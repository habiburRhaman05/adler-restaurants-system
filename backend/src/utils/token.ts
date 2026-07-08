import { Response } from "express";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { jwtUtils } from "./jwt";
import { envConfig } from "../config/env";
import { CookieUtils } from "./cookie";

const hashToken = (token: string): string => {
    return crypto.createHash("sha256").update(token).digest("hex");
};

const getAccessToken = (payload: JwtPayload) => {
    return jwtUtils.createToken(
        payload,
        envConfig.ACCESS_TOKEN_SECRET,
        { expiresIn: envConfig.ACCESS_TOKEN_EXPIRES_IN } as SignOptions
    );
}

const getRefreshToken = (payload: JwtPayload) => {
    return jwtUtils.createToken(
        payload,
        envConfig.REFRESH_TOKEN_SECRET,
        { expiresIn: envConfig.REFRESH_TOKEN_EXPIRES_IN } as SignOptions
    );
}

const setAccessTokenCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, 'accessToken', token, {
        httpOnly: true,
        secure: true,
        sameSite:"none",
        path: '/',
        maxAge: 60 * 60 * 1000, // 60 minutes in milliseconds
    });
}

const setRefreshTokenCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, 'refreshToken', token, {
        httpOnly: true,
        secure: true,
        sameSite:"none",
        path: '/',
        maxAge: 120 * 60 * 1000, // 2 days in milliseconds
    });
}

const setBetterAuthSessionCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, "better-auth.session_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: '/',
        maxAge: 60 * 60 * 1000, // 60 minutes in milliseconds
    });
}

export const tokenUtils = {
    hashToken,
    getAccessToken,
    getRefreshToken,
    setAccessTokenCookie,
    setRefreshTokenCookie,
    setBetterAuthSessionCookie,
}