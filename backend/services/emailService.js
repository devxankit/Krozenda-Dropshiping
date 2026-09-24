// Transactional email over SMTP (Nodemailer). Used for the vendor onboarding
// lifecycle: application received, account approved, application rejected and
// individual KYC documents rejected.
//
// Nothing in here ever throws to a caller: a registration or an admin review
// must never fail, or be rolled back, because an email could not go out.
// Callers fire and forget (no await needed); failures are only logged.
const nodemailer = require('nodemailer');

const BRAND = 'Krozenda';

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Tests load the real .env, so they must never reach the SMTP server;
// everywhere else sending is opt-in through EMAIL_ENABLED.
function isEnabled() {
  return process.env.EMAIL_ENABLED === 'true' && process.env.ENV !== 'test' && isConfigured();
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 is implicit TLS; 587/25 upgrade with STARTTLS.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// B2B vendors sign in on the dropshipping-partner panel, B2C on the seller one.
function panelUrl(vendor, path) {
  const base = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (!base) return null;
  const root = vendor.vendorType === 'B2B' ? '/partner' : '/seller';
  return `${base}${root}${path}`;
}

function layout({ heading, paragraphs, list, button }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p}</p>`).join('');
  const items = list?.length
    ? `<ul style="margin:0 0 16px;padding-left:20px;line-height:1.6">${list.map((i) => `<li>${i}</li>`).join('')}</ul>`
    : '';
  const cta = button?.url
    ? `<p style="margin:22px 0"><a href="${escapeHtml(button.url)}" style="background:#111827;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(button.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border-radius:8px;padding:28px 24px">
<h2 style="margin:0 0 18px;font-size:20px">${heading}</h2>
${body}${items}${cta}
<p style="margin:24px 0 0;color:#6b7280;font-size:13px">Team ${BRAND}</p>
</div>
<p style="text-align:center;color:#9ca3af;font-size:12px;margin:14px 0 0">This is an automated message, please do not reply.</p>
</div></body></html>`;
}

async function sendMail({ to, subject, html, text }) {
  if (!to) return { sent: false, reason: 'no-recipient' };
  if (!isEnabled()) return { sent: false, reason: 'disabled' };
  try {
    const from = process.env.EMAIL_FROM || `${BRAND} <${process.env.SMTP_USER}>`;
    const info = await getTransporter().sendMail({ from, to, subject, html, text });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`Email "${subject}" to ${to} failed:`, err.message);
    return { sent: false, reason: 'error' };
  }
}

// Registration (or a resubmission after rejection) has landed in the KYC queue.
function sendVendorRegistrationReceived(vendor) {
  const name = escapeHtml(vendor.name);
  return sendMail({
    to: vendor.email,
    subject: `${BRAND}: registration successful, your account is under review`,
    text: `Hi ${vendor.name},\n\nYou have registered successfully on ${BRAND}. Your account and documents are now under review by our team. We will email you as soon as your account is activated, or if anything in your documents needs to be fixed.\n\nTeam ${BRAND}`,
    html: layout({
      heading: 'Registration successful',
      paragraphs: [
        `Hi ${name},`,
        `Thank you for registering on ${BRAND}. Your account and documents are now <strong>under review</strong> by our team.`,
        'We will email you as soon as your account is activated, or if anything in your documents needs to be fixed. You will be able to log in once your account is approved.',
      ],
    }),
  });
}

function sendVendorAccountApproved(vendor) {
  const name = escapeHtml(vendor.name);
  const loginUrl = panelUrl(vendor, '/login');
  return sendMail({
    to: vendor.email,
    subject: `${BRAND}: your account is now active`,
    text: `Hi ${vendor.name},\n\nCongratulations! Your ${BRAND} account has been approved and is now active. You can log in and start selling.${loginUrl ? `\n\nLog in: ${loginUrl}` : ''}\n\nTeam ${BRAND}`,
    html: layout({
      heading: 'Your account is active',
      paragraphs: [
        `Hi ${name},`,
        `Congratulations! Your ${BRAND} account has been <strong>approved and activated</strong>.`,
        'You can now log in to your dashboard, list your products and start selling.',
      ],
      button: loginUrl ? { label: 'Log in', url: loginUrl } : null,
    }),
  });
}

function sendVendorApplicationRejected(vendor, reason) {
  const name = escapeHtml(vendor.name);
  const docsUrl = panelUrl(vendor, '/kyc-documents');
  return sendMail({
    to: vendor.email,
    subject: `${BRAND}: action needed on your seller application`,
    text: `Hi ${vendor.name},\n\nWe could not approve your ${BRAND} account yet.\n\nReason: ${reason}\n\nPlease update your details/documents and resubmit for review.${docsUrl ? `\n\n${docsUrl}` : ''}\n\nTeam ${BRAND}`,
    html: layout({
      heading: 'Action needed on your application',
      paragraphs: [
        `Hi ${name},`,
        `We could not approve your ${BRAND} account yet. Our team found the following issue:`,
        `<strong>${escapeHtml(reason)}</strong>`,
        'Please update your details or documents and resubmit your application for review.',
      ],
      button: docsUrl ? { label: 'Update documents', url: docsUrl } : null,
    }),
  });
}

function sendVendorDocumentRejected(vendor, doc) {
  const name = escapeHtml(vendor.name);
  const docName = doc.documentLabel || String(doc.documentType || 'Document').replace(/_/g, ' ');
  const docsUrl = panelUrl(vendor, '/kyc-documents');
  return sendMail({
    to: vendor.email,
    subject: `${BRAND}: issue with your ${docName}`,
    text: `Hi ${vendor.name},\n\nThere is an issue with a document you submitted.\n\nDocument: ${docName}\nReason: ${doc.rejectionReason}\n\nPlease upload a corrected document so we can continue reviewing your account.${docsUrl ? `\n\n${docsUrl}` : ''}\n\nTeam ${BRAND}`,
    html: layout({
      heading: 'Issue with your document',
      paragraphs: [
        `Hi ${name},`,
        'There is an issue with a document you submitted for verification:',
      ],
      list: [
        `<strong>Document:</strong> ${escapeHtml(docName)}`,
        `<strong>Reason:</strong> ${escapeHtml(doc.rejectionReason)}`,
      ],
      button: docsUrl ? { label: 'Upload corrected document', url: docsUrl } : null,
    }),
  });
}

module.exports = {
  isEnabled,
  sendMail,
  sendVendorRegistrationReceived,
  sendVendorAccountApproved,
  sendVendorApplicationRejected,
  sendVendorDocumentRejected,
};
