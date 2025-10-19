const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    throw new Error('Email credentials not configured');
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Send verification email
exports.sendVerificationEmail = async (email, name, verificationToken) => {
  const transporter = createTransporter();
  
  // Create both HTTP and deep link URLs
  const httpURL = `http://192.168.1.11:5000/api/auth/verify-email/${verificationToken}`;
  const expoGoURL = `exp://192.168.1.11:8081/--/verify-email?token=${verificationToken}`;
  const customSchemeURL = `iyaya://verify-email?token=${verificationToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Verify Your iYaya Account',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your iYaya Account</title>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f9f9f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <tr>
      <td style="padding: 40px 30px; text-align: center;">
        <h2 style="color: #db2777; margin: 0 0 20px 0;">Welcome to iYaya!</h2>
        <p style="margin: 0 0 15px 0; color: #333;">Hi ${name},</p>
        <p style="margin: 0 0 30px 0; color: #666; line-height: 1.5;">Thank you for creating an account with iYaya. Please click the button below to verify your email address and activate your account:</p>
        
        <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background-color: #db2777; border-radius: 8px;">
              <a href="${httpURL}" style="display: block; padding: 15px 30px; color: white; text-decoration: none; font-weight: bold; font-size: 16px;">Verify Email Address</a>
            </td>
          </tr>
        </table>
        
        <p style="margin: 30px 0 15px 0; color: #333; font-weight: bold;">Alternative Options:</p>
        
        <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="padding: 5px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #2563eb; border-radius: 6px;">
                    <a href="${expoGoURL}" style="display: block; padding: 10px 20px; color: white; text-decoration: none; font-size: 14px;">Open in Expo Go</a>
                  </td>
                </tr>
              </table>
            </td>
            <td style="padding: 5px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #16a34a; border-radius: 6px;">
                    <a href="${customSchemeURL}" style="display: block; padding: 10px 20px; color: white; text-decoration: none; font-size: 14px;">Open in iYaya App</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <p style="margin: 30px 0 10px 0; color: #333;">If the buttons don't work, copy this link:</p>
        <p style="word-break: break-all; color: #0066cc; background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; margin: 0 0 20px 0;">${httpURL}</p>
        
        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
        <p style="margin: 0; color: #666; font-size: 14px;">If you didn't create this account, please ignore this email.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px; margin: 0;">iYaya - Connecting Families with Trusted Caregivers</p>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, resetToken) => {
  const transporter = createTransporter();
  const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:19006'}/reset-password/${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Reset Your iYaya Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #db2777;">Password Reset Request</h2>
        <p>You requested a password reset for your iYaya account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetURL}" style="background-color: #db2777; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset Password</a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetURL}</p>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">iYaya - Connecting Families with Trusted Caregivers</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Send status update email (for admin actions)
exports.sendStatusEmail = async ({ email, name, status, reason }) => {
  const transporter = createTransporter();

  const statusMessages = {
    active: {
      subject: 'Your iYaya Account Has Been Activated',
      message: `Hi ${name}, your iYaya account has been activated. You can now access all features of the platform.`,
      color: '#4caf50'
    },
    suspended: {
      subject: 'Your iYaya Account Has Been Suspended',
      message: `Hi ${name}, your iYaya account has been suspended${reason ? ` for the following reason: ${reason}` : '.'}. Please contact support if you believe this is an error.`,
      color: '#ff9800'
    },
    banned: {
      subject: 'Your iYaya Account Has Been Deactivated',
      message: `Hi ${name}, your iYaya account has been deactivated${reason ? ` for the following reason: ${reason}` : '.'}. If you believe this is an error, please contact support.`,
      color: '#f44336'
    }
  };

  const statusInfo = statusMessages[status] || {
    subject: 'Your iYaya Account Status Has Changed',
    message: `Hi ${name}, your iYaya account status has been updated to: ${status}${reason ? ` for the following reason: ${reason}` : '.'}`,
    color: '#2196f3'
  };

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: statusInfo.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${statusInfo.color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; color: white;">Account Status Update</h2>
        </div>
        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <p style="margin: 0 0 20px 0; color: #333; font-size: 16px;">Hi ${name},</p>
          <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">${statusInfo.message}</p>

          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #333; font-weight: bold;">Account Status: <span style="color: ${statusInfo.color}">${status.toUpperCase()}</span></p>
            ${reason ? `<p style="margin: 10px 0 0 0; color: #666;"><strong>Reason:</strong> ${reason}</p>` : ''}
          </div>

          <p style="margin: 20px 0 0 0; color: #666; font-size: 14px;">If you have any questions about this status change, please contact our support team.</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px; margin: 0;">iYaya - Connecting Families with Trusted Caregivers</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};