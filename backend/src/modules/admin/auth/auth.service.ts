import { prisma } from "../../../config/db";
import { hashPassword, verifyPassword } from "../../../utils/bcrypt";
import { tokenUtils } from "../../../utils/token";
import { jwtUtils } from "../../../utils/jwt";
import { envConfig } from "../../../config/env";
import { AppError } from "../../../utils/AppError";
import type { Prisma } from "../../../generated/prisma/client";
import type { UpdateAdminProfileInput } from "./auth.validation";

// ─── Login ───────────────────────────────────────────────────────
const loginAdmin = async (email: string, password: string) => {
  // 1. Find admin by email
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) {
    throw new AppError("Invalid email or password.", 401);
  }

  // 2. Check if admin is active
  if (!admin.isActive) {
    throw new AppError("This admin account has been deactivated.", 403);
  }

 // 3. Verify password
  const isPasswordValid = await verifyPassword(password, admin.passwordHash);
  if (!isPasswordValid) {
    throw new AppError("Invalid email or password.", 401);
  }

  // 4. Generate tokens
  const payload = { userId: admin.id, email: admin.email, role: "ADMIN" as const };
  const accessToken = tokenUtils.getAccessToken(payload);
  const refreshToken = tokenUtils.getRefreshToken(payload);

  // 5. Store refresh token hash in DB
  const refreshTokenHash = tokenUtils.hashToken(refreshToken);
  await prisma.adminRefreshToken.create({
    data: {
      adminId: admin.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // 6. Update lastLoginAt
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken,
    refreshToken,
    admin: {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
    },
  };
};

const adminProfileSelect = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdminSelect;

// ─── Profile ─────────────────────────────────────────────────────
const getAdminProfile = async (adminId: string) => {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: adminProfileSelect,
  });

  if (!admin) {
    throw new AppError("Admin not found.", 404);
  }

  return admin;
};

// ─── Update Own Profile (name / email / password) ────────────────
const updateAdminProfile = async (adminId: string, data: UpdateAdminProfileInput) => {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) {
    throw new AppError("Admin not found.", 404);
  }

  const updateData: Prisma.AdminUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;

  // Email change — enforce uniqueness across admins.
  if (data.email !== undefined && data.email !== admin.email) {
    const taken = await prisma.admin.findUnique({ where: { email: data.email } });
    if (taken) {
      throw new AppError("An admin with this email already exists.", 409);
    }
    updateData.email = data.email;
  }

  // Password change — verify the current password first.
  let passwordChanged = false;
  if (data.newPassword) {
    const ok = await verifyPassword(data.currentPassword as string, admin.passwordHash);
    if (!ok) {
      throw new AppError("Current password is incorrect.", 401);
    }
    updateData.passwordHash = await hashPassword(data.newPassword);
    passwordChanged = true;
  }

  const updated = await prisma.admin.update({
    where: { id: adminId },
    data: updateData,
    select: adminProfileSelect,
  });

  // On a password change, revoke every refresh token so other sessions can no
  // longer be renewed (they die when their access token expires).
  if (passwordChanged) {
    await prisma.adminRefreshToken.updateMany({
      where: { adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return { admin: updated, passwordChanged };
};

// ─── Refresh Token ───────────────────────────────────────────────
const refreshAdminToken = async (oldRefreshToken: string) => {
  // 1. Decode the token to get admin ID (without verifying expiry first)
  const decoded = jwtUtils.verifyToken(oldRefreshToken, envConfig.REFRESH_TOKEN_SECRET);

  if (!decoded.success || !decoded.data) {
    throw new AppError("Invalid or expired refresh token.", 401);
  }

  const { userId } = decoded.data as { userId: string };

  // 2. Find all non-revoked refresh tokens for this admin
  const storedTokens = await prisma.adminRefreshToken.findMany({
    where: {
      adminId: userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  // 3. Find the matching token by comparing hashes
  let matchedToken = null;
  const oldTokenHash = tokenUtils.hashToken(oldRefreshToken);
  for (const stored of storedTokens) {
    if (oldTokenHash === stored.tokenHash) {
      matchedToken = stored;
      break;
    }
  }

  if (!matchedToken) {
    throw new AppError("Refresh token not found or already revoked.", 401);
  }

  // 4. Revoke the old token
  await prisma.adminRefreshToken.update({
    where: { id: matchedToken.id },
    data: { revokedAt: new Date() },
  });

  // 5. Get admin data for new token payload
  const admin = await prisma.admin.findUnique({ where: { id: userId } });
  if (!admin || !admin.isActive) {
    throw new AppError("Admin account not found or deactivated.", 403);
  }

  // 6. Generate new token pair
  const payload = { userId: admin.id, email: admin.email, role: "ADMIN" as const };
  const newAccessToken = tokenUtils.getAccessToken(payload);
  const newRefreshToken = tokenUtils.getRefreshToken(payload);

  // 7. Store new refresh token hash
  const newRefreshTokenHash = tokenUtils.hashToken(newRefreshToken);
  await prisma.adminRefreshToken.create({
    data: {
      adminId: admin.id,
      tokenHash: newRefreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

// ─── Logout ──────────────────────────────────────────────────────
const logoutAdmin = async (refreshToken: string) => {
  // Decode to get admin ID
  const decoded = jwtUtils.decodeToken(refreshToken);
  if (!decoded?.userId) {
    throw new AppError("Invalid refresh token.", 401);
  }

  const { userId } = decoded as { userId: string };

  // Find and revoke the matching token
  const storedTokens = await prisma.adminRefreshToken.findMany({
    where: {
      adminId: userId,
      revokedAt: null,
    },
  });

  const targetHash = tokenUtils.hashToken(refreshToken);
  for (const stored of storedTokens) {
    if (targetHash === stored.tokenHash) {
      await prisma.adminRefreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      break;
    }
  }
};

export const adminServices = {
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  refreshAdminToken,
  logoutAdmin,
};