import type { Request, Response } from "express";
import { userServices } from "./auth.service";
import { sendSuccess, sendError } from "../../../utils/apiResponse";
import { tokenUtils } from "../../../utils/token";
import { CookieUtils } from "../../../utils/cookie";
import type { UpdateUserProfileInput } from "./auth.validation";

const clearAuthCookies = (res: Response) => {
  const opts = { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" };
  CookieUtils.clearCookie(res, "accessToken", opts);
  CookieUtils.clearCookie(res, "refreshToken", opts);
};

// ─── Login ───────────────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.validated as { email: string; password: string };

  const result = await userServices.loginUser(email, password);

  // Set cookies (browser) AND return the tokens in the body so a mobile / React
  // Native client can store them and send `Authorization: Bearer <token>`.
  tokenUtils.setAccessTokenCookie(res, result.accessToken);
  tokenUtils.setRefreshTokenCookie(res, result.refreshToken);

  sendSuccess(res, {
    statusCode: 200,
    message: "User logged in successfully.",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
};

// ─── Update Own Profile (email / password) ───────────────────────
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const { userId } = res.locals.auth!;
  const data = req.validated as UpdateUserProfileInput;

  const result = await userServices.updateUserProfile(userId, data);

  // A password change revoked every refresh token — end this session too.
  if (result.passwordChanged) {
    clearAuthCookies(res);
  }

  sendSuccess(res, {
    statusCode: 200,
    message: result.passwordChanged
      ? "Profile updated. Please log in again with your new password."
      : "Profile updated successfully.",
    data: { user: result.user, passwordChanged: result.passwordChanged },
  });
};

// ─── Get Profile ─────────────────────────────────────────────────
export const getProfile = async (_req: Request, res: Response): Promise<void> => {
  const { userId } = res.locals.auth!;

  const user = await userServices.getUserProfile(userId);

  sendSuccess(res, {
    statusCode: 200,
    message: "User profile fetched successfully.",
    data: { user },
  });
};

// ─── Refresh Token ───────────────────────────────────────────────
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  // Mobile clients send the refresh token in the body; browsers send the cookie.
  const oldRefreshToken = req.body?.refreshToken || req.cookies?.refreshToken;

  if (!oldRefreshToken) {
    sendError(res, {
      statusCode: 401,
      message: "No refresh token provided.",
    });
    return;
  }

  const tokens = await userServices.refreshUserToken(oldRefreshToken);

  // Set new cookies AND return the new tokens in the body (for mobile clients).
  tokenUtils.setAccessTokenCookie(res, tokens.accessToken);
  tokenUtils.setRefreshTokenCookie(res, tokens.refreshToken);

  sendSuccess(res, {
    statusCode: 200,
    message: "Tokens refreshed successfully.",
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  });
};

// ─── Logout ──────────────────────────────────────────────────────
export const logout = async (req: Request, res: Response): Promise<void> => {
  // Accept the refresh token from the body (mobile) or the cookie (browser).
  const refreshTokenValue = req.body?.refreshToken || req.cookies?.refreshToken;

  if (refreshTokenValue) {
    await userServices.logoutUser(refreshTokenValue);
  }

  clearAuthCookies(res);

  sendSuccess(res, {
    statusCode: 200,
    message: "User logged out successfully.",
  });
};
