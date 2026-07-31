const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

function createTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  logger.info(`Email config — host: ${smtpHost || 'NOT SET'}, port: ${smtpPort || 'NOT SET'}, user: ${smtpUser || 'NOT SET'}, pass: ${smtpPass ? '***' : 'NOT SET'}`);

  if (!smtpHost || !smtpUser || !smtpPass) {
    logger.warn('SMTP env vars not configured — emails will NOT be sent');
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort) || 587,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
}

async function sendPasswordResetEmail(email, resetToken) {
  const transport = createTransporter();
  if (!transport) {
    logger.error('Cannot send password reset email — SMTP not configured');
    return false;
  }

  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Password Reset Request - NextGen Campus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4f46e5;">Password Reset Request</h2>
          <p>You requested a password reset for your NextGen Campus account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">NextGen Campus - Connecting Students with Mentors</p>
        </div>
      `
    });

    logger.info(`Password reset email sent to: ${email}, messageId: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send password reset email to ${email}:`, error.message);
    return false;
  }
}

async function sendVerificationEmail(email, verificationToken) {
  const transport = createTransporter();
  if (!transport) {
    logger.error('Cannot send verification email — SMTP not configured');
    return false;
  }

  try {
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Verify Your Email - NextGen Campus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4f46e5;">Welcome to NextGen Campus!</h2>
          <p>Please verify your email address to get started.</p>
          <a href="${verifyUrl}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Verify Email</a>
          <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
        </div>
      `
    });

    logger.info(`Verification email sent to: ${email}, messageId: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send verification email to ${email}:`, error.message);
    return false;
  }
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail };
