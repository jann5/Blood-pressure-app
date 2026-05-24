"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

export const sendLoginEmail = action({
  args: {
    email: v.string(),
    loginUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const { error } = await resend.emails.send({
      from: process.env.FROM_EMAIL ?? "onboarding@resend.dev",
      to: args.email,
      subject: "Zaloguj się do Ciśnieniomierza",
      html: `
        <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="margin: 0 0 16px; color: #333;">Link logowania</h2>
          <p style="margin: 0 0 16px; color: #666;">Kliknij poniższy przycisk, aby się zalogować:</p>
          <a href="${args.loginUrl}" style="display: inline-block; padding: 12px 24px; background: #0A84FF; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Zaloguj się</a>
          <p style="margin: 16px 0 0; color: #999; font-size: 12px;">Link wygasa za 1 godzinę.</p>
        </div>
      `,
    });

    if (error) {
      throw new Error(`Nie udało się wysłać emaila: ${error.message}`);
    }

    return { success: true };
  },
});