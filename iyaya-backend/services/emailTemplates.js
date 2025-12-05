// Email templates for user status notifications

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const suspensionTemplate = ({ name, reason, suspensionEndDate, suspensionCount }) => ({
  subject: 'Account Temporarily Suspended - iYaya',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f57c00;">Account Temporarily Suspended</h2>
      
      <p>Dear ${name},</p>
      
      <p>Your iYaya account has been temporarily suspended.</p>
      
      <div style="background-color: #fff3e0; padding: 15px; border-left: 4px solid #f57c00; margin: 20px 0;">
        <p><strong>Reason:</strong> ${reason || 'Policy violation'}</p>
        ${suspensionEndDate ? `<p><strong>Duration:</strong> Until ${formatDate(suspensionEndDate)}</p>` : '<p><strong>Duration:</strong> Pending investigation</p>'}
        ${suspensionCount > 1 ? `<p><strong>Note:</strong> This is suspension #${suspensionCount}. Repeated violations may result in permanent account closure.</p>` : ''}
      </div>
      
      <p><strong>What happens now:</strong></p>
      <ul>
        <li>You cannot book or accept jobs during this period</li>
        <li>Your profile is hidden from search results</li>
        <li>You can still view your account information</li>
      </ul>
      
      <p><strong>To resolve this:</strong></p>
      <ol>
        <li>Review our Terms of Service and Community Guidelines</li>
        <li>Contact support if you believe this is an error</li>
        <li>Wait for the suspension period to end</li>
      </ol>
      
      <p><strong>Appeal Process:</strong><br>
      If you believe this suspension is unjustified, you may appeal by replying to this email within 7 days with supporting evidence.</p>
      
      <p>Best regards,<br>
      <strong>iYaya Admin Team</strong></p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #999;">
        This is an automated message. Please do not reply directly to this email.
      </p>
    </div>
  `,
  text: `
Account Temporarily Suspended

Dear ${name},

Your iYaya account has been temporarily suspended.

Reason: ${reason || 'Policy violation'}
${suspensionEndDate ? `Duration: Until ${formatDate(suspensionEndDate)}` : 'Duration: Pending investigation'}
${suspensionCount > 1 ? `Note: This is suspension #${suspensionCount}. Repeated violations may result in permanent account closure.` : ''}

What happens now:
- You cannot book or accept jobs during this period
- Your profile is hidden from search results
- You can still view your account information

To resolve this:
1. Review our Terms of Service and Community Guidelines
2. Contact support if you believe this is an error
3. Wait for the suspension period to end

Appeal Process:
If you believe this suspension is unjustified, you may appeal by replying to this email within 7 days with supporting evidence.

Best regards,
iYaya Admin Team
  `,
});

const bannedTemplate = ({ name, reason }) => ({
  subject: 'Account Permanently Closed - iYaya',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d32f2f;">Account Permanently Closed</h2>
      
      <p>Dear ${name},</p>
      
      <p>After careful review, your iYaya account has been permanently closed.</p>
      
      <div style="background-color: #ffebee; padding: 15px; border-left: 4px solid #d32f2f; margin: 20px 0;">
        <p><strong>Reason:</strong> ${reason || 'Serious policy violation'}</p>
        <p><strong>Effective:</strong> Immediately</p>
      </div>
      
      <p><strong>What this means:</strong></p>
      <ul>
        <li>Your account has been permanently deactivated</li>
        <li>You cannot access the platform</li>
        <li>You cannot create a new account</li>
        <li>All active bookings have been cancelled</li>
      </ul>
      
      <p><strong>Appeal Process:</strong><br>
      This decision is final. However, you may appeal by:</p>
      <ul>
        <li>Emailing: appeals@iyaya.com</li>
        <li>Providing: New evidence or documentation</li>
        <li>Deadline: 30 days from this notice</li>
      </ul>
      
      <p><strong>Outstanding Payments:</strong><br>
      Any pending payments will be processed according to our refund policy. You will receive a separate email regarding financial settlements.</p>
      
      <p>Best regards,<br>
      <strong>iYaya Admin Team</strong></p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #999;">
        This is an automated message. For appeals, contact appeals@iyaya.com
      </p>
    </div>
  `,
  text: `
Account Permanently Closed

Dear ${name},

After careful review, your iYaya account has been permanently closed.

Reason: ${reason || 'Serious policy violation'}
Effective: Immediately

What this means:
- Your account has been permanently deactivated
- You cannot access the platform
- You cannot create a new account
- All active bookings have been cancelled

Appeal Process:
This decision is final. However, you may appeal by:
- Emailing: appeals@iyaya.com
- Providing: New evidence or documentation
- Deadline: 30 days from this notice

Outstanding Payments:
Any pending payments will be processed according to our refund policy. You will receive a separate email regarding financial settlements.

Best regards,
iYaya Admin Team
  `,
});

const reactivatedTemplate = ({ name }) => ({
  subject: 'Account Reactivated - iYaya',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4caf50;">Account Reactivated</h2>
      
      <p>Dear ${name},</p>
      
      <p>Good news! Your iYaya account has been reactivated.</p>
      
      <div style="background-color: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; margin: 20px 0;">
        <p><strong>Status:</strong> Active</p>
        <p><strong>Effective:</strong> Immediately</p>
      </div>
      
      <p><strong>You can now:</strong></p>
      <ul>
        <li>Book or accept jobs</li>
        <li>Access all platform features</li>
        <li>Your profile is visible in search results</li>
      </ul>
      
      <p><strong>Important Reminder:</strong><br>
      Please review our Terms of Service and Community Guidelines to ensure continued compliance. Future violations may result in permanent account closure.</p>
      
      <p>Welcome back!</p>
      
      <p>Best regards,<br>
      <strong>iYaya Admin Team</strong></p>
    </div>
  `,
  text: `
Account Reactivated

Dear ${name},

Good news! Your iYaya account has been reactivated.

Status: Active
Effective: Immediately

You can now:
- Book or accept jobs
- Access all platform features
- Your profile is visible in search results

Important Reminder:
Please review our Terms of Service and Community Guidelines to ensure continued compliance. Future violations may result in permanent account closure.

Welcome back!

Best regards,
iYaya Admin Team
  `,
});

module.exports = {
  suspensionTemplate,
  bannedTemplate,
  reactivatedTemplate,
};
