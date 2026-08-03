const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

function getClient() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    logger.error('SENDGRID_API_KEY not set — emails will NOT be sent');
    return null;
  }
  sgMail.setApiKey(apiKey);
  return sgMail;
}

async function sendPasswordResetEmail(email, resetToken) {
  const client = getClient();
  if (!client) return false;

  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const fromEmail = process.env.EMAIL_FROM || 'NextGen Campus <noreply@nextgencampus.com>';

    await client.send({
      from: fromEmail,
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

    logger.info(`Password reset email sent to: ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send password reset email to ${email}:`, error.message);
    return false;
  }
}

async function sendVerificationEmail(email, verificationToken) {
  const client = getClient();
  if (!client) return false;

  try {
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    const fromEmail = process.env.EMAIL_FROM || 'NextGen Campus <noreply@nextgencampus.com>';

    await client.send({
      from: fromEmail,
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

    logger.info(`Verification email sent to: ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send verification email to ${email}:`, error.message);
    return false;
  }
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail };
