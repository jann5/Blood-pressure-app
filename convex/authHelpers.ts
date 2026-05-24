import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // Get user data from auth tables
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    // Get user readings
    const readings = await ctx.db
      .query("readings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Get user preferences
    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    return {
      _id: user._id,
      email: user.email,
      name: user.name || "Użytkownik",
      loginCount: 1,
      readings,
      preferences,
    };
  },
});