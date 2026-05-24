import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const pressureValidator = v.object({
  lowSys: v.number(),
  lowDia: v.number(),
  elevatedSys: v.number(),
  high1Sys: v.number(),
  high1Dia: v.number(),
  high2Sys: v.number(),
  high2Dia: v.number(),
  high3Sys: v.number(),
  high3Dia: v.number(),
});

const pulseValidator = v.object({
  low: v.number(),
  high: v.number(),
});

const preferencesValidator = v.object({
  pressure: pressureValidator,
  pulse: pulseValidator,
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const prefs = await ctx.db
      .query("preferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    return prefs;
  },
});

export const save = mutation({
  args: {
    preferences: preferencesValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        pressure: args.preferences.pressure,
        pulse: args.preferences.pulse,
      });
    } else {
      await ctx.db.insert("preferences", {
        userId: userId as unknown as string,
        pressure: args.preferences.pressure,
        pulse: args.preferences.pulse,
      });
    }

    return { success: true };
  },
});