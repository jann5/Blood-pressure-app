import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    age: v.optional(v.number()),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
    loginCount: v.number(),
  }).index("by_email", ["email"]),

  loginCodes: defineTable({
    email: v.string(),
    code: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index("by_email_createdAt", ["email", "createdAt"]),

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
