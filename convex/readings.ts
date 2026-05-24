import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const readings = await ctx.db
      .query("readings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return readings;
  },
});

export const add = mutation({
  args: {
    systolic: v.number(),
    diastolic: v.number(),
    pulse: v.number(),
    timestamp: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const reading = await ctx.db.insert("readings", {
      userId: userId as unknown as string,
      systolic: args.systolic,
      diastolic: args.diastolic,
      pulse: args.pulse,
      timestamp: args.timestamp,
      note: args.note,
    });

    return reading;
  },
});

export const remove = mutation({
  args: {
    id: v.id("readings"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const reading = await ctx.db.get(args.id);
    if (!reading || reading.userId !== userId) {
      throw new Error("Reading not found or access denied");
    }

    await ctx.db.delete(args.id);
  },
});
