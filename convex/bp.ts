import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

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

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const makeCode = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

export const storeLoginCode = internalMutation({
  args: {
    email: v.string(),
    code: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("loginCodes", {
      email: args.email,
      code: args.code,
      createdAt: args.createdAt,
      expiresAt: args.expiresAt,
      used: false,
    });
  },
});

export const sendLoginCode = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email || !email.includes("@")) {
      throw new Error("Podaj poprawny adres e-mail.");
    }

    const now = Date.now();
    const code = makeCode();
    const expiresAt = now + 10 * 60 * 1000;

    await ctx.runMutation(internal.bp.storeLoginCode, {
      email,
      code,
      createdAt: now,
      expiresAt,
    });

    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const appName = process.env.APP_NAME ?? "Ciśnieniomierz";
    if (!resendApiKey || !from) {
      return { expiresAt, devCode: code };
    }

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5;">
        <h2 style="margin: 0 0 12px;">Kod logowania do ${appName}</h2>
        <p style="margin: 0 0 12px;">Twój jednorazowy kod to:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 0 0 16px;">${code}</p>
        <p style="margin: 0; color: #666;">Kod wygasa za 10 minut.</p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Kod logowania – ${appName}`,
        html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Nie udało się wysłać e-maila (${response.status}): ${body}`);
    }

    return { expiresAt };
  },
});

export const verifyLoginCode = mutation({
  args: {
    email: v.string(),
    code: v.string(),
    name: v.optional(v.string()),
    age: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const now = Date.now();
    const cleanCode = args.code.trim();

    const codes = await ctx.db
      .query("loginCodes")
      .withIndex("by_email_createdAt", (q) => q.eq("email", email))
      .collect();

    const latestValid = codes
      .filter((item) => !item.used && item.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!latestValid || latestValid.code !== cleanCode) {
      throw new Error("Nieprawidłowy lub wygasły kod.");
    }

    await ctx.db.patch(latestValid._id, { used: true });

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    const nextName =
      args.name?.trim() ||
      existingUser?.name ||
      email.split("@")[0] ||
      "Użytkownik";
    const nextAge = typeof args.age === "number" && Number.isFinite(args.age)
      ? Math.round(args.age)
      : existingUser?.age;

    let userId = existingUser?._id;
    let isReturning = false;
    let loginCount = 1;

    if (existingUser) {
      isReturning = true;
      loginCount = (existingUser.loginCount ?? 1) + 1;
      await ctx.db.patch(existingUser._id, {
        name: nextName,
        age: nextAge,
        lastLoginAt: now,
        loginCount,
      });
    } else {
      userId = await ctx.db.insert("users", {
        email,
        name: nextName,
        age: nextAge,
        createdAt: now,
        lastLoginAt: now,
        loginCount,
      });
    }

    if (!userId) throw new Error("Nie udało się utworzyć konta.");

    return {
      user: {
        id: userId,
        email,
        name: nextName,
        age: nextAge,
      },
      isReturning,
      loginCount,
    };
  },
});

export const getUserState = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const readings = await ctx.db
      .query("readings")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", args.userId))
      .collect();

    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return {
      readings,
      preferences: preferences
        ? {
            pressure: preferences.pressure,
            pulse: preferences.pulse,
          }
        : null,
    };
  },
});

export const savePreferences = mutation({
  args: {
    userId: v.id("users"),
    preferences: v.object({
      pressure: pressureValidator,
      pulse: pulseValidator,
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        pressure: args.preferences.pressure,
        pulse: args.preferences.pulse,
      });
      return existing._id;
    }

    return await ctx.db.insert("preferences", {
      userId: args.userId,
      pressure: args.preferences.pressure,
      pulse: args.preferences.pulse,
    });
  },
});

export const addReading = mutation({
  args: {
    userId: v.id("users"),
    reading: v.object({
      systolic: v.number(),
      diastolic: v.number(),
      pulse: v.number(),
      timestamp: v.string(),
      note: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("readings", {
      userId: args.userId,
      systolic: args.reading.systolic,
      diastolic: args.reading.diastolic,
      pulse: args.reading.pulse,
      timestamp: args.reading.timestamp,
      note: args.reading.note,
    });

    const saved = await ctx.db.get(id);
    if (!saved) throw new Error("Nie udało się zapisać pomiaru.");
    return saved;
  },
});

export const deleteReading = mutation({
  args: {
    userId: v.id("users"),
    readingId: v.id("readings"),
  },
  handler: async (ctx, args) => {
    const reading = await ctx.db.get(args.readingId);
    if (!reading || reading.userId !== args.userId) return;
    await ctx.db.delete(args.readingId);
  },
});
