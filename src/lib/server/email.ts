import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9000';
  const resetLink = `${baseUrl}/reset-password/${resetToken}`;

  const mailOptions = {
    from: '"VPCard System" <noreply@vpcard.local>',
    to: email,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: inherit; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p style="color: #555; text-align: left;">
          We received a request to reset your password. This link will expire in 1 hour.
        </p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; margin-top: 20px; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 4px;">
          Reset Password
        </a>
        <p style="color: #777; font-size: 14px; margin-top: 20px;">
          If you did not request this, please ignore this email.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};
