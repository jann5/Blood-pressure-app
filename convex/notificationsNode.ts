"use node";

import webpush from "web-push";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const pushSubscriptionValidator = v.object({
  endpoint: v.string(),
  expirationTime: v.union(v.number(), v.null()),
  keys: v.object({
    p256dh: v.string(),
    auth: v.string(),
  }),
});

let vapidConfigured = false;

const configureVapid = () => {
  if (vapidConfigured) return;

  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT ?? "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    throw new Error("Brak WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY w środowisku Convex.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
};

export const sendReminder = internalAction({
  args: {
    subscription: pushSubscriptionValidator,
  },
  handler: async (_ctx, args) => {
    configureVapid();

    const payload = JSON.stringify({
      title: "Przypomnienie",
      body: "Czas zmierzyć puls.",
      tag: "daily-pulse-reminder",
      url: "/",
    });

    await webpush.sendNotification(args.subscription, payload, {
      TTL: 120,
      urgency: "normal",
      topic: "pulse-reminder",
    });

    return null;
  },
});
