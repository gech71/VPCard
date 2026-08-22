import nodemailer from "nodemailer";

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
    rejectUnauthorized: process.env.MAIL_ALLOW_SELF_SIGNED !== "true",
  },
});

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:9000";
  const resetLink = `${baseUrl}/reset-password/${resetToken}`;

  const mailOptions = {
    from: `"Prepaid Card System" <${process.env.MAIL_FROM_EMAIL}>`,
    to: email,
    subject: "Password Reset Request",
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

/**
 * Sends the email-change verification link to the *new* address. The account
 * email only moves once this link is opened, which is what proves the new
 * mailbox is reachable and owned by the requester.
 */
export const sendEmailChangeVerificationEmail = async (
  newEmail: string,
  verificationToken: string,
  currentEmail: string,
) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:9000";
  const verifyLink = `${baseUrl}/verify-email-change/${verificationToken}`;

  const mailOptions = {
    from: `"Prepaid Card System" <${process.env.MAIL_FROM_EMAIL}>`,
    to: newEmail,
    subject: "Verify your new email address",
    html: `
      <div style="font-family: inherit; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
        <h2 style="color: #333;">Verify your new email address</h2>
        <p style="color: #555; text-align: left;">
          A request was made to change the email address of the Prepaid Card System
          account currently registered as <strong>${currentEmail}</strong> to this
          address. Confirm below to complete the change. This link will expire in 1 hour.
        </p>
        <a href="${verifyLink}" style="display: inline-block; padding: 12px 24px; margin-top: 20px; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 4px;">
          Verify Email Address
        </a>
        <p style="color: #777; font-size: 14px; margin-top: 20px;">
          If you did not request this, please ignore this email. The account email
          will not change unless this link is opened.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Best-effort notice to the address being replaced, so that an unexpected email
 * change is visible to whoever still controls the old mailbox. Delivery failure
 * here never blocks the change - it has already been verified by then.
 */
export const sendEmailChangeNoticeEmail = async (
  previousEmail: string,
  newEmail: string,
) => {
  const mailOptions = {
    from: `"Prepaid Card System" <${process.env.MAIL_FROM_EMAIL}>`,
    to: previousEmail,
    subject: "Your account email address was changed",
    html: `
      <div style="font-family: inherit; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Account email changed</h2>
        <p style="color: #555;">
          The email address for your Prepaid Card System account was changed from
          <strong>${previousEmail}</strong> to <strong>${newEmail}</strong>.
          Sign in with the new address from now on.
        </p>
        <p style="color: #777; font-size: 14px;">
          If you did not make this change, contact your system administrator immediately.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    return false;
  }
};
