import nodemailer from "nodemailer";
import { envConfig } from "../../config/env";
import { logger } from "../logger";

type MailOptions = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

// Lazily-created singleton transport. SMTP settings are optional — when they
// are not configured (e.g. local dev), sendEmail logs the message instead of
// throwing, so features that email never break the request they run in.
let transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter | null => {
  if (!envConfig.SMTP_HOST || !envConfig.SMTP_USER || !envConfig.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: envConfig.SMTP_HOST,
      port: envConfig.SMTP_PORT ?? 587,
      secure: (envConfig.SMTP_PORT ?? 587) === 465,
      auth: { user: envConfig.SMTP_USER, pass: envConfig.SMTP_PASS },
    });
  }
  return transporter;
};

export const sendEmail = async (options: MailOptions): Promise<boolean> => {
  const transport = getTransporter();
  if (!transport) {
    logger.info(
      { to: options.to, subject: options.subject },
      "SMTP not configured — email skipped (logged only)"
    );
    return false;
  }

  try {
    await transport.sendMail({
      from: envConfig.SMTP_FROM ?? envConfig.SMTP_USER,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      text: options.text,
      ...(options.html ? { html: options.html } : {}),
    });
    return true;
  } catch (err) {
    // Email failures must never fail the API request that triggered them.
    logger.error({ err, to: options.to, subject: options.subject }, "Failed to send email");
    return false;
  }
};
