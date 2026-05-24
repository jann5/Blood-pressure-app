import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const validateEmail = (rawEmail: string): string => {
  const email = normalizeEmail(rawEmail);

  if (!emailPattern.test(email)) {
    throw new Error("Podaj poprawny adres e-mail.");
  }

  return email;
};

const sendVerificationEmail = async ({
  identifier,
  token,
}: {
  identifier: string;
  token: string;
}) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error("Brak konfiguracji wysyłki emaila.");
  }

  const to = validateEmail(identifier);
  const from = process.env.FROM_EMAIL ?? "Ciśnieniomierz <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Kod potwierdzający do Ciśnieniomierza",
      html: `
        <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 16px;">
          <h2 style="margin: 0 0 12px; color: #111;">Potwierdź adres e-mail</h2>
          <p style="margin: 0 0 12px; color: #444;">Użyj poniższego kodu, aby potwierdzić e-mail i zakończyć logowanie:</p>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 0.18em; padding: 10px 14px; border: 1px solid #ddd; border-radius: 10px; display: inline-block;">
            ${token}
          </div>
          <p style="margin: 12px 0 0; color: #777; font-size: 12px;">Jeśli to nie Ty, zignoruj tę wiadomość.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Nie udało się wysłać emaila: ${payload}`);
  }
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      verify: Email({
        id: "email-verification",
        maxAge: 10 * 60,
        async generateVerificationToken() {
          return String(Math.floor(100000 + Math.random() * 900000));
        },
        async sendVerificationRequest({ identifier, token }) {
          await sendVerificationEmail({ identifier, token });
        },
      }),
      profile(params) {
        if (typeof params.email !== "string") {
          throw new Error("Podaj poprawny adres e-mail.");
        }

        const email = validateEmail(params.email);
        const rawName = typeof params.name === "string" ? params.name.trim() : "";

        return {
          email,
          name: rawName || email.split("@")[0] || "Użytkownik",
        };
      },
    }),
  ],
});
