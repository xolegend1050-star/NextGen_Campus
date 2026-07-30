const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    logger.info('Email transporter configured with SMTP');
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    logger.info('Using Ethereal test email account (dev mode)');
  }

  return transporter;
}

async function sendPasswordResetEmail(email, resetToken) {
  try {
    const transport = await getTransporter();
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || '"NextGen Campus" <noreply@nextgencampus.com>',
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

    if (process.env.NODE_ENV !== 'production') {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info(`Password reset email preview: ${previewUrl}`);
    }

    logger.info(`Password reset email sent to: ${email}`);
    return true;
  } catch (error) {
    logger.error('Failed to send password reset email:', error.message);
    return false;
  }
}

async function sendVerificationEmail(email, verificationToken) {
  try {
    const transport = await getTransporter();
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || '"NextGen Campus" <noreply@nextgencampus.com>',
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

    if (process.env.NODE_ENV !== 'production') {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info(`Verification email preview: ${previewUrl}`);
    }

    logger.info(`Verification email sent to: ${email}`);
    return true;
  } catch (error) {
    logger.error('Failed to send verification email:', error.message);
    return false;
  }
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail };
