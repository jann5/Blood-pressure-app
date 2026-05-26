import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const armSideValidator = v.union(v.literal("left"), v.literal("right"));
const appThemeValidator = v.union(
  v.literal("midnight"),
  v.literal("sand"),
  v.literal("blush"),
  v.literal("sage"),
  v.literal("ocean"),
);
const authTablesWithoutUsers = (({ users: _users, ...rest }) => rest)(authTables);

export default defineSchema({
  ...authTablesWithoutUsers,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    dominantHand: v.optional(armSideValidator),
    preferredMeasurementArm: v.optional(armSideValidator),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  
  readings: defineTable({
    userId: v.string(),
    systolic: v.number(),
    diastolic: v.number(),
    pulse: v.number(),
    arm: v.optional(armSideValidator),
    secondArm: v.optional(v.object({
      arm: armSideValidator,
      systolic: v.number(),
      diastolic: v.number(),
      pulse: v.number(),
    })),
    timestamp: v.string(),
    note: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_timestamp", ["userId", "timestamp"]),

  preferences: defineTable({
    userId: v.string(),
    theme: v.optional(appThemeValidator),
    pressure: v.object({
      lowSys: v.number(),
      lowDia: v.number(),
      elevatedSys: v.number(),
      high1Sys: v.number(),
      high1Dia: v.number(),
      high2Sys: v.number(),
      high2Dia: v.number(),
      high3Sys: v.number(),
      high3Dia: v.number(),
    }),
    pulse: v.object({
      low: v.number(),
      high: v.number(),
    }),
  }).index("by_userId", ["userId"]),
});
