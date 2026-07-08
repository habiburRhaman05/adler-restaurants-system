import type { Request } from "express";
import { UAParser } from "ua-parser-js";

export interface DeviceInfo {
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  deviceName: string | undefined;
  browser: string | undefined;
  browserVersion: string | undefined;
  os: string | undefined;
  osVersion: string | undefined;
}

export const parseDeviceInfo = (userAgent: string | undefined): DeviceInfo => {
  if (!userAgent) {
    return {
      deviceType: "unknown",
      deviceName: undefined,
      browser: undefined,
      browserVersion: undefined,
      os: undefined,
      osVersion: undefined,
    };
  }
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  const deviceTypeRaw = result.device.type;
  const deviceType: DeviceInfo["deviceType"] =
    deviceTypeRaw === "mobile"
      ? "mobile"
      : deviceTypeRaw === "tablet"
      ? "tablet"
      : deviceTypeRaw
      ? "unknown"
      : "desktop";

  return {
    deviceType,
    deviceName: result.device.model || result.device.vendor || undefined,
    browser: result.browser.name,
    browserVersion: result.browser.version,
    os: result.os.name,
    osVersion: result.os.version,
  };
};

export const getClientIp = (req: Request): string | undefined => {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0];
  }
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
};

export const getRequestContext = (req: Request) => {
  const userAgent = req.headers["user-agent"] ?? "";
  return {
    userAgent,
    ipAddress: getClientIp(req),
    deviceInfo: parseDeviceInfo(userAgent),
  };
};
