'use server';

import prisma from '@/lib/prisma';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { sendPasswordResetEmail } from '@/lib/server/email';

const ForgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required.'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[a-zA-Z]/, 'Must contain letters')
    .regex(/[0-9]/, 'Must contain numbers'),
  confirmPassword: z.string().min(8, 'Confirm password is required.'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ['confirmPassword'],
});

export async function requestPasswordResetAction(prevState: any, formData: FormData) {
  const validatedFields = ForgotPasswordSchema.safeParse({
    email: formData.get('email'),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors.email?.[0] };
  }

  const { email } = validatedFields.data;

  // 1. Verify email exists in database
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    return { error: 'No user found with this email address.' }; 
  }

  // 2. Check if a valid (not expired, not used) token already exists
  const existingToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (existingToken) {
    return { error: 'A valid reset link has already been sent to your email. Please check your inbox or wait until it expires.' };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Set expiration to 1 hour from now
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  // Store hashed token in database
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token: hashedToken,
      expiresAt,
    },
  });

  // Log action
  await createAuditLog({
    userId: user.id,
    action: 'REQUEST_PASSWORD_RESET',
    entityType: 'AUTH',
    entityId: user.id,
    details: { event: 'REQUEST_RESET' },
  });

  // Send raw token via email
  await sendPasswordResetEmail(user.email, rawToken);

  return { success: true };
}

export async function resetPasswordAction(prevState: any, formData: FormData) {
  const validatedFields = ResetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { token: rawToken, password } = validatedFields.data;
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Verify token
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token: hashedToken },
    include: { user: true },
  });

  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    return { error: 'Invalid or expired password reset token.' };
  }

  // Generate new hashed password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Update user password and mark token as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    }),
  ]);

  // Log action
  await createAuditLog({
    userId: resetToken.userId,
    action: 'RESET_PASSWORD',
    entityType: 'AUTH',
    entityId: resetToken.userId,
    details: { event: 'EXECUTE_RESET' },
  });

  return { success: true };
}

export async function validateResetToken(rawToken: string) {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token: hashedToken },
  });

  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    return false;
  }

  return true;
}
