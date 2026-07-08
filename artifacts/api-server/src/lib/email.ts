/** Email notification helper — uses SMTP via nodemailer if configured, otherwise logs */

import { logger } from './logger.js';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
}

let transporterCache: import('nodemailer').Transporter | null | 'unchecked' = 'unchecked';

async function getTransporter(): Promise<import('nodemailer').Transporter | null> {
  if (transporterCache !== 'unchecked') return transporterCache;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    transporterCache = null;
    return null;
  }

  try {
    const nodemailer = await import('nodemailer');
    transporterCache = nodemailer.createTransport({
      host,
      port: port ? Number(port) : 587,
      secure: Number(port) === 465,
      auth: { user, pass },
    });
    return transporterCache;
  } catch (err) {
    logger.warn({ err }, '[email] nodemailer not available — emails will be logged only');
    transporterCache = null;
    return null;
  }
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@mesurado.ai';

  try {
    const transporter = await getTransporter();
    if (!transporter) {
      logger.info({ to: opts.to, subject: opts.subject }, '[email] SMTP not configured — email logged only');
      logger.info({ body: opts.text }, '[email] body');
      return;
    }
    await transporter.sendMail({ from, to: opts.to, subject: opts.subject, text: opts.text });
    logger.info({ to: opts.to, subject: opts.subject }, '[email] sent');
  } catch (err) {
    logger.error({ err, to: opts.to }, '[email] send failed');
  }
}

// ── Pre-built email templates ────────────────────────────────────────────────

export function emailPaymentGenerated(email: string, amountUsd: number, uniqueCode: string, ussdCode: string) {
  return sendEmail({
    to: email,
    subject: 'Mesurado AI — Payment Request Created',
    text: [
      `Your payment request for $${amountUsd} USD has been created.`,
      '',
      `Unique code: ${uniqueCode}`,
      `USSD code: ${ussdCode}`,
      '',
      'Dial the USSD code on your MTN phone, complete the payment, then return to the dashboard and submit your proof.',
      '',
      'This request expires in 24 hours.',
      '',
      '— Mesurado AI / Media Tech Liberia',
    ].join('\n'),
  });
}

export function emailProofReceived(email: string, amountUsd: number) {
  return sendEmail({
    to: email,
    subject: 'Mesurado AI — Payment Proof Received',
    text: [
      `We received your payment proof for $${amountUsd} USD.`,
      '',
      'Our team will review it shortly. You will receive a confirmation once approved.',
      '',
      '— Mesurado AI / Media Tech Liberia',
    ].join('\n'),
  });
}

export function emailPaymentApproved(email: string, amountUsd: number, tokensAdded: number) {
  return sendEmail({
    to: email,
    subject: 'Mesurado AI — Payment Approved ✓',
    text: [
      `Your payment of $${amountUsd} USD has been approved.`,
      '',
      `${tokensAdded.toLocaleString()} tokens have been added to your account.`,
      '',
      'Log in to your dashboard to start using your new balance.',
      '',
      '— Mesurado AI / Media Tech Liberia',
    ].join('\n'),
  });
}

export function emailPaymentRejected(email: string, amountUsd: number, reason: string) {
  return sendEmail({
    to: email,
    subject: 'Mesurado AI — Payment Could Not Be Verified',
    text: [
      `Your payment of $${amountUsd} USD could not be verified.`,
      '',
      `Reason: ${reason}`,
      '',
      'Please log in to your dashboard and generate a new payment request if you wish to try again.',
      '',
      '— Mesurado AI / Media Tech Liberia',
    ].join('\n'),
  });
}

export function emailPaymentExpired(email: string, amountUsd: number) {
  return sendEmail({
    to: email,
    subject: 'Mesurado AI — Payment Request Expired',
    text: [
      `Your payment request for $${amountUsd} USD has expired (24 hours elapsed).`,
      '',
      'You can generate a new payment request at any time from the Add Funds page.',
      '',
      '— Mesurado AI / Media Tech Liberia',
    ].join('\n'),
  });
}
