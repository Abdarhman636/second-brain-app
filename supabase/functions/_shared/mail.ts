/*
 * What the email functions share: the SMTP connection, the sender, and the
 * plain RTL layout every Rusookh email uses. Supabase bundles this folder
 * into each function that imports it (it isn't deployed on its own).
 *
 * Secrets (Supabase → Edge Functions → Secrets):
 *   SMTP_USER, SMTP_PASS  the sending account. For Gmail: the address and an
 *                         app password (Google account → Security → App passwords).
 *   ADMIN_EMAIL           where new payment requests go (default: SMTP_USER).
 *   APP_URL               e.g. https://rusookh.app, for links in the emails.
 *   SMTP_HOST, SMTP_PORT  optional, default smtp.gmail.com and 465.
 *   MAIL_FROM             optional sender address (default: SMTP_USER).
 */
import nodemailer from 'npm:nodemailer@6';

const SMTP_USER = Deno.env.get('SMTP_USER') ?? '';
const SMTP_PASS = Deno.env.get('SMTP_PASS') ?? '';
export const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || SMTP_USER;
export const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '');
export const MAIL_FROM = { name: 'رسوخ', address: Deno.env.get('MAIL_FROM') || SMTP_USER };

export const mailConfigured = () => Boolean(SMTP_USER && SMTP_PASS);

// Supabase blocks outgoing ports 25 and 587, so mail goes over SSL on 465.
export const transport = nodemailer.createTransport({
  host: Deno.env.get('SMTP_HOST') || 'smtp.gmail.com',
  port: Number(Deno.env.get('SMTP_PORT') || 465),
  secure: true,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** A plain RTL email: a title, a few paragraphs, an optional details table and button. */
export function layout(input: {
  title: string;
  paragraphs: string[];
  rows?: [string, string][];
  action?: { label: string; href: string };
  /** Small print under the card, e.g. how to stop an email. */
  footer?: { text: string; link?: { label: string; href: string } };
}): string {
  const rows = input.rows?.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">${input.rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:8px 0;color:#6b6b65;width:35%;border-bottom:1px solid #e6e6e4">${escapeHtml(label)}</td><td style="padding:8px 0;color:#111;border-bottom:1px solid #e6e6e4">${escapeHtml(value)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const action = input.action
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(input.action.href)}" style="display:inline-block;background:#f27b35;color:#111;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:8px">${escapeHtml(input.action.label)}</a></p>`
    : '';
  const footer = input.footer
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.7;color:#6b6b65;text-align:center">${escapeHtml(input.footer.text)}${
        input.footer.link ? ` <a href="${escapeHtml(input.footer.link.href)}" style="color:#6b6b65">${escapeHtml(input.footer.link.label)}</a>` : ''
      }</p>`
    : '';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#e6e6e4;font-family:Tahoma,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<div style="background:#f3f3f1;border-radius:12px;padding:24px;text-align:right" dir="rtl">
<p style="margin:0 0 16px;font-weight:700;color:#b4500f">رسوخ</p>
<h1 style="margin:0 0 12px;font-size:20px;color:#111">${escapeHtml(input.title)}</h1>
${input.paragraphs.map((text) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:#333">${escapeHtml(text)}</p>`).join('')}
${rows}${action}
</div>${footer}</div></body></html>`;
}
