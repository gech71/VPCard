import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    // allow self-signed certificates if configured
    rejectUnauthorized: process.env.MAIL_ALLOW_SELF_SIGNED !== 'true'
  }
});

export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9000';
  const resetLink = `${baseUrl}/reset-password/${resetToken}`;

  const mailOptions = {
    from: `"VPCard System" <${process.env.MAIL_FROM_EMAIL}>`,
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
    return true;
  } catch (error) {
    return false;
  }
};
