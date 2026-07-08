import { prisma } from "../../../config/db";
import { hashPassword, verifyPassword } from "../../../utils/bcrypt";
import { tokenUtils } from "../../../utils/token";
import { jwtUtils } from "../../../utils/jwt";
import { envConfig } from "../../../config/env";
import { AppError } from "../../../utils/AppError";

// ─── Login ───────────────────────────────────────────────────────
const loginUser = async (email: string, password: string) => {
  // 1. Find user by email
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }

  // 2. Check if user is active
  if (!user.isActive) {
    throw new AppError("Your account has been deactivated. Please contact admin.", 403);
  }

  // 3. Verify password
  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError("Invalid email or password.", 401);
  }

  // 4. Generate tokens
  const payload = { userId: user.id, email: user.email, role: "USER" as const };
  const accessToken = tokenUtils.getAccessToken(payload);
  const refreshToken = tokenUtils.getRefreshToken(payload);

  // 5. Store refresh token hash in DB
  const refreshTokenHash = tokenUtils.hashToken(refreshToken);
  await prisma.userRefreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // 6. Update lastLoginAt
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      mustChangePassword: user.mustChangePassword,
    },
  };
};

// ─── Profile ─────────────────────────────────────────────────────
const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      contractType: true,
      workloadPercent: true,
      hourlyRate: true,
      monthlySalary: true,
      contractedHoursMonthly: true,
      hireDate: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return user;
};

// ─── Update Own Profile (email / password) ───────────────────────
const updateUserProfile = async (
  userId: string,
  data: {
    email?: string | undefined;
    currentPassword?: string | undefined;
    newPassword?: string | undefined;
  }
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const updateData: {
    email?: string;
    passwordHash?: string;
    mustChangePassword?: boolean;
  } = {};

  // Email change — enforce uniqueness across users.
  if (data.email !== undefined && data.email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email: data.email } });
    if (taken) {
      throw new AppError("A user with this email already exists.", 409);
    }
    updateData.email = data.email;
  }

  // Password change — verify the current password first.
  let passwordChanged = false;
  if (data.newPassword) {
    const ok = await verifyPassword(data.currentPassword as string, user.passwordHash);
    if (!ok) {
      throw new AppError("Current password is incorrect.", 401);
    }
    updateData.passwordHash = await hashPassword(data.newPassword);
    // Clears the forced-change flag set on admin-created accounts.
    updateData.mustChangePassword = false;
    passwordChanged = true;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      mustChangePassword: true,
      isActive: true,
      updatedAt: true,
    },
  });

  // On a password change, revoke every refresh token so other sessions can no
  // longer be renewed (they die when their access token expires).
  if (passwordChanged) {
    await prisma.userRefreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return { user: updated, passwordChanged };
};

// ─── Refresh Token ───────────────────────────────────────────────
const refreshUserToken = async (oldRefreshToken: string) => {
  // 1. Verify the token
  const decoded = jwtUtils.verifyToken(oldRefreshToken, envConfig.REFRESH_TOKEN_SECRET);

  if (!decoded.success || !decoded.data) {
    throw new AppError("Invalid or expired refresh token.", 401);
  }

  const { userId } = decoded.data as { userId: string };

  // 2. Find all non-revoked refresh tokens for this user
  const storedTokens = await prisma.userRefreshToken.findMany({
    where: {
      userId,
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
  await prisma.userRefreshToken.update({
    where: { id: matchedToken.id },
    data: { revokedAt: new Date() },
  });

  // 5. Get user data for new token payload
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new AppError("User account not found or deactivated.", 403);
  }

  // 6. Generate new token pair
  const payload = { userId: user.id, email: user.email, role: "USER" as const };
  const newAccessToken = tokenUtils.getAccessToken(payload);
  const newRefreshToken = tokenUtils.getRefreshToken(payload);

  // 7. Store new refresh token hash
  const newRefreshTokenHash = tokenUtils.hashToken(newRefreshToken);
  await prisma.userRefreshToken.create({
    data: {
      userId: user.id,
      tokenHash: newRefreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

// ─── Logout ──────────────────────────────────────────────────────
const logoutUser = async (refreshToken: string) => {
  const decoded = jwtUtils.decodeToken(refreshToken);
  if (!decoded?.userId) {
    throw new AppError("Invalid refresh token.", 401);
  }

  const { userId } = decoded as { userId: string };

  // Find and revoke the matching token
  const storedTokens = await prisma.userRefreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
    },
  });

  const targetHash = tokenUtils.hashToken(refreshToken);
  for (const stored of storedTokens) {
    if (targetHash === stored.tokenHash) {
      await prisma.userRefreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      break;
    }
  }
};

export const userServices = {
  loginUser,
  getUserProfile,
  updateUserProfile,
  refreshUserToken,
  logoutUser,
};
