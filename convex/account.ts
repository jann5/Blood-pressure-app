import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import {
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const oppositeArm = (hand: "left" | "right"): "left" | "right" =>
  hand === "left" ? "right" : "left";

export const currentUserEmail = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user || !user.email) {
      return null;
    }
    return normalizeEmail(user.email);
  },
});

export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const currentPassword = args.currentPassword.trim();
    const newPassword = args.newPassword.trim();
    if (!currentPassword || !newPassword) {
      throw new Error("Missing password");
    }
    if (newPassword.length < 8) {
      throw new Error("Invalid password");
    }
    if (currentPassword === newPassword) {
      throw new Error("Password must be different");
    }

    const email: string | null = await ctx.runQuery(api.account.currentUserEmail, {});
    if (!email) {
      throw new Error("Account email missing");
    }

    await retrieveAccount(ctx, {
      provider: "password",
      account: { id: email, secret: currentPassword },
    });

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: newPassword },
    });

    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId,
      except: sessionId ? [sessionId] : undefined,
    });

    return { success: true };
  },
});

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userIdString = userId as unknown as string;

    while (true) {
      const readingBatch = await ctx.db
        .query("readings")
        .withIndex("by_userId", (q) => q.eq("userId", userIdString))
        .take(100);
      if (readingBatch.length === 0) break;
      for (const reading of readingBatch) {
        await ctx.db.delete(reading._id);
      }
    }

    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_userId", (q) => q.eq("userId", userIdString))
      .unique();
    if (preferences) {
      await ctx.db.delete(preferences._id);
    }

    while (true) {
      const sessionBatch = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .take(100);
      if (sessionBatch.length === 0) break;

      for (const session of sessionBatch) {
        while (true) {
          const refreshTokenBatch = await ctx.db
            .query("authRefreshTokens")
            .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
            .take(100);
          if (refreshTokenBatch.length === 0) break;
          for (const token of refreshTokenBatch) {
            await ctx.db.delete(token._id);
          }
        }
        await ctx.db.delete(session._id);
      }
    }

    while (true) {
      const accountBatch = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .take(100);
      if (accountBatch.length === 0) break;

      for (const account of accountBatch) {
        while (true) {
          const verificationCodeBatch = await ctx.db
            .query("authVerificationCodes")
            .withIndex("accountId", (q) => q.eq("accountId", account._id))
            .take(100);
          if (verificationCodeBatch.length === 0) break;
          for (const verification of verificationCodeBatch) {
            await ctx.db.delete(verification._id);
          }
        }

        await ctx.db.delete(account._id);
      }
    }

    await ctx.db.delete(userId);
    return { success: true };
  },
});

export const setDominantHand = mutation({
  args: {
    dominantHand: v.union(v.literal("left"), v.literal("right")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(userId, {
      dominantHand: args.dominantHand,
      preferredMeasurementArm: oppositeArm(args.dominantHand),
    });

    return { success: true };
  },
});
