import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type VerificationPurpose = "verify-email" | "password-reset";

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
  purpose = "verify-email",
}: {
  identifier: string;
  token: string;
  purpose?: VerificationPurpose;
}) => {
  const mailBridgeUrl = process.env.MAIL_BRIDGE_URL;
  const mailBridgeToken = process.env.MAIL_BRIDGE_TOKEN;
  if (!mailBridgeUrl || !mailBridgeToken) {
    throw new Error("Brak konfiguracji MAIL_BRIDGE_URL / MAIL_BRIDGE_TOKEN.");
  }

  const to = validateEmail(identifier);
  const response = await fetch(mailBridgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mail-bridge-token": mailBridgeToken,
    },
    body: JSON.stringify({ to, token, purpose }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Nie udało się wysłać emaila przez SMTP bridge: ${payload}`);
  }
};

const createOtpEmailProvider = (id: string, purpose: VerificationPurpose) =>
  Email({
    id,
    maxAge: 10 * 60,
    async generateVerificationToken() {
      return String(Math.floor(100000 + Math.random() * 900000));
    },
    async sendVerificationRequest({ identifier, token }) {
      await sendVerificationEmail({ identifier, token, purpose });
    },
  });

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      verify: createOtpEmailProvider("email-verification", "verify-email"),
      reset: createOtpEmailProvider("password-reset", "password-reset"),
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
