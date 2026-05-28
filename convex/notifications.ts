import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";

const DEFAULT_REMINDER_HOUR = 20;
const DEFAULT_REMINDER_MINUTE = 0;
const DEFAULT_TIMEZONE = "UTC";
const MAX_REMINDER_SCAN = 400;

const pushSubscriptionValidator = v.object({
  endpoint: v.string(),
  expirationTime: v.union(v.number(), v.null()),
  keys: v.object({
    p256dh: v.string(),
    auth: v.string(),
  }),
});

type PushSubscriptionRecord = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

const normalizeReminderHour = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_REMINDER_HOUR;
  const rounded = Math.trunc(value);
  return Math.min(23, Math.max(0, rounded));
};

const normalizeReminderMinute = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_REMINDER_MINUTE;
  const rounded = Math.trunc(value);
  return Math.min(59, Math.max(0, rounded));
};

const normalizeTimezone = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

const getLocalClock = (timestampMs: number, timezone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(timestampMs));
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const year = read("year");
  const month = read("month");
  const day = read("day");
  const hour = Number(read("hour"));
  const minute = Number(read("minute"));

  if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return {
      localDate: new Date(timestampMs).toISOString().slice(0, 10),
      hour: new Date(timestampMs).getUTCHours(),
      minute: new Date(timestampMs).getUTCMinutes(),
    };
  }

  return {
    localDate: `${year}-${month}-${day}`,
    hour,
    minute,
  };
};

const defaultNotificationSettings = {
  enabled: false,
  reminderHour: DEFAULT_REMINDER_HOUR,
  reminderMinute: DEFAULT_REMINDER_MINUTE,
  timezone: DEFAULT_TIMEZONE,
  hasSubscription: false,
} as const;

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return defaultNotificationSettings;
    }

    const row = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!row) {
      return defaultNotificationSettings;
    }

    return {
      enabled: row.enabled,
      reminderHour: row.reminderHour,
      reminderMinute: row.reminderMinute,
      timezone: row.timezone,
      hasSubscription: row.subscription !== null,
    };
  },
});

export const saveSettings = mutation({
  args: {
    enabled: v.boolean(),
    reminderHour: v.number(),
    reminderMinute: v.number(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const normalized = {
      enabled: args.enabled,
      reminderHour: normalizeReminderHour(args.reminderHour),
      reminderMinute: normalizeReminderMinute(args.reminderMinute),
      timezone: normalizeTimezone(args.timezone),
    };

    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, normalized);
      return { success: true };
    }

    await ctx.db.insert("notificationPreferences", {
      userId: userId as unknown as string,
      ...normalized,
      subscription: null,
    });

    return { success: true };
  },
});

export const saveSubscription = mutation({
  args: {
    subscription: v.union(pushSubscriptionValidator, v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        subscription: args.subscription,
      });
      return { success: true };
    }

    await ctx.db.insert("notificationPreferences", {
      userId: userId as unknown as string,
      enabled: false,
      reminderHour: DEFAULT_REMINDER_HOUR,
      reminderMinute: DEFAULT_REMINDER_MINUTE,
      timezone: DEFAULT_TIMEZONE,
      subscription: args.subscription,
    });

    return { success: true };
  },
});

export const dispatchDueReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();
    const rows = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .take(MAX_REMINDER_SCAN);

    for (const row of rows) {
      if (row.subscription === null) continue;

      const clock = getLocalClock(nowMs, normalizeTimezone(row.timezone));
      if (clock.hour !== row.reminderHour || clock.minute !== row.reminderMinute) {
        continue;
      }
      if (row.lastSentLocalDate === clock.localDate) {
        continue;
      }

      await ctx.scheduler.runAfter(0, internal.notificationsNode.sendReminder, {
        subscription: row.subscription as PushSubscriptionRecord,
      });

      await ctx.db.patch(row._id, {
        lastSentLocalDate: clock.localDate,
      });
    }

    return null;
  },
});
