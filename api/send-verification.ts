import nodemailer from "nodemailer";

const unauthorized = (res: any) => {
  res.status(401).json({ error: "unauthorized" });
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const expectedToken = process.env.MAIL_BRIDGE_TOKEN;
  const receivedToken = req.headers["x-mail-bridge-token"];
  if (!expectedToken || receivedToken !== expectedToken) {
    unauthorized(res);
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";

  if (!to || !token) {
    res.status(400).json({ error: "missing_fields" });
    return;
  }

  const smtpHost = process.env.SMTP_HOST ?? "mail.auralasu.pl";
  const smtpPort = Number(process.env.SMTP_PORT ?? "465");
  const smtpUser = process.env.SMTP_USER ?? "test@auralasu.pl";
  const smtpPass = process.env.SMTP_PASS;
  const smtpSecure = String(process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false";
  const from = process.env.SMTP_FROM_EMAIL ?? smtpUser;

  if (!smtpPass) {
    res.status(500).json({ error: "smtp_pass_missing" });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `Ciśnieniomierz <${from}>`,
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
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "smtp_send_failed", message });
  }
}
