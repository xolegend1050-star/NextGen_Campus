const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

const fromEmail = process.env.EMAIL_FROM || 'NextGen Campus <noreply@nextgencampus.com>';

function getClient() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error(
      'SENDGRID_API_KEY is not set on this service, so no email can be sent. ' +
      'Add it in Render under Environment, or password reset will silently do nothing.'
    );
  }
  sgMail.setApiKey(apiKey);
  return sgMail;
}

/**
 * SendGrid reports why a message was refused in the response body, not in the
 * error message. "sender not verified" is the usual one, and losing it is what
 * made this failure take so long to diagnose, so it is logged in full.
 */
function describeSendGridError(error) {
  const body = error && error.response && error.response.body;
  if (body && body.errors && body.errors.length) {
    return body.errors.map((e) => `${e.message}${e.field ? ' (' + e.field + ')' : ''}`).join('; ');
  }
  return error.message || String(error);
}

async function sendPasswordResetEmail(email, resetToken) {
  // getClient throws when the key is absent, and the send below throws when
  // SendGrid refuses. Callers used to be handed a plain `false` here and report
  // success anyway, which is why thirty-eight reset requests had gone out with
  // no email and nobody knew.
  const client = getClient();

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  try {
    await client.send({
      from: fromEmail,
      to: email,
      subject: 'Password Reset Request - NextGen Campus',
      // SendGrid rewrites links to go through sendgrid.net/ls/click so it can
      // report opens and clicks. Gmail then wraps that in a Safe Browsing
      // interstitial, and the interstitial rendered as a blank page, so clicking
      // "Reset Password" appeared to do nothing at all. The reset link is a
      // single-use secret token, so there is nothing worth tracking in it.
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false }
      },
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
    const reason = describeSendGridError(error);
    logger.error(`Failed to send password reset email to ${email}: ${reason}`);
    const wrapped = new Error('Email could not be sent: ' + reason);
    wrapped.cause = error;
    throw wrapped;
  }
}

async function sendVerificationEmail(email, verificationToken) {
  const client = getClient();
  if (!client) return false;

  try {
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

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

async function sendVerificationSubmittedEmail(email, verificationType, userName) {
  const client = getClient();
  if (!client) return false;

  try {
    const typeLabel = verificationType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    await client.send({
      from: fromEmail,
      to: email,
      subject: `Verification Request Received - ${typeLabel} - NextGen Campus`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4f46e5;">Verification Request Received</h2>
          <p>Hi ${userName || 'there'},</p>
          <p>We've received your <strong>${typeLabel}</strong> verification request. Our team will review it shortly.</p>
          <p>You'll receive an email once your verification has been approved or rejected.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">NextGen Campus - Connecting Students with Mentors</p>
        </div>
      `
    });

    logger.info(`Verification submitted email sent to: ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send verification submitted email to ${email}:`, error.message);
    return false;
  }
}

async function sendVerificationApprovedEmail(email, verificationType, userName) {
  const client = getClient();
  if (!client) return false;

  try {
    const typeLabel = verificationType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    await client.send({
      from: fromEmail,
      to: email,
      subject: `Verification Approved - ${typeLabel} - NextGen Campus`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">Verification Approved!</h2>
          <p>Hi ${userName || 'there'},</p>
          <p>Your <strong>${typeLabel}</strong> verification has been approved.</p>
          <p>You've earned a verification badge and your trust score has been updated.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/profile" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">View Profile</a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">NextGen Campus - Connecting Students with Mentors</p>
        </div>
      `
    });

    logger.info(`Verification approved email sent to: ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send verification approved email to ${email}:`, error.message);
    return false;
  }
}

async function sendVerificationRejectedEmail(email, verificationType, userName, reason) {
  const client = getClient();
  if (!client) return false;

  try {
    const typeLabel = verificationType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    await client.send({
      from: fromEmail,
      to: email,
      subject: `Verification Rejected - ${typeLabel} - NextGen Campus`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #ef4444;">Verification Rejected</h2>
          <p>Hi ${userName || 'there'},</p>
          <p>Your <strong>${typeLabel}</strong> verification has been rejected.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          <p>You can submit a new verification request after addressing the issue.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/verification" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Try Again</a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">NextGen Campus - Connecting Students with Mentors</p>
        </div>
      `
    });

    logger.info(`Verification rejected email sent to: ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send verification rejected email to ${email}:`, error.message);
    return false;
  }
}

async function sendOtpEmail(email, otpCode) {
  const client = getClient();
  if (!client) return false;

  try {
    await client.send({
      from: fromEmail,
      to: email,
      subject: 'Your Login OTP - NextGen Campus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4f46e5;">Login Verification</h2>
          <p>Your One-Time Password (OTP) for login is:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${otpCode}</span>
          </div>
          <p style="color: #666; font-size: 14px;">This OTP expires in 5 minutes. Do not share it with anyone.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">NextGen Campus - Connecting Students with Mentors</p>
        </div>
      `
    });

    logger.info(`OTP email sent to: ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send OTP email to ${email}:`, error.message);
    return false;
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendVerificationSubmittedEmail,
  sendVerificationApprovedEmail,
  sendVerificationRejectedEmail,
  sendOtpEmail
};
