import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  
  readings: defineTable({
    userId: v.string(),
    systolic: v.number(),
    diastolic: v.number(),
    pulse: v.number(),
    timestamp: v.string(),
    note: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_timestamp", ["userId", "timestamp"]),

  preferences: defineTable({
    userId: v.string(),
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
