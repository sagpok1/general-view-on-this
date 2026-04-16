const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let transporter = null;

if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });

  // Verify connection on startup
  transporter.verify((err) => {
    if (err) {
      console.error('Mailer connection error:', err.message);
    } else {
      console.log('Mailer is ready to send emails.');
    }
  });
} else {
  console.warn(
    'Warning: EMAIL_USER and/or EMAIL_PASS not set. ' +
    'Emails will be logged to console instead of being sent. ' +
    'Set EMAIL_USER and EMAIL_PASS in your environment to enable email delivery.'
  );
}

/**
 * Send an email. Falls back to console logging if SMTP is not configured.
 * @param {Object} mailOptions - { to, subject, html, text }
 * @returns {Promise<Object>} - Nodemailer info object or console log confirmation
 */
async function sendMail(mailOptions) {
  const options = {
    from: EMAIL_USER || 'noreply@generalviewonthis.com',
    ...mailOptions
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(options);
      console.log(`Email sent to ${options.to}: ${info.messageId}`);
      return info;
    } catch (err) {
      console.error(`Failed to send email to ${options.to}:`, err.message);
      throw err;
    }
  }

  // No-op fallback: log the email to console
  console.log('--- EMAIL (not sent, no SMTP configured) ---');
  console.log(`To: ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  console.log(`Body: ${options.html || options.text}`);
  console.log('--- END EMAIL ---');
  return { messageId: 'console-log', accepted: [options.to] };
}

/**
 * Send a verification email with a token link.
 * @param {Object} user - User object with at least { email, name }
 * @param {string} token - Verification token
 * @returns {Promise<Object>}
 */
async function sendVerificationEmail(user, token) {
  const verificationUrl = `${BASE_URL}/auth/verify?token=${encodeURIComponent(token)}`;

  return sendMail({
    to: user.email,
    subject: 'Verify your General View On This account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c3e50;">Welcome to General View On This!</h2>
        <p>Hi ${user.name},</p>
        <p>Thank you for signing up. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}"
             style="background-color: #3498db; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
            Verify Email
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #7f8c8d;">${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 20px 0;" />
        <p style="color: #95a5a6; font-size: 12px;">
          If you did not create a General View On This account, you can safely ignore this email.
        </p>
      </div>
    `,
    text: `Hi ${user.name},\n\nWelcome to General View On This! Please verify your email by visiting:\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you did not create a General View On This account, you can safely ignore this email.`
  });
}

module.exports = { sendMail, sendVerificationEmail };
