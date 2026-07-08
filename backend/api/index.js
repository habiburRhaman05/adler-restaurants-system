var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/app.ts
import express2 from "express";

// src/config/env.ts
import dotenv from "dotenv";
import { z } from "zod";

// src/utils/logger.ts
import pino from "pino";
import pinoHttp from "pino-http";
var isProduction = process.env.NODE_ENV === "production";
var level = process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug");
var logger = pino({
  level,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']"
    ],
    remove: true
  }
});
var httpLogger = pinoHttp({
  logger
});

// src/config/env.ts
dotenv.config();
var envSchema = z.object({
  PORT: z.coerce.number().default(8e3),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  CLIENT_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("1d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),
  // Rate limiting (per client IP). Optional — sensible defaults applied.
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1e3),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1e3),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  // Number of reverse proxies in front of the app (for correct client IPs).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
  // SMTP (optional — when unset, outgoing email is logged instead of sent).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional()
});
var parsed = envSchema.safeParse(process.env);
var envValidationError = parsed.success ? null : JSON.stringify(parsed.error.flatten().fieldErrors);
if (!parsed.success) {
  logger.fatal(
    { fieldErrors: parsed.error.flatten().fieldErrors },
    "Invalid or missing environment variables"
  );
}
var FALLBACK_ENV = {
  PORT: 8e3,
  NODE_ENV: "production",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://invalid:invalid@localhost:5432/invalid",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost",
  JWT_SECRET: "x".repeat(32),
  JWT_EXPIRES_IN: "1d",
  BCRYPT_SALT_ROUNDS: 12,
  ACCESS_TOKEN_SECRET: "x".repeat(32),
  ACCESS_TOKEN_EXPIRES_IN: "15m",
  REFRESH_TOKEN_SECRET: "x".repeat(32),
  REFRESH_TOKEN_EXPIRES_IN: "7d",
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1e3,
  RATE_LIMIT_MAX: 1e3,
  AUTH_RATE_LIMIT_MAX: 20,
  TRUST_PROXY_HOPS: 1
};
var envConfig = parsed.success ? parsed.data : FALLBACK_ENV;

// src/middleware/index.ts
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import hpp from "hpp";

// src/config/cors.ts
var allowedOrigins = [...new Set([envConfig.CLIENT_URL, "http://localhost:5173", "http://localhost:8081"].filter(Boolean))];
var corsConfig = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  credentials: true
};

// src/middleware/rateLimit.ts
import { rateLimit } from "express-rate-limit";

// src/utils/apiResponse.ts
var sendSuccess = (res, { statusCode = 200, message = "Success", data, meta }) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...meta
    }
  });
};
var sendError = (res, {
  statusCode = 500,
  message = "Something went wrong",
  errors
}) => {
  res.status(statusCode).json({
    success: false,
    message,
    errors,
    meta: {
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
};

// src/middleware/rateLimit.ts
var windowMs = envConfig.RATE_LIMIT_WINDOW_MS;
var tooMany = (res, message) => sendError(res, { statusCode: 429, message });
var apiLimiter = rateLimit({
  windowMs,
  limit: envConfig.RATE_LIMIT_MAX,
  standardHeaders: true,
  // emit RateLimit-* headers
  legacyHeaders: false,
  // drop the deprecated X-RateLimit-* headers
  skip: (req) => req.path === "/health",
  handler: (_req, res) => tooMany(res, "Too many requests. Please slow down and try again shortly.")
});
var authLimiter = rateLimit({
  windowMs,
  limit: envConfig.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => tooMany(res, "Too many attempts. Please wait a few minutes and try again.")
});

// src/middleware/index.ts
var applyMiddleware = (app2) => {
  app2.use(helmet());
  app2.use(cors(corsConfig));
  app2.use(compression());
  app2.use(cookieParser());
  app2.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        if (req.originalUrl.includes("/stripe/webhook")) {
          req.rawBody = buf;
        }
      }
    })
  );
  app2.use(hpp());
  app2.use(httpLogger);
  app2.use(apiLimiter);
};

// src/utils/AppError.ts
var AppError = class extends Error {
  statusCode;
  isOperational;
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
};

// src/generated/prisma/client.ts
import * as process2 from "node:process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// src/generated/prisma/internal/class.ts
import * as runtime from "@prisma/client/runtime/library";
var config = {
  "generator": {
    "name": "client",
    "provider": {
      "fromEnvVar": null,
      "value": "prisma-client"
    },
    "output": {
      "value": "C:\\Users\\ODL\\Downloads\\semi-finnal-code-main\\semi-finnal-code-main\\backend\\src\\generated\\prisma",
      "fromEnvVar": null
    },
    "config": {
      "engineType": "library"
    },
    "binaryTargets": [
      {
        "fromEnvVar": null,
        "value": "windows",
        "native": true
      },
      {
        "fromEnvVar": null,
        "value": "rhel-openssl-3.0.x"
      }
    ],
    "previewFeatures": [],
    "sourceFilePath": "C:\\Users\\ODL\\Downloads\\semi-finnal-code-main\\semi-finnal-code-main\\backend\\prisma\\schemas\\base.prisma",
    "isCustomOutput": true
  },
  "relativePath": "../../../prisma/schemas",
  "clientVersion": "6.19.3",
  "engineVersion": "c2990dca591cba766e3b7ef5d9e8a84796e47ab7",
  "datasourceNames": [
    "db"
  ],
  "activeProvider": "postgresql",
  "postinstall": false,
  "inlineDatasources": {
    "db": {
      "url": {
        "fromEnvVar": "DATABASE_URL",
        "value": null
      }
    }
  },
  "inlineSchema": `model Admin {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  name         String?
  firstName    String?
  lastName     String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  refreshTokens        AdminRefreshToken[]
  submittedPlans       WeeklyPlan[]         @relation("PlanSubmittedBy")
  approvedSwaps        SwapRequest[]        @relation("SwapAdmin")
  auditLogs            AuditLog[]           @relation("AuditActor")
  deliveredCredentials CredentialDelivery[] @relation("DeliveredBy")
  ruleCheckLogs        RuleCheckLog[]       @relation("RuleCheckActor")
  createdShiftOffers   ShiftOffer[]         @relation("ShiftOfferCreatedBy")
  approvedResponses    ShiftOfferResponse[] @relation("ResponseApprovedBy")
  reviewedShiftSwaps   ShiftSwapRequest[]   @relation("ShiftSwapReviewedBy")
  reviewedLeaves       LeaveRequest[]       @relation("LeaveReviewedBy")

  @@index([isActive])
  @@index([lastName, firstName])
  @@map("admins")
}

model AdminRefreshToken {
  id         String    @id @default(cuid())
  adminId    String
  admin      Admin     @relation(fields: [adminId], references: [id], onDelete: Cascade)
  tokenHash  String    @unique
  deviceInfo String?
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  @@index([adminId])
  @@index([expiresAt])
  @@map("admin_refresh_tokens")
}

enum TimeEntryStatus {
  ACTIVE
  ON_BREAK
  COMPLETED
}

model TimeEntry {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Optional link to the roster shift this entry fulfils.
  shiftId String?
  shift   Shift?  @relation(fields: [shiftId], references: [id], onDelete: SetNull)

  clockInAt  DateTime
  clockOutAt DateTime?

  // Break tracking: while on break, breakStartedAt is set; accumulated
  // completed break time lands in breakMinutes.
  breakStartedAt DateTime?
  breakMinutes   Int       @default(0)

  // Optional geo/context captured at clock-in.
  latitude  Decimal? @db.Decimal(9, 6)
  longitude Decimal? @db.Decimal(9, 6)
  location  String?

  status TimeEntryStatus @default(ACTIVE)

  // Derived on clock-out (kept for cheap reporting).
  workedMinutes   Int?
  lateMinutes     Int?
  overtimeMinutes Int?

  note String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, clockInAt])
  @@index([userId, status])
  @@index([shiftId])
  @@map("time_entries")
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  actor      Admin?   @relation("AuditActor", fields: [actorId], references: [id])
  action     String
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([actorId])
  @@index([createdAt])
  @@map("audit_logs")
}

model AvailabilityMonth {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  year        Int
  month       Int
  status      AvailabilityMonthStatus @default(DRAFT)
  cutoffAt    DateTime
  submittedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  days AvailabilityDay[]

  @@unique([userId, year, month])
  @@index([year, month])
  @@index([status])
  @@map("availability_months")
}

model AvailabilityDay {
  id                  String            @id @default(cuid())
  availabilityMonthId String
  availabilityMonth   AvailabilityMonth @relation(fields: [availabilityMonthId], references: [id], onDelete: Cascade)

  date               DateTime              @db.Date
  status             DayAvailabilityStatus
  note               String?
  preferredStartTime DateTime?
  preferredEndTime   DateTime?

  @@unique([availabilityMonthId, date])
  @@index([date])
  @@map("availability_days")
}

generator client {
  provider      = "prisma-client"
  output        = "../../src/generated/prisma"
  // "native" covers local dev; "rhel-openssl-3.0.x" is the Vercel/AWS Lambda
  // serverless runtime so the query engine binary matches in production.
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Category {
  id       String     @id @default(cuid())
  name     String
  parentId String?
  parent   Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: Restrict)
  children Category[] @relation("CategoryHierarchy")

  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users         UserCategory[]
  shifts        Shift[]
  staffingNeeds StaffingDemand[]
  shiftOffers   ShiftOffer[]
  dayDemands    DayDemand[]

  @@unique([parentId, name])
  @@index([parentId])
  @@map("categories")
}

model UserCategory {
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  assignedAt DateTime @default(now())

  @@id([userId, categoryId])
  @@index([categoryId])
  @@map("user_categories")
}

// Weekly staffing "Demands" \u2014 a Sunday-based week plan holding a per-day,
// per-category required headcount ("how many employees are needed in each
// category on each day"). This is the day-level demand grid behind the admin
// "Demands" page, distinct from the shift-slot-level StaffingDemand model.

enum DemandWeekStatus {
  DRAFT
  PUBLISHED
}

model DemandWeek {
  id            String           @id @default(cuid())
  weekStartDate DateTime         @db.Date // always a Sunday
  weekEndDate   DateTime         @db.Date // the following Saturday
  status        DemandWeekStatus @default(DRAFT)
  publishedAt   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  demands DayDemand[]

  @@unique([weekStartDate])
  @@index([status])
  @@index([weekStartDate, weekEndDate])
  @@map("demand_weeks")
}

model DayDemand {
  id           String     @id @default(cuid())
  demandWeekId String
  demandWeek   DemandWeek @relation(fields: [demandWeekId], references: [id], onDelete: Cascade)

  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  date          DateTime @db.Date
  requiredCount Int      @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([demandWeekId, categoryId, date])
  @@index([demandWeekId])
  @@index([categoryId])
  @@index([date])
  @@map("day_demands")
}

enum AvailabilityMonthStatus {
  DRAFT
  SUBMITTED
  LOCKED
}

enum DayAvailabilityStatus {
  AVAILABLE
  UNAVAILABLE
  WISH
}

enum NotificationType {
  WEEKLY_SHIFTS_PUBLISHED
  SHIFT_OFFER_PUBLISHED
  AVAILABILITY_REMINDER
  SWAP_REQUEST_RECEIVED
  SWAP_REQUEST_RESULT
  SWAP_PENDING_ADMIN_APPROVAL
  SHIFT_CHANGED
  RULE_VIOLATION
  LEAVE_REQUEST_RESULT
  GENERAL
}

enum NotificationChannel {
  PUSH
  EMAIL
  IN_APP
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  READ
}

enum PlanStatus {
  DRAFT
  SUBMITTED
  PUBLISHED
}

enum ShiftStatus {
  PENDING
  ACCEPTED
  REJECTED
  CANCELLED
  SWAPPED_OUT
}

enum SwapType {
  TARGETED
  OPEN
}

enum SwapStatus {
  PENDING_RECIPIENT
  PENDING_ADMIN_APPROVAL
  APPROVED
  REJECTED
  EXPIRED
  CANCELLED
}

enum CredentialDeliveryMethod {
  EMAIL
  SMS
  IN_PERSON
}

enum ContractType {
  HOURLY
  MONTHLY_SALARY
  WORKLOAD_PERCENT
}

enum EmployeeType {
  FULL_TIME
  PART_TIME
}

enum ShiftResponseStatus {
  ACCEPTED
  REJECTED
}

enum ShiftApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ShiftSwapStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum LeaveType {
  VACATION
  SICK
  PERSONAL
  OTHER
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

model LeaveRequest {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  leaveType LeaveType
  startDate DateTime  @db.Date
  endDate   DateTime  @db.Date
  reason    String

  status    LeaveStatus @default(PENDING)
  adminNote String?

  reviewedById String?
  reviewedBy   Admin?    @relation("LeaveReviewedBy", fields: [reviewedById], references: [id])
  reviewedAt   DateTime?

  // Roster shifts auto-cancelled when this leave was approved.
  affectedShifts Shift[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, status])
  @@index([status])
  @@index([startDate, endDate])
  @@map("leave_requests")
}

model Notification {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  type    NotificationType
  channel NotificationChannel
  status  NotificationStatus  @default(PENDING)

  title   String
  body    String
  payload Json?

  sentAt     DateTime?
  readAt     DateTime?
  failReason String?

  createdAt DateTime @default(now())

  @@index([userId, status])
  @@index([userId, readAt])
  @@index([type])
  @@index([createdAt])
  @@map("notifications")
}

model OrgSettings {
  id Int @id @default(1)

  maxDailyHours             Decimal @db.Decimal(4, 2)
  maxWeeklyHours            Decimal @db.Decimal(4, 2)
  minRestHoursBetweenShifts Decimal @db.Decimal(4, 2)
  minBreakMinutes           Int
  breakRequiredAfterHours   Decimal @default(5.50) @db.Decimal(4, 2)
  breakRules                Json?

  sessionTimeoutMinutes Int   @default(30)
  notificationPrefs     Json?

  swapExpiryHours Int @default(72)

  // How many minutes before a shift's start an employee may clock in.
  earlyClockInWindowMinutes Int @default(15)

  // Default shift window ("HH:mm", UTC) applied when generating shifts from
  // the day-level demand grid, which stores headcount but no times.
  defaultShiftStartTime String @default("09:00")
  defaultShiftEndTime   String @default("17:00")

  updatedAt   DateTime @updatedAt
  updatedById String?

  @@map("org_settings")
}

model RuleCheckLog {
  id          String   @id @default(cuid())
  context     String
  entityId    String
  passed      Boolean
  details     Json
  checkedAt   DateTime @default(now())
  checkedById String?
  checkedBy   Admin?   @relation("RuleCheckActor", fields: [checkedById], references: [id])

  @@index([context, entityId])
  @@index([checkedAt])
  @@map("rule_check_logs")
}

model WeeklyPlan {
  id            String   @id @default(cuid())
  year          Int
  month         Int
  weekNumber    Int
  weekStartDate DateTime @db.Date
  weekEndDate   DateTime @db.Date

  status        PlanStatus @default(DRAFT)
  submittedAt   DateTime?
  submittedById String?
  submittedBy   Admin?     @relation("PlanSubmittedBy", fields: [submittedById], references: [id])

  needsRenotify Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  shifts  Shift[]
  demands StaffingDemand[]

  @@unique([year, month, weekNumber])
  @@index([status])
  @@index([weekStartDate, weekEndDate])
  @@map("weekly_plans")
}

model Shift {
  id           String     @id @default(cuid())
  weeklyPlanId String
  weeklyPlan   WeeklyPlan @relation(fields: [weeklyPlanId], references: [id], onDelete: Cascade)

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Restrict)

  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  date DateTime @db.Date

  startTime DateTime
  endTime   DateTime

  actualStartTime    DateTime?
  actualEndTime      DateTime?
  actualBreakMinutes Int?

  status          ShiftStatus @default(PENDING)
  rejectionReason String?

  ruleViolations Json?
  rulePassed     Boolean @default(true)

  notifiedAt DateTime?

  // Set when an approved leave request auto-cancelled this shift.
  leaveRequestId String?
  leaveRequest   LeaveRequest? @relation(fields: [leaveRequestId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  swapsAsInitiatorShift SwapRequest[] @relation("InitiatorShift")
  swapsAsRecipientShift SwapRequest[] @relation("RecipientShift")
  timeEntries           TimeEntry[]

  @@index([userId, date])
  @@index([weeklyPlanId])
  @@index([categoryId])
  @@index([date, status])
  @@map("shifts")
}

model ShiftOffer {
  id          String   @id @default(cuid())
  jobTitle    String
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  startTime   DateTime
  endTime     DateTime
  hourlyPrice Decimal  @db.Decimal(10, 2)
  description String?

  createdById String?
  createdBy   Admin?  @relation("ShiftOfferCreatedBy", fields: [createdById], references: [id])

  notifiedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  responses ShiftOfferResponse[]

  swapsAsInitiatorShift ShiftSwapRequest[] @relation("ShiftSwapInitiatorShift")
  swapsAsRecipientShift ShiftSwapRequest[] @relation("ShiftSwapRecipientShift")

  @@index([categoryId])
  @@index([startTime])
  @@index([notifiedAt])
  @@map("shift_offers")
}

model ShiftOfferResponse {
  id           String     @id @default(cuid())
  shiftOfferId String
  shiftOffer   ShiftOffer @relation(fields: [shiftOfferId], references: [id], onDelete: Cascade)
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  status      ShiftResponseStatus
  respondedAt DateTime            @default(now())

  // Admin approval layer: a staff ACCEPT is a volunteer offer; the admin then
  // confirms who actually works the shift. Only APPROVED responses count as
  // available/confirmed workers.
  approvalStatus ShiftApprovalStatus @default(PENDING)
  approvedById   String?
  approvedBy     Admin?              @relation("ResponseApprovedBy", fields: [approvedById], references: [id])
  approvedAt     DateTime?
  approvalNote   String?

  @@unique([shiftOfferId, userId])
  @@index([userId])
  @@index([shiftOfferId])
  @@index([status])
  @@index([approvalStatus])
  @@map("shift_offer_responses")
}

// A request by one employee to swap their confirmed (admin-approved) shift with
// another employee's confirmed shift. Routed to the admin for approval. Built on
// ShiftOffer (the functional shift-board model), distinct from the deferred
// WeeklyPlan-based SwapRequest in shiftSwap.prisma.
model ShiftSwapRequest {
  id String @id @default(cuid())

  initiatorUserId  String
  initiatorUser    User       @relation("ShiftSwapInitiatorUser", fields: [initiatorUserId], references: [id], onDelete: Cascade)
  initiatorShiftId String
  initiatorShift   ShiftOffer @relation("ShiftSwapInitiatorShift", fields: [initiatorShiftId], references: [id], onDelete: Cascade)

  recipientUserId  String
  recipientUser    User       @relation("ShiftSwapRecipientUser", fields: [recipientUserId], references: [id], onDelete: Cascade)
  recipientShiftId String
  recipientShift   ShiftOffer @relation("ShiftSwapRecipientShift", fields: [recipientShiftId], references: [id], onDelete: Cascade)

  status ShiftSwapStatus @default(PENDING)
  reason String?

  reviewedById String?
  reviewedBy   Admin?    @relation("ShiftSwapReviewedBy", fields: [reviewedById], references: [id])
  reviewedAt   DateTime?
  adminNote    String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([initiatorUserId])
  @@index([recipientUserId])
  @@index([initiatorShiftId])
  @@index([recipientShiftId])
  @@map("shift_swap_requests")
}

model SwapRequest {
  id String @id @default(cuid())

  swapType SwapType @default(TARGETED)

  initiatorUserId  String
  initiatorUser    User   @relation("SwapInitiator", fields: [initiatorUserId], references: [id], onDelete: Cascade)
  initiatorShiftId String
  initiatorShift   Shift  @relation("InitiatorShift", fields: [initiatorShiftId], references: [id], onDelete: Cascade)

  recipientUserId  String?
  recipientUser    User?   @relation("SwapRecipient", fields: [recipientUserId], references: [id], onDelete: Cascade)
  recipientShiftId String?
  recipientShift   Shift?  @relation("RecipientShift", fields: [recipientShiftId], references: [id], onDelete: Cascade)

  status               SwapStatus @default(PENDING_RECIPIENT)
  recipientRespondedAt DateTime?

  ruleCheckResult Json?
  ruleCheckPassed Boolean?
  ruleCheckedAt   DateTime?

  approvedById String?
  approvedBy   Admin?    @relation("SwapAdmin", fields: [approvedById], references: [id])
  adminReason  String?
  resolvedAt   DateTime?
  expiresAt    DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([initiatorUserId])
  @@index([recipientUserId])
  @@index([status])
  @@index([initiatorShiftId])
  @@index([recipientShiftId])
  @@index([swapType, status])
  @@map("swap_requests")
}

model StaffingDemand {
  id           String     @id @default(cuid())
  weeklyPlanId String
  weeklyPlan   WeeklyPlan @relation(fields: [weeklyPlanId], references: [id], onDelete: Cascade)

  date       DateTime @db.Date
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  requiredCount Int
  startTime     DateTime
  endTime       DateTime
  note          String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([weeklyPlanId, date, categoryId, startTime])
  @@index([weeklyPlanId])
  @@index([date])
  @@index([categoryId])
  @@map("staffing_demands")
}

model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  passwordHash       String
  mustChangePassword Boolean   @default(true)
  isActive           Boolean   @default(true)
  lastLoginAt        DateTime?

  name                   String?
  firstName              String?
  lastName               String?
  phone                  String?
  address                String?
  department             String?
  designation            String?
  employeeType           EmployeeType?
  contractType           ContractType?
  workloadPercent        Decimal?      @db.Decimal(5, 2)
  hourlyRate             Decimal?      @db.Decimal(10, 2)
  monthlySalary          Decimal?      @db.Decimal(10, 2)
  contractedHoursMonthly Decimal?      @db.Decimal(6, 2)
  hireDate               DateTime?
  deactivatedAt          DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  categories          UserCategory[]
  availabilityMonths  AvailabilityMonth[]
  shifts              Shift[]
  shiftOfferResponses ShiftOfferResponse[]
  initiatedShiftSwaps ShiftSwapRequest[]   @relation("ShiftSwapInitiatorUser")
  receivedShiftSwaps  ShiftSwapRequest[]   @relation("ShiftSwapRecipientUser")

  initiatedSwaps      SwapRequest[]        @relation("SwapInitiator")
  receivedSwaps       SwapRequest[]        @relation("SwapRecipient")
  receivedCredentials CredentialDelivery[] @relation("CredentialRecipient")

  notifications Notification[]
  refreshTokens UserRefreshToken[]
  timeEntries   TimeEntry[]
  leaveRequests LeaveRequest[]

  @@index([isActive])
  @@index([lastName, firstName])
  @@index([deactivatedAt])
  @@map("users")
}

model UserRefreshToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash  String    @unique
  deviceInfo String?
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  @@index([userId])
  @@index([expiresAt])
  @@map("user_refresh_tokens")
}

model CredentialDelivery {
  id            String                   @id @default(cuid())
  userId        String
  user          User                     @relation("CredentialRecipient", fields: [userId], references: [id], onDelete: Cascade)
  method        CredentialDeliveryMethod
  deliveredById String?
  deliveredBy   Admin?                   @relation("DeliveredBy", fields: [deliveredById], references: [id])
  deliveredAt   DateTime                 @default(now())
  note          String?

  @@index([userId])
  @@map("credential_deliveries")
}
`,
  "inlineSchemaHash": "f23fda30f1f2886696fd002296a13ad6d25e2905ee137f6f5340061a9b9db4a3",
  "copyEngine": true,
  "runtimeDataModel": {
    "models": {},
    "enums": {},
    "types": {}
  },
  "dirname": ""
};
config.runtimeDataModel = JSON.parse('{"models":{"Admin":{"dbName":"admins","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"email","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"passwordHash","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"isActive","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","nativeType":null,"default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"lastLoginAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"firstName","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"lastName","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"refreshTokens","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AdminRefreshToken","nativeType":null,"relationName":"AdminToAdminRefreshToken","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"submittedPlans","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"WeeklyPlan","nativeType":null,"relationName":"PlanSubmittedBy","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"approvedSwaps","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"SwapRequest","nativeType":null,"relationName":"SwapAdmin","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"auditLogs","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AuditLog","nativeType":null,"relationName":"AuditActor","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"deliveredCredentials","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"CredentialDelivery","nativeType":null,"relationName":"DeliveredBy","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"ruleCheckLogs","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"RuleCheckLog","nativeType":null,"relationName":"RuleCheckActor","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"createdShiftOffers","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftOffer","nativeType":null,"relationName":"ShiftOfferCreatedBy","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"approvedResponses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftOfferResponse","nativeType":null,"relationName":"ResponseApprovedBy","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"reviewedShiftSwaps","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftSwapRequest","nativeType":null,"relationName":"ShiftSwapReviewedBy","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"reviewedLeaves","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LeaveRequest","nativeType":null,"relationName":"LeaveReviewedBy","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"AdminRefreshToken":{"dbName":"admin_refresh_tokens","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"adminId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"admin","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Admin","nativeType":null,"relationName":"AdminToAdminRefreshToken","relationFromFields":["adminId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"tokenHash","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"deviceInfo","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"expiresAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"revokedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"TimeEntry":{"dbName":"time_entries","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"TimeEntryToUser","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"shiftId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"shift","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Shift","nativeType":null,"relationName":"ShiftToTimeEntry","relationFromFields":["shiftId"],"relationToFields":["id"],"relationOnDelete":"SetNull","isGenerated":false,"isUpdatedAt":false},{"name":"clockInAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"clockOutAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"breakStartedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"breakMinutes","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"latitude","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Decimal","nativeType":["Decimal",["9","6"]],"isGenerated":false,"isUpdatedAt":false},{"name":"longitude","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Decimal","nativeType":["Decimal",["9","6"]],"isGenerated":false,"isUpdatedAt":false},{"name":"location","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"TimeEntryStatus","nativeType":null,"default":"ACTIVE","isGenerated":false,"isUpdatedAt":false},{"name":"workedMinutes","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"lateMinutes","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"overtimeMinutes","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"note","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"AuditLog":{"dbName":"audit_logs","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"actorId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"actor","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Admin","nativeType":null,"relationName":"AuditActor","relationFromFields":["actorId"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"action","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"entityType","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"entityId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"metadata","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"AvailabilityMonth":{"dbName":"availability_months","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"AvailabilityMonthToUser","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"year","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"month","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"AvailabilityMonthStatus","nativeType":null,"default":"DRAFT","isGenerated":false,"isUpdatedAt":false},{"name":"cutoffAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"submittedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"days","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AvailabilityDay","nativeType":null,"relationName":"AvailabilityDayToAvailabilityMonth","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["userId","year","month"]],"uniqueIndexes":[{"name":null,"fields":["userId","year","month"]}],"isGenerated":false},"AvailabilityDay":{"dbName":"availability_days","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"availabilityMonthId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"availabilityMonth","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AvailabilityMonth","nativeType":null,"relationName":"AvailabilityDayToAvailabilityMonth","relationFromFields":["availabilityMonthId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"date","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":["Date",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DayAvailabilityStatus","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"note","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"preferredStartTime","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"preferredEndTime","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["availabilityMonthId","date"]],"uniqueIndexes":[{"name":null,"fields":["availabilityMonthId","date"]}],"isGenerated":false},"Category":{"dbName":"categories","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"parentId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"parent","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Category","nativeType":null,"relationName":"CategoryHierarchy","relationFromFields":["parentId"],"relationToFields":["id"],"relationOnDelete":"Restrict","isGenerated":false,"isUpdatedAt":false},{"name":"children","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Category","nativeType":null,"relationName":"CategoryHierarchy","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"isActive","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","nativeType":null,"default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"users","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"UserCategory","nativeType":null,"relationName":"CategoryToUserCategory","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"shifts","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Shift","nativeType":null,"relationName":"CategoryToShift","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"staffingNeeds","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"StaffingDemand","nativeType":null,"relationName":"CategoryToStaffingDemand","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"shiftOffers","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftOffer","nativeType":null,"relationName":"CategoryToShiftOffer","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"dayDemands","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DayDemand","nativeType":null,"relationName":"CategoryToDayDemand","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["parentId","name"]],"uniqueIndexes":[{"name":null,"fields":["parentId","name"]}],"isGenerated":false},"UserCategory":{"dbName":"user_categories","schema":null,"fields":[{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"UserToUserCategory","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"categoryId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"category","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Category","nativeType":null,"relationName":"CategoryToUserCategory","relationFromFields":["categoryId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"assignedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false}],"primaryKey":{"name":null,"fields":["userId","categoryId"]},"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"DemandWeek":{"dbName":"demand_weeks","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"weekStartDate","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":["Date",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"weekEndDate","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":["Date",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DemandWeekStatus","nativeType":null,"default":"DRAFT","isGenerated":false,"isUpdatedAt":false},{"name":"publishedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"demands","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DayDemand","nativeType":null,"relationName":"DayDemandToDemandWeek","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["weekStartDate"]],"uniqueIndexes":[{"name":null,"fields":["weekStartDate"]}],"isGenerated":false},"DayDemand":{"dbName":"day_demands","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"demandWeekId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"demandWeek","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DemandWeek","nativeType":null,"relationName":"DayDemandToDemandWeek","relationFromFields":["demandWeekId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"categoryId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"category","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Category","nativeType":null,"relationName":"CategoryToDayDemand","relationFromFields":["categoryId"],"relationToFields":["id"],"relationOnDelete":"Restrict","isGenerated":false,"isUpdatedAt":false},{"name":"date","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":["Date",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"requiredCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["demandWeekId","categoryId","date"]],"uniqueIndexes":[{"name":null,"fields":["demandWeekId","categoryId","date"]}],"isGenerated":false},"LeaveRequest":{"dbName":"leave_requests","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"LeaveRequestToUser","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"leaveType","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LeaveType","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"startDate","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":["Date",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"endDate","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":["Date",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"reason","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"LeaveStatus","nativeType":null,"default":"PENDING","isGenerated":false,"isUpdatedAt":false},{"name":"adminNote","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"reviewedById","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"reviewedBy","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Admin","nativeType":null,"relationName":"LeaveReviewedBy","relationFromFields":["reviewedById"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"reviewedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"affectedShifts","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Shift","nativeType":null,"relationName":"LeaveRequestToShift","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Notification":{"dbName":"notifications","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"NotificationToUser","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"NotificationType","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"channel","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"NotificationChannel","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"NotificationStatus","nativeType":null,"default":"PENDING","isGenerated":false,"isUpdatedAt":false},{"name":"title","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"body","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"payload","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"sentAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"readAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"failReason","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"OrgSettings":{"dbName":"org_settings","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"maxDailyHours","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Decimal","nativeType":["Decimal",["4","2"]],"isGenerated":false,"isUpdatedAt":false},{"name":"maxWeeklyHours","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Decimal","nativeType":["Decimal",["4","2"]],"isGenerated":false,"isUpdatedAt":false},{"name":"minRestHoursBetweenShifts","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Decimal","nativeType":["Decimal",["4","2"]],"isGenerated":false,"isUpdatedAt":false},{"name":"minBreakMinutes","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"breakRequiredAfterHours","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Decimal","nativeType":["Decimal",["4","2"]],"default":5.5,"isGenerated":false,"isUpdatedAt":false},{"name":"breakRules","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"sessionTimeoutMinutes","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":30,"isGenerated":false,"isUpdatedAt":false},{"name":"notificationPrefs","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"swapExpiryHours","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":72,"isGenerated":false,"isUpdatedAt":false},{"name":"earlyClockInWindowMinutes","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":15,"isGenerated":false,"isUpdatedAt":false},{"name":"defaultShiftStartTime","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"09:00","isGenerated":false,"isUpdatedAt":false},{"name":"defaultShiftEndTime","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"17:00","isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"updatedById","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"RuleCheckLog":{"dbName":"rule_check_logs","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"context","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"entityId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"passed","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Boolean","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"details","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"checkedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"checkedById","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"checkedBy","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Admin","nativeType":null,"relationName":"RuleCheckActor","relationFromFields":["checkedById"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"WeeklyPlan":{"dbName":"weekly_plans","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"year","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"month","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"weekNumber","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"weekStartDate","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":["Date",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"weekEndDate","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":["Date",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"PlanStatus","nativeType":null,"default":"DRAFT","isGenerated":false,"isUpdatedAt":false},{"name":"submittedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"submittedById","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"submittedBy","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Admin","nativeType":null,"relationName":"PlanSubmittedBy","relationFromFields":["submittedById"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"needsRenotify","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","nativeType":null,"default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"shifts","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Shift","nativeType":null,"relationName":"ShiftToWeeklyPlan","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"demands","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"StaffingDemand","nativeType":null,"relationName":"StaffingDemandToWeeklyPlan","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["year","month","weekNumber"]],"uniqueIndexes":[{"name":null,"fields":["year","month","weekNumber"]}],"isGenerated":false},"Shift":{"dbName":"shifts","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"weeklyPlanId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"weeklyPlan","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"WeeklyPlan","nativeType":null,"relationName":"ShiftToWeeklyPlan","relationFromFields":["weeklyPlanId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"ShiftToUser","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Restrict","isGenerated":false,"isUpdatedAt":false},{"name":"categoryId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"category","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Category","nativeType":null,"relationName":"CategoryToShift","relationFromFields":["categoryId"],"relationToFields":["id"],"relationOnDelete":"Restrict","isGenerated":false,"isUpdatedAt":false},{"name":"date","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":["Date",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"startTime","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"endTime","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"actualStartTime","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"actualEndTime","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"actualBreakMinutes","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"ShiftStatus","nativeType":null,"default":"PENDING","isGenerated":false,"isUpdatedAt":false},{"name":"rejectionReason","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"ruleViolations","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"rulePassed","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","nativeType":null,"default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"notifiedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"leaveRequestId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"leaveRequest","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LeaveRequest","nativeType":null,"relationName":"LeaveRequestToShift","relationFromFields":["leaveRequestId"],"relationToFields":["id"],"relationOnDelete":"SetNull","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"swapsAsInitiatorShift","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"SwapRequest","nativeType":null,"relationName":"InitiatorShift","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"swapsAsRecipientShift","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"SwapRequest","nativeType":null,"relationName":"RecipientShift","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"timeEntries","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"TimeEntry","nativeType":null,"relationName":"ShiftToTimeEntry","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"ShiftOffer":{"dbName":"shift_offers","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"jobTitle","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"categoryId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"category","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Category","nativeType":null,"relationName":"CategoryToShiftOffer","relationFromFields":["categoryId"],"relationToFields":["id"],"relationOnDelete":"Restrict","isGenerated":false,"isUpdatedAt":false},{"name":"startTime","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"endTime","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"hourlyPrice","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Decimal","nativeType":["Decimal",["10","2"]],"isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdById","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdBy","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Admin","nativeType":null,"relationName":"ShiftOfferCreatedBy","relationFromFields":["createdById"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"notifiedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"responses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftOfferResponse","nativeType":null,"relationName":"ShiftOfferToShiftOfferResponse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"swapsAsInitiatorShift","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftSwapRequest","nativeType":null,"relationName":"ShiftSwapInitiatorShift","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"swapsAsRecipientShift","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftSwapRequest","nativeType":null,"relationName":"ShiftSwapRecipientShift","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"ShiftOfferResponse":{"dbName":"shift_offer_responses","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"shiftOfferId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"shiftOffer","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftOffer","nativeType":null,"relationName":"ShiftOfferToShiftOfferResponse","relationFromFields":["shiftOfferId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"ShiftOfferResponseToUser","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftResponseStatus","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"respondedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"approvalStatus","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"ShiftApprovalStatus","nativeType":null,"default":"PENDING","isGenerated":false,"isUpdatedAt":false},{"name":"approvedById","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"approvedBy","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Admin","nativeType":null,"relationName":"ResponseApprovedBy","relationFromFields":["approvedById"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"approvedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"approvalNote","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["shiftOfferId","userId"]],"uniqueIndexes":[{"name":null,"fields":["shiftOfferId","userId"]}],"isGenerated":false},"ShiftSwapRequest":{"dbName":"shift_swap_requests","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"initiatorUserId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"initiatorUser","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"ShiftSwapInitiatorUser","relationFromFields":["initiatorUserId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"initiatorShiftId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"initiatorShift","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftOffer","nativeType":null,"relationName":"ShiftSwapInitiatorShift","relationFromFields":["initiatorShiftId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"recipientUserId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"recipientUser","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"ShiftSwapRecipientUser","relationFromFields":["recipientUserId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"recipientShiftId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"recipientShift","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftOffer","nativeType":null,"relationName":"ShiftSwapRecipientShift","relationFromFields":["recipientShiftId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"ShiftSwapStatus","nativeType":null,"default":"PENDING","isGenerated":false,"isUpdatedAt":false},{"name":"reason","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"reviewedById","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"reviewedBy","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Admin","nativeType":null,"relationName":"ShiftSwapReviewedBy","relationFromFields":["reviewedById"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"reviewedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"adminNote","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"SwapRequest":{"dbName":"swap_requests","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"swapType","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"SwapType","nativeType":null,"default":"TARGETED","isGenerated":false,"isUpdatedAt":false},{"name":"initiatorUserId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"initiatorUser","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"SwapInitiator","relationFromFields":["initiatorUserId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"initiatorShiftId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"initiatorShift","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Shift","nativeType":null,"relationName":"InitiatorShift","relationFromFields":["initiatorShiftId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"recipientUserId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"recipientUser","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"SwapRecipient","relationFromFields":["recipientUserId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"recipientShiftId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"recipientShift","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Shift","nativeType":null,"relationName":"RecipientShift","relationFromFields":["recipientShiftId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"SwapStatus","nativeType":null,"default":"PENDING_RECIPIENT","isGenerated":false,"isUpdatedAt":false},{"name":"recipientRespondedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"ruleCheckResult","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"ruleCheckPassed","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Boolean","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"ruleCheckedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"approvedById","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"approvedBy","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Admin","nativeType":null,"relationName":"SwapAdmin","relationFromFields":["approvedById"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"adminReason","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"resolvedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"expiresAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"StaffingDemand":{"dbName":"staffing_demands","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"weeklyPlanId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"weeklyPlan","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"WeeklyPlan","nativeType":null,"relationName":"StaffingDemandToWeeklyPlan","relationFromFields":["weeklyPlanId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"date","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":["Date",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"categoryId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"category","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Category","nativeType":null,"relationName":"CategoryToStaffingDemand","relationFromFields":["categoryId"],"relationToFields":["id"],"relationOnDelete":"Restrict","isGenerated":false,"isUpdatedAt":false},{"name":"requiredCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"startTime","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"endTime","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"note","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["weeklyPlanId","date","categoryId","startTime"]],"uniqueIndexes":[{"name":null,"fields":["weeklyPlanId","date","categoryId","startTime"]}],"isGenerated":false},"User":{"dbName":"users","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"email","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"passwordHash","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"mustChangePassword","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","nativeType":null,"default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"isActive","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","nativeType":null,"default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"lastLoginAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"firstName","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"lastName","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"phone","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"address","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"department","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"designation","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"employeeType","kind":"enum","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"EmployeeType","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"contractType","kind":"enum","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ContractType","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"workloadPercent","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Decimal","nativeType":["Decimal",["5","2"]],"isGenerated":false,"isUpdatedAt":false},{"name":"hourlyRate","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Decimal","nativeType":["Decimal",["10","2"]],"isGenerated":false,"isUpdatedAt":false},{"name":"monthlySalary","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Decimal","nativeType":["Decimal",["10","2"]],"isGenerated":false,"isUpdatedAt":false},{"name":"contractedHoursMonthly","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Decimal","nativeType":["Decimal",["6","2"]],"isGenerated":false,"isUpdatedAt":false},{"name":"hireDate","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"deactivatedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"categories","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"UserCategory","nativeType":null,"relationName":"UserToUserCategory","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"availabilityMonths","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AvailabilityMonth","nativeType":null,"relationName":"AvailabilityMonthToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"shifts","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Shift","nativeType":null,"relationName":"ShiftToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"shiftOfferResponses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftOfferResponse","nativeType":null,"relationName":"ShiftOfferResponseToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"initiatedShiftSwaps","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftSwapRequest","nativeType":null,"relationName":"ShiftSwapInitiatorUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"receivedShiftSwaps","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ShiftSwapRequest","nativeType":null,"relationName":"ShiftSwapRecipientUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"initiatedSwaps","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"SwapRequest","nativeType":null,"relationName":"SwapInitiator","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"receivedSwaps","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"SwapRequest","nativeType":null,"relationName":"SwapRecipient","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"receivedCredentials","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"CredentialDelivery","nativeType":null,"relationName":"CredentialRecipient","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"notifications","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Notification","nativeType":null,"relationName":"NotificationToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"refreshTokens","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"UserRefreshToken","nativeType":null,"relationName":"UserToUserRefreshToken","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"timeEntries","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"TimeEntry","nativeType":null,"relationName":"TimeEntryToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"leaveRequests","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LeaveRequest","nativeType":null,"relationName":"LeaveRequestToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"UserRefreshToken":{"dbName":"user_refresh_tokens","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"UserToUserRefreshToken","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"tokenHash","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"deviceInfo","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"expiresAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"revokedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"CredentialDelivery":{"dbName":"credential_deliveries","schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"cuid","args":[1]},"isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"CredentialRecipient","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"method","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"CredentialDeliveryMethod","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"deliveredById","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"deliveredBy","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Admin","nativeType":null,"relationName":"DeliveredBy","relationFromFields":["deliveredById"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"deliveredAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"note","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false}},"enums":{"TimeEntryStatus":{"values":[{"name":"ACTIVE","dbName":null},{"name":"ON_BREAK","dbName":null},{"name":"COMPLETED","dbName":null}],"dbName":null},"DemandWeekStatus":{"values":[{"name":"DRAFT","dbName":null},{"name":"PUBLISHED","dbName":null}],"dbName":null},"AvailabilityMonthStatus":{"values":[{"name":"DRAFT","dbName":null},{"name":"SUBMITTED","dbName":null},{"name":"LOCKED","dbName":null}],"dbName":null},"DayAvailabilityStatus":{"values":[{"name":"AVAILABLE","dbName":null},{"name":"UNAVAILABLE","dbName":null},{"name":"WISH","dbName":null}],"dbName":null},"NotificationType":{"values":[{"name":"WEEKLY_SHIFTS_PUBLISHED","dbName":null},{"name":"SHIFT_OFFER_PUBLISHED","dbName":null},{"name":"AVAILABILITY_REMINDER","dbName":null},{"name":"SWAP_REQUEST_RECEIVED","dbName":null},{"name":"SWAP_REQUEST_RESULT","dbName":null},{"name":"SWAP_PENDING_ADMIN_APPROVAL","dbName":null},{"name":"SHIFT_CHANGED","dbName":null},{"name":"RULE_VIOLATION","dbName":null},{"name":"LEAVE_REQUEST_RESULT","dbName":null},{"name":"GENERAL","dbName":null}],"dbName":null},"NotificationChannel":{"values":[{"name":"PUSH","dbName":null},{"name":"EMAIL","dbName":null},{"name":"IN_APP","dbName":null}],"dbName":null},"NotificationStatus":{"values":[{"name":"PENDING","dbName":null},{"name":"SENT","dbName":null},{"name":"FAILED","dbName":null},{"name":"READ","dbName":null}],"dbName":null},"PlanStatus":{"values":[{"name":"DRAFT","dbName":null},{"name":"SUBMITTED","dbName":null},{"name":"PUBLISHED","dbName":null}],"dbName":null},"ShiftStatus":{"values":[{"name":"PENDING","dbName":null},{"name":"ACCEPTED","dbName":null},{"name":"REJECTED","dbName":null},{"name":"CANCELLED","dbName":null},{"name":"SWAPPED_OUT","dbName":null}],"dbName":null},"SwapType":{"values":[{"name":"TARGETED","dbName":null},{"name":"OPEN","dbName":null}],"dbName":null},"SwapStatus":{"values":[{"name":"PENDING_RECIPIENT","dbName":null},{"name":"PENDING_ADMIN_APPROVAL","dbName":null},{"name":"APPROVED","dbName":null},{"name":"REJECTED","dbName":null},{"name":"EXPIRED","dbName":null},{"name":"CANCELLED","dbName":null}],"dbName":null},"CredentialDeliveryMethod":{"values":[{"name":"EMAIL","dbName":null},{"name":"SMS","dbName":null},{"name":"IN_PERSON","dbName":null}],"dbName":null},"ContractType":{"values":[{"name":"HOURLY","dbName":null},{"name":"MONTHLY_SALARY","dbName":null},{"name":"WORKLOAD_PERCENT","dbName":null}],"dbName":null},"EmployeeType":{"values":[{"name":"FULL_TIME","dbName":null},{"name":"PART_TIME","dbName":null}],"dbName":null},"ShiftResponseStatus":{"values":[{"name":"ACCEPTED","dbName":null},{"name":"REJECTED","dbName":null}],"dbName":null},"ShiftApprovalStatus":{"values":[{"name":"PENDING","dbName":null},{"name":"APPROVED","dbName":null},{"name":"REJECTED","dbName":null}],"dbName":null},"ShiftSwapStatus":{"values":[{"name":"PENDING","dbName":null},{"name":"APPROVED","dbName":null},{"name":"REJECTED","dbName":null},{"name":"CANCELLED","dbName":null}],"dbName":null},"LeaveType":{"values":[{"name":"VACATION","dbName":null},{"name":"SICK","dbName":null},{"name":"PERSONAL","dbName":null},{"name":"OTHER","dbName":null}],"dbName":null},"LeaveStatus":{"values":[{"name":"PENDING","dbName":null},{"name":"APPROVED","dbName":null},{"name":"REJECTED","dbName":null},{"name":"CANCELLED","dbName":null}],"dbName":null}},"types":{}}');
config.engineWasm = void 0;
config.compilerWasm = void 0;
function getPrismaClientClass(dirname2) {
  config.dirname = dirname2;
  return runtime.getPrismaClient(config);
}

// src/generated/prisma/internal/prismaNamespace.ts
var prismaNamespace_exports = {};
__export(prismaNamespace_exports, {
  AdminRefreshTokenScalarFieldEnum: () => AdminRefreshTokenScalarFieldEnum,
  AdminScalarFieldEnum: () => AdminScalarFieldEnum,
  AnyNull: () => AnyNull,
  AuditLogScalarFieldEnum: () => AuditLogScalarFieldEnum,
  AvailabilityDayScalarFieldEnum: () => AvailabilityDayScalarFieldEnum,
  AvailabilityMonthScalarFieldEnum: () => AvailabilityMonthScalarFieldEnum,
  CategoryScalarFieldEnum: () => CategoryScalarFieldEnum,
  CredentialDeliveryScalarFieldEnum: () => CredentialDeliveryScalarFieldEnum,
  DayDemandScalarFieldEnum: () => DayDemandScalarFieldEnum,
  DbNull: () => DbNull,
  Decimal: () => Decimal2,
  DemandWeekScalarFieldEnum: () => DemandWeekScalarFieldEnum,
  JsonNull: () => JsonNull,
  JsonNullValueFilter: () => JsonNullValueFilter,
  JsonNullValueInput: () => JsonNullValueInput,
  LeaveRequestScalarFieldEnum: () => LeaveRequestScalarFieldEnum,
  ModelName: () => ModelName,
  NotificationScalarFieldEnum: () => NotificationScalarFieldEnum,
  NullTypes: () => NullTypes,
  NullableJsonNullValueInput: () => NullableJsonNullValueInput,
  NullsOrder: () => NullsOrder,
  OrgSettingsScalarFieldEnum: () => OrgSettingsScalarFieldEnum,
  PrismaClientInitializationError: () => PrismaClientInitializationError2,
  PrismaClientKnownRequestError: () => PrismaClientKnownRequestError2,
  PrismaClientRustPanicError: () => PrismaClientRustPanicError2,
  PrismaClientUnknownRequestError: () => PrismaClientUnknownRequestError2,
  PrismaClientValidationError: () => PrismaClientValidationError2,
  QueryMode: () => QueryMode,
  RuleCheckLogScalarFieldEnum: () => RuleCheckLogScalarFieldEnum,
  ShiftOfferResponseScalarFieldEnum: () => ShiftOfferResponseScalarFieldEnum,
  ShiftOfferScalarFieldEnum: () => ShiftOfferScalarFieldEnum,
  ShiftScalarFieldEnum: () => ShiftScalarFieldEnum,
  ShiftSwapRequestScalarFieldEnum: () => ShiftSwapRequestScalarFieldEnum,
  SortOrder: () => SortOrder,
  Sql: () => Sql2,
  StaffingDemandScalarFieldEnum: () => StaffingDemandScalarFieldEnum,
  SwapRequestScalarFieldEnum: () => SwapRequestScalarFieldEnum,
  TimeEntryScalarFieldEnum: () => TimeEntryScalarFieldEnum,
  TransactionIsolationLevel: () => TransactionIsolationLevel,
  UserCategoryScalarFieldEnum: () => UserCategoryScalarFieldEnum,
  UserRefreshTokenScalarFieldEnum: () => UserRefreshTokenScalarFieldEnum,
  UserScalarFieldEnum: () => UserScalarFieldEnum,
  WeeklyPlanScalarFieldEnum: () => WeeklyPlanScalarFieldEnum,
  defineExtension: () => defineExtension,
  empty: () => empty2,
  getExtensionContext: () => getExtensionContext,
  join: () => join2,
  prismaVersion: () => prismaVersion,
  raw: () => raw2,
  sql: () => sql
});
import * as runtime2 from "@prisma/client/runtime/library";
var PrismaClientKnownRequestError2 = runtime2.PrismaClientKnownRequestError;
var PrismaClientUnknownRequestError2 = runtime2.PrismaClientUnknownRequestError;
var PrismaClientRustPanicError2 = runtime2.PrismaClientRustPanicError;
var PrismaClientInitializationError2 = runtime2.PrismaClientInitializationError;
var PrismaClientValidationError2 = runtime2.PrismaClientValidationError;
var sql = runtime2.sqltag;
var empty2 = runtime2.empty;
var join2 = runtime2.join;
var raw2 = runtime2.raw;
var Sql2 = runtime2.Sql;
var Decimal2 = runtime2.Decimal;
var getExtensionContext = runtime2.Extensions.getExtensionContext;
var prismaVersion = {
  client: "6.19.3",
  engine: "c2990dca591cba766e3b7ef5d9e8a84796e47ab7"
};
var NullTypes = {
  DbNull: runtime2.objectEnumValues.classes.DbNull,
  JsonNull: runtime2.objectEnumValues.classes.JsonNull,
  AnyNull: runtime2.objectEnumValues.classes.AnyNull
};
var DbNull = runtime2.objectEnumValues.instances.DbNull;
var JsonNull = runtime2.objectEnumValues.instances.JsonNull;
var AnyNull = runtime2.objectEnumValues.instances.AnyNull;
var ModelName = {
  Admin: "Admin",
  AdminRefreshToken: "AdminRefreshToken",
  TimeEntry: "TimeEntry",
  AuditLog: "AuditLog",
  AvailabilityMonth: "AvailabilityMonth",
  AvailabilityDay: "AvailabilityDay",
  Category: "Category",
  UserCategory: "UserCategory",
  DemandWeek: "DemandWeek",
  DayDemand: "DayDemand",
  LeaveRequest: "LeaveRequest",
  Notification: "Notification",
  OrgSettings: "OrgSettings",
  RuleCheckLog: "RuleCheckLog",
  WeeklyPlan: "WeeklyPlan",
  Shift: "Shift",
  ShiftOffer: "ShiftOffer",
  ShiftOfferResponse: "ShiftOfferResponse",
  ShiftSwapRequest: "ShiftSwapRequest",
  SwapRequest: "SwapRequest",
  StaffingDemand: "StaffingDemand",
  User: "User",
  UserRefreshToken: "UserRefreshToken",
  CredentialDelivery: "CredentialDelivery"
};
var TransactionIsolationLevel = runtime2.makeStrictEnum({
  ReadUncommitted: "ReadUncommitted",
  ReadCommitted: "ReadCommitted",
  RepeatableRead: "RepeatableRead",
  Serializable: "Serializable"
});
var AdminScalarFieldEnum = {
  id: "id",
  email: "email",
  passwordHash: "passwordHash",
  isActive: "isActive",
  lastLoginAt: "lastLoginAt",
  name: "name",
  firstName: "firstName",
  lastName: "lastName",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var AdminRefreshTokenScalarFieldEnum = {
  id: "id",
  adminId: "adminId",
  tokenHash: "tokenHash",
  deviceInfo: "deviceInfo",
  expiresAt: "expiresAt",
  revokedAt: "revokedAt",
  createdAt: "createdAt"
};
var TimeEntryScalarFieldEnum = {
  id: "id",
  userId: "userId",
  shiftId: "shiftId",
  clockInAt: "clockInAt",
  clockOutAt: "clockOutAt",
  breakStartedAt: "breakStartedAt",
  breakMinutes: "breakMinutes",
  latitude: "latitude",
  longitude: "longitude",
  location: "location",
  status: "status",
  workedMinutes: "workedMinutes",
  lateMinutes: "lateMinutes",
  overtimeMinutes: "overtimeMinutes",
  note: "note",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var AuditLogScalarFieldEnum = {
  id: "id",
  actorId: "actorId",
  action: "action",
  entityType: "entityType",
  entityId: "entityId",
  metadata: "metadata",
  createdAt: "createdAt"
};
var AvailabilityMonthScalarFieldEnum = {
  id: "id",
  userId: "userId",
  year: "year",
  month: "month",
  status: "status",
  cutoffAt: "cutoffAt",
  submittedAt: "submittedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var AvailabilityDayScalarFieldEnum = {
  id: "id",
  availabilityMonthId: "availabilityMonthId",
  date: "date",
  status: "status",
  note: "note",
  preferredStartTime: "preferredStartTime",
  preferredEndTime: "preferredEndTime"
};
var CategoryScalarFieldEnum = {
  id: "id",
  name: "name",
  parentId: "parentId",
  isActive: "isActive",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var UserCategoryScalarFieldEnum = {
  userId: "userId",
  categoryId: "categoryId",
  assignedAt: "assignedAt"
};
var DemandWeekScalarFieldEnum = {
  id: "id",
  weekStartDate: "weekStartDate",
  weekEndDate: "weekEndDate",
  status: "status",
  publishedAt: "publishedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var DayDemandScalarFieldEnum = {
  id: "id",
  demandWeekId: "demandWeekId",
  categoryId: "categoryId",
  date: "date",
  requiredCount: "requiredCount",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var LeaveRequestScalarFieldEnum = {
  id: "id",
  userId: "userId",
  leaveType: "leaveType",
  startDate: "startDate",
  endDate: "endDate",
  reason: "reason",
  status: "status",
  adminNote: "adminNote",
  reviewedById: "reviewedById",
  reviewedAt: "reviewedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var NotificationScalarFieldEnum = {
  id: "id",
  userId: "userId",
  type: "type",
  channel: "channel",
  status: "status",
  title: "title",
  body: "body",
  payload: "payload",
  sentAt: "sentAt",
  readAt: "readAt",
  failReason: "failReason",
  createdAt: "createdAt"
};
var OrgSettingsScalarFieldEnum = {
  id: "id",
  maxDailyHours: "maxDailyHours",
  maxWeeklyHours: "maxWeeklyHours",
  minRestHoursBetweenShifts: "minRestHoursBetweenShifts",
  minBreakMinutes: "minBreakMinutes",
  breakRequiredAfterHours: "breakRequiredAfterHours",
  breakRules: "breakRules",
  sessionTimeoutMinutes: "sessionTimeoutMinutes",
  notificationPrefs: "notificationPrefs",
  swapExpiryHours: "swapExpiryHours",
  earlyClockInWindowMinutes: "earlyClockInWindowMinutes",
  defaultShiftStartTime: "defaultShiftStartTime",
  defaultShiftEndTime: "defaultShiftEndTime",
  updatedAt: "updatedAt",
  updatedById: "updatedById"
};
var RuleCheckLogScalarFieldEnum = {
  id: "id",
  context: "context",
  entityId: "entityId",
  passed: "passed",
  details: "details",
  checkedAt: "checkedAt",
  checkedById: "checkedById"
};
var WeeklyPlanScalarFieldEnum = {
  id: "id",
  year: "year",
  month: "month",
  weekNumber: "weekNumber",
  weekStartDate: "weekStartDate",
  weekEndDate: "weekEndDate",
  status: "status",
  submittedAt: "submittedAt",
  submittedById: "submittedById",
  needsRenotify: "needsRenotify",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var ShiftScalarFieldEnum = {
  id: "id",
  weeklyPlanId: "weeklyPlanId",
  userId: "userId",
  categoryId: "categoryId",
  date: "date",
  startTime: "startTime",
  endTime: "endTime",
  actualStartTime: "actualStartTime",
  actualEndTime: "actualEndTime",
  actualBreakMinutes: "actualBreakMinutes",
  status: "status",
  rejectionReason: "rejectionReason",
  ruleViolations: "ruleViolations",
  rulePassed: "rulePassed",
  notifiedAt: "notifiedAt",
  leaveRequestId: "leaveRequestId",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var ShiftOfferScalarFieldEnum = {
  id: "id",
  jobTitle: "jobTitle",
  categoryId: "categoryId",
  startTime: "startTime",
  endTime: "endTime",
  hourlyPrice: "hourlyPrice",
  description: "description",
  createdById: "createdById",
  notifiedAt: "notifiedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var ShiftOfferResponseScalarFieldEnum = {
  id: "id",
  shiftOfferId: "shiftOfferId",
  userId: "userId",
  status: "status",
  respondedAt: "respondedAt",
  approvalStatus: "approvalStatus",
  approvedById: "approvedById",
  approvedAt: "approvedAt",
  approvalNote: "approvalNote"
};
var ShiftSwapRequestScalarFieldEnum = {
  id: "id",
  initiatorUserId: "initiatorUserId",
  initiatorShiftId: "initiatorShiftId",
  recipientUserId: "recipientUserId",
  recipientShiftId: "recipientShiftId",
  status: "status",
  reason: "reason",
  reviewedById: "reviewedById",
  reviewedAt: "reviewedAt",
  adminNote: "adminNote",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var SwapRequestScalarFieldEnum = {
  id: "id",
  swapType: "swapType",
  initiatorUserId: "initiatorUserId",
  initiatorShiftId: "initiatorShiftId",
  recipientUserId: "recipientUserId",
  recipientShiftId: "recipientShiftId",
  status: "status",
  recipientRespondedAt: "recipientRespondedAt",
  ruleCheckResult: "ruleCheckResult",
  ruleCheckPassed: "ruleCheckPassed",
  ruleCheckedAt: "ruleCheckedAt",
  approvedById: "approvedById",
  adminReason: "adminReason",
  resolvedAt: "resolvedAt",
  expiresAt: "expiresAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var StaffingDemandScalarFieldEnum = {
  id: "id",
  weeklyPlanId: "weeklyPlanId",
  date: "date",
  categoryId: "categoryId",
  requiredCount: "requiredCount",
  startTime: "startTime",
  endTime: "endTime",
  note: "note",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var UserScalarFieldEnum = {
  id: "id",
  email: "email",
  passwordHash: "passwordHash",
  mustChangePassword: "mustChangePassword",
  isActive: "isActive",
  lastLoginAt: "lastLoginAt",
  name: "name",
  firstName: "firstName",
  lastName: "lastName",
  phone: "phone",
  address: "address",
  department: "department",
  designation: "designation",
  employeeType: "employeeType",
  contractType: "contractType",
  workloadPercent: "workloadPercent",
  hourlyRate: "hourlyRate",
  monthlySalary: "monthlySalary",
  contractedHoursMonthly: "contractedHoursMonthly",
  hireDate: "hireDate",
  deactivatedAt: "deactivatedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var UserRefreshTokenScalarFieldEnum = {
  id: "id",
  userId: "userId",
  tokenHash: "tokenHash",
  deviceInfo: "deviceInfo",
  expiresAt: "expiresAt",
  revokedAt: "revokedAt",
  createdAt: "createdAt"
};
var CredentialDeliveryScalarFieldEnum = {
  id: "id",
  userId: "userId",
  method: "method",
  deliveredById: "deliveredById",
  deliveredAt: "deliveredAt",
  note: "note"
};
var SortOrder = {
  asc: "asc",
  desc: "desc"
};
var NullableJsonNullValueInput = {
  DbNull,
  JsonNull
};
var JsonNullValueInput = {
  JsonNull
};
var QueryMode = {
  default: "default",
  insensitive: "insensitive"
};
var NullsOrder = {
  first: "first",
  last: "last"
};
var JsonNullValueFilter = {
  DbNull,
  JsonNull,
  AnyNull
};
var defineExtension = runtime2.Extensions.defineExtension;

// src/generated/prisma/client.ts
globalThis["__dirname"] = path.dirname(fileURLToPath(import.meta.url));
var PrismaClient = getPrismaClientClass(__dirname);
path.join(__dirname, "query_engine-windows.dll.node");
path.join(process2.cwd(), "src/generated/prisma/query_engine-windows.dll.node");
path.join(__dirname, "libquery_engine-rhel-openssl-3.0.x.so.node");
path.join(process2.cwd(), "src/generated/prisma/libquery_engine-rhel-openssl-3.0.x.so.node");

// src/utils/handlePrismaError.ts
var handlePrismaError = (error) => {
  let statusCode = 400;
  let message = "An unexpected database error occurred";
  let errorDetails = {};
  if (error instanceof prismaNamespace_exports.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        const target = error.meta?.target?.join(", ") || "field";
        message = `Duplicate entry found: A record with this ${target} already exists.`;
        break;
      case "P2003":
        statusCode = 409;
        message = "This record is linked to other data and cannot be modified or deleted.";
        break;
      case "P2025":
        statusCode = 404;
        message = error.meta?.cause || "The requested record was not found.";
        break;
      case "P2000":
        message = "Input overflow: One of the values provided is too long for the database column.";
        break;
      case "P2014":
        message = "The change you are trying to make would violate a required relationship.";
        break;
      case "P2024":
        statusCode = 504;
        message = "Database connection timed out. Please try again.";
        break;
      default:
        message = `Database Error (${error.code}): Contact support if this persists.`;
        break;
    }
  } else if (error instanceof prismaNamespace_exports.PrismaClientValidationError) {
    message = "Invalid data format: Please verify your input matches the required schema.";
  } else if (error instanceof prismaNamespace_exports.PrismaClientInitializationError) {
    statusCode = 500;
    message = "Infrastructure Error: Unable to establish a connection to the database.";
  } else if (error instanceof prismaNamespace_exports.PrismaClientRustPanicError) {
    statusCode = 500;
    message = "The database engine crashed. Our team has been notified.";
  } else if (error instanceof prismaNamespace_exports.PrismaClientUnknownRequestError) {
    statusCode = 500;
    message = "An unidentifiable database request error occurred.";
  } else if (typeof error?.message === "string") {
    const msg = error.message.toLowerCase();
    if (msg.includes("foreign key constraint")) {
      statusCode = 409;
      message = "This record is linked to other data and cannot be modified or deleted.";
    } else if (msg.includes("unique constraint")) {
      statusCode = 409;
      message = "A record with these details already exists.";
    } else if (msg.includes("not-null") || msg.includes("null value")) {
      statusCode = 400;
      message = "A required field is missing.";
    }
  }
  return {
    statusCode,
    message,
    // Optional: include original error in development for easier debugging
    stack: process.env.NODE_ENV === "development" ? error.stack : void 0
  };
};

// src/middleware/errorHandler.ts
var errorHandler = (err, req, res, _next) => {
  let statusCode = 500;
  let message = "Internal Server Error";
  const errorMessages = err?.message;
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err?.constructor?.name?.startsWith("Prisma") || err?.constructor?.name === "DriverAdapterError" || typeof err?.code === "string" && /^P\d{4}$/.test(err.code)) {
    const prismaError = handlePrismaError(err);
    statusCode = prismaError.statusCode;
    message = prismaError.message;
  }
  const context = { statusCode, method: req.method, path: req.originalUrl };
  if (statusCode >= 500) {
    logger.error({ ...context, err }, message);
  } else {
    logger.warn(context, message);
  }
  const isDev = process.env.NODE_ENV === "development";
  res.status(statusCode).json({
    success: false,
    message: message || errorMessages,
    errorDetails: {
      originalMessage: isDev ? errorMessages : void 0
    },
    stack: isDev ? err?.stack : void 0
  });
};

// src/middleware/notFound.ts
var notFound = (req, res, _next) => {
  res.status(404).json({
    success: false,
    message: `\u{1F6AB} Route not found: ${req.originalUrl}`
  });
};

// src/routes/index.route.ts
import { Router as Router25 } from "express";

// src/modules/admin/auth/auth.route.ts
import { Router } from "express";

// src/utils/asyncHandler.ts
var asyncHandler = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

// src/middleware/validateRequest.ts
var validateRequest = (schema) => (req, res, next) => {
  try {
    const result = schema.parse({
      ...req.body,
      ...req.params,
      ...req.query
    });
    req.validated = result;
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      errors: err.errors || err.message
    });
  }
};

// src/utils/jwt.ts
import jwt from "jsonwebtoken";
var createToken = (payload, secret, options) => {
  const token = jwt.sign(payload, secret, { ...options, algorithm: "HS256" });
  return token;
};
var verifyToken = (token, secret) => {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    return {
      success: true,
      data: decoded
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      error
    };
  }
};
var decodeToken = (token) => {
  const decoded = jwt.decode(token);
  return decoded;
};
var jwtUtils = {
  createToken,
  verifyToken,
  decodeToken
};

// src/middleware/auth.ts
var authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : req.cookies?.accessToken;
  if (!token) {
    sendError(res, {
      statusCode: 401,
      message: "Authentication required. No access token provided."
    });
    return;
  }
  const result = jwtUtils.verifyToken(token, envConfig.ACCESS_TOKEN_SECRET);
  if (!result.success || !result.data) {
    sendError(res, {
      statusCode: 401,
      message: "Invalid or expired access token."
    });
    return;
  }
  const { userId, email, role } = result.data;
  res.locals.auth = { userId, email, role };
  next();
};
var authorizeAdmin = (_req, res, next) => {
  console.log(res.locals.auth);
  next();
};
var authorizeUser = (_req, res, next) => {
  next();
};

// src/modules/admin/auth/auth.validation.ts
import { z as z2 } from "zod";
var adminLoginSchema = z2.object({
  email: z2.string({ required_error: "Email is required" }).email("Please provide a valid email address").trim().toLowerCase(),
  password: z2.string({ required_error: "Password is required" }).min(6, "Password must be at least 6 characters")
});
var updateAdminProfileSchema = z2.object({
  name: z2.string().trim().min(1, "Name cannot be empty").max(120).optional(),
  firstName: z2.string().trim().max(80).optional(),
  lastName: z2.string().trim().max(80).optional(),
  email: z2.string().email("Please provide a valid email address").trim().toLowerCase().optional(),
  currentPassword: z2.string().min(1, "Current password is required").optional(),
  newPassword: z2.string().min(8, "New password must be at least 8 characters").optional()
}).refine((d) => Object.keys(d).length > 0, {
  message: "Provide at least one field to update."
}).refine((d) => !(d.newPassword && !d.currentPassword), {
  message: "Current password is required to set a new password.",
  path: ["currentPassword"]
}).refine((d) => !(d.currentPassword && !d.newPassword), {
  message: "New password is required when providing the current password.",
  path: ["newPassword"]
});

// src/lib/prisma.ts
import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
var globalForPrisma = globalThis;
var pool = globalForPrisma.__pgPool ?? new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep the per-instance pool small: on serverless, many instances share the
  // database, so point DATABASE_URL at a pooled endpoint (Neon pooler /
  // PgBouncer) and let it fan out. Tunable via DB_POOL_MAX.
  max: Number(process.env.DB_POOL_MAX ?? 5)
});
var adapter = new PrismaPg(pool);
var prisma = globalForPrisma.__prisma ?? new PrismaClient({ adapter });
globalForPrisma.__pgPool = pool;
globalForPrisma.__prisma = prisma;

// src/utils/bcrypt.ts
import bcrypt from "bcrypt";
var DEFAULT_SALT_ROUNDS = 12;
var MIN_SALT_ROUNDS = 4;
var MAX_SALT_ROUNDS = 31;
var resolveSaltRounds = () => {
  const raw3 = process.env.BCRYPT_SALT_ROUNDS;
  if (!raw3) return DEFAULT_SALT_ROUNDS;
  const parsed2 = Number.parseInt(raw3, 10);
  if (!Number.isFinite(parsed2)) return DEFAULT_SALT_ROUNDS;
  if (parsed2 < MIN_SALT_ROUNDS || parsed2 > MAX_SALT_ROUNDS) return DEFAULT_SALT_ROUNDS;
  return parsed2;
};
var hashPassword = async (plainPassword, saltRounds = resolveSaltRounds()) => {
  if (!plainPassword) {
    throw new Error("Password is required for hashing.");
  }
  return bcrypt.hash(plainPassword, saltRounds);
};
var verifyPassword = async (plainPassword, passwordHash) => {
  if (!plainPassword || !passwordHash) {
    return false;
  }
  return bcrypt.compare(plainPassword, passwordHash);
};

// src/utils/token.ts
import crypto from "crypto";

// src/utils/cookie.ts
var setCookie = (res, key, value, options) => {
  res.cookie(key, value, options);
};
var getCookie = (req, key) => {
  return req.cookies[key];
};
var clearCookie = (res, key, options) => {
  res.clearCookie(key, options);
};
var CookieUtils = {
  setCookie,
  getCookie,
  clearCookie
};

// src/utils/token.ts
var hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};
var getAccessToken = (payload) => {
  return jwtUtils.createToken(
    payload,
    envConfig.ACCESS_TOKEN_SECRET,
    { expiresIn: envConfig.ACCESS_TOKEN_EXPIRES_IN }
  );
};
var getRefreshToken = (payload) => {
  return jwtUtils.createToken(
    payload,
    envConfig.REFRESH_TOKEN_SECRET,
    { expiresIn: envConfig.REFRESH_TOKEN_EXPIRES_IN }
  );
};
var setAccessTokenCookie = (res, token) => {
  CookieUtils.setCookie(res, "accessToken", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 60 * 60 * 1e3
    // 60 minutes in milliseconds
  });
};
var setRefreshTokenCookie = (res, token) => {
  CookieUtils.setCookie(res, "refreshToken", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 120 * 60 * 1e3
    // 2 days in milliseconds
  });
};
var setBetterAuthSessionCookie = (res, token) => {
  CookieUtils.setCookie(res, "better-auth.session_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 60 * 60 * 1e3
    // 60 minutes in milliseconds
  });
};
var tokenUtils = {
  hashToken,
  getAccessToken,
  getRefreshToken,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setBetterAuthSessionCookie
};

// src/modules/admin/auth/auth.service.ts
var loginAdmin = async (email, password) => {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) {
    throw new AppError("Invalid email or password.", 401);
  }
  if (!admin.isActive) {
    throw new AppError("This admin account has been deactivated.", 403);
  }
  const isPasswordValid = await verifyPassword(password, admin.passwordHash);
  if (!isPasswordValid) {
    throw new AppError("Invalid email or password.", 401);
  }
  const payload = { userId: admin.id, email: admin.email, role: "ADMIN" };
  const accessToken = tokenUtils.getAccessToken(payload);
  const refreshToken3 = tokenUtils.getRefreshToken(payload);
  const refreshTokenHash = tokenUtils.hashToken(refreshToken3);
  await prisma.adminRefreshToken.create({
    data: {
      adminId: admin.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
      // 7 days
    }
  });
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: /* @__PURE__ */ new Date() }
  });
  return {
    accessToken,
    refreshToken: refreshToken3,
    admin: {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName
    }
  };
};
var adminProfileSelect = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true
};
var getAdminProfile = async (adminId) => {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: adminProfileSelect
  });
  if (!admin) {
    throw new AppError("Admin not found.", 404);
  }
  return admin;
};
var updateAdminProfile = async (adminId, data) => {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) {
    throw new AppError("Admin not found.", 404);
  }
  const updateData = {};
  if (data.name !== void 0) updateData.name = data.name;
  if (data.firstName !== void 0) updateData.firstName = data.firstName;
  if (data.lastName !== void 0) updateData.lastName = data.lastName;
  if (data.email !== void 0 && data.email !== admin.email) {
    const taken = await prisma.admin.findUnique({ where: { email: data.email } });
    if (taken) {
      throw new AppError("An admin with this email already exists.", 409);
    }
    updateData.email = data.email;
  }
  let passwordChanged = false;
  if (data.newPassword) {
    const ok = await verifyPassword(data.currentPassword, admin.passwordHash);
    if (!ok) {
      throw new AppError("Current password is incorrect.", 401);
    }
    updateData.passwordHash = await hashPassword(data.newPassword);
    passwordChanged = true;
  }
  const updated = await prisma.admin.update({
    where: { id: adminId },
    data: updateData,
    select: adminProfileSelect
  });
  if (passwordChanged) {
    await prisma.adminRefreshToken.updateMany({
      where: { adminId, revokedAt: null },
      data: { revokedAt: /* @__PURE__ */ new Date() }
    });
  }
  return { admin: updated, passwordChanged };
};
var refreshAdminToken = async (oldRefreshToken) => {
  const decoded = jwtUtils.verifyToken(oldRefreshToken, envConfig.REFRESH_TOKEN_SECRET);
  if (!decoded.success || !decoded.data) {
    throw new AppError("Invalid or expired refresh token.", 401);
  }
  const { userId } = decoded.data;
  const storedTokens = await prisma.adminRefreshToken.findMany({
    where: {
      adminId: userId,
      revokedAt: null,
      expiresAt: { gt: /* @__PURE__ */ new Date() }
    }
  });
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
  await prisma.adminRefreshToken.update({
    where: { id: matchedToken.id },
    data: { revokedAt: /* @__PURE__ */ new Date() }
  });
  const admin = await prisma.admin.findUnique({ where: { id: userId } });
  if (!admin || !admin.isActive) {
    throw new AppError("Admin account not found or deactivated.", 403);
  }
  const payload = { userId: admin.id, email: admin.email, role: "ADMIN" };
  const newAccessToken = tokenUtils.getAccessToken(payload);
  const newRefreshToken = tokenUtils.getRefreshToken(payload);
  const newRefreshTokenHash = tokenUtils.hashToken(newRefreshToken);
  await prisma.adminRefreshToken.create({
    data: {
      adminId: admin.id,
      tokenHash: newRefreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
    }
  });
  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};
var logoutAdmin = async (refreshToken3) => {
  const decoded = jwtUtils.decodeToken(refreshToken3);
  if (!decoded?.userId) {
    throw new AppError("Invalid refresh token.", 401);
  }
  const { userId } = decoded;
  const storedTokens = await prisma.adminRefreshToken.findMany({
    where: {
      adminId: userId,
      revokedAt: null
    }
  });
  const targetHash = tokenUtils.hashToken(refreshToken3);
  for (const stored of storedTokens) {
    if (targetHash === stored.tokenHash) {
      await prisma.adminRefreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: /* @__PURE__ */ new Date() }
      });
      break;
    }
  }
};
var adminServices = {
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  refreshAdminToken,
  logoutAdmin
};

// src/modules/admin/auth/auth.controller.ts
var login = async (req, res) => {
  const { email, password } = req.validated;
  const result = await adminServices.loginAdmin(email, password);
  tokenUtils.setAccessTokenCookie(res, result.accessToken);
  tokenUtils.setRefreshTokenCookie(res, result.refreshToken);
  sendSuccess(res, {
    statusCode: 200,
    message: "Admin logged in successfully.",
    data: {
      admin: result.admin
    }
  });
};
var getProfile = async (_req, res) => {
  const { userId } = res.locals.auth;
  const admin = await adminServices.getAdminProfile(userId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Admin profile fetched successfully.",
    data: { admin }
  });
};
var updateProfile = async (req, res) => {
  const { userId } = res.locals.auth;
  const data = req.validated;
  const result = await adminServices.updateAdminProfile(userId, data);
  if (result.passwordChanged) {
    CookieUtils.clearCookie(res, "accessToken", { httpOnly: true, secure: true, sameSite: "none", path: "/" });
    CookieUtils.clearCookie(res, "refreshToken", { httpOnly: true, secure: true, sameSite: "none", path: "/" });
  }
  sendSuccess(res, {
    statusCode: 200,
    message: result.passwordChanged ? "Profile updated. Please log in again with your new password." : "Profile updated successfully.",
    data: { admin: result.admin, passwordChanged: result.passwordChanged }
  });
};
var refreshToken = async (req, res) => {
  const oldRefreshToken = req.cookies?.refreshToken;
  if (!oldRefreshToken) {
    sendError(res, {
      statusCode: 401,
      message: "No refresh token provided."
    });
    return;
  }
  const tokens = await adminServices.refreshAdminToken(oldRefreshToken);
  tokenUtils.setAccessTokenCookie(res, tokens.accessToken);
  tokenUtils.setRefreshTokenCookie(res, tokens.refreshToken);
  sendSuccess(res, {
    statusCode: 200,
    message: "Tokens refreshed successfully."
  });
};
var logout = async (req, res) => {
  const refreshTokenValue = req.cookies?.refreshToken;
  if (refreshTokenValue) {
    await adminServices.logoutAdmin(refreshTokenValue);
  }
  CookieUtils.clearCookie(res, "accessToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/"
  });
  CookieUtils.clearCookie(res, "refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/"
  });
  sendSuccess(res, {
    statusCode: 200,
    message: "Admin logged out successfully."
  });
};

// src/modules/admin/auth/auth.route.ts
var adminAuthRouter = Router();
adminAuthRouter.post("/login", authLimiter, validateRequest(adminLoginSchema), asyncHandler(login));
adminAuthRouter.post("/refresh", authLimiter, asyncHandler(refreshToken));
adminAuthRouter.post("/logout", authenticate, asyncHandler(logout));
adminAuthRouter.get("/profile", authenticate, authorizeAdmin, asyncHandler(getProfile));
adminAuthRouter.patch(
  "/profile",
  authenticate,
  authorizeAdmin,
  validateRequest(updateAdminProfileSchema),
  asyncHandler(updateProfile)
);
var auth_route_default = adminAuthRouter;

// src/modules/admin/overview/overview.route.ts
import { Router as Router2 } from "express";

// src/modules/admin/reports/reports.service.ts
var HOURS_PER_MS = 1 / (1e3 * 60 * 60);
var round2 = (n) => Math.round(n * 100) / 100;
var monthRange = (year, month) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
};
var buildReport = async (query) => {
  const now = /* @__PURE__ */ new Date();
  const year = query.year ?? now.getUTCFullYear();
  const month = query.month ?? now.getUTCMonth() + 1;
  const { start, end } = monthRange(year, month);
  const userWhere = { isActive: true };
  if (query.categoryId) userWhere.categories = { some: { categoryId: query.categoryId } };
  const employees = await prisma.user.findMany({
    where: userWhere,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      employeeType: true,
      contractType: true,
      workloadPercent: true,
      hourlyRate: true,
      monthlySalary: true,
      contractedHoursMonthly: true,
      categories: {
        select: { category: { select: { id: true, name: true } } },
        orderBy: { assignedAt: "asc" }
      }
    }
  });
  const approved = await prisma.shiftOfferResponse.findMany({
    where: {
      approvalStatus: "APPROVED",
      userId: { in: employees.map((e) => e.id) },
      shiftOffer: { startTime: { gte: start, lt: end } }
    },
    select: {
      userId: true,
      shiftOffer: { select: { startTime: true, endTime: true } }
    }
  });
  const hoursByUser = /* @__PURE__ */ new Map();
  for (const r of approved) {
    const hrs = (r.shiftOffer.endTime.getTime() - r.shiftOffer.startTime.getTime()) * HOURS_PER_MS;
    hoursByUser.set(r.userId, (hoursByUser.get(r.userId) ?? 0) + hrs);
  }
  const rows = employees.map((e) => {
    const worked = round2(hoursByUser.get(e.id) ?? 0);
    const contracted = e.contractedHoursMonthly !== null ? Number(e.contractedHoursMonthly) : null;
    const hourlyRate = e.hourlyRate !== null ? Number(e.hourlyRate) : null;
    const monthlySalary = e.monthlySalary !== null ? Number(e.monthlySalary) : null;
    const overtimeHours = contracted !== null ? round2(Math.max(0, worked - contracted)) : 0;
    const dueHours = contracted !== null ? round2(Math.max(0, contracted - worked)) : 0;
    const wageCost = hourlyRate !== null ? round2(worked * hourlyRate) : monthlySalary !== null ? round2(monthlySalary) : 0;
    return {
      userId: e.id,
      name: e.name,
      email: e.email,
      employeeType: e.employeeType,
      contractType: e.contractType,
      workloadPercent: e.workloadPercent !== null ? Number(e.workloadPercent) : null,
      categories: e.categories.map((c) => c.category),
      contractedHours: contracted,
      scheduledHours: worked,
      workedHours: worked,
      overtimeHours,
      dueHours,
      hourlyRate,
      monthlySalary,
      wageCost
    };
  });
  const summary = rows.reduce(
    (acc, r) => {
      acc.totalWorked += r.workedHours;
      acc.overtime += r.overtimeHours;
      acc.hoursDue += r.dueHours;
      acc.wageCost += r.wageCost;
      return acc;
    },
    { totalWorked: 0, overtime: 0, hoursDue: 0, wageCost: 0 }
  );
  return {
    period: { year, month },
    summary: {
      totalWorked: round2(summary.totalWorked),
      overtime: round2(summary.overtime),
      hoursDue: round2(summary.hoursDue),
      wageCost: round2(summary.wageCost),
      employeeCount: rows.length
    },
    employees: rows
  };
};
var csvCell = (value) => {
  const s = value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
var buildReportCsv = async (query) => {
  const report = await buildReport(query);
  const header = [
    "Employee",
    "Email",
    "Employee Type",
    "Contract Type",
    "Workload %",
    "Categories",
    "Contracted Hours",
    "Scheduled Hours",
    "Worked Hours",
    "Overtime Hours",
    "Due Hours",
    "Hourly Rate",
    "Monthly Salary",
    "Wage Cost"
  ];
  const lines = [header.join(",")];
  for (const r of report.employees) {
    lines.push(
      [
        csvCell(r.name ?? r.email),
        csvCell(r.email),
        csvCell(r.employeeType),
        csvCell(r.contractType),
        csvCell(r.workloadPercent),
        csvCell(r.categories.map((c) => c.name).join(" | ")),
        csvCell(r.contractedHours),
        csvCell(r.scheduledHours),
        csvCell(r.workedHours),
        csvCell(r.overtimeHours),
        csvCell(r.dueHours),
        csvCell(r.hourlyRate),
        csvCell(r.monthlySalary),
        csvCell(r.wageCost)
      ].join(",")
    );
  }
  const filename = `report-${report.period.year}-${String(report.period.month).padStart(2, "0")}.csv`;
  return { csv: lines.join("\n"), filename };
};
var reportServices = {
  buildReport,
  buildReportCsv
};

// src/modules/user/swaps/swaps.service.ts
var swapSelect = {
  id: true,
  status: true,
  reason: true,
  adminNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  initiatorUser: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
  recipientUser: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
  initiatorShift: {
    select: {
      id: true,
      jobTitle: true,
      startTime: true,
      endTime: true,
      category: { select: { id: true, name: true } }
    }
  },
  recipientShift: {
    select: {
      id: true,
      jobTitle: true,
      startTime: true,
      endTime: true,
      category: { select: { id: true, name: true } }
    }
  }
};
var assertConfirmedShift = async (userId, shiftId, label) => {
  const response = await prisma.shiftOfferResponse.findFirst({
    where: { userId, shiftOfferId: shiftId, approvalStatus: "APPROVED" },
    select: { id: true, shiftOffer: { select: { endTime: true } } }
  });
  if (!response) {
    throw new AppError(`${label} is not a confirmed shift for that employee.`, 409);
  }
  if (response.shiftOffer.endTime.getTime() < Date.now()) {
    throw new AppError(`${label} has already ended.`, 409);
  }
};
var createSwap = async (initiatorUserId, data) => {
  if (data.recipientUserId === initiatorUserId) {
    throw new AppError("You cannot swap a shift with yourself.", 400);
  }
  const recipient = await prisma.user.findUnique({
    where: { id: data.recipientUserId },
    select: { id: true, isActive: true }
  });
  if (!recipient) {
    throw new AppError("Recipient employee not found.", 404);
  }
  await assertConfirmedShift(initiatorUserId, data.initiatorShiftId, "Your shift");
  await assertConfirmedShift(data.recipientUserId, data.recipientShiftId, "The recipient's shift");
  const duplicate = await prisma.shiftSwapRequest.findFirst({
    where: {
      status: "PENDING",
      initiatorShiftId: data.initiatorShiftId,
      recipientShiftId: data.recipientShiftId
    },
    select: { id: true }
  });
  if (duplicate) {
    throw new AppError("A pending swap already exists for these shifts.", 409);
  }
  const createData = {
    initiatorUser: { connect: { id: initiatorUserId } },
    initiatorShift: { connect: { id: data.initiatorShiftId } },
    recipientUser: { connect: { id: data.recipientUserId } },
    recipientShift: { connect: { id: data.recipientShiftId } }
  };
  if (data.reason !== void 0) createData.reason = data.reason;
  const swap = await prisma.shiftSwapRequest.create({
    data: createData,
    select: swapSelect
  });
  await prisma.notification.create({
    data: {
      userId: data.recipientUserId,
      type: "SWAP_REQUEST_RECEIVED",
      channel: "IN_APP",
      status: "SENT",
      title: "Shift swap requested",
      body: `A colleague requested to swap shifts with you (pending admin approval).`,
      sentAt: /* @__PURE__ */ new Date(),
      payload: { swapId: swap.id }
    }
  });
  return swap;
};
var listMySwaps = async (userId, query) => {
  const { page, limit, status, role } = query;
  const skip = (page - 1) * limit;
  const where = {};
  if (status) where.status = status;
  if (role === "initiated") where.initiatorUserId = userId;
  else if (role === "received") where.recipientUserId = userId;
  else where.OR = [{ initiatorUserId: userId }, { recipientUserId: userId }];
  const [swaps, total] = await Promise.all([
    prisma.shiftSwapRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: swapSelect
    }),
    prisma.shiftSwapRequest.count({ where })
  ]);
  return {
    swaps,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var cancelSwap = async (userId, swapId) => {
  const swap = await prisma.shiftSwapRequest.findUnique({
    where: { id: swapId },
    select: { id: true, initiatorUserId: true, status: true }
  });
  if (!swap) {
    throw new AppError("Swap request not found.", 404);
  }
  if (swap.initiatorUserId !== userId) {
    throw new AppError("Only the employee who created the swap can cancel it.", 403);
  }
  if (swap.status !== "PENDING") {
    throw new AppError("Only pending swaps can be cancelled.", 409);
  }
  return prisma.shiftSwapRequest.update({
    where: { id: swapId },
    data: { status: "CANCELLED" },
    select: swapSelect
  });
};
var userSwapServices = {
  createSwap,
  listMySwaps,
  cancelSwap
};

// src/modules/admin/swaps/swaps.service.ts
var HOURS_PER_MS2 = 1 / (1e3 * 60 * 60);
var durationHours = (s) => (s.endTime.getTime() - s.startTime.getTime()) * HOURS_PER_MS2;
var displayName = (u) => u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);
var weekBounds = (d) => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diffToMonday = (date.getUTCDay() + 6) % 7;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
};
var dayBounds = (d) => {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { start, end };
};
var projectedHours = async (userId, window, excludeShiftId, incomingShift) => {
  const rows = await prisma.shiftOfferResponse.findMany({
    where: {
      userId,
      approvalStatus: "APPROVED",
      shiftOfferId: { not: excludeShiftId },
      shiftOffer: { startTime: { gte: window.start, lt: window.end } }
    },
    select: { shiftOffer: { select: { startTime: true, endTime: true } } }
  });
  let hours = rows.reduce((sum, r) => sum + durationHours(r.shiftOffer), 0);
  if (incomingShift.startTime >= window.start && incomingShift.startTime < window.end) {
    hours += durationHours(incomingShift);
  }
  return hours;
};
var evaluateSwapRules = async (swap) => {
  const settings = await prisma.orgSettings.findUnique({
    where: { id: 1 },
    select: { maxDailyHours: true, maxWeeklyHours: true }
  });
  const maxWeekly = settings ? Number(settings.maxWeeklyHours) : Infinity;
  const maxDaily = settings ? Number(settings.maxDailyHours) : Infinity;
  const violations = [];
  const checks = [
    {
      userId: swap.initiatorUserId,
      name: displayName(swap.initiatorUser),
      giving: swap.initiatorShiftId,
      taking: swap.recipientShift
    },
    {
      userId: swap.recipientUserId,
      name: displayName(swap.recipientUser),
      giving: swap.recipientShiftId,
      taking: swap.initiatorShift
    }
  ];
  for (const c of checks) {
    const week = await projectedHours(c.userId, weekBounds(c.taking.startTime), c.giving, c.taking);
    if (week > maxWeekly) {
      violations.push(`Would exceed ${maxWeekly}h weekly max for ${c.name}`);
    }
    const day = await projectedHours(c.userId, dayBounds(c.taking.startTime), c.giving, c.taking);
    if (day > maxDaily) {
      violations.push(`Would exceed ${maxDaily}h daily max for ${c.name}`);
    }
  }
  return { passed: violations.length === 0, violations };
};
var listSelect = {
  ...swapSelect,
  initiatorUserId: true,
  initiatorShiftId: true,
  recipientUserId: true,
  recipientShiftId: true
};
var listSwaps = async (query) => {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;
  const where = {};
  if (status) where.status = status;
  const [swaps, total] = await Promise.all([
    prisma.shiftSwapRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: listSelect
    }),
    prisma.shiftSwapRequest.count({ where })
  ]);
  const withRules = await Promise.all(
    swaps.map(async (s) => {
      const ruleCheck = s.status === "PENDING" ? await evaluateSwapRules(s) : null;
      const {
        initiatorUserId: _iu,
        initiatorShiftId: _is,
        recipientUserId: _ru,
        recipientShiftId: _rs,
        ...rest
      } = s;
      return { ...rest, ruleCheck };
    })
  );
  return {
    swaps: withRules,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var approveSwap = async (swapId, adminId, note) => {
  const swap = await prisma.shiftSwapRequest.findUnique({
    where: { id: swapId },
    select: {
      id: true,
      status: true,
      initiatorUserId: true,
      initiatorShiftId: true,
      recipientUserId: true,
      recipientShiftId: true,
      initiatorShift: { select: { jobTitle: true } },
      recipientShift: { select: { jobTitle: true } }
    }
  });
  if (!swap) throw new AppError("Swap request not found.", 404);
  if (swap.status !== "PENDING") {
    throw new AppError("Only pending swaps can be approved.", 409);
  }
  const [initiatorOk, recipientOk] = await Promise.all([
    prisma.shiftOfferResponse.findFirst({
      where: {
        userId: swap.initiatorUserId,
        shiftOfferId: swap.initiatorShiftId,
        approvalStatus: "APPROVED"
      },
      select: { id: true }
    }),
    prisma.shiftOfferResponse.findFirst({
      where: {
        userId: swap.recipientUserId,
        shiftOfferId: swap.recipientShiftId,
        approvalStatus: "APPROVED"
      },
      select: { id: true }
    })
  ]);
  if (!initiatorOk || !recipientOk) {
    throw new AppError(
      "One of the shifts is no longer confirmed for its employee; this swap can no longer be applied.",
      409
    );
  }
  const now = /* @__PURE__ */ new Date();
  const bodyInitiator = `Your shift "${swap.initiatorShift.jobTitle}" was swapped for "${swap.recipientShift.jobTitle}".`;
  const bodyRecipient = `Your shift "${swap.recipientShift.jobTitle}" was swapped for "${swap.initiatorShift.jobTitle}".`;
  const [, , , , updated] = await prisma.$transaction([
    // Clear any responses by either employee on either shift to free the
    // @@unique([shiftOfferId, userId]) slots before re-creating the swapped ones.
    prisma.shiftOfferResponse.deleteMany({
      where: {
        OR: [
          { shiftOfferId: swap.initiatorShiftId, userId: { in: [swap.initiatorUserId, swap.recipientUserId] } },
          { shiftOfferId: swap.recipientShiftId, userId: { in: [swap.initiatorUserId, swap.recipientUserId] } }
        ]
      }
    }),
    // Initiator now confirmed on the recipient's shift.
    prisma.shiftOfferResponse.create({
      data: {
        shiftOfferId: swap.recipientShiftId,
        userId: swap.initiatorUserId,
        status: "ACCEPTED",
        approvalStatus: "APPROVED",
        approvedById: adminId,
        approvedAt: now
      }
    }),
    // Recipient now confirmed on the initiator's shift.
    prisma.shiftOfferResponse.create({
      data: {
        shiftOfferId: swap.initiatorShiftId,
        userId: swap.recipientUserId,
        status: "ACCEPTED",
        approvalStatus: "APPROVED",
        approvedById: adminId,
        approvedAt: now
      }
    }),
    prisma.notification.createMany({
      data: [
        {
          userId: swap.initiatorUserId,
          type: "SWAP_REQUEST_RESULT",
          channel: "IN_APP",
          status: "SENT",
          title: "Swap approved",
          body: bodyInitiator,
          sentAt: now,
          payload: { swapId, result: "APPROVED" }
        },
        {
          userId: swap.recipientUserId,
          type: "SWAP_REQUEST_RESULT",
          channel: "IN_APP",
          status: "SENT",
          title: "Swap approved",
          body: bodyRecipient,
          sentAt: now,
          payload: { swapId, result: "APPROVED" }
        }
      ]
    }),
    prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: "APPROVED",
        reviewedById: adminId,
        reviewedAt: now,
        ...note !== void 0 ? { adminNote: note } : {}
      },
      select: swapSelect
    })
  ]);
  return updated;
};
var rejectSwap = async (swapId, adminId, note) => {
  const swap = await prisma.shiftSwapRequest.findUnique({
    where: { id: swapId },
    select: { id: true, status: true, initiatorUserId: true, recipientUserId: true }
  });
  if (!swap) throw new AppError("Swap request not found.", 404);
  if (swap.status !== "PENDING") {
    throw new AppError("Only pending swaps can be rejected.", 409);
  }
  const now = /* @__PURE__ */ new Date();
  const [, updated] = await prisma.$transaction([
    prisma.notification.createMany({
      data: [swap.initiatorUserId, swap.recipientUserId].map((userId) => ({
        userId,
        type: "SWAP_REQUEST_RESULT",
        channel: "IN_APP",
        status: "SENT",
        title: "Swap rejected",
        body: "Your shift swap request was not approved.",
        sentAt: now,
        payload: { swapId, result: "REJECTED" }
      }))
    }),
    prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: "REJECTED",
        reviewedById: adminId,
        reviewedAt: now,
        ...note !== void 0 ? { adminNote: note } : {}
      },
      select: swapSelect
    })
  ]);
  return updated;
};
var adminSwapServices = {
  listSwaps,
  approveSwap,
  rejectSwap
};

// src/modules/admin/availability/availability.service.ts
var monthDetailSelect = {
  id: true,
  userId: true,
  year: true,
  month: true,
  status: true,
  cutoffAt: true,
  submittedAt: true,
  days: {
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      status: true,
      note: true,
      preferredStartTime: true,
      preferredEndTime: true
    }
  },
  user: { select: { id: true, name: true, firstName: true, lastName: true, email: true } }
};
var openMonth = async (data) => {
  const cutoffAt = new Date(data.cutoffAt);
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
  if (users.length === 0) {
    throw new AppError("There are no active employees to open availability for.", 409);
  }
  await prisma.$transaction(
    users.map(
      (u) => prisma.availabilityMonth.upsert({
        where: { userId_year_month: { userId: u.id, year: data.year, month: data.month } },
        create: { userId: u.id, year: data.year, month: data.month, cutoffAt },
        update: { cutoffAt },
        select: { id: true }
      })
    )
  );
  return { year: data.year, month: data.month, cutoffAt, opened: users.length };
};
var getMonthStatus = async (year, month) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, firstName: true, lastName: true, email: true }
  });
  const months = await prisma.availabilityMonth.findMany({
    where: { year, month, userId: { in: users.map((u) => u.id) } },
    select: {
      userId: true,
      status: true,
      submittedAt: true,
      cutoffAt: true,
      _count: { select: { days: true } }
    }
  });
  const byUser = new Map(months.map((m) => [m.userId, m]));
  const rows = users.map((u) => {
    const m = byUser.get(u.id);
    return {
      userId: u.id,
      name: u.name,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      // NOT_OPENED = this employee has no slot for the month yet.
      status: m ? m.status : "NOT_OPENED",
      submittedAt: m?.submittedAt ?? null,
      cutoffAt: m?.cutoffAt ?? null,
      filledDays: m?._count.days ?? 0
    };
  });
  const submitted = rows.filter((r) => r.status === "SUBMITTED");
  const notSubmitted = rows.filter((r) => r.status !== "SUBMITTED");
  return {
    year,
    month,
    rows,
    notSubmitted,
    summary: { total: rows.length, submitted: submitted.length, notSubmitted: notSubmitted.length }
  };
};
var getMonthGrid = async (year, month) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, firstName: true, lastName: true, email: true }
  });
  const months = await prisma.availabilityMonth.findMany({
    where: { year, month, userId: { in: users.map((u) => u.id) } },
    select: {
      userId: true,
      status: true,
      submittedAt: true,
      cutoffAt: true,
      days: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          status: true,
          note: true,
          preferredStartTime: true,
          preferredEndTime: true
        }
      }
    }
  });
  const byUser = new Map(months.map((m) => [m.userId, m]));
  const employees = users.map((u) => {
    const m = byUser.get(u.id);
    return {
      userId: u.id,
      name: u.name,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      status: m ? m.status : "NOT_OPENED",
      submittedAt: m?.submittedAt ?? null,
      cutoffAt: m?.cutoffAt ?? null,
      days: m?.days ?? []
    };
  });
  const submitted = employees.filter((e) => e.status === "SUBMITTED").length;
  return {
    year,
    month,
    employees,
    summary: { total: employees.length, submitted, notSubmitted: employees.length - submitted }
  };
};
var getUserMonth = async (userId, year, month) => {
  const m = await prisma.availabilityMonth.findUnique({
    where: { userId_year_month: { userId, year, month } },
    select: monthDetailSelect
  });
  if (!m) {
    throw new AppError("This employee has no availability for the given month.", 404);
  }
  return m;
};
var nudge = async (userId, year, month) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    throw new AppError("Employee not found.", 404);
  }
  const m = await prisma.availabilityMonth.findUnique({
    where: { userId_year_month: { userId, year, month } },
    select: { status: true }
  });
  if (!m) {
    throw new AppError("Availability for this month has not been opened for this employee.", 409);
  }
  if (m.status === "SUBMITTED") {
    throw new AppError("This employee has already submitted their availability.", 409);
  }
  await prisma.notification.create({
    data: {
      userId,
      type: "AVAILABILITY_REMINDER",
      channel: "IN_APP",
      status: "SENT",
      title: "Availability reminder",
      body: `Please submit your availability for ${String(month).padStart(2, "0")}/${year} before the cut-off.`,
      sentAt: /* @__PURE__ */ new Date(),
      payload: { year, month }
    }
  });
  return { notified: true };
};
var adminAvailabilityServices = {
  openMonth,
  getMonthStatus,
  getMonthGrid,
  getUserMonth,
  nudge
};

// src/modules/admin/overview/overview.service.ts
var displayName2 = (u) => u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);
var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var dayName = (d) => WEEKDAYS[d.getUTCDay()];
var mealPeriod = (d) => d.getUTCHours() < 16 ? "Lunch" : "Dinner";
var dateOnly = (d) => d.toISOString().slice(0, 10);
var getOverview = async () => {
  const now = /* @__PURE__ */ new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [
    activeEmployees,
    inactiveEmployees,
    topCategories,
    subCategories,
    draftShifts,
    upcomingShifts,
    pendingApprovals,
    shiftsAwaitingApproval,
    pendingSwaps,
    thisMonth,
    plans,
    recentStaff,
    swapList,
    availabilityStatus
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.category.count({ where: { parentId: null } }),
    prisma.category.count({ where: { parentId: { not: null } } }),
    prisma.shiftOffer.count({ where: { notifiedAt: null } }),
    prisma.shiftOffer.count({ where: { notifiedAt: { not: null }, endTime: { gte: now } } }),
    // Individual acceptances still waiting on an admin decision.
    prisma.shiftOfferResponse.count({
      where: { status: "ACCEPTED", approvalStatus: "PENDING" }
    }),
    // Distinct published shifts that have at least one pending acceptance.
    prisma.shiftOffer.count({
      where: {
        notifiedAt: { not: null },
        responses: { some: { status: "ACCEPTED", approvalStatus: "PENDING" } }
      }
    }),
    // Shift swaps waiting on the admin's review.
    prisma.shiftSwapRequest.count({ where: { status: "PENDING" } }),
    // Scheduled/worked hours, overtime and wage cost for the current month.
    reportServices.buildReport({}),
    // Weekly plans (newest first) with their assignment counts.
    prisma.weeklyPlan.findMany({
      orderBy: [{ weekStartDate: "desc" }],
      take: 6,
      select: {
        id: true,
        weekNumber: true,
        weekStartDate: true,
        weekEndDate: true,
        status: true,
        _count: { select: { shifts: true } }
      }
    }),
    // Newest team members.
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        designation: true,
        department: true,
        isActive: true
      }
    }),
    // Pending swaps, already carrying an advisory rule-check result.
    adminSwapServices.listSwaps({ page: 1, limit: 5, status: "PENDING" }),
    // Monthly availability submission status for the current month.
    adminAvailabilityServices.getMonthStatus(currentYear, currentMonth)
  ]);
  return {
    kpis: {
      employees: {
        active: activeEmployees,
        inactive: inactiveEmployees,
        total: activeEmployees + inactiveEmployees
      },
      categories: {
        total: topCategories,
        subCategories
      },
      shifts: {
        draft: draftShifts,
        upcoming: upcomingShifts,
        awaitingApproval: shiftsAwaitingApproval
      },
      approvals: {
        pendingResponses: pendingApprovals
      },
      swaps: {
        pending: pendingSwaps
      }
    },
    thisMonth: {
      period: thisMonth.period,
      scheduledHours: thisMonth.summary.totalWorked,
      overtime: thisMonth.summary.overtime,
      hoursDue: thisMonth.summary.hoursDue,
      wageCost: thisMonth.summary.wageCost
    },
    plans: plans.map((p) => ({
      id: p.id,
      weekNumber: p.weekNumber,
      dateRange: { start: dateOnly(p.weekStartDate), end: dateOnly(p.weekEndDate) },
      status: p.status.toLowerCase(),
      assignmentsCount: p._count.shifts
    })),
    swaps: swapList.swaps.map((s) => ({
      id: s.id,
      fromEmployeeId: s.initiatorUser.id,
      toEmployeeId: s.recipientUser.id,
      fromEmployeeName: displayName2(s.initiatorUser),
      toEmployeeName: displayName2(s.recipientUser),
      day: dayName(s.initiatorShift.startTime),
      time: mealPeriod(s.initiatorShift.startTime),
      ruleCheck: s.ruleCheck?.passed ? "pass" : "fail"
    })),
    staff: recentStaff.map((u) => ({
      id: u.id,
      name: displayName2(u),
      designation: u.designation,
      department: u.department,
      avatar: null,
      status: u.isActive ? "Active" : "Inactive"
    })),
    availability: {
      year: availabilityStatus.year,
      month: availabilityStatus.month,
      total: availabilityStatus.summary.total,
      submitted: availabilityStatus.summary.submitted,
      notSubmitted: availabilityStatus.summary.notSubmitted
    }
  };
};
var overviewServices = { getOverview };

// src/modules/admin/overview/overview.controller.ts
var getOverview2 = async (_req, res) => {
  const overview = await overviewServices.getOverview();
  sendSuccess(res, {
    statusCode: 200,
    message: "Overview fetched successfully.",
    data: overview
  });
};

// src/modules/admin/overview/overview.route.ts
var overviewRouter = Router2();
overviewRouter.use(authenticate, authorizeAdmin);
overviewRouter.get("/", asyncHandler(getOverview2));
var overview_route_default = overviewRouter;

// src/modules/admin/employees/employees.route.ts
import { Router as Router3 } from "express";

// src/modules/admin/employees/employees.validation.ts
import { z as z3 } from "zod";
var createUserSchema = z3.object({
  email: z3.string({ required_error: "Email is required" }).email("Please provide a valid email address").trim().toLowerCase(),
  password: z3.string({ required_error: "Password is required" }).min(6, "Password must be at least 6 characters"),
  name: z3.string().trim().min(1, "Name cannot be empty").optional(),
  firstName: z3.string().trim().optional(),
  lastName: z3.string().trim().optional(),
  phone: z3.string().trim().optional(),
  address: z3.string().trim().optional(),
  department: z3.string().trim().optional(),
  designation: z3.string().trim().optional(),
  employeeType: z3.enum(["FULL_TIME", "PART_TIME"]).optional(),
  isActive: z3.boolean().optional(),
  contractType: z3.enum(["HOURLY", "MONTHLY_SALARY", "WORKLOAD_PERCENT"]).optional(),
  workloadPercent: z3.number().min(0).max(100).optional(),
  hourlyRate: z3.number().min(0).optional(),
  monthlySalary: z3.number().min(0).optional(),
  contractedHoursMonthly: z3.number().min(0).optional(),
  hireDate: z3.string().datetime().optional(),
  // Categories (roles) this employee is qualified for.
  categoryIds: z3.array(z3.string().min(1)).optional()
});
var updateUserSchema = z3.object({
  email: z3.string().email("Please provide a valid email address").trim().toLowerCase().optional(),
  password: z3.string().min(6, "Password must be at least 6 characters").optional(),
  name: z3.string().trim().min(1, "Name cannot be empty").optional(),
  firstName: z3.string().trim().optional(),
  lastName: z3.string().trim().optional(),
  phone: z3.string().trim().optional(),
  address: z3.string().trim().optional(),
  department: z3.string().trim().optional(),
  designation: z3.string().trim().optional(),
  employeeType: z3.enum(["FULL_TIME", "PART_TIME"]).optional(),
  isActive: z3.boolean().optional(),
  contractType: z3.enum(["HOURLY", "MONTHLY_SALARY", "WORKLOAD_PERCENT"]).optional(),
  workloadPercent: z3.number().min(0).max(100).optional(),
  hourlyRate: z3.number().min(0).optional(),
  monthlySalary: z3.number().min(0).optional(),
  contractedHoursMonthly: z3.number().min(0).optional(),
  hireDate: z3.string().datetime().optional(),
  mustChangePassword: z3.boolean().optional(),
  // Replaces the full set of category assignments when provided.
  categoryIds: z3.array(z3.string().min(1)).optional()
});
var userIdParamSchema = z3.object({
  userId: z3.string({ required_error: "User ID is required" }).min(1)
});
var listUsersQuerySchema = z3.object({
  limit: z3.coerce.number().int().min(1).max(100).default(10),
  // Opaque keyset cursor taken from a previous page's `nextCursor`.
  // Omit it to fetch the first page.
  cursor: z3.string().min(1).optional(),
  isActive: z3.enum(["true", "false"]).transform((val) => val === "true").optional(),
  search: z3.string().trim().optional(),
  categoryId: z3.string().min(1).optional()
});

// src/modules/admin/employees/employees.service.ts
var userSelect = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  phone: true,
  address: true,
  department: true,
  designation: true,
  employeeType: true,
  contractType: true,
  workloadPercent: true,
  hourlyRate: true,
  monthlySalary: true,
  contractedHoursMonthly: true,
  hireDate: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  deactivatedAt: true,
  createdAt: true,
  updatedAt: true,
  categories: {
    select: { category: { select: { id: true, name: true, parentId: true } } },
    orderBy: { assignedAt: "asc" }
  }
};
var flattenUser = (user) => {
  const { categories, ...rest } = user;
  return { ...rest, categories: categories.map((c) => c.category) };
};
var encodeCursor = (id) => Buffer.from(id, "utf8").toString("base64url");
var decodeCursor = (cursor) => {
  const id = Buffer.from(cursor, "base64url").toString("utf8");
  if (!id) throw new AppError("Invalid pagination cursor.", 400);
  return id;
};
var assertCategoriesExist = async (categoryIds) => {
  if (categoryIds.length === 0) return;
  const unique = [...new Set(categoryIds)];
  const found = await prisma.category.count({ where: { id: { in: unique } } });
  if (found !== unique.length) {
    throw new AppError("One or more selected categories do not exist.", 400);
  }
};
var createUser = async (data) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email }
  });
  if (existingUser) {
    throw new AppError("A user with this email already exists.", 409);
  }
  const passwordHash = await hashPassword(data.password);
  const createData = {
    email: data.email,
    passwordHash,
    mustChangePassword: true
  };
  if (data.name !== void 0) createData.name = data.name;
  if (data.firstName !== void 0) createData.firstName = data.firstName;
  if (data.lastName !== void 0) createData.lastName = data.lastName;
  if (data.phone !== void 0) createData.phone = data.phone;
  if (data.address !== void 0) createData.address = data.address;
  if (data.department !== void 0) createData.department = data.department;
  if (data.designation !== void 0) createData.designation = data.designation;
  if (data.employeeType !== void 0) createData.employeeType = data.employeeType;
  if (data.isActive !== void 0) createData.isActive = data.isActive;
  if (data.contractType !== void 0) createData.contractType = data.contractType;
  if (data.workloadPercent !== void 0) createData.workloadPercent = data.workloadPercent;
  if (data.hourlyRate !== void 0) createData.hourlyRate = data.hourlyRate;
  if (data.monthlySalary !== void 0) createData.monthlySalary = data.monthlySalary;
  if (data.contractedHoursMonthly !== void 0) createData.contractedHoursMonthly = data.contractedHoursMonthly;
  if (data.hireDate !== void 0) createData.hireDate = new Date(data.hireDate);
  if (data.categoryIds && data.categoryIds.length > 0) {
    await assertCategoriesExist(data.categoryIds);
    createData.categories = {
      create: [...new Set(data.categoryIds)].map((categoryId) => ({
        category: { connect: { id: categoryId } }
      }))
    };
  }
  const user = await prisma.user.create({
    data: createData,
    select: userSelect
  });
  return flattenUser(user);
};
var updateUser = async (userId, data) => {
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }
  if (data.email && data.email !== existingUser.email) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (emailTaken) {
      throw new AppError("A user with this email already exists.", 409);
    }
  }
  const updateData = {};
  if (data.email !== void 0) updateData.email = data.email;
  if (data.name !== void 0) updateData.name = data.name;
  if (data.firstName !== void 0) updateData.firstName = data.firstName;
  if (data.lastName !== void 0) updateData.lastName = data.lastName;
  if (data.phone !== void 0) updateData.phone = data.phone;
  if (data.address !== void 0) updateData.address = data.address;
  if (data.department !== void 0) updateData.department = data.department;
  if (data.designation !== void 0) updateData.designation = data.designation;
  if (data.employeeType !== void 0) updateData.employeeType = data.employeeType;
  if (data.contractType !== void 0) updateData.contractType = data.contractType;
  if (data.workloadPercent !== void 0) updateData.workloadPercent = data.workloadPercent;
  if (data.hourlyRate !== void 0) updateData.hourlyRate = data.hourlyRate;
  if (data.monthlySalary !== void 0) updateData.monthlySalary = data.monthlySalary;
  if (data.contractedHoursMonthly !== void 0) updateData.contractedHoursMonthly = data.contractedHoursMonthly;
  if (data.hireDate !== void 0) updateData.hireDate = new Date(data.hireDate);
  if (data.mustChangePassword !== void 0) updateData.mustChangePassword = data.mustChangePassword;
  if (data.isActive !== void 0) {
    updateData.isActive = data.isActive;
    updateData.deactivatedAt = data.isActive ? null : /* @__PURE__ */ new Date();
  }
  if (data.categoryIds !== void 0) {
    await assertCategoriesExist(data.categoryIds);
    updateData.categories = {
      deleteMany: {},
      create: [...new Set(data.categoryIds)].map((categoryId) => ({
        category: { connect: { id: categoryId } }
      }))
    };
  }
  if (data.password) {
    updateData.passwordHash = await hashPassword(data.password);
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: userSelect
  });
  return flattenUser(user);
};
var deleteUser = async (userId) => {
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }
  await prisma.user.delete({ where: { id: userId } });
};
var deactivateUser = async (userId) => {
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }
  if (!existingUser.isActive) {
    throw new AppError("User is already deactivated.", 400);
  }
  await prisma.userRefreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: /* @__PURE__ */ new Date() }
  });
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      deactivatedAt: /* @__PURE__ */ new Date()
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      deactivatedAt: true
    }
  });
  return user;
};
var activateUser = async (userId) => {
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }
  if (existingUser.isActive) {
    throw new AppError("User is already active.", 400);
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: true,
      deactivatedAt: null
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true
    }
  });
  return user;
};
var getAllUsers = async (query) => {
  const { limit, cursor, isActive, search, categoryId } = query;
  const where = {};
  if (isActive !== void 0) {
    where.isActive = isActive;
  }
  if (categoryId) {
    where.categories = { some: { categoryId } };
  }
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { department: { contains: search, mode: "insensitive" } },
      { designation: { contains: search, mode: "insensitive" } }
    ];
  }
  let cursorId;
  if (cursor) {
    cursorId = decodeCursor(cursor);
    const exists = await prisma.user.findUnique({
      where: { id: cursorId },
      select: { id: true }
    });
    if (!exists) {
      throw new AppError("Invalid or expired pagination cursor.", 400);
    }
  }
  const countWhere = { ...where };
  delete countWhere.isActive;
  const [rows, activeCount, inactiveCount] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit + 1,
      ...cursorId ? { cursor: { id: cursorId }, skip: 1 } : {},
      // A unique tiebreaker (id) makes the ordering total, which keyset
      // pagination requires to never skip or repeat a row.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        department: true,
        designation: true,
        employeeType: true,
        contractType: true,
        workloadPercent: true,
        hourlyRate: true,
        monthlySalary: true,
        isActive: true,
        lastLoginAt: true,
        hireDate: true,
        createdAt: true,
        categories: {
          select: { category: { select: { id: true, name: true, parentId: true } } },
          orderBy: { assignedAt: "asc" }
        }
      }
    }),
    prisma.user.count({ where: { ...countWhere, isActive: true } }),
    prisma.user.count({ where: { ...countWhere, isActive: false } })
  ]);
  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasNextPage && lastRow ? encodeCursor(lastRow.id) : null;
  return {
    users: pageRows.map(flattenUser),
    counts: { active: activeCount, inactive: inactiveCount },
    pagination: { limit, nextCursor, hasNextPage }
  };
};
var getUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect
  });
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  return flattenUser(user);
};
var userManagementServices = {
  createUser,
  updateUser,
  deleteUser,
  deactivateUser,
  activateUser,
  getAllUsers,
  getUserById
};

// src/modules/admin/employees/employees.controller.ts
var createUser2 = async (req, res) => {
  const data = req.validated;
  const user = await userManagementServices.createUser(data);
  sendSuccess(res, {
    statusCode: 201,
    message: "User created successfully.",
    data: { user }
  });
};
var updateUser2 = async (req, res) => {
  const userId = req.params.userId;
  const data = req.validated;
  const user = await userManagementServices.updateUser(userId, data);
  sendSuccess(res, {
    statusCode: 200,
    message: "User updated successfully.",
    data: { user }
  });
};
var deleteUser2 = async (req, res) => {
  const userId = req.params.userId;
  await userManagementServices.deleteUser(userId);
  sendSuccess(res, {
    statusCode: 200,
    message: "User deleted successfully."
  });
};
var deactivateUser2 = async (req, res) => {
  const userId = req.params.userId;
  const user = await userManagementServices.deactivateUser(userId);
  sendSuccess(res, {
    statusCode: 200,
    message: "User deactivated successfully.",
    data: { user }
  });
};
var activateUser2 = async (req, res) => {
  const userId = req.params.userId;
  const user = await userManagementServices.activateUser(userId);
  sendSuccess(res, {
    statusCode: 200,
    message: "User activated successfully.",
    data: { user }
  });
};
var getAllUsers2 = async (req, res) => {
  const validated = req.validated;
  const query = {
    limit: validated.limit
  };
  if (validated.cursor !== void 0) query.cursor = validated.cursor;
  if (validated.isActive !== void 0) query.isActive = validated.isActive;
  if (validated.search !== void 0) query.search = validated.search;
  if (validated.categoryId !== void 0) query.categoryId = validated.categoryId;
  const result = await userManagementServices.getAllUsers(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Users fetched successfully.",
    data: { users: result.users, counts: result.counts },
    meta: { pagination: result.pagination }
  });
};
var getUserById2 = async (req, res) => {
  const userId = req.params.userId;
  const user = await userManagementServices.getUserById(userId);
  sendSuccess(res, {
    statusCode: 200,
    message: "User fetched successfully.",
    data: { user }
  });
};

// src/modules/admin/employees/employees.route.ts
var userManagementRouter = Router3();
userManagementRouter.use(authenticate, authorizeAdmin);
userManagementRouter.post(
  "/",
  validateRequest(createUserSchema),
  asyncHandler(createUser2)
);
userManagementRouter.get(
  "/",
  validateRequest(listUsersQuerySchema),
  asyncHandler(getAllUsers2)
);
userManagementRouter.get(
  "/:userId",
  asyncHandler(getUserById2)
);
userManagementRouter.patch(
  "/:userId",
  validateRequest(updateUserSchema),
  asyncHandler(updateUser2)
);
userManagementRouter.delete(
  "/:userId",
  asyncHandler(deleteUser2)
);
userManagementRouter.patch(
  "/:userId/deactivate",
  asyncHandler(deactivateUser2)
);
userManagementRouter.patch(
  "/:userId/activate",
  asyncHandler(activateUser2)
);
var employees_route_default = userManagementRouter;

// src/modules/admin/categories/categories.route.ts
import { Router as Router4 } from "express";

// src/modules/admin/categories/categories.validation.ts
import { z as z4 } from "zod";
var createCategorySchema = z4.object({
  name: z4.string({ required_error: "Category name is required" }).trim().min(1, "Category name cannot be empty").max(100, "Category name is too long"),
  isActive: z4.boolean().optional(),
  // Provide to create a sub-category under an existing top-level category.
  parentId: z4.string().min(1).optional()
});
var createSubCategorySchema = z4.object({
  name: z4.string({ required_error: "Sub-category name is required" }).trim().min(1, "Sub-category name cannot be empty").max(100)
});
var updateCategorySchema = z4.object({
  name: z4.string().trim().min(1, "Category name cannot be empty").max(100).optional(),
  isActive: z4.boolean().optional()
});
var categoryIdParamSchema = z4.object({
  categoryId: z4.string({ required_error: "Category ID is required" }).min(1)
});
var listCategoriesQuerySchema = z4.object({
  page: z4.coerce.number().int().min(1).default(1),
  limit: z4.coerce.number().int().min(1).max(100).default(50),
  isActive: z4.enum(["true", "false"]).transform((val) => val === "true").optional(),
  search: z4.string().trim().optional()
});

// src/modules/admin/categories/categories.service.ts
var categorySelect = {
  id: true,
  name: true,
  parentId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};
var assertNameAvailable = async (name, parentId, excludeId) => {
  const existing = await prisma.category.findFirst({
    where: {
      parentId,
      name: { equals: name, mode: "insensitive" },
      ...excludeId ? { id: { not: excludeId } } : {}
    },
    select: { id: true }
  });
  if (existing) {
    throw new AppError(
      parentId ? "A sub-category with this name already exists here." : "A category with this name already exists.",
      409
    );
  }
};
var assertValidParent = async (parentId) => {
  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true }
  });
  if (!parent) {
    throw new AppError("Parent category does not exist.", 404);
  }
  if (parent.parentId) {
    throw new AppError("Sub-categories cannot be nested more than one level.", 409);
  }
};
var createCategory = async (data) => {
  const parentId = data.parentId ?? null;
  if (parentId) await assertValidParent(parentId);
  await assertNameAvailable(data.name, parentId);
  const createData = { name: data.name };
  if (data.isActive !== void 0) createData.isActive = data.isActive;
  if (parentId) createData.parent = { connect: { id: parentId } };
  return prisma.category.create({ data: createData, select: categorySelect });
};
var createSubCategory = async (parentId, data) => {
  await assertValidParent(parentId);
  await assertNameAvailable(data.name, parentId);
  return prisma.category.create({
    data: { name: data.name, parent: { connect: { id: parentId } } },
    select: categorySelect
  });
};
var getCategoryTree = async () => {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      _count: { select: { users: true, children: true } },
      children: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          isActive: true,
          _count: { select: { users: true } }
        }
      }
    }
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    isActive: c.isActive,
    createdAt: c.createdAt,
    qualifiedCount: c._count.users,
    // employees assigned to this role
    subCategoryCount: c._count.children,
    children: c.children.map((child) => ({
      id: child.id,
      name: child.name,
      isActive: child.isActive,
      qualifiedCount: child._count.users
    }))
  }));
};
var updateCategory = async (categoryId, data) => {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) {
    throw new AppError("Category not found.", 404);
  }
  if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertNameAvailable(data.name, existing.parentId, categoryId);
  }
  const updateData = {};
  if (data.name !== void 0) updateData.name = data.name;
  if (data.isActive !== void 0) updateData.isActive = data.isActive;
  return prisma.category.update({
    where: { id: categoryId },
    data: updateData,
    select: categorySelect
  });
};
var deleteCategory = async (categoryId) => {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, children: { select: { id: true } } }
  });
  if (!existing) {
    throw new AppError("Category not found.", 404);
  }
  const childIds = existing.children.map((c) => c.id);
  const allIds = [categoryId, ...childIds];
  await prisma.$transaction([
    prisma.dayDemand.deleteMany({ where: { categoryId: { in: allIds } } }),
    prisma.staffingDemand.deleteMany({ where: { categoryId: { in: allIds } } }),
    prisma.shiftOffer.deleteMany({ where: { categoryId: { in: allIds } } }),
    prisma.shift.deleteMany({ where: { categoryId: { in: allIds } } }),
    prisma.userCategory.deleteMany({ where: { categoryId: { in: allIds } } }),
    // Sub-categories reference the parent (Restrict), so remove them first.
    ...childIds.length ? [prisma.category.deleteMany({ where: { id: { in: childIds } } })] : [],
    prisma.category.delete({ where: { id: categoryId } })
  ]);
};
var getAllCategories = async (query) => {
  const { page, limit, isActive, search } = query;
  const skip = (page - 1) * limit;
  const where = { parentId: null };
  if (isActive !== void 0) where.isActive = isActive;
  if (search) where.name = { contains: search, mode: "insensitive" };
  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        ...categorySelect,
        _count: { select: { shiftOffers: true } }
      }
    }),
    prisma.category.count({ where })
  ]);
  return {
    categories,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getCategoryById = async (categoryId) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: categorySelect
  });
  if (!category) {
    throw new AppError("Category not found.", 404);
  }
  return category;
};
var categoryServices = {
  createCategory,
  createSubCategory,
  getCategoryTree,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById
};

// src/modules/admin/categories/categories.controller.ts
var createCategory2 = async (req, res) => {
  const data = req.validated;
  const category = await categoryServices.createCategory(data);
  sendSuccess(res, {
    statusCode: 201,
    message: "Category created successfully.",
    data: { category }
  });
};
var updateCategory2 = async (req, res) => {
  const categoryId = req.params.categoryId;
  const data = req.validated;
  const category = await categoryServices.updateCategory(categoryId, data);
  sendSuccess(res, {
    statusCode: 200,
    message: "Category updated successfully.",
    data: { category }
  });
};
var deleteCategory2 = async (req, res) => {
  const categoryId = req.params.categoryId;
  await categoryServices.deleteCategory(categoryId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Category deleted successfully."
  });
};
var createSubCategory2 = async (req, res) => {
  const categoryId = req.params.categoryId;
  const data = req.validated;
  const category = await categoryServices.createSubCategory(categoryId, data);
  sendSuccess(res, {
    statusCode: 201,
    message: "Sub-category created successfully.",
    data: { category }
  });
};
var getCategoryTree2 = async (_req, res) => {
  const categories = await categoryServices.getCategoryTree();
  sendSuccess(res, {
    statusCode: 200,
    message: "Category tree fetched successfully.",
    data: { categories }
  });
};
var getAllCategories2 = async (req, res) => {
  const validated = req.validated;
  const query = {
    page: validated.page,
    limit: validated.limit
  };
  if (validated.isActive !== void 0) query.isActive = validated.isActive;
  if (validated.search !== void 0) query.search = validated.search;
  const result = await categoryServices.getAllCategories(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Categories fetched successfully.",
    data: { categories: result.categories },
    meta: { pagination: result.pagination }
  });
};
var getCategoryById2 = async (req, res) => {
  const categoryId = req.params.categoryId;
  const category = await categoryServices.getCategoryById(categoryId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Category fetched successfully.",
    data: { category }
  });
};

// src/modules/admin/categories/categories.route.ts
var categoryRouter = Router4();
categoryRouter.use(authenticate, authorizeAdmin);
categoryRouter.post(
  "/",
  validateRequest(createCategorySchema),
  asyncHandler(createCategory2)
);
categoryRouter.get(
  "/",
  validateRequest(listCategoriesQuerySchema),
  asyncHandler(getAllCategories2)
);
categoryRouter.get("/tree", asyncHandler(getCategoryTree2));
categoryRouter.post(
  "/:categoryId/subcategories",
  validateRequest(createSubCategorySchema),
  asyncHandler(createSubCategory2)
);
categoryRouter.get("/:categoryId", asyncHandler(getCategoryById2));
categoryRouter.patch(
  "/:categoryId",
  validateRequest(updateCategorySchema),
  asyncHandler(updateCategory2)
);
categoryRouter.delete("/:categoryId", asyncHandler(deleteCategory2));
var categories_route_default = categoryRouter;

// src/modules/admin/shifts/shifts.route.ts
import { Router as Router5 } from "express";

// src/modules/admin/shifts/shifts.validation.ts
import { z as z5 } from "zod";
var createShiftSchema = z5.object({
  jobTitle: z5.string({ required_error: "Job title is required" }).trim().min(1, "Job title cannot be empty").max(150, "Job title is too long"),
  categoryId: z5.string({ required_error: "Category is required" }).min(1, "Category is required"),
  startTime: z5.string({ required_error: "Shift start time is required" }).datetime({
    message: "startTime must be an ISO 8601 date-time string"
  }),
  endTime: z5.string({ required_error: "Shift end time is required" }).datetime({
    message: "endTime must be an ISO 8601 date-time string"
  }),
  hourlyPrice: z5.number({ required_error: "Hourly price is required" }).min(0, "Hourly price cannot be negative"),
  description: z5.string().trim().max(2e3).optional()
}).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: "endTime must be after startTime",
  path: ["endTime"]
});
var updateShiftSchema = z5.object({
  jobTitle: z5.string().trim().min(1).max(150).optional(),
  categoryId: z5.string().min(1).optional(),
  startTime: z5.string().datetime().optional(),
  endTime: z5.string().datetime().optional(),
  hourlyPrice: z5.number().min(0).optional(),
  description: z5.string().trim().max(2e3).optional()
}).refine(
  (data) => !(data.startTime && data.endTime) || new Date(data.endTime) > new Date(data.startTime),
  { message: "endTime must be after startTime", path: ["endTime"] }
);
var shiftIdParamSchema = z5.object({
  shiftId: z5.string({ required_error: "Shift ID is required" }).min(1)
});
var rejectResponseSchema = z5.object({
  note: z5.string().trim().max(500).optional()
});
var listApprovalsQuerySchema = z5.object({
  page: z5.coerce.number().int().min(1).default(1),
  limit: z5.coerce.number().int().min(1).max(100).default(20),
  pendingOnly: z5.enum(["true", "false"]).transform((val) => val === "true").optional()
});
var listShiftsQuerySchema = z5.object({
  page: z5.coerce.number().int().min(1).default(1),
  limit: z5.coerce.number().int().min(1).max(100).default(20),
  categoryId: z5.string().min(1).optional(),
  notified: z5.enum(["true", "false"]).transform((val) => val === "true").optional(),
  upcoming: z5.enum(["true", "false"]).transform((val) => val === "true").optional()
});

// src/modules/admin/shifts/shifts.service.ts
var shiftSelect = {
  id: true,
  jobTitle: true,
  categoryId: true,
  startTime: true,
  endTime: true,
  hourlyPrice: true,
  description: true,
  notifiedAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } }
};
var summarizeResponses = (responses) => {
  const accepted = responses.filter((r) => r.status === "ACCEPTED");
  return {
    acceptedCount: accepted.length,
    approvedCount: accepted.filter((r) => r.approvalStatus === "APPROVED").length,
    pendingApprovalCount: accepted.filter((r) => r.approvalStatus === "PENDING").length,
    rejectedByAdminCount: accepted.filter((r) => r.approvalStatus === "REJECTED").length,
    declinedCount: responses.filter((r) => r.status === "REJECTED").length
  };
};
var ensureCategoryUsable = async (categoryId) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true }
  });
  if (!category) {
    throw new AppError("Selected category does not exist.", 404);
  }
  if (!category.isActive) {
    throw new AppError("Selected category is inactive.", 409);
  }
};
var createShift = async (data, adminId) => {
  await ensureCategoryUsable(data.categoryId);
  const createData = {
    jobTitle: data.jobTitle,
    startTime: new Date(data.startTime),
    endTime: new Date(data.endTime),
    hourlyPrice: data.hourlyPrice,
    category: { connect: { id: data.categoryId } },
    createdBy: { connect: { id: adminId } }
  };
  if (data.description !== void 0) createData.description = data.description;
  return prisma.shiftOffer.create({ data: createData, select: shiftSelect });
};
var updateShift = async (shiftId, data) => {
  const existing = await prisma.shiftOffer.findUnique({ where: { id: shiftId } });
  if (!existing) {
    throw new AppError("Shift not found.", 404);
  }
  if (data.categoryId) {
    await ensureCategoryUsable(data.categoryId);
  }
  const nextStart = data.startTime ? new Date(data.startTime) : existing.startTime;
  const nextEnd = data.endTime ? new Date(data.endTime) : existing.endTime;
  if (nextEnd <= nextStart) {
    throw new AppError("endTime must be after startTime.", 400);
  }
  const updateData = {};
  if (data.jobTitle !== void 0) updateData.jobTitle = data.jobTitle;
  if (data.categoryId !== void 0) updateData.category = { connect: { id: data.categoryId } };
  if (data.startTime !== void 0) updateData.startTime = new Date(data.startTime);
  if (data.endTime !== void 0) updateData.endTime = new Date(data.endTime);
  if (data.hourlyPrice !== void 0) updateData.hourlyPrice = data.hourlyPrice;
  if (data.description !== void 0) updateData.description = data.description;
  return prisma.shiftOffer.update({
    where: { id: shiftId },
    data: updateData,
    select: shiftSelect
  });
};
var deleteShift = async (shiftId) => {
  const existing = await prisma.shiftOffer.findUnique({ where: { id: shiftId } });
  if (!existing) {
    throw new AppError("Shift not found.", 404);
  }
  await prisma.shiftOffer.delete({ where: { id: shiftId } });
};
var notifyShift = async (shiftId) => {
  const shift = await prisma.shiftOffer.findUnique({
    where: { id: shiftId },
    select: shiftSelect
  });
  if (!shift) {
    throw new AppError("Shift not found.", 404);
  }
  const recipients = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true }
  });
  if (recipients.length === 0) {
    throw new AppError("There are no active employees to notify.", 409);
  }
  const now = /* @__PURE__ */ new Date();
  const title = "New shift available";
  const body = `${shift.jobTitle} (${shift.category.name}) \u2014 tap to view and accept.`;
  const [, updatedShift] = await prisma.$transaction([
    prisma.notification.createMany({
      data: recipients.map((u) => ({
        userId: u.id,
        type: "SHIFT_OFFER_PUBLISHED",
        channel: "IN_APP",
        status: "SENT",
        title,
        body,
        sentAt: now,
        payload: {
          shiftOfferId: shift.id,
          jobTitle: shift.jobTitle,
          categoryId: shift.categoryId,
          categoryName: shift.category.name,
          startTime: shift.startTime.toISOString(),
          endTime: shift.endTime.toISOString(),
          hourlyPrice: shift.hourlyPrice.toString()
        }
      }))
    }),
    prisma.shiftOffer.update({
      where: { id: shiftId },
      data: { notifiedAt: now },
      select: shiftSelect
    })
  ]);
  return { shift: updatedShift, notifiedCount: recipients.length };
};
var getAllShifts = async (query) => {
  const { page, limit, categoryId, notified, upcoming } = query;
  const skip = (page - 1) * limit;
  const where = {};
  if (categoryId) where.categoryId = categoryId;
  if (notified !== void 0) where.notifiedAt = notified ? { not: null } : null;
  if (upcoming) where.endTime = { gte: /* @__PURE__ */ new Date() };
  const [shifts, total] = await Promise.all([
    prisma.shiftOffer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startTime: "desc" },
      select: {
        ...shiftSelect,
        responses: { select: { status: true, approvalStatus: true } }
      }
    }),
    prisma.shiftOffer.count({ where })
  ]);
  const data = shifts.map(({ responses, ...shift }) => ({
    ...shift,
    ...summarizeResponses(responses)
  }));
  return {
    shifts: data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getShiftById = async (shiftId) => {
  const shift = await prisma.shiftOffer.findUnique({
    where: { id: shiftId },
    select: {
      ...shiftSelect,
      responses: { select: { status: true, approvalStatus: true } }
    }
  });
  if (!shift) {
    throw new AppError("Shift not found.", 404);
  }
  const { responses, ...rest } = shift;
  return { ...rest, ...summarizeResponses(responses) };
};
var responseSelect = {
  id: true,
  status: true,
  approvalStatus: true,
  respondedAt: true,
  approvedAt: true,
  approvalNote: true,
  user: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      department: true,
      designation: true,
      employeeType: true
    }
  }
};
var getShiftResponses = async (shiftId) => {
  const shift = await prisma.shiftOffer.findUnique({
    where: { id: shiftId },
    select: shiftSelect
  });
  if (!shift) {
    throw new AppError("Shift not found.", 404);
  }
  const responses = await prisma.shiftOfferResponse.findMany({
    where: { shiftOfferId: shiftId },
    orderBy: { respondedAt: "asc" },
    select: responseSelect
  });
  const accepted = responses.filter((r) => r.status === "ACCEPTED");
  const rejected = responses.filter((r) => r.status === "REJECTED");
  const summary = summarizeResponses(responses);
  return {
    shift,
    // Everyone who volunteered, with their per-response approval state.
    accepted,
    // Employees who declined the offer.
    declined: rejected,
    counts: {
      ...summary,
      total: responses.length,
      // "How many workers are available for this shift" = admin-approved count.
      available: summary.approvedCount
    }
  };
};
var loadResponseForApproval = async (shiftId, responseId) => {
  const response = await prisma.shiftOfferResponse.findFirst({
    where: { id: responseId, shiftOfferId: shiftId },
    select: {
      id: true,
      status: true,
      approvalStatus: true,
      userId: true,
      shiftOffer: { select: { jobTitle: true, startTime: true } }
    }
  });
  if (!response) {
    throw new AppError("Shift response not found.", 404);
  }
  if (response.status !== "ACCEPTED") {
    throw new AppError("Only accepted shifts can be approved or rejected.", 409);
  }
  return response;
};
var approveResponse = async (shiftId, responseId, adminId) => {
  const response = await loadResponseForApproval(shiftId, responseId);
  const now = /* @__PURE__ */ new Date();
  const [updated] = await prisma.$transaction([
    prisma.shiftOfferResponse.update({
      where: { id: responseId },
      data: {
        approvalStatus: "APPROVED",
        approvedById: adminId,
        approvedAt: now,
        approvalNote: null
      },
      select: responseSelect
    }),
    // Let the employee know their shift is confirmed (updates their app status).
    prisma.notification.create({
      data: {
        userId: response.userId,
        type: "SHIFT_CHANGED",
        channel: "IN_APP",
        status: "SENT",
        title: "Shift confirmed",
        body: `You are confirmed for "${response.shiftOffer.jobTitle}".`,
        sentAt: now,
        payload: { shiftOfferId: shiftId, approvalStatus: "APPROVED" }
      }
    })
  ]);
  return updated;
};
var rejectResponse = async (shiftId, responseId, adminId, note) => {
  const response = await loadResponseForApproval(shiftId, responseId);
  const now = /* @__PURE__ */ new Date();
  const [updated] = await prisma.$transaction([
    prisma.shiftOfferResponse.update({
      where: { id: responseId },
      data: {
        approvalStatus: "REJECTED",
        approvedById: adminId,
        approvedAt: now,
        ...note !== void 0 ? { approvalNote: note } : {}
      },
      select: responseSelect
    }),
    prisma.notification.create({
      data: {
        userId: response.userId,
        type: "SHIFT_CHANGED",
        channel: "IN_APP",
        status: "SENT",
        title: "Shift not assigned",
        body: `You were not assigned to "${response.shiftOffer.jobTitle}".`,
        sentAt: now,
        payload: { shiftOfferId: shiftId, approvalStatus: "REJECTED" }
      }
    })
  ]);
  return updated;
};
var getShiftsForApproval = async (query) => {
  const { page, limit, pendingOnly } = query;
  const skip = (page - 1) * limit;
  const where = {
    notifiedAt: { not: null },
    responses: pendingOnly ? { some: { status: "ACCEPTED", approvalStatus: "PENDING" } } : { some: { status: "ACCEPTED" } }
  };
  const [shifts, total] = await Promise.all([
    prisma.shiftOffer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startTime: "asc" },
      select: {
        ...shiftSelect,
        responses: {
          where: { status: "ACCEPTED" },
          orderBy: { respondedAt: "asc" },
          select: responseSelect
        }
      }
    }),
    prisma.shiftOffer.count({ where })
  ]);
  const data = shifts.map(({ responses, ...shift }) => ({
    ...shift,
    volunteers: responses,
    ...summarizeResponses(responses),
    available: responses.filter((r) => r.approvalStatus === "APPROVED").length
  }));
  return {
    shifts: data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var shiftServices = {
  createShift,
  updateShift,
  deleteShift,
  notifyShift,
  getAllShifts,
  getShiftById,
  getShiftResponses,
  approveResponse,
  rejectResponse,
  getShiftsForApproval
};

// src/modules/admin/shifts/shifts.controller.ts
var createShift2 = async (req, res) => {
  const data = req.validated;
  const adminId = res.locals.auth.userId;
  const shift = await shiftServices.createShift(data, adminId);
  sendSuccess(res, {
    statusCode: 201,
    message: "Shift created successfully.",
    data: { shift }
  });
};
var updateShift2 = async (req, res) => {
  const shiftId = req.params.shiftId;
  const data = req.validated;
  const shift = await shiftServices.updateShift(shiftId, data);
  sendSuccess(res, {
    statusCode: 200,
    message: "Shift updated successfully.",
    data: { shift }
  });
};
var deleteShift2 = async (req, res) => {
  const shiftId = req.params.shiftId;
  await shiftServices.deleteShift(shiftId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Shift deleted successfully."
  });
};
var notifyShift2 = async (req, res) => {
  const shiftId = req.params.shiftId;
  const result = await shiftServices.notifyShift(shiftId);
  sendSuccess(res, {
    statusCode: 200,
    message: `Notification sent to ${result.notifiedCount} employee(s).`,
    data: { shift: result.shift, notifiedCount: result.notifiedCount }
  });
};
var getAllShifts2 = async (req, res) => {
  const validated = req.validated;
  const query = { page: validated.page, limit: validated.limit };
  if (validated.categoryId !== void 0) query.categoryId = validated.categoryId;
  if (validated.notified !== void 0) query.notified = validated.notified;
  if (validated.upcoming !== void 0) query.upcoming = validated.upcoming;
  const result = await shiftServices.getAllShifts(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Shifts fetched successfully.",
    data: { shifts: result.shifts },
    meta: { pagination: result.pagination }
  });
};
var getShiftById2 = async (req, res) => {
  const shiftId = req.params.shiftId;
  const shift = await shiftServices.getShiftById(shiftId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Shift fetched successfully.",
    data: { shift }
  });
};
var getShiftResponses2 = async (req, res) => {
  const shiftId = req.params.shiftId;
  const result = await shiftServices.getShiftResponses(shiftId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Shift responses fetched successfully.",
    data: {
      shift: result.shift,
      accepted: result.accepted,
      declined: result.declined,
      counts: result.counts
    }
  });
};
var getShiftsForApproval2 = async (req, res) => {
  const validated = req.validated;
  const query = {
    page: validated.page,
    limit: validated.limit
  };
  if (validated.pendingOnly !== void 0) query.pendingOnly = validated.pendingOnly;
  const result = await shiftServices.getShiftsForApproval(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Shifts awaiting approval fetched successfully.",
    data: { shifts: result.shifts },
    meta: { pagination: result.pagination }
  });
};
var approveResponse2 = async (req, res) => {
  const shiftId = req.params.shiftId;
  const responseId = req.params.responseId;
  const adminId = res.locals.auth.userId;
  const response = await shiftServices.approveResponse(shiftId, responseId, adminId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Employee approved for this shift.",
    data: { response }
  });
};
var rejectResponse2 = async (req, res) => {
  const shiftId = req.params.shiftId;
  const responseId = req.params.responseId;
  const adminId = res.locals.auth.userId;
  const { note } = req.validated;
  const response = await shiftServices.rejectResponse(shiftId, responseId, adminId, note);
  sendSuccess(res, {
    statusCode: 200,
    message: "Employee not assigned to this shift.",
    data: { response }
  });
};

// src/modules/admin/shifts/shifts.route.ts
var shiftRouter = Router5();
shiftRouter.use(authenticate, authorizeAdmin);
shiftRouter.post(
  "/",
  validateRequest(createShiftSchema),
  asyncHandler(createShift2)
);
shiftRouter.get(
  "/",
  validateRequest(listShiftsQuerySchema),
  asyncHandler(getAllShifts2)
);
shiftRouter.get(
  "/approvals",
  validateRequest(listApprovalsQuerySchema),
  asyncHandler(getShiftsForApproval2)
);
shiftRouter.get("/:shiftId", asyncHandler(getShiftById2));
shiftRouter.get("/:shiftId/responses", asyncHandler(getShiftResponses2));
shiftRouter.post(
  "/:shiftId/responses/:responseId/approve",
  asyncHandler(approveResponse2)
);
shiftRouter.post(
  "/:shiftId/responses/:responseId/reject",
  validateRequest(rejectResponseSchema),
  asyncHandler(rejectResponse2)
);
shiftRouter.patch(
  "/:shiftId",
  validateRequest(updateShiftSchema),
  asyncHandler(updateShift2)
);
shiftRouter.delete("/:shiftId", asyncHandler(deleteShift2));
shiftRouter.post("/:shiftId/notify", asyncHandler(notifyShift2));
var shifts_route_default = shiftRouter;

// src/modules/admin/workload/workload.route.ts
import { Router as Router6 } from "express";

// src/modules/admin/workload/workload.validation.ts
import { z as z6 } from "zod";
var dateString = (label) => z6.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).refine((s) => !Number.isNaN(Date.parse(s)), {
  message: `${label} must be a valid date`
});
var isoDateTime = (label) => z6.string({ required_error: `${label} is required` }).datetime({
  message: `${label} must be an ISO 8601 date-time string`
});
var planStatusEnum = z6.enum(["DRAFT", "SUBMITTED", "PUBLISHED"]);
var createWeekSchema = z6.object({
  // The Monday (or any day) the workload week starts on; the rest of the week
  // metadata is derived from it server-side.
  weekStartDate: dateString("Week start date"),
  // Optional override; defaults to the ISO week number of weekStartDate.
  weekNumber: z6.coerce.number().int().min(1).max(53).optional()
});
var updateWeekSchema = z6.object({
  status: planStatusEnum.optional(),
  needsRenotify: z6.boolean().optional()
});
var listWeeksQuerySchema = z6.object({
  page: z6.coerce.number().int().min(1).default(1),
  limit: z6.coerce.number().int().min(1).max(100).default(20),
  year: z6.coerce.number().int().min(2e3).max(2100).optional(),
  month: z6.coerce.number().int().min(1).max(12).optional(),
  status: planStatusEnum.optional()
});
var demandFields = {
  date: dateString("Demand date"),
  categoryId: z6.string({ required_error: "Category is required" }).min(1, "Category is required"),
  requiredCount: z6.number({ required_error: "Required headcount is required" }).int("Required headcount must be a whole number").min(1, "At least one person must be required").max(1e3, "Required headcount is too large"),
  startTime: isoDateTime("Shift start time"),
  endTime: isoDateTime("Shift end time"),
  note: z6.string().trim().max(1e3).optional()
};
var endAfterStart = (d) => !(d.startTime && d.endTime) || new Date(d.endTime) > new Date(d.startTime);
var createDemandSchema = z6.object(demandFields).refine((d) => new Date(d.endTime) > new Date(d.startTime), {
  message: "endTime must be after startTime",
  path: ["endTime"]
});
var bulkDemandsSchema = z6.object({
  demands: z6.array(
    z6.object(demandFields).refine((d) => new Date(d.endTime) > new Date(d.startTime), {
      message: "endTime must be after startTime",
      path: ["endTime"]
    })
  ).min(1, "Provide at least one demand to upload").max(500, "Too many demands in a single upload")
});
var updateDemandSchema = z6.object({
  date: dateString("Demand date").optional(),
  categoryId: z6.string().min(1).optional(),
  requiredCount: z6.number().int().min(1).max(1e3).optional(),
  startTime: isoDateTime("Shift start time").optional(),
  endTime: isoDateTime("Shift end time").optional(),
  note: z6.string().trim().max(1e3).optional()
}).refine(endAfterStart, { message: "endTime must be after startTime", path: ["endTime"] });
var workloadViewQuerySchema = z6.object({
  view: z6.enum(["day", "week", "month"]).default("week"),
  date: dateString("Reference date"),
  categoryId: z6.string().min(1).optional()
});

// src/modules/admin/workload/workload.service.ts
var startOfUTCDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
var addDays = (d, n) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
var dateOnly2 = (d) => d.toISOString().slice(0, 10);
var sameUTCDate = (a, b) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
var isoWeekNumber = (date) => {
  const d = startOfUTCDay(date);
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1e3));
};
var planSelect = {
  id: true,
  year: true,
  month: true,
  weekNumber: true,
  weekStartDate: true,
  weekEndDate: true,
  status: true,
  submittedAt: true,
  needsRenotify: true,
  createdAt: true,
  updatedAt: true
};
var demandSelect = {
  id: true,
  weeklyPlanId: true,
  date: true,
  categoryId: true,
  requiredCount: true,
  startTime: true,
  endTime: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } }
};
var ensureCategoryUsable2 = async (categoryId) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true }
  });
  if (!category) throw new AppError("Selected category does not exist.", 404);
  if (!category.isActive) throw new AppError("Selected category is inactive.", 409);
};
var ensurePlanExists = async (planId) => {
  const plan = await prisma.weeklyPlan.findUnique({ where: { id: planId }, select: { id: true } });
  if (!plan) throw new AppError("Workload week not found.", 404);
};
var annotateDemands = async (demands, windowStart, windowEndExclusive) => {
  if (demands.length === 0) return [];
  const categoryIds = [...new Set(demands.map((d) => d.categoryId))];
  const offers = await prisma.shiftOffer.findMany({
    where: {
      categoryId: { in: categoryIds },
      startTime: { gte: windowStart, lt: windowEndExclusive }
    },
    select: {
      id: true,
      jobTitle: true,
      categoryId: true,
      startTime: true,
      endTime: true,
      notifiedAt: true,
      responses: { select: { status: true, approvalStatus: true } }
    }
  });
  const shifts = offers.map((o) => {
    const accepted = o.responses.filter((r) => r.status === "ACCEPTED");
    return {
      id: o.id,
      jobTitle: o.jobTitle,
      categoryId: o.categoryId,
      startTime: o.startTime,
      endTime: o.endTime,
      notified: o.notifiedAt !== null,
      approvedCount: accepted.filter((r) => r.approvalStatus === "APPROVED").length,
      pendingCount: accepted.filter((r) => r.approvalStatus === "PENDING").length
    };
  });
  return demands.map((d) => {
    const matches = shifts.filter(
      (o) => o.categoryId === d.categoryId && sameUTCDate(o.startTime, d.date) && o.startTime < d.endTime && o.endTime > d.startTime
    );
    const filledCount = matches.reduce((sum, o) => sum + o.approvedCount, 0);
    const pendingCount = matches.reduce((sum, o) => sum + o.pendingCount, 0);
    return {
      ...d,
      fulfillment: {
        requiredCount: d.requiredCount,
        filledCount,
        pendingCount,
        openCount: Math.max(0, d.requiredCount - filledCount),
        status: filledCount >= d.requiredCount ? "MET" : filledCount > 0 ? "PARTIAL" : "OPEN"
      },
      // The shifts the admin created that feed this demand.
      connectedShifts: matches.map(({ categoryId: _c, ...rest }) => rest)
    };
  });
};
var computeTotals = (demands) => demands.reduce(
  (acc, d) => {
    acc.demandCount += 1;
    acc.totalRequired += d.fulfillment.requiredCount;
    acc.totalFilled += d.fulfillment.filledCount;
    acc.totalOpen += d.fulfillment.openCount;
    return acc;
  },
  { demandCount: 0, totalRequired: 0, totalFilled: 0, totalOpen: 0 }
);
var groupByCategory = (demands) => {
  const groups = /* @__PURE__ */ new Map();
  for (const d of demands) {
    let group = groups.get(d.categoryId);
    if (!group) {
      group = { category: d.category, totalRequired: 0, totalFilled: 0, demands: [] };
      groups.set(d.categoryId, group);
    }
    group.demands.push(d);
    group.totalRequired += d.fulfillment.requiredCount;
    group.totalFilled += d.fulfillment.filledCount;
  }
  return [...groups.values()];
};
var createWorkloadWeek = async (data) => {
  const start = startOfUTCDay(new Date(data.weekStartDate));
  const end = addDays(start, 6);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + 1;
  const weekNumber = data.weekNumber ?? isoWeekNumber(start);
  const existing = await prisma.weeklyPlan.findUnique({
    where: { year_month_weekNumber: { year, month, weekNumber } },
    select: { id: true }
  });
  if (existing) {
    throw new AppError("A workload week already exists for this month and week number.", 409);
  }
  return prisma.weeklyPlan.create({
    data: { year, month, weekNumber, weekStartDate: start, weekEndDate: end },
    select: planSelect
  });
};
var listWorkloadWeeks = async (query) => {
  const { page, limit, year, month, status } = query;
  const skip = (page - 1) * limit;
  const where = {};
  if (year !== void 0) where.year = year;
  if (month !== void 0) where.month = month;
  if (status) where.status = status;
  const [weeks, total] = await Promise.all([
    prisma.weeklyPlan.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ year: "desc" }, { month: "desc" }, { weekNumber: "desc" }],
      select: {
        ...planSelect,
        _count: { select: { demands: true } },
        demands: { select: { requiredCount: true } }
      }
    }),
    prisma.weeklyPlan.count({ where })
  ]);
  const data = weeks.map(({ demands, _count, ...week }) => ({
    ...week,
    demandCount: _count.demands,
    totalRequired: demands.reduce((sum, d) => sum + d.requiredCount, 0)
  }));
  return {
    weeks: data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getWorkloadWeek = async (planId) => {
  const week = await prisma.weeklyPlan.findUnique({
    where: { id: planId },
    select: planSelect
  });
  if (!week) throw new AppError("Workload week not found.", 404);
  const demands = await prisma.staffingDemand.findMany({
    where: { weeklyPlanId: planId },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: demandSelect
  });
  const windowStart = startOfUTCDay(week.weekStartDate);
  const windowEndExclusive = addDays(startOfUTCDay(week.weekEndDate), 1);
  const annotated = await annotateDemands(demands, windowStart, windowEndExclusive);
  return {
    week,
    totals: computeTotals(annotated),
    categories: groupByCategory(annotated),
    demands: annotated
  };
};
var updateWorkloadWeek = async (planId, data) => {
  await ensurePlanExists(planId);
  const updateData = {};
  if (data.status !== void 0) {
    updateData.status = data.status;
    if (data.status === "SUBMITTED") updateData.submittedAt = /* @__PURE__ */ new Date();
  }
  if (data.needsRenotify !== void 0) updateData.needsRenotify = data.needsRenotify;
  return prisma.weeklyPlan.update({ where: { id: planId }, data: updateData, select: planSelect });
};
var publishWorkloadWeek = async (planId) => {
  const week = await prisma.weeklyPlan.findUnique({
    where: { id: planId },
    select: { id: true, _count: { select: { demands: true } } }
  });
  if (!week) throw new AppError("Workload week not found.", 404);
  if (week._count.demands === 0) {
    throw new AppError(
      "Cannot upload an empty workload. Add at least one staffing demand first.",
      409
    );
  }
  return prisma.weeklyPlan.update({
    where: { id: planId },
    data: { status: "PUBLISHED" },
    select: planSelect
  });
};
var deleteWorkloadWeek = async (planId) => {
  await ensurePlanExists(planId);
  await prisma.weeklyPlan.delete({ where: { id: planId } });
};
var addDemand = async (planId, data) => {
  await ensurePlanExists(planId);
  await ensureCategoryUsable2(data.categoryId);
  const date = startOfUTCDay(new Date(data.date));
  const startTime = new Date(data.startTime);
  const duplicate = await prisma.staffingDemand.findFirst({
    where: { weeklyPlanId: planId, date, categoryId: data.categoryId, startTime },
    select: { id: true }
  });
  if (duplicate) {
    throw new AppError(
      "A demand for this category and start time already exists on that day.",
      409
    );
  }
  const createData = {
    weeklyPlan: { connect: { id: planId } },
    category: { connect: { id: data.categoryId } },
    date,
    startTime,
    endTime: new Date(data.endTime),
    requiredCount: data.requiredCount
  };
  if (data.note !== void 0) createData.note = data.note;
  return prisma.staffingDemand.create({ data: createData, select: demandSelect });
};
var bulkAddDemands = async (planId, data) => {
  await ensurePlanExists(planId);
  const categoryIds = [...new Set(data.demands.map((d) => d.categoryId))];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, isActive: true }
  });
  const usable = new Set(categories.filter((c) => c.isActive).map((c) => c.id));
  const invalid = categoryIds.find((id) => !usable.has(id));
  if (invalid) {
    throw new AppError(`Category ${invalid} does not exist or is inactive.`, 409);
  }
  const result = await prisma.staffingDemand.createMany({
    data: data.demands.map((d) => ({
      weeklyPlanId: planId,
      categoryId: d.categoryId,
      date: startOfUTCDay(new Date(d.date)),
      startTime: new Date(d.startTime),
      endTime: new Date(d.endTime),
      requiredCount: d.requiredCount,
      note: d.note ?? null
    })),
    skipDuplicates: true
  });
  return {
    createdCount: result.count,
    skippedCount: data.demands.length - result.count
  };
};
var updateDemand = async (demandId, data) => {
  const existing = await prisma.staffingDemand.findUnique({ where: { id: demandId } });
  if (!existing) throw new AppError("Staffing demand not found.", 404);
  if (data.categoryId) await ensureCategoryUsable2(data.categoryId);
  const nextStart = data.startTime ? new Date(data.startTime) : existing.startTime;
  const nextEnd = data.endTime ? new Date(data.endTime) : existing.endTime;
  if (nextEnd <= nextStart) {
    throw new AppError("endTime must be after startTime.", 400);
  }
  const updateData = {};
  if (data.date !== void 0) updateData.date = startOfUTCDay(new Date(data.date));
  if (data.categoryId !== void 0) updateData.category = { connect: { id: data.categoryId } };
  if (data.requiredCount !== void 0) updateData.requiredCount = data.requiredCount;
  if (data.startTime !== void 0) updateData.startTime = new Date(data.startTime);
  if (data.endTime !== void 0) updateData.endTime = new Date(data.endTime);
  if (data.note !== void 0) updateData.note = data.note;
  return prisma.staffingDemand.update({
    where: { id: demandId },
    data: updateData,
    select: demandSelect
  });
};
var deleteDemand = async (demandId) => {
  const existing = await prisma.staffingDemand.findUnique({
    where: { id: demandId },
    select: { id: true }
  });
  if (!existing) throw new AppError("Staffing demand not found.", 404);
  await prisma.staffingDemand.delete({ where: { id: demandId } });
};
var getWorkloadView = async (query) => {
  const anchor = startOfUTCDay(new Date(query.date));
  let windowStart;
  let windowEndExclusive;
  if (query.view === "day") {
    windowStart = anchor;
    windowEndExclusive = addDays(anchor, 1);
  } else if (query.view === "week") {
    const dow = (anchor.getUTCDay() + 6) % 7;
    windowStart = addDays(anchor, -dow);
    windowEndExclusive = addDays(windowStart, 7);
  } else {
    windowStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    windowEndExclusive = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  }
  const where = {
    date: { gte: windowStart, lt: windowEndExclusive }
  };
  if (query.categoryId) where.categoryId = query.categoryId;
  const demands = await prisma.staffingDemand.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: demandSelect
  });
  const annotated = await annotateDemands(demands, windowStart, windowEndExclusive);
  return {
    view: query.view,
    range: { start: dateOnly2(windowStart), end: dateOnly2(addDays(windowEndExclusive, -1)) },
    totals: computeTotals(annotated),
    categories: groupByCategory(annotated),
    demands: annotated
  };
};
var workloadServices = {
  createWorkloadWeek,
  listWorkloadWeeks,
  getWorkloadWeek,
  updateWorkloadWeek,
  publishWorkloadWeek,
  deleteWorkloadWeek,
  addDemand,
  bulkAddDemands,
  updateDemand,
  deleteDemand,
  getWorkloadView
};

// src/modules/admin/workload/workload.controller.ts
var createWeek = async (req, res) => {
  const data = req.validated;
  const week = await workloadServices.createWorkloadWeek(data);
  sendSuccess(res, {
    statusCode: 201,
    message: "Workload week created successfully.",
    data: { week }
  });
};
var listWeeks = async (req, res) => {
  const query = req.validated;
  const result = await workloadServices.listWorkloadWeeks(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Workload weeks fetched successfully.",
    data: { weeks: result.weeks },
    meta: { pagination: result.pagination }
  });
};
var getWeek = async (req, res) => {
  const planId = req.params.planId;
  const result = await workloadServices.getWorkloadWeek(planId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Workload week fetched successfully.",
    data: result
  });
};
var updateWeek = async (req, res) => {
  const planId = req.params.planId;
  const data = req.validated;
  const week = await workloadServices.updateWorkloadWeek(planId, data);
  sendSuccess(res, {
    statusCode: 200,
    message: "Workload week updated successfully.",
    data: { week }
  });
};
var publishWeek = async (req, res) => {
  const planId = req.params.planId;
  const week = await workloadServices.publishWorkloadWeek(planId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Workload uploaded (published) successfully.",
    data: { week }
  });
};
var deleteWeek = async (req, res) => {
  const planId = req.params.planId;
  await workloadServices.deleteWorkloadWeek(planId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Workload week deleted successfully."
  });
};
var addDemand2 = async (req, res) => {
  const planId = req.params.planId;
  const data = req.validated;
  const demand = await workloadServices.addDemand(planId, data);
  sendSuccess(res, {
    statusCode: 201,
    message: "Staffing demand added successfully.",
    data: { demand }
  });
};
var bulkAddDemands2 = async (req, res) => {
  const planId = req.params.planId;
  const data = req.validated;
  const result = await workloadServices.bulkAddDemands(planId, data);
  sendSuccess(res, {
    statusCode: 201,
    message: `Uploaded ${result.createdCount} staffing demand(s).`,
    data: result
  });
};
var updateDemand2 = async (req, res) => {
  const demandId = req.params.demandId;
  const data = req.validated;
  const demand = await workloadServices.updateDemand(demandId, data);
  sendSuccess(res, {
    statusCode: 200,
    message: "Staffing demand updated successfully.",
    data: { demand }
  });
};
var deleteDemand2 = async (req, res) => {
  const demandId = req.params.demandId;
  await workloadServices.deleteDemand(demandId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Staffing demand deleted successfully."
  });
};
var getWorkloadView2 = async (req, res) => {
  const query = req.validated;
  const result = await workloadServices.getWorkloadView(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Workload fetched successfully.",
    data: result
  });
};

// src/modules/admin/workload/workload.route.ts
var workloadRouter = Router6();
workloadRouter.use(authenticate, authorizeAdmin);
workloadRouter.get(
  "/",
  validateRequest(workloadViewQuerySchema),
  asyncHandler(getWorkloadView2)
);
workloadRouter.post(
  "/weeks",
  validateRequest(createWeekSchema),
  asyncHandler(createWeek)
);
workloadRouter.get(
  "/weeks",
  validateRequest(listWeeksQuerySchema),
  asyncHandler(listWeeks)
);
workloadRouter.get("/weeks/:planId", asyncHandler(getWeek));
workloadRouter.patch(
  "/weeks/:planId",
  validateRequest(updateWeekSchema),
  asyncHandler(updateWeek)
);
workloadRouter.post("/weeks/:planId/publish", asyncHandler(publishWeek));
workloadRouter.delete("/weeks/:planId", asyncHandler(deleteWeek));
workloadRouter.post(
  "/weeks/:planId/demands/bulk",
  validateRequest(bulkDemandsSchema),
  asyncHandler(bulkAddDemands2)
);
workloadRouter.post(
  "/weeks/:planId/demands",
  validateRequest(createDemandSchema),
  asyncHandler(addDemand2)
);
workloadRouter.patch(
  "/demands/:demandId",
  validateRequest(updateDemandSchema),
  asyncHandler(updateDemand2)
);
workloadRouter.delete("/demands/:demandId", asyncHandler(deleteDemand2));
var workload_route_default = workloadRouter;

// src/modules/admin/demands/demands.route.ts
import { Router as Router7 } from "express";

// src/modules/admin/demands/demands.validation.ts
import { z as z7 } from "zod";
var dateString2 = (label) => z7.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).refine((s) => !Number.isNaN(Date.parse(s)), {
  message: `${label} must be a valid date`
});
var requiredCount = z7.number({ required_error: "Required headcount is required" }).int("Required headcount must be a whole number").min(0, "Required headcount cannot be negative").max(1e3, "Required headcount is too large");
var listDemandsQuerySchema = z7.object({
  // weekly = the single week containing `date`; monthly = every week in that
  // month; upcoming = the current week plus all future weeks (default).
  scope: z7.enum(["week", "month", "upcoming"]).default("upcoming"),
  date: dateString2("Reference date").optional()
});
var createWeekSchema2 = z7.object({
  // Any day inside the target week — the server snaps it to that week's Sunday.
  weekStartDate: dateString2("Week start date"),
  // Optional: seed the new week by copying an existing week's demands
  // (mapped day-for-day by weekday).
  copyFromWeekId: z7.string().min(1).optional()
});
var saveGridSchema = z7.object({
  demands: z7.array(
    z7.object({
      categoryId: z7.string({ required_error: "Category is required" }).min(1, "Category is required"),
      date: dateString2("Demand date"),
      requiredCount
    })
  ).min(1, "Provide at least one cell to save").max(700, "Too many cells in a single save")
});
var upsertCellSchema = z7.object({
  categoryId: z7.string({ required_error: "Category is required" }).min(1, "Category is required"),
  date: dateString2("Demand date"),
  requiredCount
});

// src/modules/admin/demands/demands.service.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
var startOfUTCDay2 = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
var addDays2 = (d, n) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
var weekStartSunday = (d) => {
  const day = startOfUTCDay2(d);
  return addDays2(day, -day.getUTCDay());
};
var dateOnly3 = (d) => d.toISOString().slice(0, 10);
var sevenDays = (weekStart) => Array.from({ length: 7 }, (_, i) => addDays2(weekStart, i));
var relativeLabel = (weekStart, currentStart) => {
  const w = weekStart.getTime();
  const c = currentStart.getTime();
  return w < c ? "past" : w > c ? "upcoming" : "current";
};
var demandSelect2 = {
  id: true,
  categoryId: true,
  date: true,
  requiredCount: true
};
var weekSelect = {
  id: true,
  weekStartDate: true,
  weekEndDate: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  demands: { select: demandSelect2 }
};
var getActiveCategories = () => prisma.category.findMany({
  where: { isActive: true },
  orderBy: [{ createdAt: "asc" }],
  select: { id: true, name: true }
});
var buildWeek = (week, categories, currentStart) => {
  const start = startOfUTCDay2(week.weekStartDate);
  const days = sevenDays(start).map(dateOnly3);
  const byKey = /* @__PURE__ */ new Map();
  for (const d of week.demands) byKey.set(`${d.categoryId}|${dateOnly3(d.date)}`, d);
  const categoryGrid = categories.map((cat) => ({
    category: cat,
    cells: days.map((day) => {
      const hit = byKey.get(`${cat.id}|${day}`);
      return {
        date: day,
        requiredCount: hit ? hit.requiredCount : 0,
        demandId: hit ? hit.id : null
      };
    })
  }));
  return {
    id: week.id,
    weekStartDate: dateOnly3(week.weekStartDate),
    weekEndDate: dateOnly3(week.weekEndDate),
    status: week.status,
    publishedAt: week.publishedAt,
    relative: relativeLabel(start, currentStart),
    days,
    categories: categoryGrid
  };
};
var loadWeekOr404 = async (weekId) => {
  const week = await prisma.demandWeek.findUnique({ where: { id: weekId }, select: weekSelect });
  if (!week) throw new AppError("Demand week plan not found.", 404);
  return week;
};
var getDemands = async (query) => {
  const now = /* @__PURE__ */ new Date();
  const currentStart = weekStartSunday(now);
  const anchor = query.date ? new Date(query.date) : now;
  let where;
  if (query.scope === "week") {
    where = { weekStartDate: weekStartSunday(anchor) };
  } else if (query.scope === "month") {
    const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
    where = { weekStartDate: { gte: monthStart, lt: monthEnd } };
  } else {
    where = { weekStartDate: { gte: currentStart } };
  }
  const [weeks, categories] = await Promise.all([
    prisma.demandWeek.findMany({ where, orderBy: [{ weekStartDate: "asc" }], select: weekSelect }),
    getActiveCategories()
  ]);
  return {
    scope: query.scope,
    today: dateOnly3(startOfUTCDay2(now)),
    currentWeek: {
      weekStartDate: dateOnly3(currentStart),
      weekEndDate: dateOnly3(addDays2(currentStart, 6))
    },
    weeks: weeks.map((w) => buildWeek(w, categories, currentStart))
  };
};
var listWeeks2 = async () => {
  const currentStart = weekStartSunday(/* @__PURE__ */ new Date());
  const weeks = await prisma.demandWeek.findMany({
    orderBy: [{ weekStartDate: "desc" }],
    select: {
      id: true,
      weekStartDate: true,
      weekEndDate: true,
      status: true,
      publishedAt: true,
      _count: { select: { demands: true } }
    }
  });
  return weeks.map((w) => ({
    id: w.id,
    weekStartDate: dateOnly3(w.weekStartDate),
    weekEndDate: dateOnly3(w.weekEndDate),
    status: w.status,
    publishedAt: w.publishedAt,
    demandCount: w._count.demands,
    relative: relativeLabel(startOfUTCDay2(w.weekStartDate), currentStart)
  }));
};
var getWeek2 = async (weekId) => {
  const week = await loadWeekOr404(weekId);
  const categories = await getActiveCategories();
  return buildWeek(week, categories, weekStartSunday(/* @__PURE__ */ new Date()));
};
var createWeek2 = async (data) => {
  const start = weekStartSunday(new Date(data.weekStartDate));
  const end = addDays2(start, 6);
  const existing = await prisma.demandWeek.findUnique({
    where: { weekStartDate: start },
    select: { id: true }
  });
  if (existing) {
    throw new AppError("A demand plan already exists for this week.", 409);
  }
  let seed = [];
  if (data.copyFromWeekId) {
    const source = await prisma.demandWeek.findUnique({
      where: { id: data.copyFromWeekId },
      select: { weekStartDate: true, demands: { select: demandSelect2 } }
    });
    if (!source) throw new AppError("The week to copy from was not found.", 404);
    const sourceStart = startOfUTCDay2(source.weekStartDate);
    seed = source.demands.map((d) => {
      const offset = Math.round((startOfUTCDay2(d.date).getTime() - sourceStart.getTime()) / DAY_MS);
      return {
        category: { connect: { id: d.categoryId } },
        date: addDays2(start, offset),
        requiredCount: d.requiredCount
      };
    });
  }
  const week = await prisma.demandWeek.create({
    data: {
      weekStartDate: start,
      weekEndDate: end,
      ...seed.length ? { demands: { create: seed } } : {}
    },
    select: weekSelect
  });
  const categories = await getActiveCategories();
  return buildWeek(week, categories, weekStartSunday(/* @__PURE__ */ new Date()));
};
var validateCells = async (week, cells) => {
  const start = startOfUTCDay2(week.weekStartDate);
  const validDays = new Set(sevenDays(start).map(dateOnly3));
  for (const c of cells) {
    if (!validDays.has(dateOnly3(new Date(c.date)))) {
      throw new AppError(`Date ${dateOnly3(new Date(c.date))} is outside this week.`, 400);
    }
  }
  const categoryIds = [...new Set(cells.map((c) => c.categoryId))];
  const found = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true }
  });
  const known = new Set(found.map((c) => c.id));
  const missing = categoryIds.find((id) => !known.has(id));
  if (missing) throw new AppError(`Category ${missing} does not exist.`, 400);
};
var cellWhere = (weekId, categoryId, date) => ({
  demandWeekId_categoryId_date: {
    demandWeekId: weekId,
    categoryId,
    date: startOfUTCDay2(new Date(date))
  }
});
var saveGrid = async (weekId, data) => {
  const week = await loadWeekOr404(weekId);
  await validateCells(week, data.demands);
  await prisma.$transaction(
    data.demands.map(
      (c) => prisma.dayDemand.upsert({
        where: cellWhere(weekId, c.categoryId, c.date),
        create: {
          demandWeek: { connect: { id: weekId } },
          category: { connect: { id: c.categoryId } },
          date: startOfUTCDay2(new Date(c.date)),
          requiredCount: c.requiredCount
        },
        update: { requiredCount: c.requiredCount }
      })
    )
  );
  return getWeek2(weekId);
};
var upsertCell = async (weekId, data) => {
  const week = await loadWeekOr404(weekId);
  await validateCells(week, [data]);
  const demand = await prisma.dayDemand.upsert({
    where: cellWhere(weekId, data.categoryId, data.date),
    create: {
      demandWeek: { connect: { id: weekId } },
      category: { connect: { id: data.categoryId } },
      date: startOfUTCDay2(new Date(data.date)),
      requiredCount: data.requiredCount
    },
    update: { requiredCount: data.requiredCount },
    select: { ...demandSelect2, date: true }
  });
  return { ...demand, date: dateOnly3(demand.date) };
};
var publishWeek2 = async (weekId) => {
  await loadWeekOr404(weekId);
  const week = await prisma.demandWeek.update({
    where: { id: weekId },
    data: { status: "PUBLISHED", publishedAt: /* @__PURE__ */ new Date() },
    select: weekSelect
  });
  const categories = await getActiveCategories();
  return buildWeek(week, categories, weekStartSunday(/* @__PURE__ */ new Date()));
};
var deleteWeek2 = async (weekId) => {
  await loadWeekOr404(weekId);
  await prisma.demandWeek.delete({ where: { id: weekId } });
};
var demandServices = {
  getDemands,
  listWeeks: listWeeks2,
  getWeek: getWeek2,
  createWeek: createWeek2,
  saveGrid,
  upsertCell,
  publishWeek: publishWeek2,
  deleteWeek: deleteWeek2
};

// src/modules/admin/demands/demands.controller.ts
var getDemands2 = async (req, res) => {
  const query = req.validated;
  const result = await demandServices.getDemands(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Demands fetched successfully.",
    data: result
  });
};
var listWeeks3 = async (_req, res) => {
  const weeks = await demandServices.listWeeks();
  sendSuccess(res, {
    statusCode: 200,
    message: "Week plans fetched successfully.",
    data: { weeks }
  });
};
var getWeek3 = async (req, res) => {
  const weekId = req.params.weekId;
  const week = await demandServices.getWeek(weekId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Week plan fetched successfully.",
    data: { week }
  });
};
var createWeek3 = async (req, res) => {
  const data = req.validated;
  const week = await demandServices.createWeek(data);
  sendSuccess(res, {
    statusCode: 201,
    message: "Week plan created successfully.",
    data: { week }
  });
};
var saveGrid2 = async (req, res) => {
  const weekId = req.params.weekId;
  const data = req.validated;
  const week = await demandServices.saveGrid(weekId, data);
  sendSuccess(res, {
    statusCode: 200,
    message: "Demands saved successfully.",
    data: { week }
  });
};
var upsertCell2 = async (req, res) => {
  const weekId = req.params.weekId;
  const data = req.validated;
  const demand = await demandServices.upsertCell(weekId, data);
  sendSuccess(res, {
    statusCode: 200,
    message: "Demand updated successfully.",
    data: { demand }
  });
};
var publishWeek3 = async (req, res) => {
  const weekId = req.params.weekId;
  const week = await demandServices.publishWeek(weekId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Week plan published successfully.",
    data: { week }
  });
};
var deleteWeek3 = async (req, res) => {
  const weekId = req.params.weekId;
  await demandServices.deleteWeek(weekId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Week plan deleted successfully."
  });
};

// src/modules/admin/demands/demands.route.ts
var demandRouter = Router7();
demandRouter.use(authenticate, authorizeAdmin);
demandRouter.get(
  "/",
  validateRequest(listDemandsQuerySchema),
  asyncHandler(getDemands2)
);
demandRouter.get("/weeks", asyncHandler(listWeeks3));
demandRouter.post(
  "/weeks",
  validateRequest(createWeekSchema2),
  asyncHandler(createWeek3)
);
demandRouter.get("/weeks/:weekId", asyncHandler(getWeek3));
demandRouter.put(
  "/weeks/:weekId",
  validateRequest(saveGridSchema),
  asyncHandler(saveGrid2)
);
demandRouter.put(
  "/weeks/:weekId/cell",
  validateRequest(upsertCellSchema),
  asyncHandler(upsertCell2)
);
demandRouter.post("/weeks/:weekId/publish", asyncHandler(publishWeek3));
demandRouter.delete("/weeks/:weekId", asyncHandler(deleteWeek3));
var demands_route_default = demandRouter;

// src/modules/admin/reports/reports.route.ts
import { Router as Router8 } from "express";

// src/modules/admin/reports/reports.validation.ts
import { z as z8 } from "zod";
var reportQuerySchema = z8.object({
  year: z8.coerce.number().int().min(2e3).max(2100).optional(),
  month: z8.coerce.number().int().min(1).max(12).optional(),
  categoryId: z8.string().min(1).optional()
});

// src/modules/admin/reports/reports.controller.ts
var toServiceQuery = (validated) => {
  const query = {};
  if (validated.year !== void 0) query.year = validated.year;
  if (validated.month !== void 0) query.month = validated.month;
  if (validated.categoryId !== void 0) query.categoryId = validated.categoryId;
  return query;
};
var getReport = async (req, res) => {
  const validated = req.validated;
  const report = await reportServices.buildReport(toServiceQuery(validated));
  sendSuccess(res, {
    statusCode: 200,
    message: "Report generated successfully.",
    data: report
  });
};
var exportReportCsv = async (req, res) => {
  const validated = req.validated;
  const { csv, filename } = await reportServices.buildReportCsv(toServiceQuery(validated));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
};

// src/modules/admin/reports/reports.route.ts
var reportRouter = Router8();
reportRouter.use(authenticate, authorizeAdmin);
reportRouter.get(
  "/",
  validateRequest(reportQuerySchema),
  asyncHandler(getReport)
);
reportRouter.get(
  "/export",
  validateRequest(reportQuerySchema),
  asyncHandler(exportReportCsv)
);
var reports_route_default = reportRouter;

// src/modules/admin/settings/settings.route.ts
import { Router as Router9 } from "express";

// src/modules/admin/settings/settings.validation.ts
import { z as z9 } from "zod";
var notificationPrefsSchema = z9.object({
  shiftPublished: z9.boolean().optional(),
  swapRequests: z9.boolean().optional(),
  availabilityReminders: z9.boolean().optional(),
  ruleViolations: z9.boolean().optional(),
  channelEmail: z9.boolean().optional(),
  channelPush: z9.boolean().optional(),
  channelInApp: z9.boolean().optional()
});
var updateSettingsSchema = z9.object({
  maxDailyHours: z9.number().min(0).max(24).optional(),
  maxWeeklyHours: z9.number().min(0).max(168).optional(),
  minRestHoursBetweenShifts: z9.number().min(0).max(48).optional(),
  breakRequiredAfterHours: z9.number().min(0).max(24).optional(),
  minBreakMinutes: z9.number().int().min(0).max(480).optional(),
  sessionTimeoutMinutes: z9.number().int().min(1).max(1440).optional(),
  swapExpiryHours: z9.number().int().min(1).max(720).optional(),
  defaultShiftStartTime: z9.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "defaultShiftStartTime must be HH:mm").optional(),
  defaultShiftEndTime: z9.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "defaultShiftEndTime must be HH:mm").optional(),
  notificationPrefs: notificationPrefsSchema.optional()
}).refine(
  (d) => !d.defaultShiftStartTime || !d.defaultShiftEndTime || d.defaultShiftEndTime > d.defaultShiftStartTime,
  { message: "defaultShiftEndTime must be after defaultShiftStartTime" }
).refine((data) => Object.keys(data).length > 0, {
  message: "Provide at least one setting to update."
});

// src/modules/admin/settings/settings.service.ts
var DEFAULTS = {
  maxDailyHours: 12.5,
  maxWeeklyHours: 50,
  minRestHoursBetweenShifts: 11,
  breakRequiredAfterHours: 5.5,
  minBreakMinutes: 30,
  sessionTimeoutMinutes: 30,
  swapExpiryHours: 72
};
var DEFAULT_NOTIFICATION_PREFS = {
  shiftPublished: true,
  swapRequests: true,
  availabilityReminders: true,
  ruleViolations: true,
  channelEmail: false,
  channelPush: true,
  channelInApp: true
};
var settingsSelect = {
  id: true,
  maxDailyHours: true,
  maxWeeklyHours: true,
  minRestHoursBetweenShifts: true,
  breakRequiredAfterHours: true,
  minBreakMinutes: true,
  breakRules: true,
  sessionTimeoutMinutes: true,
  notificationPrefs: true,
  swapExpiryHours: true,
  defaultShiftStartTime: true,
  defaultShiftEndTime: true,
  updatedAt: true,
  updatedById: true
};
var withPrefDefaults = (settings) => ({
  ...settings,
  notificationPrefs: {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...settings.notificationPrefs ?? {}
  }
});
var getSettings = async () => {
  const settings = await prisma.orgSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...DEFAULTS },
    update: {},
    select: settingsSelect
  });
  return withPrefDefaults(settings);
};
var updateSettings = async (data, adminId) => {
  const current = await getSettings();
  const updateData = { updatedById: adminId };
  if (data.maxDailyHours !== void 0) updateData.maxDailyHours = data.maxDailyHours;
  if (data.maxWeeklyHours !== void 0) updateData.maxWeeklyHours = data.maxWeeklyHours;
  if (data.minRestHoursBetweenShifts !== void 0)
    updateData.minRestHoursBetweenShifts = data.minRestHoursBetweenShifts;
  if (data.breakRequiredAfterHours !== void 0)
    updateData.breakRequiredAfterHours = data.breakRequiredAfterHours;
  if (data.minBreakMinutes !== void 0) updateData.minBreakMinutes = data.minBreakMinutes;
  if (data.sessionTimeoutMinutes !== void 0)
    updateData.sessionTimeoutMinutes = data.sessionTimeoutMinutes;
  if (data.swapExpiryHours !== void 0) updateData.swapExpiryHours = data.swapExpiryHours;
  if (data.defaultShiftStartTime !== void 0)
    updateData.defaultShiftStartTime = data.defaultShiftStartTime;
  if (data.defaultShiftEndTime !== void 0)
    updateData.defaultShiftEndTime = data.defaultShiftEndTime;
  if (data.notificationPrefs !== void 0) {
    const currentPrefs = current.notificationPrefs;
    updateData.notificationPrefs = { ...currentPrefs, ...data.notificationPrefs };
  }
  const settings = await prisma.orgSettings.update({
    where: { id: 1 },
    data: updateData,
    select: settingsSelect
  });
  return withPrefDefaults(settings);
};
var settingsServices = { getSettings, updateSettings };

// src/modules/admin/settings/settings.controller.ts
var getSettings2 = async (_req, res) => {
  const settings = await settingsServices.getSettings();
  sendSuccess(res, {
    statusCode: 200,
    message: "Settings fetched successfully.",
    data: { settings }
  });
};
var updateSettings2 = async (req, res) => {
  const data = req.validated;
  const adminId = res.locals.auth.userId;
  const settings = await settingsServices.updateSettings(data, adminId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Settings updated successfully.",
    data: { settings }
  });
};

// src/modules/admin/settings/settings.route.ts
var settingsRouter = Router9();
settingsRouter.use(authenticate, authorizeAdmin);
settingsRouter.get("/", asyncHandler(getSettings2));
settingsRouter.patch(
  "/",
  validateRequest(updateSettingsSchema),
  asyncHandler(updateSettings2)
);
var settings_route_default = settingsRouter;

// src/modules/admin/swaps/swaps.route.ts
import { Router as Router10 } from "express";

// src/modules/admin/swaps/swaps.validation.ts
import { z as z10 } from "zod";
var listSwapsQuerySchema = z10.object({
  page: z10.coerce.number().int().min(1).default(1),
  limit: z10.coerce.number().int().min(1).max(100).default(20),
  status: z10.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional()
});
var swapIdParamSchema = z10.object({
  swapId: z10.string({ required_error: "Swap ID is required" }).min(1)
});
var reviewSwapSchema = z10.object({
  note: z10.string().trim().max(500).optional()
});

// src/modules/admin/swaps/swaps.controller.ts
var listSwaps2 = async (req, res) => {
  const validated = req.validated;
  const query = { page: validated.page, limit: validated.limit };
  if (validated.status !== void 0) query.status = validated.status;
  const result = await adminSwapServices.listSwaps(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Swap requests fetched successfully.",
    data: { swaps: result.swaps },
    meta: { pagination: result.pagination }
  });
};
var approveSwap2 = async (req, res) => {
  const swapId = req.params.swapId;
  const adminId = res.locals.auth.userId;
  const { note } = req.validated;
  const swap = await adminSwapServices.approveSwap(swapId, adminId, note);
  sendSuccess(res, {
    statusCode: 200,
    message: "Swap approved and shifts exchanged.",
    data: { swap }
  });
};
var rejectSwap2 = async (req, res) => {
  const swapId = req.params.swapId;
  const adminId = res.locals.auth.userId;
  const { note } = req.validated;
  const swap = await adminSwapServices.rejectSwap(swapId, adminId, note);
  sendSuccess(res, {
    statusCode: 200,
    message: "Swap request rejected.",
    data: { swap }
  });
};

// src/modules/admin/swaps/swaps.route.ts
var adminSwapRouter = Router10();
adminSwapRouter.use(authenticate, authorizeAdmin);
adminSwapRouter.get(
  "/",
  validateRequest(listSwapsQuerySchema),
  asyncHandler(listSwaps2)
);
adminSwapRouter.post(
  "/:swapId/approve",
  validateRequest(reviewSwapSchema),
  asyncHandler(approveSwap2)
);
adminSwapRouter.post(
  "/:swapId/reject",
  validateRequest(reviewSwapSchema),
  asyncHandler(rejectSwap2)
);
var swaps_route_default = adminSwapRouter;

// src/modules/admin/availability/availability.route.ts
import { Router as Router11 } from "express";

// src/modules/admin/availability/availability.validation.ts
import { z as z11 } from "zod";
var openAvailabilitySchema = z11.object({
  year: z11.number({ required_error: "Year is required" }).int().min(2e3).max(2100),
  month: z11.number({ required_error: "Month is required" }).int().min(1).max(12),
  cutoffAt: z11.string({ required_error: "Cut-off date is required" }).datetime({
    message: "cutoffAt must be an ISO 8601 date-time string"
  })
});
var availabilityQuerySchema = z11.object({
  year: z11.coerce.number().int().min(2e3).max(2100),
  month: z11.coerce.number().int().min(1).max(12)
});
var nudgeSchema = z11.object({
  year: z11.number({ required_error: "Year is required" }).int().min(2e3).max(2100),
  month: z11.number({ required_error: "Month is required" }).int().min(1).max(12)
});

// src/modules/admin/availability/availability.controller.ts
var openMonth2 = async (req, res) => {
  const data = req.validated;
  const result = await adminAvailabilityServices.openMonth(data);
  sendSuccess(res, {
    statusCode: 201,
    message: `Availability opened for ${result.opened} employee(s).`,
    data: result
  });
};
var getMonthStatus2 = async (req, res) => {
  const { year, month } = req.validated;
  const result = await adminAvailabilityServices.getMonthStatus(year, month);
  sendSuccess(res, {
    statusCode: 200,
    message: "Availability status fetched successfully.",
    data: {
      year: result.year,
      month: result.month,
      employees: result.rows,
      notSubmitted: result.notSubmitted,
      summary: result.summary
    }
  });
};
var getMonthGrid2 = async (req, res) => {
  const { year, month } = req.validated;
  const result = await adminAvailabilityServices.getMonthGrid(year, month);
  sendSuccess(res, {
    statusCode: 200,
    message: "Availability grid fetched successfully.",
    data: result
  });
};
var getUserMonth2 = async (req, res) => {
  const userId = req.params.userId;
  const { year, month } = req.validated;
  const availability = await adminAvailabilityServices.getUserMonth(userId, year, month);
  sendSuccess(res, {
    statusCode: 200,
    message: "Employee availability fetched successfully.",
    data: { availability }
  });
};
var nudge2 = async (req, res) => {
  const userId = req.params.userId;
  const { year, month } = req.validated;
  await adminAvailabilityServices.nudge(userId, year, month);
  sendSuccess(res, {
    statusCode: 200,
    message: "Reminder sent to the employee."
  });
};

// src/modules/admin/availability/availability.route.ts
var adminAvailabilityRouter = Router11();
adminAvailabilityRouter.use(authenticate, authorizeAdmin);
adminAvailabilityRouter.post(
  "/open",
  validateRequest(openAvailabilitySchema),
  asyncHandler(openMonth2)
);
adminAvailabilityRouter.get(
  "/",
  validateRequest(availabilityQuerySchema),
  asyncHandler(getMonthStatus2)
);
adminAvailabilityRouter.get(
  "/grid",
  validateRequest(availabilityQuerySchema),
  asyncHandler(getMonthGrid2)
);
adminAvailabilityRouter.get(
  "/:userId",
  validateRequest(availabilityQuerySchema),
  asyncHandler(getUserMonth2)
);
adminAvailabilityRouter.post(
  "/:userId/nudge",
  validateRequest(nudgeSchema),
  asyncHandler(nudge2)
);
var availability_route_default = adminAvailabilityRouter;

// src/modules/admin/scheduling/scheduling.route.ts
import { Router as Router12 } from "express";

// src/modules/admin/scheduling/scheduling.validation.ts
import { z as z12 } from "zod";
var dateString3 = (label) => z12.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).refine((s) => !Number.isNaN(Date.parse(s)), {
  message: `${label} must be a valid date`
});
var isoDateTime2 = (label) => z12.string({ required_error: `${label} is required` }).datetime({
  message: `${label} must be an ISO 8601 date-time string`
});
var planStatusEnum2 = z12.enum(["DRAFT", "SUBMITTED", "PUBLISHED"]);
var generateScheduleSchema = z12.object({
  weekPlanId: z12.string({ required_error: "weekPlanId is required" }).min(1, "weekPlanId is required")
});
var generateMonthSchema = z12.object({
  year: z12.coerce.number().int().min(2e3).max(2100),
  month: z12.coerce.number().int().min(1).max(12)
});
var listPlansQuerySchema = z12.object({
  page: z12.coerce.number().int().min(1).default(1),
  limit: z12.coerce.number().int().min(1).max(100).default(20),
  year: z12.coerce.number().int().min(2e3).max(2100).optional(),
  month: z12.coerce.number().int().min(1).max(12).optional(),
  status: planStatusEnum2.optional()
});
var createShiftSchema2 = z12.object({
  userId: z12.string({ required_error: "userId is required" }).min(1, "userId is required"),
  categoryId: z12.string({ required_error: "categoryId is required" }).min(1, "categoryId is required"),
  date: dateString3("Shift date"),
  startTime: isoDateTime2("Shift start time"),
  endTime: isoDateTime2("Shift end time"),
  // Owner rule for manually filling an open slot: also reduce the same
  // weekday/category demand of next week and consume the employee's
  // availability entry for this date.
  reduceNextWeekDemand: z12.boolean().optional().default(false)
}).refine((d) => new Date(d.endTime) > new Date(d.startTime), {
  message: "endTime must be after startTime",
  path: ["endTime"]
});
var updateShiftSchema2 = z12.object({
  startTime: isoDateTime2("Shift start time"),
  endTime: isoDateTime2("Shift end time")
}).refine((d) => new Date(d.endTime) > new Date(d.startTime), {
  message: "endTime must be after startTime",
  path: ["endTime"]
});

// src/modules/admin/scheduling/scheduling.service.ts
var HOURS_PER_MS3 = 1 / (1e3 * 60 * 60);
var startOfUTCDay3 = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
var addDays3 = (d, n) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
var sameUTCDate2 = (a, b) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
var dateOnly4 = (d) => d.toISOString().slice(0, 10);
var durationHours2 = (s) => (s.endTime.getTime() - s.startTime.getTime()) * HOURS_PER_MS3;
var overlaps = (a, b) => a.startTime < b.endTime && a.endTime > b.startTime;
var displayName3 = (u) => u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);
var planSelect2 = {
  id: true,
  year: true,
  month: true,
  weekNumber: true,
  weekStartDate: true,
  weekEndDate: true,
  status: true,
  submittedAt: true,
  needsRenotify: true,
  createdAt: true,
  updatedAt: true
};
var shiftSelect2 = {
  id: true,
  weeklyPlanId: true,
  userId: true,
  user: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      hourlyRate: true
    }
  },
  categoryId: true,
  category: { select: { id: true, name: true } },
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  rejectionReason: true,
  rulePassed: true,
  ruleViolations: true,
  notifiedAt: true,
  createdAt: true,
  updatedAt: true
};
var loadRuleSettings = async () => {
  const settings = await prisma.orgSettings.findUnique({
    where: { id: 1 },
    select: { maxDailyHours: true, maxWeeklyHours: true, minRestHoursBetweenShifts: true }
  });
  return {
    maxDailyHours: settings ? Number(settings.maxDailyHours) : Infinity,
    maxWeeklyHours: settings ? Number(settings.maxWeeklyHours) : Infinity,
    minRestHours: settings ? Number(settings.minRestHoursBetweenShifts) : 0
  };
};
var evaluateAssignment = (candidate, existing, rules, weekWindow2) => {
  const violations = [];
  if (existing.some((s) => overlaps(s, candidate))) {
    violations.push("OVERLAP: already assigned to an overlapping shift");
  }
  const dayHours = existing.filter((s) => sameUTCDate2(s.startTime, candidate.startTime)).reduce((sum, s) => sum + durationHours2(s), 0) + durationHours2(candidate);
  if (dayHours > rules.maxDailyHours) {
    violations.push(
      `DAILY_HOURS: ${dayHours.toFixed(2)}h would exceed the ${rules.maxDailyHours}h daily maximum`
    );
  }
  const weekHours = existing.filter(
    (s) => s.startTime >= weekWindow2.start && s.startTime < weekWindow2.endExclusive
  ).reduce((sum, s) => sum + durationHours2(s), 0) + durationHours2(candidate);
  if (weekHours > rules.maxWeeklyHours) {
    violations.push(
      `WEEKLY_HOURS: ${weekHours.toFixed(2)}h would exceed the ${rules.maxWeeklyHours}h weekly maximum`
    );
  }
  if (rules.minRestHours > 0) {
    for (const s of existing) {
      if (overlaps(s, candidate)) continue;
      const gapH = s.endTime <= candidate.startTime ? (candidate.startTime.getTime() - s.endTime.getTime()) * HOURS_PER_MS3 : (s.startTime.getTime() - candidate.endTime.getTime()) * HOURS_PER_MS3;
      if (gapH < rules.minRestHours) {
        violations.push(
          `REST_PERIOD: only ${gapH.toFixed(2)}h rest to an adjacent shift (minimum ${rules.minRestHours}h)`
        );
        break;
      }
    }
  }
  return violations;
};
var loadNearbyShifts = async (userIds, week, excludeShiftId) => {
  const rows = await prisma.shift.findMany({
    where: {
      userId: { in: userIds },
      date: {
        gte: addDays3(startOfUTCDay3(week.weekStartDate), -1),
        lte: addDays3(startOfUTCDay3(week.weekEndDate), 1)
      },
      status: { notIn: ["CANCELLED", "REJECTED", "SWAPPED_OUT"] },
      ...excludeShiftId ? { id: { not: excludeShiftId } } : {}
    },
    select: { id: true, userId: true, startTime: true, endTime: true }
  });
  const byUser = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push({ id: r.id, startTime: r.startTime, endTime: r.endTime });
    byUser.set(r.userId, list);
  }
  return byUser;
};
var weekNumberInMonth = (weekStart) => Math.floor((weekStart.getUTCDate() - 1) / 7) + 1;
var loadDefaultShiftWindow = async () => {
  const settings = await prisma.orgSettings.findUnique({
    where: { id: 1 },
    select: { defaultShiftStartTime: true, defaultShiftEndTime: true }
  });
  const parse = (value, fallback) => {
    const m = /^(\d{2}):(\d{2})$/.exec(value ?? "");
    return m ? [Number(m[1]), Number(m[2])] : fallback;
  };
  return {
    start: parse(settings?.defaultShiftStartTime, [9, 0]),
    end: parse(settings?.defaultShiftEndTime, [17, 0])
  };
};
var syncPlanFromDemandWeek = async (demandWeek) => {
  const weekStart = startOfUTCDay3(demandWeek.weekStartDate);
  let plan = await prisma.weeklyPlan.findFirst({
    where: { weekStartDate: demandWeek.weekStartDate },
    select: planSelect2
  });
  if (!plan) {
    const base = {
      year: weekStart.getUTCFullYear(),
      month: weekStart.getUTCMonth() + 1,
      weekStartDate: demandWeek.weekStartDate,
      weekEndDate: demandWeek.weekEndDate,
      status: "DRAFT"
    };
    try {
      plan = await prisma.weeklyPlan.create({
        data: { ...base, weekNumber: weekNumberInMonth(weekStart) },
        select: planSelect2
      });
    } catch (err) {
      if (err instanceof prismaNamespace_exports.PrismaClientKnownRequestError && err.code === "P2002") {
        const max = await prisma.weeklyPlan.aggregate({
          where: { year: base.year, month: base.month },
          _max: { weekNumber: true }
        });
        plan = await prisma.weeklyPlan.create({
          data: { ...base, weekNumber: (max._max.weekNumber ?? 0) + 1 },
          select: planSelect2
        });
      } else {
        throw err;
      }
    }
  }
  if (plan.status === "PUBLISHED") return plan;
  const window = await loadDefaultShiftWindow();
  const demandsToCreate = demandWeek.demands.filter((d) => d.requiredCount > 0).map((d) => {
    const day = startOfUTCDay3(d.date);
    return {
      weeklyPlanId: plan.id,
      categoryId: d.categoryId,
      date: d.date,
      requiredCount: d.requiredCount,
      startTime: new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), ...window.start)
      ),
      endTime: new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), ...window.end)
      )
    };
  });
  await prisma.$transaction([
    prisma.staffingDemand.deleteMany({ where: { weeklyPlanId: plan.id } }),
    ...demandsToCreate.length > 0 ? [prisma.staffingDemand.createMany({ data: demandsToCreate, skipDuplicates: true })] : []
  ]);
  return plan;
};
var getPlanOr404 = async (weekPlanId) => {
  const plan = await prisma.weeklyPlan.findUnique({
    where: { id: weekPlanId },
    select: planSelect2
  });
  if (plan) {
    if (plan.status === "PUBLISHED") return plan;
    const demandWeek2 = await prisma.demandWeek.findFirst({
      where: { weekStartDate: plan.weekStartDate },
      include: { demands: true }
    });
    if (demandWeek2) return syncPlanFromDemandWeek(demandWeek2);
    return plan;
  }
  const demandWeek = await prisma.demandWeek.findUnique({
    where: { id: weekPlanId },
    include: { demands: true }
  });
  if (demandWeek) return syncPlanFromDemandWeek(demandWeek);
  throw new AppError("Weekly plan not found.", 404);
};
var buildScheduleDetail = async (weekPlanId) => {
  const plan = await getPlanOr404(weekPlanId);
  const [shifts, demands] = await Promise.all([
    prisma.shift.findMany({
      where: { weeklyPlanId: plan.id },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: shiftSelect2
    }),
    prisma.staffingDemand.findMany({
      where: { weeklyPlanId: plan.id },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        date: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
        requiredCount: true,
        startTime: true,
        endTime: true
      }
    })
  ]);
  const activeShifts = shifts.filter(
    (s) => s.status !== "CANCELLED" && s.status !== "REJECTED" && s.status !== "SWAPPED_OUT"
  );
  const unfilledDemands = demands.map((d) => {
    const assigned = activeShifts.filter(
      (s) => s.categoryId === d.categoryId && sameUTCDate2(s.date, d.date) && overlaps(s, d)
    ).length;
    return {
      demandId: d.id,
      date: dateOnly4(d.date),
      categoryId: d.categoryId,
      categoryName: d.category.name,
      startTime: d.startTime,
      endTime: d.endTime,
      requiredCount: d.requiredCount,
      assignedCount: assigned,
      missingCount: Math.max(0, d.requiredCount - assigned)
    };
  }).filter((d) => d.missingCount > 0);
  const violations = shifts.filter((s) => !s.rulePassed && s.ruleViolations).map((s) => ({
    shiftId: s.id,
    userId: s.userId,
    userName: displayName3(s.user),
    date: dateOnly4(s.date),
    startTime: s.startTime,
    endTime: s.endTime,
    violations: s.ruleViolations
  }));
  const totalHours = activeShifts.reduce((sum, s) => sum + durationHours2(s), 0);
  const totalCost = activeShifts.reduce(
    (sum, s) => sum + durationHours2(s) * Number(s.user.hourlyRate ?? 0),
    0
  );
  return {
    plan,
    shifts,
    unfilledDemands,
    violations,
    demands,
    summary: {
      shiftCount: activeShifts.length,
      totalHours: Number(totalHours.toFixed(2)),
      estimatedCost: Number(totalCost.toFixed(2)),
      unfilledCount: unfilledDemands.length,
      violationCount: violations.length
    }
  };
};
var listPlans = async (query) => {
  const { page, limit, year, month, status } = query;
  const skip = (page - 1) * limit;
  const where = {};
  if (year !== void 0) where.year = year;
  if (month !== void 0) where.month = month;
  if (status) where.status = status;
  const [plans, total] = await Promise.all([
    prisma.weeklyPlan.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ year: "desc" }, { month: "desc" }, { weekNumber: "desc" }],
      select: {
        ...planSelect2,
        _count: { select: { shifts: true, demands: true } }
      }
    }),
    prisma.weeklyPlan.count({ where })
  ]);
  return {
    plans: plans.map(({ _count, ...p }) => ({
      ...p,
      shiftCount: _count.shifts,
      demandCount: _count.demands
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var generateForPlan = async (plan) => {
  const demands = await prisma.staffingDemand.findMany({
    where: { weeklyPlanId: plan.id },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      date: true,
      categoryId: true,
      category: { select: { name: true } },
      requiredCount: true,
      startTime: true,
      endTime: true
    }
  });
  if (demands.length === 0) {
    throw new AppError(
      "This week has no staffing demand. Set this week's demand on the Demand page before generating a schedule.",
      409
    );
  }
  await prisma.shift.deleteMany({
    where: { weeklyPlanId: plan.id, status: { not: "ACCEPTED" } }
  });
  const rules = await loadRuleSettings();
  const weekStart = startOfUTCDay3(plan.weekStartDate);
  const weekEndExclusive = addDays3(startOfUTCDay3(plan.weekEndDate), 1);
  const weekWindow2 = { start: weekStart, endExclusive: weekEndExclusive };
  const categoryIds = [...new Set(demands.map((d) => d.categoryId))];
  const users = await prisma.user.findMany({
    where: { isActive: true, categories: { some: { categoryId: { in: categoryIds } } } },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      categories: { select: { categoryId: true } }
    }
  });
  const userIds = users.map((u) => u.id);
  const availDays = await prisma.availabilityDay.findMany({
    where: {
      availabilityMonth: { userId: { in: userIds } },
      date: { gte: weekStart, lt: weekEndExclusive }
    },
    select: {
      date: true,
      status: true,
      availabilityMonth: { select: { userId: true, year: true, month: true } }
    }
  });
  const availByUserDay = /* @__PURE__ */ new Map();
  for (const d of availDays) {
    availByUserDay.set(`${d.availabilityMonth.userId}|${dateOnly4(d.date)}`, d.status);
  }
  const assignedByUser = await loadNearbyShifts(userIds, plan);
  for (const id of userIds) if (!assignedByUser.has(id)) assignedByUser.set(id, []);
  const keptShifts = await prisma.shift.findMany({
    where: { weeklyPlanId: plan.id },
    select: { userId: true, categoryId: true, date: true, startTime: true, endTime: true }
  });
  const weekHoursOf = (uid) => (assignedByUser.get(uid) ?? []).filter((s) => s.startTime >= weekStart && s.startTime < weekEndExclusive).reduce((sum, s) => sum + durationHours2(s), 0);
  const newShifts = [];
  const unfilled = [];
  for (const demand of demands) {
    const slot = { startTime: demand.startTime, endTime: demand.endTime };
    const dayKey = dateOnly4(demand.date);
    const alreadyAssigned = keptShifts.filter(
      (s) => s.categoryId === demand.categoryId && sameUTCDate2(s.date, demand.date) && overlaps(s, slot)
    );
    const assignedUserIds = new Set(alreadyAssigned.map((s) => s.userId));
    let filled = alreadyAssigned.length;
    const reasons = [];
    while (filled < demand.requiredCount) {
      const candidates = users.filter((u) => !assignedUserIds.has(u.id)).filter((u) => u.categories.some((c) => c.categoryId === demand.categoryId)).map((u) => {
        const avail = availByUserDay.get(`${u.id}|${dayKey}`) ?? "AVAILABLE";
        return { user: u, avail };
      }).filter((c) => c.avail === "AVAILABLE" || c.avail === "WISH").filter(
        (c) => evaluateAssignment(slot, assignedByUser.get(c.user.id) ?? [], rules, weekWindow2).length === 0
      ).sort((a, b) => {
        if (a.avail !== b.avail) return a.avail === "WISH" ? -1 : 1;
        const diff = weekHoursOf(a.user.id) - weekHoursOf(b.user.id);
        if (diff !== 0) return diff;
        return displayName3(a.user).localeCompare(displayName3(b.user));
      });
      const pick = candidates[0];
      if (!pick) {
        reasons.push(
          "No remaining employee in this category is available and within the working-time rules for this slot."
        );
        break;
      }
      newShifts.push({
        weeklyPlanId: plan.id,
        userId: pick.user.id,
        categoryId: demand.categoryId,
        date: demand.date,
        startTime: demand.startTime,
        endTime: demand.endTime,
        status: "PENDING",
        rulePassed: true
      });
      assignedUserIds.add(pick.user.id);
      assignedByUser.get(pick.user.id).push({ ...slot });
      filled += 1;
    }
    if (filled < demand.requiredCount) {
      unfilled.push({
        demandId: demand.id,
        date: dayKey,
        categoryName: demand.category.name,
        startTime: demand.startTime,
        endTime: demand.endTime,
        requiredCount: demand.requiredCount,
        assignedCount: filled,
        missingCount: demand.requiredCount - filled,
        reasons
      });
    }
  }
  if (newShifts.length > 0) {
    await prisma.shift.createMany({ data: newShifts });
  }
  const detail = await buildScheduleDetail(plan.id);
  return {
    ...detail,
    generation: {
      createdCount: newShifts.length,
      keptAcceptedCount: keptShifts.length,
      unfilled
    }
  };
};
var generateSchedule = async (data) => {
  const plan = await getPlanOr404(data.weekPlanId);
  if (plan.status === "PUBLISHED") {
    throw new AppError(
      "This week's schedule is already published. Unpublish it before regenerating.",
      409
    );
  }
  return generateForPlan(plan);
};
var generateMonthSchedule = async (data) => {
  const { year, month } = data;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const demandWeeks = await prisma.demandWeek.findMany({
    where: { weekStartDate: { gte: monthStart, lt: monthEnd } },
    include: { demands: true },
    orderBy: { weekStartDate: "asc" }
  });
  const withDemand = demandWeeks.filter((w) => w.demands.some((d) => d.requiredCount > 0));
  if (withDemand.length === 0) {
    throw new AppError(
      `No week demand exists for ${year}-${String(month).padStart(2, "0")}. Create at least one week's demand on the Demand page first.`,
      409
    );
  }
  const weeks = [];
  for (const demandWeek of withDemand) {
    const plan = await syncPlanFromDemandWeek(demandWeek);
    if (plan.status === "PUBLISHED") {
      weeks.push({
        weekPlanId: plan.id,
        weekNumber: plan.weekNumber,
        weekStartDate: dateOnly4(plan.weekStartDate),
        weekEndDate: dateOnly4(plan.weekEndDate),
        status: plan.status,
        result: "skipped_published",
        createdCount: 0,
        unfilledCount: 0
      });
      continue;
    }
    const generated = await generateForPlan(plan);
    weeks.push({
      weekPlanId: plan.id,
      weekNumber: plan.weekNumber,
      weekStartDate: dateOnly4(plan.weekStartDate),
      weekEndDate: dateOnly4(plan.weekEndDate),
      status: generated.plan.status,
      result: "generated",
      createdCount: generated.generation.createdCount,
      unfilledCount: generated.generation.unfilled.length
    });
  }
  const covered = new Set(withDemand.map((w) => dateOnly4(startOfUTCDay3(w.weekStartDate))));
  const weeksWithoutDemand = [];
  const anchorDow = startOfUTCDay3(withDemand[0].weekStartDate).getUTCDay();
  let cursor = monthStart;
  while (cursor.getUTCDay() !== anchorDow) cursor = addDays3(cursor, 1);
  for (; cursor < monthEnd; cursor = addDays3(cursor, 7)) {
    if (!covered.has(dateOnly4(cursor))) {
      weeksWithoutDemand.push({
        weekStartDate: dateOnly4(cursor),
        weekEndDate: dateOnly4(addDays3(cursor, 6))
      });
    }
  }
  return {
    year,
    month,
    generatedCount: weeks.filter((w) => w.result === "generated").length,
    skippedPublishedCount: weeks.filter((w) => w.result === "skipped_published").length,
    weeks,
    weeksWithoutDemand
  };
};
var listMonths = async () => {
  const plans = await prisma.weeklyPlan.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }, { weekNumber: "asc" }],
    select: {
      ...planSelect2,
      _count: { select: { shifts: true, demands: true } }
    }
  });
  if (plans.length === 0) return { months: [] };
  const planIds = plans.map((p) => p.id);
  const [shiftRows, demandRows] = await Promise.all([
    prisma.shift.findMany({
      where: {
        weeklyPlanId: { in: planIds },
        status: { notIn: ["CANCELLED", "REJECTED", "SWAPPED_OUT"] }
      },
      select: {
        weeklyPlanId: true,
        startTime: true,
        endTime: true,
        user: { select: { hourlyRate: true } }
      }
    }),
    prisma.staffingDemand.findMany({
      where: { weeklyPlanId: { in: planIds } },
      select: { weeklyPlanId: true, requiredCount: true }
    })
  ]);
  const hoursByPlan = /* @__PURE__ */ new Map();
  const costByPlan = /* @__PURE__ */ new Map();
  for (const s of shiftRows) {
    const h = durationHours2(s);
    hoursByPlan.set(s.weeklyPlanId, (hoursByPlan.get(s.weeklyPlanId) ?? 0) + h);
    costByPlan.set(
      s.weeklyPlanId,
      (costByPlan.get(s.weeklyPlanId) ?? 0) + h * Number(s.user.hourlyRate ?? 0)
    );
  }
  const demandByPlan = /* @__PURE__ */ new Map();
  for (const d of demandRows) {
    demandByPlan.set(d.weeklyPlanId, (demandByPlan.get(d.weeklyPlanId) ?? 0) + d.requiredCount);
  }
  const byMonth = /* @__PURE__ */ new Map();
  for (const p of plans) {
    const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
    const list = byMonth.get(key) ?? [];
    list.push(p);
    byMonth.set(key, list);
  }
  const months = [...byMonth.entries()].map(([key, monthPlans]) => {
    const weeks = monthPlans.slice().sort((a, b) => a.weekNumber - b.weekNumber).map(({ _count, ...p }) => ({
      id: p.id,
      weekNumber: p.weekNumber,
      weekStartDate: dateOnly4(p.weekStartDate),
      weekEndDate: dateOnly4(p.weekEndDate),
      status: p.status,
      shiftCount: _count.shifts,
      demandCount: _count.demands,
      totalDemand: demandByPlan.get(p.id) ?? 0,
      estimatedCost: Number((costByPlan.get(p.id) ?? 0).toFixed(2))
    }));
    const publishedCount = weeks.filter((w) => w.status === "PUBLISHED").length;
    return {
      key,
      year: monthPlans[0].year,
      month: monthPlans[0].month,
      createdAt: monthPlans.reduce(
        (min, p) => p.createdAt < min ? p.createdAt : min,
        monthPlans[0].createdAt
      ),
      weekCount: weeks.length,
      publishedWeekCount: publishedCount,
      status: publishedCount === weeks.length ? "PUBLISHED" : publishedCount > 0 ? "PARTIAL" : "DRAFT",
      totalShifts: weeks.reduce((sum, w) => sum + w.shiftCount, 0),
      totalDemand: weeks.reduce((sum, w) => sum + w.totalDemand, 0),
      totalHours: Number(
        monthPlans.reduce((sum, p) => sum + (hoursByPlan.get(p.id) ?? 0), 0).toFixed(2)
      ),
      estimatedCost: Number(
        monthPlans.reduce((sum, p) => sum + (costByPlan.get(p.id) ?? 0), 0).toFixed(2)
      ),
      weeks
    };
  });
  return { months };
};
var publishSchedule = async (weekPlanId, adminId) => {
  const plan = await getPlanOr404(weekPlanId);
  if (plan.status === "PUBLISHED" && !plan.needsRenotify) {
    throw new AppError("This week's schedule is already published.", 409);
  }
  const shifts = await prisma.shift.findMany({
    where: { weeklyPlanId: plan.id, status: { notIn: ["CANCELLED", "REJECTED"] } },
    select: { id: true, userId: true }
  });
  if (shifts.length === 0) {
    throw new AppError("Cannot publish an empty schedule. Generate shifts first.", 409);
  }
  const violatingCount = await prisma.shift.count({
    where: {
      weeklyPlanId: plan.id,
      rulePassed: false,
      status: { notIn: ["CANCELLED", "REJECTED", "SWAPPED_OUT"] }
    }
  });
  if (violatingCount > 0) {
    throw new AppError(
      `Cannot publish: ${violatingCount} shift(s) break the working-time rules. Fix the violations first.`,
      409
    );
  }
  const now = /* @__PURE__ */ new Date();
  const assignedUserIds = [...new Set(shifts.map((s) => s.userId))];
  const weekLabel = `${dateOnly4(plan.weekStartDate)} \u2013 ${dateOnly4(plan.weekEndDate)}`;
  await prisma.$transaction([
    prisma.weeklyPlan.update({
      where: { id: plan.id },
      data: {
        status: "PUBLISHED",
        submittedAt: now,
        submittedById: adminId,
        needsRenotify: false
      }
    }),
    prisma.shift.updateMany({
      where: { weeklyPlanId: plan.id },
      data: { notifiedAt: now }
    }),
    prisma.notification.createMany({
      data: assignedUserIds.map((userId) => ({
        userId,
        type: "WEEKLY_SHIFTS_PUBLISHED",
        channel: "IN_APP",
        status: "SENT",
        title: "New weekly schedule published",
        body: `Your shifts for the week ${weekLabel} have been published. Please review and respond.`,
        sentAt: now,
        payload: { weekPlanId: plan.id }
      }))
    })
  ]);
  return buildScheduleDetail(plan.id);
};
var unpublishSchedule = async (weekPlanId) => {
  const plan = await getPlanOr404(weekPlanId);
  if (plan.status !== "PUBLISHED") {
    throw new AppError("Only a published schedule can be unpublished.", 409);
  }
  await prisma.weeklyPlan.update({
    where: { id: plan.id },
    data: { status: "DRAFT" }
  });
  return buildScheduleDetail(plan.id);
};
var addShift = async (weekPlanId, data) => {
  const plan = await getPlanOr404(weekPlanId);
  const [user, category, membership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, isActive: true }
    }),
    prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true, isActive: true }
    }),
    prisma.userCategory.findUnique({
      where: { userId_categoryId: { userId: data.userId, categoryId: data.categoryId } },
      select: { userId: true }
    })
  ]);
  if (!user) throw new AppError("Employee not found.", 404);
  if (!user.isActive) throw new AppError("Employee is deactivated.", 409);
  if (!category) throw new AppError("Category not found.", 404);
  if (!category.isActive) throw new AppError("Category is inactive.", 409);
  if (!membership) {
    throw new AppError("This employee is not assigned to that category.", 409);
  }
  const date = startOfUTCDay3(new Date(data.date));
  if (date < startOfUTCDay3(plan.weekStartDate) || date > startOfUTCDay3(plan.weekEndDate)) {
    throw new AppError("Shift date falls outside this plan's week.", 400);
  }
  const slot = { startTime: new Date(data.startTime), endTime: new Date(data.endTime) };
  const rules = await loadRuleSettings();
  const weekWindow2 = {
    start: startOfUTCDay3(plan.weekStartDate),
    endExclusive: addDays3(startOfUTCDay3(plan.weekEndDate), 1)
  };
  const existing = (await loadNearbyShifts([data.userId], plan)).get(data.userId) ?? [];
  const violations = evaluateAssignment(slot, existing, rules, weekWindow2);
  if (violations.some((v) => v.startsWith("OVERLAP"))) {
    throw new AppError("This employee already has an overlapping shift.", 409);
  }
  const shift = await prisma.shift.create({
    data: {
      weeklyPlanId: plan.id,
      userId: data.userId,
      categoryId: data.categoryId,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: "PENDING",
      rulePassed: violations.length === 0,
      ...violations.length > 0 ? { ruleViolations: violations } : {}
    },
    select: shiftSelect2
  });
  let nextWeekDemandReduced = false;
  let availabilityDayRemoved = false;
  if (data.reduceNextWeekDemand) {
    const nextWeekDate = addDays3(date, 7);
    const nextDayDemand = await prisma.dayDemand.findFirst({
      where: { categoryId: data.categoryId, date: nextWeekDate, requiredCount: { gt: 0 } },
      select: { id: true, requiredCount: true, demandWeekId: true }
    });
    if (nextDayDemand) {
      await prisma.dayDemand.update({
        where: { id: nextDayDemand.id },
        data: { requiredCount: nextDayDemand.requiredCount - 1 }
      });
      await prisma.staffingDemand.updateMany({
        where: {
          categoryId: data.categoryId,
          date: nextWeekDate,
          requiredCount: { gt: 0 },
          weeklyPlan: { status: { not: "PUBLISHED" } }
        },
        data: { requiredCount: { decrement: 1 } }
      });
      nextWeekDemandReduced = true;
    }
    const removed = await prisma.availabilityDay.deleteMany({
      where: { availabilityMonth: { userId: data.userId }, date }
    });
    availabilityDayRemoved = removed.count > 0;
  }
  if (plan.status === "PUBLISHED") {
    await prisma.$transaction([
      prisma.weeklyPlan.update({
        where: { id: plan.id },
        data: { needsRenotify: true }
      }),
      prisma.notification.create({
        data: {
          userId: data.userId,
          type: "SHIFT_CHANGED",
          channel: "IN_APP",
          status: "SENT",
          title: "Schedule updated",
          body: `A new shift on ${dateOnly4(date)} was added to your published schedule. Please review it.`,
          sentAt: /* @__PURE__ */ new Date(),
          payload: { weekPlanId: plan.id, shiftId: shift.id }
        }
      })
    ]);
  }
  return {
    shift,
    ruleViolations: violations,
    rulePassed: violations.length === 0,
    nextWeekDemandReduced,
    availabilityDayRemoved
  };
};
var getShiftInPlanOr404 = async (weekPlanId, shiftId) => {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: { id: true, weeklyPlanId: true, userId: true, date: true }
  });
  if (!shift || shift.weeklyPlanId !== weekPlanId) {
    throw new AppError("Shift not found in this weekly plan.", 404);
  }
  return shift;
};
var updateShift3 = async (weekPlanId, shiftId, data) => {
  const plan = await getPlanOr404(weekPlanId);
  const shift = await getShiftInPlanOr404(plan.id, shiftId);
  const slot = { startTime: new Date(data.startTime), endTime: new Date(data.endTime) };
  const rules = await loadRuleSettings();
  const weekWindow2 = {
    start: startOfUTCDay3(plan.weekStartDate),
    endExclusive: addDays3(startOfUTCDay3(plan.weekEndDate), 1)
  };
  const existing = (await loadNearbyShifts([shift.userId], plan, shiftId)).get(shift.userId) ?? [];
  const violations = evaluateAssignment(slot, existing, rules, weekWindow2);
  if (violations.some((v) => v.startsWith("OVERLAP"))) {
    throw new AppError("The new time overlaps another shift for this employee.", 409);
  }
  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      startTime: slot.startTime,
      endTime: slot.endTime,
      date: startOfUTCDay3(slot.startTime),
      rulePassed: violations.length === 0,
      ruleViolations: violations.length > 0 ? violations : prismaNamespace_exports.JsonNull
    },
    select: shiftSelect2
  });
  if (plan.status === "PUBLISHED") {
    await prisma.$transaction([
      prisma.weeklyPlan.update({
        where: { id: plan.id },
        data: { needsRenotify: true }
      }),
      prisma.notification.create({
        data: {
          userId: shift.userId,
          type: "SHIFT_CHANGED",
          channel: "IN_APP",
          status: "SENT",
          title: "Schedule updated",
          body: `Your shift on ${dateOnly4(shift.date)} was rescheduled. Please review the new time.`,
          sentAt: /* @__PURE__ */ new Date(),
          payload: { weekPlanId: plan.id, shiftId }
        }
      })
    ]);
  }
  return { shift: updated, ruleViolations: violations, rulePassed: violations.length === 0 };
};
var removeShift = async (weekPlanId, shiftId) => {
  const plan = await getPlanOr404(weekPlanId);
  const shift = await getShiftInPlanOr404(plan.id, shiftId);
  await prisma.shift.delete({ where: { id: shiftId } });
  if (plan.status === "PUBLISHED") {
    await prisma.$transaction([
      prisma.weeklyPlan.update({
        where: { id: plan.id },
        data: { needsRenotify: true }
      }),
      prisma.notification.create({
        data: {
          userId: shift.userId,
          type: "SHIFT_CHANGED",
          channel: "IN_APP",
          status: "SENT",
          title: "Schedule updated",
          body: `Your shift on ${dateOnly4(shift.date)} was removed from the schedule.`,
          sentAt: /* @__PURE__ */ new Date(),
          payload: { weekPlanId: plan.id }
        }
      })
    ]);
  }
};
var getAvailabilityForPlan = async (weekPlanId) => {
  const plan = await getPlanOr404(weekPlanId);
  const weekStart = startOfUTCDay3(plan.weekStartDate);
  const weekEndExclusive = addDays3(startOfUTCDay3(plan.weekEndDate), 1);
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      categories: { select: { category: { select: { name: true } } } },
      availabilityMonths: {
        where: {
          year: plan.year,
          month: plan.month
        },
        select: {
          id: true,
          year: true,
          month: true,
          days: {
            where: {
              date: { gte: weekStart, lt: weekEndExclusive },
              status: { in: ["AVAILABLE", "WISH"] }
            }
          }
        }
      }
    }
  });
  const pad = (n) => String(n).padStart(2, "0");
  const hhmm = (d) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return users.filter((u) => u.availabilityMonths.length > 0 && (u.availabilityMonths[0]?.days.length ?? 0) > 0).map((u) => {
    const defaultCategory = u.categories[0]?.category?.name || "Unassigned";
    const monthRecord = u.availabilityMonths[0];
    const monthStr = `${monthRecord.year}-${pad(monthRecord.month)}`;
    return {
      user: {
        name: displayName3(u),
        email: u.email
      },
      slots: {
        date: monthStr,
        avalibltyslots: monthRecord.days.map((d) => ({
          date: dateOnly4(d.date),
          "time-slot": d.preferredStartTime && d.preferredEndTime ? `${hhmm(d.preferredStartTime)} to ${hhmm(d.preferredEndTime)}` : "Any time",
          category: defaultCategory
        }))
      }
    };
  });
};
var schedulingServices = {
  listPlans,
  listMonths,
  getSchedule: buildScheduleDetail,
  generateSchedule,
  generateMonthSchedule,
  publishSchedule,
  unpublishSchedule,
  addShift,
  updateShift: updateShift3,
  removeShift,
  getAvailabilityForPlan
};

// src/modules/admin/scheduling/scheduling.controller.ts
var listPlans2 = async (req, res) => {
  const query = req.validated;
  const result = await schedulingServices.listPlans(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Weekly plans fetched successfully.",
    data: { plans: result.plans },
    meta: { pagination: result.pagination }
  });
};
var listMonths2 = async (_req, res) => {
  const result = await schedulingServices.listMonths();
  sendSuccess(res, {
    statusCode: 200,
    message: "Monthly schedules fetched successfully.",
    data: result
  });
};
var generateMonthSchedule2 = async (req, res) => {
  const data = req.validated;
  const result = await schedulingServices.generateMonthSchedule(data);
  sendSuccess(res, {
    statusCode: 201,
    message: `Schedule generated for ${result.generatedCount} week(s).`,
    data: result
  });
};
var getSchedule = async (req, res) => {
  const weekPlanId = req.params.weekPlanId;
  const result = await schedulingServices.getSchedule(weekPlanId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Schedule fetched successfully.",
    data: result
  });
};
var generateSchedule2 = async (req, res) => {
  const data = req.validated;
  const result = await schedulingServices.generateSchedule(data);
  sendSuccess(res, {
    statusCode: 201,
    message: "Schedule generated successfully.",
    data: result
  });
};
var publishSchedule2 = async (req, res) => {
  const weekPlanId = req.params.weekPlanId;
  const adminId = res.locals.auth.userId;
  const result = await schedulingServices.publishSchedule(weekPlanId, adminId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Schedule published successfully. Assigned employees have been notified.",
    data: result
  });
};
var unpublishSchedule2 = async (req, res) => {
  const weekPlanId = req.params.weekPlanId;
  const result = await schedulingServices.unpublishSchedule(weekPlanId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Schedule unpublished. It is now a draft again.",
    data: result
  });
};
var addShift2 = async (req, res) => {
  const weekPlanId = req.params.weekPlanId;
  const data = req.validated;
  const result = await schedulingServices.addShift(weekPlanId, data);
  sendSuccess(res, {
    statusCode: 201,
    message: result.rulePassed ? "Shift added successfully." : "Shift added with rule violations \u2014 review the violations panel.",
    data: result
  });
};
var updateShift4 = async (req, res) => {
  const weekPlanId = req.params.weekPlanId;
  const shiftId = req.params.shiftId;
  const data = req.validated;
  const result = await schedulingServices.updateShift(weekPlanId, shiftId, data);
  sendSuccess(res, {
    statusCode: 200,
    message: result.rulePassed ? "Shift updated successfully." : "Shift updated with rule violations \u2014 review the violations panel.",
    data: result
  });
};
var removeShift2 = async (req, res) => {
  const weekPlanId = req.params.weekPlanId;
  const shiftId = req.params.shiftId;
  await schedulingServices.removeShift(weekPlanId, shiftId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Shift removed successfully."
  });
};
var getAvailability = async (req, res) => {
  const weekPlanId = req.params.weekPlanId;
  const result = await schedulingServices.getAvailabilityForPlan(weekPlanId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Availability fetched successfully.",
    data: result
  });
};

// src/modules/admin/scheduling/scheduling.route.ts
var schedulingRouter = Router12();
schedulingRouter.use(authenticate, authorizeAdmin);
schedulingRouter.get(
  "/",
  validateRequest(listPlansQuerySchema),
  asyncHandler(listPlans2)
);
schedulingRouter.get("/months", asyncHandler(listMonths2));
schedulingRouter.post(
  "/generate",
  validateRequest(generateScheduleSchema),
  asyncHandler(generateSchedule2)
);
schedulingRouter.post(
  "/generate-month",
  validateRequest(generateMonthSchema),
  asyncHandler(generateMonthSchedule2)
);
schedulingRouter.get("/:weekPlanId", asyncHandler(getSchedule));
schedulingRouter.get("/:weekPlanId/availability", asyncHandler(getAvailability));
schedulingRouter.post(
  "/:weekPlanId/publish",
  asyncHandler(publishSchedule2)
);
schedulingRouter.post(
  "/:weekPlanId/unpublish",
  asyncHandler(unpublishSchedule2)
);
schedulingRouter.post(
  "/:weekPlanId/shifts",
  validateRequest(createShiftSchema2),
  asyncHandler(addShift2)
);
schedulingRouter.patch(
  "/:weekPlanId/shifts/:shiftId",
  validateRequest(updateShiftSchema2),
  asyncHandler(updateShift4)
);
schedulingRouter.delete(
  "/:weekPlanId/shifts/:shiftId",
  asyncHandler(removeShift2)
);
var scheduling_route_default = schedulingRouter;

// src/modules/admin/attendance/attendance.route.ts
import { Router as Router13 } from "express";

// src/modules/admin/attendance/attendance.validation.ts
import { z as z13 } from "zod";
var dateString4 = (label) => z13.string().trim().min(1, `${label} is required`).refine((s) => !Number.isNaN(Date.parse(s)), {
  message: `${label} must be a valid date`
});
var listAttendanceQuerySchema = z13.object({
  page: z13.coerce.number().int().min(1).default(1),
  limit: z13.coerce.number().int().min(1).max(100).default(20),
  userId: z13.string().min(1).optional(),
  date: dateString4("Date").optional(),
  status: z13.enum(["ACTIVE", "ON_BREAK", "COMPLETED"]).optional()
});
var reportQuerySchema2 = z13.object({
  from: dateString4("From date").optional(),
  to: dateString4("To date").optional(),
  month: z13.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be in YYYY-MM format").optional(),
  userId: z13.string().min(1).optional()
}).refine((q) => !(q.from && !q.to) && !(q.to && !q.from), {
  message: "Provide both from and to, or neither",
  path: ["to"]
});

// src/modules/admin/attendance/attendance.service.ts
var startOfUTCDay4 = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
var addDays4 = (d, n) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
var userSelect2 = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  hourlyRate: true
};
var entrySelect = {
  id: true,
  userId: true,
  user: { select: userSelect2 },
  shiftId: true,
  shift: {
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      category: { select: { id: true, name: true } }
    }
  },
  clockInAt: true,
  clockOutAt: true,
  breakMinutes: true,
  status: true,
  workedMinutes: true,
  lateMinutes: true,
  overtimeMinutes: true,
  location: true,
  note: true
};
var listAttendance = async (query) => {
  const { page, limit, userId, date, status } = query;
  const skip = (page - 1) * limit;
  const where = {};
  if (userId) where.userId = userId;
  if (status) where.status = status;
  if (date) {
    const day = startOfUTCDay4(new Date(date));
    where.clockInAt = { gte: day, lt: addDays4(day, 1) };
  }
  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({
      where,
      skip,
      take: limit,
      orderBy: { clockInAt: "desc" },
      select: entrySelect
    }),
    prisma.timeEntry.count({ where })
  ]);
  return {
    entries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getAttendanceReport = async (query) => {
  let start;
  let endExclusive;
  if (query.from && query.to) {
    start = startOfUTCDay4(new Date(query.from));
    endExclusive = addDays4(startOfUTCDay4(new Date(query.to)), 1);
  } else {
    const anchor = query.month ? /* @__PURE__ */ new Date(`${query.month}-01T00:00:00.000Z`) : /* @__PURE__ */ new Date();
    start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    endExclusive = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  }
  const entryWhere = {
    status: "COMPLETED",
    clockInAt: { gte: start, lt: endExclusive }
  };
  if (query.userId) entryWhere.userId = query.userId;
  const now = /* @__PURE__ */ new Date();
  const [entries, endedShifts] = await Promise.all([
    prisma.timeEntry.findMany({
      where: entryWhere,
      select: {
        userId: true,
        user: { select: userSelect2 },
        workedMinutes: true,
        breakMinutes: true,
        lateMinutes: true,
        overtimeMinutes: true
      }
    }),
    // Absence detection: published roster shifts that have ended with no time
    // entry recorded against them (computed on read, never persisted).
    prisma.shift.findMany({
      where: {
        date: { gte: start, lt: endExclusive },
        endTime: { lt: now },
        status: { in: ["ACCEPTED", "PENDING"] },
        weeklyPlan: { status: "PUBLISHED" },
        timeEntries: { none: {} },
        ...query.userId ? { userId: query.userId } : {}
      },
      select: {
        id: true,
        userId: true,
        user: { select: userSelect2 },
        date: true,
        startTime: true,
        endTime: true,
        category: { select: { id: true, name: true } }
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }]
    })
  ]);
  const byUser = /* @__PURE__ */ new Map();
  const rowFor = (userId, user) => {
    let row = byUser.get(userId);
    if (!row) {
      row = {
        user,
        workedMinutes: 0,
        breakMinutes: 0,
        lateCount: 0,
        overtimeMinutes: 0,
        entryCount: 0,
        absenceCount: 0
      };
      byUser.set(userId, row);
    }
    return row;
  };
  for (const e of entries) {
    const row = rowFor(e.userId, e.user);
    row.workedMinutes += e.workedMinutes ?? 0;
    row.breakMinutes += e.breakMinutes;
    row.lateCount += (e.lateMinutes ?? 0) > 0 ? 1 : 0;
    row.overtimeMinutes += e.overtimeMinutes ?? 0;
    row.entryCount += 1;
  }
  for (const s of endedShifts) {
    rowFor(s.userId, s.user).absenceCount += 1;
  }
  const employees = [...byUser.entries()].map(([userId, row]) => {
    const workedHours = row.workedMinutes / 60;
    const hourlyRate = row.user.hourlyRate ? Number(row.user.hourlyRate) : null;
    return {
      userId,
      user: row.user,
      workedHours: Number(workedHours.toFixed(2)),
      breakMinutes: row.breakMinutes,
      lateCount: row.lateCount,
      overtimeMinutes: row.overtimeMinutes,
      entryCount: row.entryCount,
      absenceCount: row.absenceCount,
      estimatedWage: hourlyRate !== null ? Number((workedHours * hourlyRate).toFixed(2)) : null
    };
  });
  return {
    range: {
      start: start.toISOString().slice(0, 10),
      end: addDays4(endExclusive, -1).toISOString().slice(0, 10)
    },
    employees,
    absences: endedShifts.map((s) => ({
      shiftId: s.id,
      userId: s.userId,
      userName: s.user.name ?? ([s.user.firstName, s.user.lastName].filter(Boolean).join(" ") || s.user.email),
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      category: s.category
    })),
    totals: {
      workedHours: Number(employees.reduce((sum, e) => sum + e.workedHours, 0).toFixed(2)),
      estimatedWage: Number(
        employees.reduce((sum, e) => sum + (e.estimatedWage ?? 0), 0).toFixed(2)
      ),
      absenceCount: endedShifts.length
    }
  };
};
var adminAttendanceServices = {
  listAttendance,
  getAttendanceReport
};

// src/modules/admin/attendance/attendance.controller.ts
var listAttendance2 = async (req, res) => {
  const query = req.validated;
  const result = await adminAttendanceServices.listAttendance(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Attendance entries fetched successfully.",
    data: { entries: result.entries },
    meta: { pagination: result.pagination }
  });
};
var getAttendanceReport2 = async (req, res) => {
  const query = req.validated;
  const result = await adminAttendanceServices.getAttendanceReport(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Attendance report generated successfully.",
    data: result
  });
};

// src/modules/admin/attendance/attendance.route.ts
var adminAttendanceRouter = Router13();
adminAttendanceRouter.use(authenticate, authorizeAdmin);
adminAttendanceRouter.get(
  "/",
  validateRequest(listAttendanceQuerySchema),
  asyncHandler(listAttendance2)
);
adminAttendanceRouter.get(
  "/report",
  validateRequest(reportQuerySchema2),
  asyncHandler(getAttendanceReport2)
);
var attendance_route_default = adminAttendanceRouter;

// src/modules/admin/leaves/leaves.route.ts
import { Router as Router14 } from "express";

// src/modules/admin/leaves/leaves.validation.ts
import { z as z14 } from "zod";
var listLeavesQuerySchema = z14.object({
  page: z14.coerce.number().int().min(1).default(1),
  limit: z14.coerce.number().int().min(1).max(100).default(20),
  status: z14.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  userId: z14.string().min(1).optional()
});
var reviewLeaveSchema = z14.object({
  adminNote: z14.string().trim().max(2e3).optional()
});

// src/modules/admin/leaves/leaves.service.ts
var addDays5 = (d, n) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
var adminLeaveSelect = {
  id: true,
  userId: true,
  user: {
    select: { id: true, name: true, firstName: true, lastName: true, email: true }
  },
  leaveType: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  adminNote: true,
  reviewedById: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true
};
var listLeaves = async (query) => {
  const { page, limit, status, userId } = query;
  const skip = (page - 1) * limit;
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;
  const [leaves, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: adminLeaveSelect
    }),
    prisma.leaveRequest.count({ where })
  ]);
  const withImpact = await Promise.all(
    leaves.map(async (leave) => {
      if (leave.status !== "PENDING") return { ...leave, affectedShiftCount: 0 };
      const affectedShiftCount = await prisma.shift.count({
        where: {
          userId: leave.userId,
          date: { gte: leave.startDate, lt: addDays5(leave.endDate, 1) },
          status: { notIn: ["CANCELLED", "REJECTED"] }
        }
      });
      return { ...leave, affectedShiftCount };
    })
  );
  return {
    leaves: withImpact,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getPendingLeaveOr404 = async (leaveId) => {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    select: {
      id: true,
      userId: true,
      status: true,
      startDate: true,
      endDate: true,
      leaveType: true
    }
  });
  if (!leave) throw new AppError("Leave request not found.", 404);
  if (leave.status !== "PENDING") {
    throw new AppError("Only a pending leave request can be reviewed.", 409);
  }
  return leave;
};
var approveLeave = async (leaveId, adminId, data) => {
  const leave = await getPendingLeaveOr404(leaveId);
  const now = /* @__PURE__ */ new Date();
  const [updated, cancelled] = await prisma.$transaction([
    prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: "APPROVED",
        reviewedById: adminId,
        reviewedAt: now,
        ...data.adminNote !== void 0 ? { adminNote: data.adminNote } : {}
      },
      select: adminLeaveSelect
    }),
    prisma.shift.updateMany({
      where: {
        userId: leave.userId,
        date: { gte: leave.startDate, lt: addDays5(leave.endDate, 1) },
        status: { notIn: ["CANCELLED", "REJECTED"] }
      },
      data: {
        status: "CANCELLED",
        rejectionReason: "Employee on approved leave",
        leaveRequestId: leaveId
      }
    }),
    prisma.notification.create({
      data: {
        userId: leave.userId,
        type: "LEAVE_REQUEST_RESULT",
        channel: "IN_APP",
        status: "SENT",
        title: "Leave approved",
        body: `Your ${leave.leaveType.toLowerCase()} leave from ${leave.startDate.toISOString().slice(0, 10)} to ${leave.endDate.toISOString().slice(0, 10)} has been approved.`,
        sentAt: now,
        payload: { leaveId }
      }
    })
  ]);
  return { leave: updated, cancelledShiftCount: cancelled.count };
};
var rejectLeave = async (leaveId, adminId, data) => {
  const leave = await getPendingLeaveOr404(leaveId);
  const now = /* @__PURE__ */ new Date();
  const [updated] = await prisma.$transaction([
    prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: "REJECTED",
        reviewedById: adminId,
        reviewedAt: now,
        ...data.adminNote !== void 0 ? { adminNote: data.adminNote } : {}
      },
      select: adminLeaveSelect
    }),
    prisma.notification.create({
      data: {
        userId: leave.userId,
        type: "LEAVE_REQUEST_RESULT",
        channel: "IN_APP",
        status: "SENT",
        title: "Leave rejected",
        body: `Your ${leave.leaveType.toLowerCase()} leave request was not approved.${data.adminNote ? ` Note: ${data.adminNote}` : ""}`,
        sentAt: now,
        payload: { leaveId }
      }
    })
  ]);
  return { leave: updated };
};
var adminLeavesServices = {
  listLeaves,
  approveLeave,
  rejectLeave
};

// src/modules/admin/leaves/leaves.controller.ts
var authAdminId = (res) => res.locals.auth.userId;
var listLeaves2 = async (req, res) => {
  const query = req.validated;
  const result = await adminLeavesServices.listLeaves(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Leave requests fetched successfully.",
    data: { leaves: result.leaves },
    meta: { pagination: result.pagination }
  });
};
var approveLeave2 = async (req, res) => {
  const leaveId = req.params.leaveId;
  const data = req.validated;
  const result = await adminLeavesServices.approveLeave(leaveId, authAdminId(res), data);
  sendSuccess(res, {
    statusCode: 200,
    message: result.cancelledShiftCount > 0 ? `Leave approved. ${result.cancelledShiftCount} scheduled shift(s) were cancelled.` : "Leave approved.",
    data: result
  });
};
var rejectLeave2 = async (req, res) => {
  const leaveId = req.params.leaveId;
  const data = req.validated;
  const result = await adminLeavesServices.rejectLeave(leaveId, authAdminId(res), data);
  sendSuccess(res, {
    statusCode: 200,
    message: "Leave rejected.",
    data: result
  });
};

// src/modules/admin/leaves/leaves.route.ts
var adminLeavesRouter = Router14();
adminLeavesRouter.use(authenticate, authorizeAdmin);
adminLeavesRouter.get(
  "/",
  validateRequest(listLeavesQuerySchema),
  asyncHandler(listLeaves2)
);
adminLeavesRouter.post(
  "/:leaveId/approve",
  validateRequest(reviewLeaveSchema),
  asyncHandler(approveLeave2)
);
adminLeavesRouter.post(
  "/:leaveId/reject",
  validateRequest(reviewLeaveSchema),
  asyncHandler(rejectLeave2)
);
var leaves_route_default = adminLeavesRouter;

// src/modules/admin/schedule-swaps/schedule-swaps.route.ts
import { Router as Router15 } from "express";

// src/modules/admin/schedule-swaps/schedule-swaps.validation.ts
import { z as z15 } from "zod";
var listScheduleSwapsQuerySchema = z15.object({
  page: z15.coerce.number().int().min(1).default(1),
  limit: z15.coerce.number().int().min(1).max(100).default(20),
  status: z15.enum([
    "PENDING_RECIPIENT",
    "PENDING_ADMIN_APPROVAL",
    "APPROVED",
    "REJECTED",
    "EXPIRED",
    "CANCELLED"
  ]).optional()
});
var reviewScheduleSwapSchema = z15.object({
  reason: z15.string().trim().max(2e3).optional()
});

// src/modules/user/schedule-swaps/schedule-swaps.service.ts
var HOURS_PER_MS4 = 1 / (1e3 * 60 * 60);
var startOfUTCDay5 = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
var addDays6 = (d, n) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
var durationHours3 = (s) => (s.endTime.getTime() - s.startTime.getTime()) * HOURS_PER_MS4;
var displayName4 = (u) => u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);
var swapShiftSelect = {
  id: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  category: { select: { id: true, name: true } }
};
var swapUserSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true
};
var scheduleSwapSelect = {
  id: true,
  swapType: true,
  initiatorUserId: true,
  initiatorUser: { select: swapUserSelect },
  initiatorShiftId: true,
  initiatorShift: { select: swapShiftSelect },
  recipientUserId: true,
  recipientUser: { select: swapUserSelect },
  recipientShiftId: true,
  recipientShift: { select: swapShiftSelect },
  status: true,
  recipientRespondedAt: true,
  ruleCheckResult: true,
  ruleCheckPassed: true,
  adminReason: true,
  resolvedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true
};
var OPEN_SWAP_STATUSES = ["PENDING_RECIPIENT", "PENDING_ADMIN_APPROVAL"];
var projectedHours2 = async (userId, window, excludeShiftId, incomingShift) => {
  const rows = await prisma.shift.findMany({
    where: {
      userId,
      id: { not: excludeShiftId },
      startTime: { gte: window.start, lt: window.endExclusive },
      status: { notIn: ["CANCELLED", "REJECTED", "SWAPPED_OUT"] }
    },
    select: { startTime: true, endTime: true }
  });
  let hours = rows.reduce((sum, r) => sum + durationHours3(r), 0);
  if (incomingShift.startTime >= window.start && incomingShift.startTime < window.endExclusive) {
    hours += durationHours3(incomingShift);
  }
  return hours;
};
var weekWindow = (d) => {
  const day = startOfUTCDay5(d);
  const diffToMonday = (day.getUTCDay() + 6) % 7;
  const start = addDays6(day, -diffToMonday);
  return { start, endExclusive: addDays6(start, 7) };
};
var dayWindow = (d) => {
  const start = startOfUTCDay5(d);
  return { start, endExclusive: addDays6(start, 1) };
};
var evaluateSwapRules2 = async (parties) => {
  const settings = await prisma.orgSettings.findUnique({
    where: { id: 1 },
    select: { maxDailyHours: true, maxWeeklyHours: true }
  });
  const maxWeekly = settings ? Number(settings.maxWeeklyHours) : Infinity;
  const maxDaily = settings ? Number(settings.maxDailyHours) : Infinity;
  const violations = [];
  for (const p of parties) {
    const week = await projectedHours2(
      p.userId,
      weekWindow(p.takingShift.startTime),
      p.givingShiftId,
      p.takingShift
    );
    if (week > maxWeekly) {
      violations.push(`Would exceed ${maxWeekly}h weekly max for ${p.name}`);
    }
    const day = await projectedHours2(
      p.userId,
      dayWindow(p.takingShift.startTime),
      p.givingShiftId,
      p.takingShift
    );
    if (day > maxDaily) {
      violations.push(`Would exceed ${maxDaily}h daily max for ${p.name}`);
    }
  }
  return { passed: violations.length === 0, violations };
};
var searchSwapTargets = async (userId, query) => {
  const day = startOfUTCDay5(new Date(query.date));
  const shifts = await prisma.shift.findMany({
    where: {
      date: day,
      userId: { not: userId },
      status: { in: ["PENDING", "ACCEPTED"] },
      endTime: { gt: /* @__PURE__ */ new Date() },
      weeklyPlan: { status: "PUBLISHED" },
      ...query.categoryId ? { categoryId: query.categoryId } : {},
      // Exclude shifts already tied up in an open swap.
      swapsAsInitiatorShift: { none: { status: { in: [...OPEN_SWAP_STATUSES] } } },
      swapsAsRecipientShift: { none: { status: { in: [...OPEN_SWAP_STATUSES] } } }
    },
    orderBy: [{ startTime: "asc" }],
    select: {
      ...swapShiftSelect,
      userId: true,
      user: { select: swapUserSelect }
    }
  });
  return { date: day.toISOString().slice(0, 10), shifts };
};
var createSwap2 = async (userId, data) => {
  if (data.recipientUserId === userId) {
    throw new AppError("You cannot request a swap with yourself.", 400);
  }
  const [initiatorShift, recipientShift] = await Promise.all([
    prisma.shift.findUnique({
      where: { id: data.initiatorShiftId },
      select: {
        id: true,
        userId: true,
        status: true,
        startTime: true,
        endTime: true,
        weeklyPlan: { select: { status: true } },
        user: { select: swapUserSelect }
      }
    }),
    prisma.shift.findUnique({
      where: { id: data.recipientShiftId },
      select: {
        id: true,
        userId: true,
        status: true,
        startTime: true,
        endTime: true,
        weeklyPlan: { select: { status: true } },
        user: { select: swapUserSelect }
      }
    })
  ]);
  if (!initiatorShift || initiatorShift.userId !== userId) {
    throw new AppError("Your shift was not found.", 404);
  }
  if (!recipientShift || recipientShift.userId !== data.recipientUserId) {
    throw new AppError("The other employee's shift was not found.", 404);
  }
  for (const [label, shift] of [
    ["your shift", initiatorShift],
    ["the other shift", recipientShift]
  ]) {
    if (shift.weeklyPlan.status !== "PUBLISHED") {
      throw new AppError(`The schedule for ${label} is not published.`, 409);
    }
    if (shift.status !== "PENDING" && shift.status !== "ACCEPTED") {
      throw new AppError(`Cannot swap: ${label} is ${shift.status.toLowerCase()}.`, 409);
    }
    if (shift.endTime <= /* @__PURE__ */ new Date()) {
      throw new AppError(`Cannot swap: ${label} has already ended.`, 409);
    }
  }
  const openSwap = await prisma.swapRequest.findFirst({
    where: {
      status: { in: [...OPEN_SWAP_STATUSES] },
      OR: [
        { initiatorShiftId: { in: [initiatorShift.id, recipientShift.id] } },
        { recipientShiftId: { in: [initiatorShift.id, recipientShift.id] } }
      ]
    },
    select: { id: true }
  });
  if (openSwap) {
    throw new AppError("One of these shifts is already part of a pending swap request.", 409);
  }
  const ruleCheck = await evaluateSwapRules2([
    {
      userId,
      name: displayName4(initiatorShift.user),
      givingShiftId: initiatorShift.id,
      takingShift: recipientShift
    },
    {
      userId: data.recipientUserId,
      name: displayName4(recipientShift.user),
      givingShiftId: recipientShift.id,
      takingShift: initiatorShift
    }
  ]);
  const settings = await prisma.orgSettings.findUnique({
    where: { id: 1 },
    select: { swapExpiryHours: true }
  });
  const expiryHours = settings?.swapExpiryHours ?? 72;
  const now = /* @__PURE__ */ new Date();
  const [swap] = await prisma.$transaction([
    prisma.swapRequest.create({
      data: {
        swapType: "TARGETED",
        initiatorUserId: userId,
        initiatorShiftId: initiatorShift.id,
        recipientUserId: data.recipientUserId,
        recipientShiftId: recipientShift.id,
        status: "PENDING_RECIPIENT",
        ruleCheckResult: ruleCheck,
        ruleCheckPassed: ruleCheck.passed,
        ruleCheckedAt: now,
        expiresAt: new Date(now.getTime() + expiryHours * 60 * 60 * 1e3)
      },
      select: scheduleSwapSelect
    }),
    prisma.notification.create({
      data: {
        userId: data.recipientUserId,
        type: "SWAP_REQUEST_RECEIVED",
        channel: "IN_APP",
        status: "SENT",
        title: "Shift swap request",
        body: `${displayName4(initiatorShift.user)} wants to swap shifts with you. Open the Swaps tab to respond.`,
        sentAt: now,
        payload: { kind: "scheduleSwap" }
      }
    })
  ]);
  return swap;
};
var listMySwaps2 = async (userId, query) => {
  const { role, status, page, limit } = query;
  const skip = (page - 1) * limit;
  const where = role === "initiated" ? { initiatorUserId: userId } : role === "received" ? { recipientUserId: userId } : { OR: [{ initiatorUserId: userId }, { recipientUserId: userId }] };
  if (status) where.status = status;
  const [swaps, total] = await Promise.all([
    prisma.swapRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: scheduleSwapSelect
    }),
    prisma.swapRequest.count({ where })
  ]);
  return {
    swaps,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var respondToSwap = async (userId, swapId, data) => {
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapId },
    select: {
      id: true,
      status: true,
      initiatorUserId: true,
      recipientUserId: true,
      expiresAt: true,
      recipientUser: { select: swapUserSelect }
    }
  });
  if (!swap || swap.recipientUserId !== userId) {
    throw new AppError("Swap request not found.", 404);
  }
  if (swap.status !== "PENDING_RECIPIENT") {
    throw new AppError("This swap request is no longer awaiting your response.", 409);
  }
  if (swap.expiresAt && swap.expiresAt <= /* @__PURE__ */ new Date()) {
    await prisma.swapRequest.update({ where: { id: swapId }, data: { status: "EXPIRED" } });
    throw new AppError("This swap request has expired.", 409);
  }
  const now = /* @__PURE__ */ new Date();
  const accepted = data.action === "ACCEPT";
  const recipientName = swap.recipientUser ? displayName4(swap.recipientUser) : "The other employee";
  const [updated] = await prisma.$transaction([
    prisma.swapRequest.update({
      where: { id: swapId },
      data: {
        status: accepted ? "PENDING_ADMIN_APPROVAL" : "REJECTED",
        recipientRespondedAt: now,
        ...accepted ? {} : { resolvedAt: now }
      },
      select: scheduleSwapSelect
    }),
    prisma.notification.create({
      data: {
        userId: swap.initiatorUserId,
        type: accepted ? "SWAP_PENDING_ADMIN_APPROVAL" : "SWAP_REQUEST_RESULT",
        channel: "IN_APP",
        status: "SENT",
        title: accepted ? "Swap accepted \u2014 awaiting admin" : "Swap declined",
        body: accepted ? `${recipientName} accepted your swap request. It now needs admin approval.` : `${recipientName} declined your swap request.`,
        sentAt: now,
        payload: { swapId, kind: "scheduleSwap" }
      }
    })
  ]);
  return updated;
};
var cancelSwap2 = async (userId, swapId) => {
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapId },
    select: { id: true, status: true, initiatorUserId: true }
  });
  if (!swap || swap.initiatorUserId !== userId) {
    throw new AppError("Swap request not found.", 404);
  }
  if (swap.status !== "PENDING_RECIPIENT") {
    throw new AppError("Only a swap still awaiting the other employee can be cancelled.", 409);
  }
  return prisma.swapRequest.update({
    where: { id: swapId },
    data: { status: "CANCELLED", resolvedAt: /* @__PURE__ */ new Date() },
    select: scheduleSwapSelect
  });
};
var scheduleSwapsServices = {
  searchSwapTargets,
  createSwap: createSwap2,
  listMySwaps: listMySwaps2,
  respondToSwap,
  cancelSwap: cancelSwap2
};

// src/modules/admin/schedule-swaps/schedule-swaps.service.ts
var listSwaps3 = async (query) => {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;
  const where = {};
  if (status) where.status = status;
  const [swaps, total] = await Promise.all([
    prisma.swapRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: scheduleSwapSelect
    }),
    prisma.swapRequest.count({ where })
  ]);
  return {
    swaps,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getSwapForReview = async (swapId) => {
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapId },
    select: {
      id: true,
      status: true,
      initiatorUserId: true,
      initiatorShiftId: true,
      recipientUserId: true,
      recipientShiftId: true
    }
  });
  if (!swap) throw new AppError("Swap request not found.", 404);
  if (swap.status !== "PENDING_ADMIN_APPROVAL") {
    throw new AppError("Only a swap awaiting admin approval can be reviewed.", 409);
  }
  if (!swap.recipientUserId || !swap.recipientShiftId) {
    throw new AppError("This swap request has no recipient shift.", 409);
  }
  return swap;
};
var approveSwap3 = async (swapId, adminId, data) => {
  const swap = await getSwapForReview(swapId);
  const [initiatorShift, recipientShift] = await Promise.all([
    prisma.shift.findUnique({
      where: { id: swap.initiatorShiftId },
      select: { id: true, userId: true, status: true, endTime: true }
    }),
    prisma.shift.findUnique({
      where: { id: swap.recipientShiftId },
      select: { id: true, userId: true, status: true, endTime: true }
    })
  ]);
  const usable = (s, owner) => s !== null && s.userId === owner && (s.status === "PENDING" || s.status === "ACCEPTED") && s.endTime > /* @__PURE__ */ new Date();
  if (!usable(initiatorShift, swap.initiatorUserId) || !usable(recipientShift, swap.recipientUserId)) {
    throw new AppError(
      "One of the shifts has changed since this swap was requested; it can no longer be applied.",
      409
    );
  }
  const now = /* @__PURE__ */ new Date();
  const [, , , updated] = await prisma.$transaction([
    // The actual exchange — this is where the main plan changes.
    prisma.shift.update({
      where: { id: swap.initiatorShiftId },
      data: { userId: swap.recipientUserId, status: "ACCEPTED" }
    }),
    prisma.shift.update({
      where: { id: swap.recipientShiftId },
      data: { userId: swap.initiatorUserId, status: "ACCEPTED" }
    }),
    prisma.notification.createMany({
      data: [swap.initiatorUserId, swap.recipientUserId].map((userId) => ({
        userId,
        type: "SWAP_REQUEST_RESULT",
        channel: "IN_APP",
        status: "SENT",
        title: "Swap approved",
        body: "Your shift swap has been approved by the admin. Check your updated schedule.",
        sentAt: now,
        payload: { swapId, result: "APPROVED" }
      }))
    }),
    prisma.swapRequest.update({
      where: { id: swapId },
      data: {
        status: "APPROVED",
        approvedById: adminId,
        resolvedAt: now,
        ...data.reason !== void 0 ? { adminReason: data.reason } : {}
      },
      select: scheduleSwapSelect
    })
  ]);
  return updated;
};
var rejectSwap3 = async (swapId, adminId, data) => {
  const swap = await getSwapForReview(swapId);
  const now = /* @__PURE__ */ new Date();
  const [, updated] = await prisma.$transaction([
    prisma.notification.createMany({
      data: [swap.initiatorUserId, swap.recipientUserId].map((userId) => ({
        userId,
        type: "SWAP_REQUEST_RESULT",
        channel: "IN_APP",
        status: "SENT",
        title: "Swap rejected",
        body: "Your shift swap request was not approved by the admin.",
        sentAt: now,
        payload: { swapId, result: "REJECTED" }
      }))
    }),
    prisma.swapRequest.update({
      where: { id: swapId },
      data: {
        status: "REJECTED",
        approvedById: adminId,
        resolvedAt: now,
        ...data.reason !== void 0 ? { adminReason: data.reason } : {}
      },
      select: scheduleSwapSelect
    })
  ]);
  return updated;
};
var adminScheduleSwapsServices = {
  listSwaps: listSwaps3,
  approveSwap: approveSwap3,
  rejectSwap: rejectSwap3
};

// src/modules/admin/schedule-swaps/schedule-swaps.controller.ts
var authAdminId2 = (res) => res.locals.auth.userId;
var listSwaps4 = async (req, res) => {
  const query = req.validated;
  const result = await adminScheduleSwapsServices.listSwaps(query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Schedule swap requests fetched successfully.",
    data: { swaps: result.swaps },
    meta: { pagination: result.pagination }
  });
};
var approveSwap4 = async (req, res) => {
  const swapId = req.params.swapId;
  const data = req.validated;
  const swap = await adminScheduleSwapsServices.approveSwap(swapId, authAdminId2(res), data);
  sendSuccess(res, {
    statusCode: 200,
    message: "Swap approved. The two shifts have been exchanged.",
    data: { swap }
  });
};
var rejectSwap4 = async (req, res) => {
  const swapId = req.params.swapId;
  const data = req.validated;
  const swap = await adminScheduleSwapsServices.rejectSwap(swapId, authAdminId2(res), data);
  sendSuccess(res, {
    statusCode: 200,
    message: "Swap rejected.",
    data: { swap }
  });
};

// src/modules/admin/schedule-swaps/schedule-swaps.route.ts
var adminScheduleSwapsRouter = Router15();
adminScheduleSwapsRouter.use(authenticate, authorizeAdmin);
adminScheduleSwapsRouter.get(
  "/",
  validateRequest(listScheduleSwapsQuerySchema),
  asyncHandler(listSwaps4)
);
adminScheduleSwapsRouter.post(
  "/:swapId/approve",
  validateRequest(reviewScheduleSwapSchema),
  asyncHandler(approveSwap4)
);
adminScheduleSwapsRouter.post(
  "/:swapId/reject",
  validateRequest(reviewScheduleSwapSchema),
  asyncHandler(rejectSwap4)
);
var schedule_swaps_route_default = adminScheduleSwapsRouter;

// src/modules/user/auth/auth.route.ts
import { Router as Router16 } from "express";

// src/modules/user/auth/auth.validation.ts
import { z as z16 } from "zod";
var userLoginSchema = z16.object({
  email: z16.string({ required_error: "Email is required" }).email("Please provide a valid email address").trim().toLowerCase(),
  password: z16.string({ required_error: "Password is required" }).min(6, "Password must be at least 6 characters")
});
var updateUserProfileSchema = z16.object({
  email: z16.string().email("Please provide a valid email address").trim().toLowerCase().optional(),
  currentPassword: z16.string().min(1, "Current password is required").optional(),
  newPassword: z16.string().min(6, "New password must be at least 6 characters").optional()
}).refine((d) => d.email !== void 0 || d.newPassword !== void 0, {
  message: "Provide an email and/or a new password to update."
}).refine((d) => !d.newPassword || !!d.currentPassword, {
  message: "currentPassword is required to change the password.",
  path: ["currentPassword"]
});

// src/modules/user/auth/auth.service.ts
var loginUser = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }
  if (!user.isActive) {
    throw new AppError("Your account has been deactivated. Please contact admin.", 403);
  }
  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError("Invalid email or password.", 401);
  }
  const payload = { userId: user.id, email: user.email, role: "USER" };
  const accessToken = tokenUtils.getAccessToken(payload);
  const refreshToken3 = tokenUtils.getRefreshToken(payload);
  const refreshTokenHash = tokenUtils.hashToken(refreshToken3);
  await prisma.userRefreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
      // 7 days
    }
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: /* @__PURE__ */ new Date() }
  });
  return {
    accessToken,
    refreshToken: refreshToken3,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      mustChangePassword: user.mustChangePassword
    }
  };
};
var getUserProfile = async (userId) => {
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
      updatedAt: true
    }
  });
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  return user;
};
var updateUserProfile = async (userId, data) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  const updateData = {};
  if (data.email !== void 0 && data.email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email: data.email } });
    if (taken) {
      throw new AppError("A user with this email already exists.", 409);
    }
    updateData.email = data.email;
  }
  let passwordChanged = false;
  if (data.newPassword) {
    const ok = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppError("Current password is incorrect.", 401);
    }
    updateData.passwordHash = await hashPassword(data.newPassword);
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
      updatedAt: true
    }
  });
  if (passwordChanged) {
    await prisma.userRefreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: /* @__PURE__ */ new Date() }
    });
  }
  return { user: updated, passwordChanged };
};
var refreshUserToken = async (oldRefreshToken) => {
  const decoded = jwtUtils.verifyToken(oldRefreshToken, envConfig.REFRESH_TOKEN_SECRET);
  if (!decoded.success || !decoded.data) {
    throw new AppError("Invalid or expired refresh token.", 401);
  }
  const { userId } = decoded.data;
  const storedTokens = await prisma.userRefreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: /* @__PURE__ */ new Date() }
    }
  });
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
  await prisma.userRefreshToken.update({
    where: { id: matchedToken.id },
    data: { revokedAt: /* @__PURE__ */ new Date() }
  });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new AppError("User account not found or deactivated.", 403);
  }
  const payload = { userId: user.id, email: user.email, role: "USER" };
  const newAccessToken = tokenUtils.getAccessToken(payload);
  const newRefreshToken = tokenUtils.getRefreshToken(payload);
  const newRefreshTokenHash = tokenUtils.hashToken(newRefreshToken);
  await prisma.userRefreshToken.create({
    data: {
      userId: user.id,
      tokenHash: newRefreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
    }
  });
  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};
var logoutUser = async (refreshToken3) => {
  const decoded = jwtUtils.decodeToken(refreshToken3);
  if (!decoded?.userId) {
    throw new AppError("Invalid refresh token.", 401);
  }
  const { userId } = decoded;
  const storedTokens = await prisma.userRefreshToken.findMany({
    where: {
      userId,
      revokedAt: null
    }
  });
  const targetHash = tokenUtils.hashToken(refreshToken3);
  for (const stored of storedTokens) {
    if (targetHash === stored.tokenHash) {
      await prisma.userRefreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: /* @__PURE__ */ new Date() }
      });
      break;
    }
  }
};
var userServices = {
  loginUser,
  getUserProfile,
  updateUserProfile,
  refreshUserToken,
  logoutUser
};

// src/modules/user/auth/auth.controller.ts
var clearAuthCookies = (res) => {
  const opts = { httpOnly: true, secure: true, sameSite: "none", path: "/" };
  CookieUtils.clearCookie(res, "accessToken", opts);
  CookieUtils.clearCookie(res, "refreshToken", opts);
};
var login2 = async (req, res) => {
  const { email, password } = req.validated;
  const result = await userServices.loginUser(email, password);
  tokenUtils.setAccessTokenCookie(res, result.accessToken);
  tokenUtils.setRefreshTokenCookie(res, result.refreshToken);
  sendSuccess(res, {
    statusCode: 200,
    message: "User logged in successfully.",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    }
  });
};
var updateProfile2 = async (req, res) => {
  const { userId } = res.locals.auth;
  const data = req.validated;
  const result = await userServices.updateUserProfile(userId, data);
  if (result.passwordChanged) {
    clearAuthCookies(res);
  }
  sendSuccess(res, {
    statusCode: 200,
    message: result.passwordChanged ? "Profile updated. Please log in again with your new password." : "Profile updated successfully.",
    data: { user: result.user, passwordChanged: result.passwordChanged }
  });
};
var getProfile2 = async (_req, res) => {
  const { userId } = res.locals.auth;
  const user = await userServices.getUserProfile(userId);
  sendSuccess(res, {
    statusCode: 200,
    message: "User profile fetched successfully.",
    data: { user }
  });
};
var refreshToken2 = async (req, res) => {
  const oldRefreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
  if (!oldRefreshToken) {
    sendError(res, {
      statusCode: 401,
      message: "No refresh token provided."
    });
    return;
  }
  const tokens = await userServices.refreshUserToken(oldRefreshToken);
  tokenUtils.setAccessTokenCookie(res, tokens.accessToken);
  tokenUtils.setRefreshTokenCookie(res, tokens.refreshToken);
  sendSuccess(res, {
    statusCode: 200,
    message: "Tokens refreshed successfully.",
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  });
};
var logout2 = async (req, res) => {
  const refreshTokenValue = req.body?.refreshToken || req.cookies?.refreshToken;
  if (refreshTokenValue) {
    await userServices.logoutUser(refreshTokenValue);
  }
  clearAuthCookies(res);
  sendSuccess(res, {
    statusCode: 200,
    message: "User logged out successfully."
  });
};

// src/modules/user/auth/auth.route.ts
var userAuthRouter = Router16();
userAuthRouter.post("/login", authLimiter, validateRequest(userLoginSchema), asyncHandler(login2));
userAuthRouter.post("/refresh", authLimiter, asyncHandler(refreshToken2));
userAuthRouter.post("/logout", authenticate, asyncHandler(logout2));
userAuthRouter.get("/profile", authenticate, authorizeUser, asyncHandler(getProfile2));
userAuthRouter.patch(
  "/profile",
  authenticate,
  authorizeUser,
  validateRequest(updateUserProfileSchema),
  asyncHandler(updateProfile2)
);
var auth_route_default2 = userAuthRouter;

// src/modules/user/shifts/shifts.route.ts
import { Router as Router17 } from "express";

// src/modules/user/shifts/shifts.validation.ts
import { z as z17 } from "zod";
var respondToShiftSchema = z17.object({
  status: z17.enum(["ACCEPTED", "REJECTED"], {
    required_error: "Response status is required",
    invalid_type_error: "status must be either ACCEPTED or REJECTED"
  })
});
var shiftIdParamSchema2 = z17.object({
  shiftId: z17.string({ required_error: "Shift ID is required" }).min(1)
});
var listUserShiftsQuerySchema = z17.object({
  page: z17.coerce.number().int().min(1).default(1),
  limit: z17.coerce.number().int().min(1).max(100).default(20),
  categoryId: z17.string().min(1).optional(),
  // Filter by this user's own response state.
  mine: z17.enum(["accepted", "rejected", "pending"]).optional(),
  // Hide shifts that have already ended.
  upcoming: z17.enum(["true", "false"]).transform((val) => val === "true").optional()
});

// src/modules/user/shifts/shifts.service.ts
var buildShiftSelect = (userId) => ({
  id: true,
  jobTitle: true,
  categoryId: true,
  startTime: true,
  endTime: true,
  hourlyPrice: true,
  description: true,
  notifiedAt: true,
  createdAt: true,
  category: { select: { id: true, name: true } },
  responses: {
    where: { userId },
    select: { status: true, approvalStatus: true, respondedAt: true, approvedAt: true }
  },
  // Confirmed (admin-approved) workers on this shift.
  _count: { select: { responses: { where: { approvalStatus: "APPROVED" } } } }
});
var shapeShift = (shift) => {
  const { responses, _count, ...rest } = shift;
  const myResponse = responses[0] ?? null;
  return {
    ...rest,
    myResponse,
    // Number of workers confirmed by the admin for this shift.
    confirmedCount: _count.responses
  };
};
var listAvailableShifts = async (userId, query) => {
  const { page, limit, categoryId, mine, upcoming } = query;
  const skip = (page - 1) * limit;
  const where = { notifiedAt: { not: null } };
  if (categoryId) where.categoryId = categoryId;
  if (upcoming) where.endTime = { gte: /* @__PURE__ */ new Date() };
  if (mine === "accepted") where.responses = { some: { userId, status: "ACCEPTED" } };
  if (mine === "rejected") where.responses = { some: { userId, status: "REJECTED" } };
  if (mine === "pending") where.responses = { none: { userId } };
  const [shifts, total] = await Promise.all([
    prisma.shiftOffer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startTime: "asc" },
      select: buildShiftSelect(userId)
    }),
    prisma.shiftOffer.count({ where })
  ]);
  return {
    shifts: shifts.map(shapeShift),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var getShiftForUser = async (userId, shiftId) => {
  const shift = await prisma.shiftOffer.findFirst({
    where: { id: shiftId, notifiedAt: { not: null } },
    select: buildShiftSelect(userId)
  });
  if (!shift) {
    throw new AppError("Shift not found.", 404);
  }
  return shapeShift(shift);
};
var respondToShift = async (userId, shiftId, data) => {
  const shift = await prisma.shiftOffer.findFirst({
    where: { id: shiftId, notifiedAt: { not: null } },
    select: { id: true, endTime: true }
  });
  if (!shift) {
    throw new AppError("Shift not found.", 404);
  }
  if (shift.endTime.getTime() < Date.now()) {
    throw new AppError("This shift has already ended.", 409);
  }
  const response = await prisma.shiftOfferResponse.upsert({
    where: { shiftOfferId_userId: { shiftOfferId: shiftId, userId } },
    create: { shiftOfferId: shiftId, userId, status: data.status },
    update: { status: data.status, respondedAt: /* @__PURE__ */ new Date() },
    select: {
      id: true,
      shiftOfferId: true,
      status: true,
      respondedAt: true
    }
  });
  return response;
};
var userShiftServices = {
  listAvailableShifts,
  getShiftForUser,
  respondToShift
};

// src/modules/user/shifts/shifts.controller.ts
var listShifts = async (req, res) => {
  const userId = res.locals.auth.userId;
  const validated = req.validated;
  const query = { page: validated.page, limit: validated.limit };
  if (validated.categoryId !== void 0) query.categoryId = validated.categoryId;
  if (validated.mine !== void 0) query.mine = validated.mine;
  if (validated.upcoming !== void 0) query.upcoming = validated.upcoming;
  const result = await userShiftServices.listAvailableShifts(userId, query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Shifts fetched successfully.",
    data: { shifts: result.shifts },
    meta: { pagination: result.pagination }
  });
};
var getShift = async (req, res) => {
  const userId = res.locals.auth.userId;
  const shiftId = req.params.shiftId;
  const shift = await userShiftServices.getShiftForUser(userId, shiftId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Shift fetched successfully.",
    data: { shift }
  });
};
var respondToShift2 = async (req, res) => {
  const userId = res.locals.auth.userId;
  const shiftId = req.params.shiftId;
  const data = req.validated;
  const response = await userShiftServices.respondToShift(userId, shiftId, data);
  sendSuccess(res, {
    statusCode: 200,
    message: data.status === "ACCEPTED" ? "Shift accepted successfully." : "Shift declined.",
    data: { response }
  });
};

// src/modules/user/shifts/shifts.route.ts
var userShiftRouter = Router17();
userShiftRouter.use(authenticate, authorizeUser);
userShiftRouter.get(
  "/",
  validateRequest(listUserShiftsQuerySchema),
  asyncHandler(listShifts)
);
userShiftRouter.get("/:shiftId", asyncHandler(getShift));
userShiftRouter.post(
  "/:shiftId/respond",
  validateRequest(respondToShiftSchema),
  asyncHandler(respondToShift2)
);
var shifts_route_default2 = userShiftRouter;

// src/modules/user/notifications/notifications.route.ts
import { Router as Router18 } from "express";

// src/modules/user/notifications/notifications.validation.ts
import { z as z18 } from "zod";
var listNotificationsQuerySchema = z18.object({
  page: z18.coerce.number().int().min(1).default(1),
  limit: z18.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z18.enum(["true", "false"]).transform((val) => val === "true").optional()
});
var notificationIdParamSchema = z18.object({
  notificationId: z18.string({ required_error: "Notification ID is required" }).min(1)
});

// src/modules/user/notifications/notifications.service.ts
var notificationSelect = {
  id: true,
  type: true,
  channel: true,
  status: true,
  title: true,
  body: true,
  payload: true,
  sentAt: true,
  readAt: true,
  createdAt: true
};
var listNotifications = async (userId, query) => {
  const { page, limit, unreadOnly } = query;
  const skip = (page - 1) * limit;
  const where = { userId };
  if (unreadOnly) where.readAt = null;
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: notificationSelect
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } })
  ]);
  return {
    notifications,
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var markAsRead = async (userId, notificationId) => {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true, readAt: true }
  });
  if (!existing) {
    throw new AppError("Notification not found.", 404);
  }
  if (existing.readAt) {
    return prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
      select: notificationSelect
    });
  }
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: /* @__PURE__ */ new Date(), status: "READ" },
    select: notificationSelect
  });
};
var markAllAsRead = async (userId) => {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: /* @__PURE__ */ new Date(), status: "READ" }
  });
  return { updatedCount: result.count };
};
var notificationServices = {
  listNotifications,
  markAsRead,
  markAllAsRead
};

// src/modules/user/notifications/notifications.controller.ts
var listNotifications2 = async (req, res) => {
  const userId = res.locals.auth.userId;
  const validated = req.validated;
  const query = {
    page: validated.page,
    limit: validated.limit
  };
  if (validated.unreadOnly !== void 0) query.unreadOnly = validated.unreadOnly;
  const result = await notificationServices.listNotifications(userId, query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Notifications fetched successfully.",
    data: { notifications: result.notifications, unreadCount: result.unreadCount },
    meta: { pagination: result.pagination }
  });
};
var markAsRead2 = async (req, res) => {
  const userId = res.locals.auth.userId;
  const notificationId = req.params.notificationId;
  const notification = await notificationServices.markAsRead(userId, notificationId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Notification marked as read.",
    data: { notification }
  });
};
var markAllAsRead2 = async (req, res) => {
  const userId = res.locals.auth.userId;
  const result = await notificationServices.markAllAsRead(userId);
  sendSuccess(res, {
    statusCode: 200,
    message: "All notifications marked as read.",
    data: { updatedCount: result.updatedCount }
  });
};

// src/modules/user/notifications/notifications.route.ts
var notificationRouter = Router18();
notificationRouter.use(authenticate, authorizeUser);
notificationRouter.get(
  "/",
  validateRequest(listNotificationsQuerySchema),
  asyncHandler(listNotifications2)
);
notificationRouter.patch("/read-all", asyncHandler(markAllAsRead2));
notificationRouter.patch(
  "/:notificationId/read",
  asyncHandler(markAsRead2)
);
var notifications_route_default = notificationRouter;

// src/modules/user/swaps/swaps.route.ts
import { Router as Router19 } from "express";

// src/modules/user/swaps/swaps.validation.ts
import { z as z19 } from "zod";
var createSwapSchema = z19.object({
  // The caller's own confirmed shift they want to give away.
  initiatorShiftId: z19.string({ required_error: "Your shift is required" }).min(1),
  // The colleague to swap with and the confirmed shift of theirs you want.
  recipientUserId: z19.string({ required_error: "Recipient is required" }).min(1),
  recipientShiftId: z19.string({ required_error: "Recipient shift is required" }).min(1),
  reason: z19.string().trim().max(500).optional()
}).refine((d) => d.initiatorShiftId !== d.recipientShiftId, {
  message: "You cannot swap a shift with itself.",
  path: ["recipientShiftId"]
});
var swapIdParamSchema2 = z19.object({
  swapId: z19.string({ required_error: "Swap ID is required" }).min(1)
});
var listUserSwapsQuerySchema = z19.object({
  page: z19.coerce.number().int().min(1).default(1),
  limit: z19.coerce.number().int().min(1).max(100).default(20),
  status: z19.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  role: z19.enum(["initiated", "received"]).optional()
});

// src/modules/user/swaps/swaps.controller.ts
var createSwap3 = async (req, res) => {
  const userId = res.locals.auth.userId;
  const data = req.validated;
  const swap = await userSwapServices.createSwap(userId, data);
  sendSuccess(res, {
    statusCode: 201,
    message: "Swap request submitted for admin approval.",
    data: { swap }
  });
};
var listMySwaps3 = async (req, res) => {
  const userId = res.locals.auth.userId;
  const validated = req.validated;
  const query = { page: validated.page, limit: validated.limit };
  if (validated.status !== void 0) query.status = validated.status;
  if (validated.role !== void 0) query.role = validated.role;
  const result = await userSwapServices.listMySwaps(userId, query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Swaps fetched successfully.",
    data: { swaps: result.swaps },
    meta: { pagination: result.pagination }
  });
};
var cancelSwap3 = async (req, res) => {
  const userId = res.locals.auth.userId;
  const swapId = req.params.swapId;
  const swap = await userSwapServices.cancelSwap(userId, swapId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Swap request cancelled.",
    data: { swap }
  });
};

// src/modules/user/swaps/swaps.route.ts
var userSwapRouter = Router19();
userSwapRouter.use(authenticate, authorizeUser);
userSwapRouter.post(
  "/",
  validateRequest(createSwapSchema),
  asyncHandler(createSwap3)
);
userSwapRouter.get(
  "/",
  validateRequest(listUserSwapsQuerySchema),
  asyncHandler(listMySwaps3)
);
userSwapRouter.post("/:swapId/cancel", asyncHandler(cancelSwap3));
var swaps_route_default2 = userSwapRouter;

// src/modules/user/availability/availability.route.ts
import { Router as Router20 } from "express";

// src/modules/user/availability/availability.validation.ts
import { z as z20 } from "zod";
var monthParamSchema = z20.object({
  year: z20.coerce.number().int().min(2e3).max(2100),
  month: z20.coerce.number().int().min(1).max(12)
});
var dayEntrySchema = z20.object({
  date: z20.string({ required_error: "date is required" }).refine((s) => !Number.isNaN(Date.parse(s)), "date must be a valid date"),
  status: z20.enum(["AVAILABLE", "UNAVAILABLE", "WISH"], {
    required_error: "status is required",
    invalid_type_error: "status must be AVAILABLE, UNAVAILABLE or WISH"
  }),
  note: z20.string().trim().max(500).optional(),
  preferredStartTime: z20.string().datetime().optional(),
  preferredEndTime: z20.string().datetime().optional()
});
var setDaysSchema = z20.object({
  year: z20.coerce.number().int().min(2e3).max(2100),
  month: z20.coerce.number().int().min(1).max(12),
  days: z20.array(dayEntrySchema).min(1, "Provide at least one day").max(31)
});

// src/modules/user/availability/availability.service.ts
var monthSelect = {
  id: true,
  year: true,
  month: true,
  status: true,
  cutoffAt: true,
  submittedAt: true,
  days: {
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      status: true,
      note: true,
      preferredStartTime: true,
      preferredEndTime: true
    }
  }
};
var endOfMonthUTC = (year, month) => new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
var isCurrentMonth = (year, month) => {
  for (const d of [
    /* @__PURE__ */ new Date(),
    new Date(Date.now() + 14 * 60 * 60 * 1e3),
    new Date(Date.now() - 12 * 60 * 60 * 1e3)
  ]) {
    if (d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month) return true;
  }
  return false;
};
var ensureCurrentMonthOpen = async (userId, year, month) => {
  if (!isCurrentMonth(year, month)) return;
  await prisma.availabilityMonth.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: { userId, year, month, cutoffAt: endOfMonthUTC(year, month) },
    update: {},
    select: { id: true }
  });
};
var loadEditableMonth = async (userId, year, month) => {
  await ensureCurrentMonthOpen(userId, year, month);
  const m = await prisma.availabilityMonth.findUnique({
    where: { userId_year_month: { userId, year, month } },
    select: { id: true, status: true, cutoffAt: true, _count: { select: { days: true } } }
  });
  if (!m) {
    throw new AppError("Availability for this month is not open yet.", 404);
  }
  if (m.status !== "DRAFT") {
    throw new AppError("Your availability is already submitted and can no longer be edited.", 409);
  }
  if (m.cutoffAt.getTime() < Date.now()) {
    throw new AppError("The cut-off date for this month has passed.", 409);
  }
  return m;
};
var listMyMonths = async (userId) => {
  const months = await prisma.availabilityMonth.findMany({
    where: { userId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      cutoffAt: true,
      submittedAt: true,
      _count: { select: { days: true } }
    }
  });
  const now = Date.now();
  return months.map((m) => ({
    id: m.id,
    year: m.year,
    month: m.month,
    status: m.status,
    cutoffAt: m.cutoffAt,
    submittedAt: m.submittedAt,
    dayCount: m._count.days,
    // The app can show/hide the "edit availability" action based on this.
    editable: m.status === "DRAFT" && m.cutoffAt.getTime() > now
  }));
};
var getMyMonth = async (userId, year, month) => {
  await ensureCurrentMonthOpen(userId, year, month);
  const m = await prisma.availabilityMonth.findUnique({
    where: { userId_year_month: { userId, year, month } },
    select: monthSelect
  });
  if (!m) {
    throw new AppError("Availability for this month is not open yet.", 404);
  }
  return m;
};
var setDays = async (userId, year, month, days) => {
  const m = await loadEditableMonth(userId, year, month);
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 1);
  for (const d of days) {
    const t = Date.parse(d.date);
    if (!(t >= monthStart && t < monthEnd)) {
      throw new AppError(
        `Date ${d.date} is not within ${String(month).padStart(2, "0")}/${year}.`,
        400
      );
    }
  }
  const seen = /* @__PURE__ */ new Set();
  for (const d of days) {
    const key = new Date(d.date).toISOString().slice(0, 10);
    if (seen.has(key)) {
      throw new AppError(`Duplicate entry for date ${key}.`, 400);
    }
    seen.add(key);
  }
  const rows = days.map((d) => {
    const row = {
      availabilityMonthId: m.id,
      date: new Date(d.date),
      status: d.status
    };
    if (d.note !== void 0) row.note = d.note;
    if (d.preferredStartTime !== void 0) row.preferredStartTime = new Date(d.preferredStartTime);
    if (d.preferredEndTime !== void 0) row.preferredEndTime = new Date(d.preferredEndTime);
    return row;
  });
  await prisma.$transaction([
    prisma.availabilityDay.deleteMany({ where: { availabilityMonthId: m.id } }),
    prisma.availabilityDay.createMany({ data: rows })
  ]);
  return getMyMonth(userId, year, month);
};
var submit = async (userId, year, month) => {
  const m = await loadEditableMonth(userId, year, month);
  if (m._count.days === 0) {
    throw new AppError("Add your availability before submitting.", 400);
  }
  return prisma.availabilityMonth.update({
    where: { id: m.id },
    data: { status: "SUBMITTED", submittedAt: /* @__PURE__ */ new Date() },
    select: monthSelect
  });
};
var userAvailabilityServices = {
  listMyMonths,
  getMyMonth,
  setDays,
  submit
};

// src/modules/user/availability/availability.controller.ts
var listMyMonths2 = async (_req, res) => {
  const userId = res.locals.auth.userId;
  const months = await userAvailabilityServices.listMyMonths(userId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Availability months fetched successfully.",
    data: { months }
  });
};
var getMyMonth2 = async (req, res) => {
  const userId = res.locals.auth.userId;
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const availability = await userAvailabilityServices.getMyMonth(userId, year, month);
  sendSuccess(res, {
    statusCode: 200,
    message: "Availability fetched successfully.",
    data: { availability }
  });
};
var setDays2 = async (req, res) => {
  const userId = res.locals.auth.userId;
  const { year, month, days } = req.validated;
  const availability = await userAvailabilityServices.setDays(userId, year, month, days);
  sendSuccess(res, {
    statusCode: 200,
    message: "Availability saved.",
    data: { availability }
  });
};
var submit2 = async (req, res) => {
  const userId = res.locals.auth.userId;
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const availability = await userAvailabilityServices.submit(userId, year, month);
  sendSuccess(res, {
    statusCode: 200,
    message: "Availability submitted.",
    data: { availability }
  });
};

// src/modules/user/availability/availability.route.ts
var userAvailabilityRouter = Router20();
userAvailabilityRouter.use(authenticate, authorizeUser);
userAvailabilityRouter.get("/", asyncHandler(listMyMonths2));
userAvailabilityRouter.get("/:year/:month", asyncHandler(getMyMonth2));
userAvailabilityRouter.put(
  "/:year/:month/days",
  validateRequest(setDaysSchema),
  asyncHandler(setDays2)
);
userAvailabilityRouter.post("/:year/:month/submit", asyncHandler(submit2));
var availability_route_default2 = userAvailabilityRouter;

// src/modules/user/me/me.route.ts
import { Router as Router21 } from "express";

// src/modules/user/me/me.validation.ts
import { z as z21 } from "zod";
var monthString = z21.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be in YYYY-MM format").optional();
var myShiftsQuerySchema = z21.object({
  month: monthString
});
var respondAction = z21.enum(["ACCEPT", "REJECT"], {
  errorMap: () => ({ message: "action must be ACCEPT or REJECT" })
});
var respondShiftSchema = z21.object({
  shiftId: z21.string({ required_error: "shiftId is required" }).min(1, "shiftId is required"),
  action: respondAction,
  reason: z21.string().trim().max(1e3).optional()
});
var batchRespondSchema = z21.object({
  responses: z21.array(
    z21.object({
      shiftId: z21.string().min(1, "shiftId is required"),
      action: respondAction,
      reason: z21.string().trim().max(1e3).optional()
    })
  ).min(1, "Provide at least one response").max(100, "Too many responses in a single request")
});
var myHoursQuerySchema = z21.object({
  month: monthString
});
var updateMyProfileSchema = z21.object({
  firstName: z21.string().trim().optional(),
  lastName: z21.string().trim().optional(),
  phone: z21.string().trim().optional(),
  address: z21.string().trim().optional()
});

// src/modules/user/me/me.service.ts
var HOURS_PER_MS5 = 1 / (1e3 * 60 * 60);
var monthBounds = (month) => {
  const anchor = month ? /* @__PURE__ */ new Date(`${month}-01T00:00:00.000Z`) : /* @__PURE__ */ new Date();
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const endExclusive = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  return { start, endExclusive };
};
var myShiftSelect = {
  id: true,
  weeklyPlanId: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  rejectionReason: true,
  actualStartTime: true,
  actualEndTime: true,
  actualBreakMinutes: true,
  category: { select: { id: true, name: true } },
  weeklyPlan: { select: { status: true, weekStartDate: true, weekEndDate: true } }
};
var getMyShifts = async (userId, query) => {
  const { start, endExclusive } = monthBounds(query.month);
  const [shifts, unpublishedPlanCount] = await Promise.all([
    prisma.shift.findMany({
      where: {
        userId,
        date: { gte: start, lt: endExclusive },
        weeklyPlan: { status: "PUBLISHED" },
        status: { notIn: ["CANCELLED", "SWAPPED_OUT"] }
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: myShiftSelect
    }),
    // Lets the mobile empty state distinguish "no plan exists" from "a plan
    // exists but hasn't been published yet".
    prisma.weeklyPlan.count({
      where: {
        status: { not: "PUBLISHED" },
        weekStartDate: { lt: endExclusive },
        weekEndDate: { gte: start }
      }
    })
  ]);
  return {
    month: `${start.toISOString().slice(0, 7)}`,
    status: "published",
    hasUnpublishedPlan: unpublishedPlanCount > 0,
    shifts
  };
};
var respondToShift3 = async (userId, data) => {
  const shift = await prisma.shift.findUnique({
    where: { id: data.shiftId },
    select: {
      id: true,
      userId: true,
      status: true,
      endTime: true,
      weeklyPlan: { select: { status: true } }
    }
  });
  if (!shift || shift.userId !== userId) {
    throw new AppError("Shift not found.", 404);
  }
  if (shift.weeklyPlan.status !== "PUBLISHED") {
    throw new AppError("This shift's schedule has not been published yet.", 409);
  }
  if (shift.status !== "PENDING") {
    throw new AppError("This shift has already been responded to.", 409);
  }
  if (shift.endTime <= /* @__PURE__ */ new Date()) {
    throw new AppError("This shift has already ended.", 409);
  }
  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: data.action === "ACCEPT" ? { status: "ACCEPTED", rejectionReason: null } : { status: "REJECTED", rejectionReason: data.reason ?? null },
    select: myShiftSelect
  });
  return updated;
};
var batchRespond = async (userId, data) => {
  const results = [];
  for (const response of data.responses) {
    try {
      await respondToShift3(userId, response);
      results.push({ shiftId: response.shiftId, success: true });
    } catch (err) {
      results.push({
        shiftId: response.shiftId,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  }
  return {
    results,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length
  };
};
var getMyHours = async (userId, query) => {
  const { start, endExclusive } = monthBounds(query.month);
  const [shifts, user] = await Promise.all([
    prisma.shift.findMany({
      where: {
        userId,
        date: { gte: start, lt: endExclusive },
        weeklyPlan: { status: "PUBLISHED" },
        status: { in: ["ACCEPTED", "PENDING"] }
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        actualStartTime: true,
        actualEndTime: true,
        actualBreakMinutes: true,
        category: { select: { id: true, name: true } }
      }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { hourlyRate: true, contractedHoursMonthly: true }
    })
  ]);
  const entries = shifts.map((s) => {
    const plannedHours = (s.endTime.getTime() - s.startTime.getTime()) * HOURS_PER_MS5;
    const actualHours = s.actualStartTime && s.actualEndTime ? Math.max(
      0,
      (s.actualEndTime.getTime() - s.actualStartTime.getTime()) * HOURS_PER_MS5 - (s.actualBreakMinutes ?? 0) / 60
    ) : null;
    return {
      shiftId: s.id,
      date: s.date,
      category: s.category,
      status: s.status,
      plannedStart: s.startTime,
      plannedEnd: s.endTime,
      actualStart: s.actualStartTime,
      actualEnd: s.actualEndTime,
      breakMinutes: s.actualBreakMinutes,
      hours: Number((actualHours ?? plannedHours).toFixed(2))
    };
  });
  const totalHours = Number(entries.reduce((sum, e) => sum + e.hours, 0).toFixed(2));
  return {
    month: `${start.toISOString().slice(0, 7)}`,
    totalHours,
    targetHours: user?.contractedHoursMonthly ? Number(user.contractedHoursMonthly) : null,
    hourlyRate: user?.hourlyRate ? Number(user.hourlyRate) : null,
    entries
  };
};
var updateProfile3 = async (userId, data) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      address: true,
      contractedHoursMonthly: true,
      hourlyRate: true
    }
  });
  return user;
};
var meServices = {
  getMyShifts,
  respondToShift: respondToShift3,
  batchRespond,
  getMyHours,
  updateProfile: updateProfile3
};

// src/modules/user/me/me.controller.ts
var authUserId = (res) => res.locals.auth.userId;
var getMyShifts2 = async (req, res) => {
  const query = req.validated;
  const result = await meServices.getMyShifts(authUserId(res), query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Your shifts fetched successfully.",
    data: result
  });
};
var respondToShift4 = async (req, res) => {
  const data = req.validated;
  const shift = await meServices.respondToShift(authUserId(res), data);
  sendSuccess(res, {
    statusCode: 200,
    message: `Shift ${data.action === "ACCEPT" ? "accepted" : "rejected"} successfully.`,
    data: { shift }
  });
};
var batchRespond2 = async (req, res) => {
  const data = req.validated;
  const result = await meServices.batchRespond(authUserId(res), data);
  sendSuccess(res, {
    statusCode: 200,
    message: `${result.succeeded} response(s) applied, ${result.failed} failed.`,
    data: result
  });
};
var getMyHours2 = async (req, res) => {
  const query = req.validated;
  const result = await meServices.getMyHours(authUserId(res), query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Your hours fetched successfully.",
    data: result
  });
};
var updateProfile4 = async (req, res) => {
  const data = req.validated;
  const user = await meServices.updateProfile(authUserId(res), data);
  sendSuccess(res, {
    statusCode: 200,
    message: "Profile updated successfully.",
    data: { user }
  });
};

// src/modules/user/me/me.route.ts
var meRouter = Router21();
meRouter.use(authenticate, authorizeUser);
meRouter.get("/shifts", validateRequest(myShiftsQuerySchema), asyncHandler(getMyShifts2));
meRouter.post(
  "/shifts/respond",
  validateRequest(respondShiftSchema),
  asyncHandler(respondToShift4)
);
meRouter.post(
  "/shifts/batch-respond",
  validateRequest(batchRespondSchema),
  asyncHandler(batchRespond2)
);
meRouter.get("/hours", validateRequest(myHoursQuerySchema), asyncHandler(getMyHours2));
meRouter.patch("/profile", validateRequest(updateMyProfileSchema), asyncHandler(updateProfile4));
var me_route_default = meRouter;

// src/modules/user/attendance/attendance.route.ts
import { Router as Router22 } from "express";

// src/modules/user/attendance/attendance.validation.ts
import { z as z22 } from "zod";
var clockInSchema = z22.object({
  shiftId: z22.string().min(1).optional(),
  latitude: z22.coerce.number().min(-90).max(90).optional(),
  longitude: z22.coerce.number().min(-180).max(180).optional(),
  location: z22.string().trim().max(500).optional(),
  note: z22.string().trim().max(1e3).optional()
});
var clockOutSchema = z22.object({
  note: z22.string().trim().max(1e3).optional()
});
var historyQuerySchema = z22.object({
  page: z22.coerce.number().int().min(1).default(1),
  limit: z22.coerce.number().int().min(1).max(100).default(20),
  month: z22.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be in YYYY-MM format").optional()
});

// src/modules/user/attendance/attendance.service.ts
var MINUTES_PER_MS = 1 / (1e3 * 60);
var entrySelect2 = {
  id: true,
  shiftId: true,
  shift: {
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      category: { select: { id: true, name: true } }
    }
  },
  clockInAt: true,
  clockOutAt: true,
  breakStartedAt: true,
  breakMinutes: true,
  location: true,
  status: true,
  workedMinutes: true,
  lateMinutes: true,
  overtimeMinutes: true,
  note: true,
  createdAt: true
};
var findOpenEntry = (userId) => prisma.timeEntry.findFirst({
  where: { userId, status: { in: ["ACTIVE", "ON_BREAK"] } },
  select: entrySelect2,
  orderBy: { clockInAt: "desc" }
});
var withElapsed = (entry) => {
  const now = Date.now();
  const liveBreakSeconds = entry.status === "ON_BREAK" && entry.breakStartedAt ? Math.floor((now - entry.breakStartedAt.getTime()) / 1e3) : 0;
  const breakSeconds = entry.breakMinutes * 60 + liveBreakSeconds;
  const elapsedSeconds = Math.floor((now - entry.clockInAt.getTime()) / 1e3);
  return {
    ...entry,
    elapsedSeconds,
    breakSeconds,
    workedSeconds: Math.max(0, elapsedSeconds - breakSeconds)
  };
};
var clockIn = async (userId, data) => {
  const open = await findOpenEntry(userId);
  if (open) throw new AppError("You are already clocked in.", 409);
  let lateMinutes = null;
  const now = /* @__PURE__ */ new Date();
  if (data.shiftId) {
    const shift = await prisma.shift.findUnique({
      where: { id: data.shiftId },
      select: {
        id: true,
        userId: true,
        status: true,
        startTime: true,
        endTime: true,
        weeklyPlan: { select: { status: true } }
      }
    });
    if (!shift || shift.userId !== userId) throw new AppError("Shift not found.", 404);
    if (shift.weeklyPlan.status !== "PUBLISHED") {
      throw new AppError("This shift's schedule has not been published yet.", 409);
    }
    if (shift.status !== "ACCEPTED" && shift.status !== "PENDING") {
      throw new AppError("You can only clock in to an active (accepted) shift.", 409);
    }
    if (now >= shift.endTime) {
      throw new AppError("This shift has already ended.", 409);
    }
    const settings = await prisma.orgSettings.findUnique({
      where: { id: 1 },
      select: { earlyClockInWindowMinutes: true }
    });
    const windowMinutes = settings?.earlyClockInWindowMinutes ?? 15;
    const earliest = new Date(shift.startTime.getTime() - windowMinutes * 60 * 1e3);
    if (now < earliest) {
      throw new AppError(
        `You can clock in starting ${windowMinutes} minutes before your shift.`,
        400
      );
    }
    lateMinutes = Math.max(0, Math.round((now.getTime() - shift.startTime.getTime()) * MINUTES_PER_MS));
  }
  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      clockInAt: now,
      status: "ACTIVE",
      ...data.shiftId ? { shiftId: data.shiftId } : {},
      ...data.latitude !== void 0 ? { latitude: data.latitude } : {},
      ...data.longitude !== void 0 ? { longitude: data.longitude } : {},
      ...data.location !== void 0 ? { location: data.location } : {},
      ...data.note !== void 0 ? { note: data.note } : {},
      ...lateMinutes !== null ? { lateMinutes } : {}
    },
    select: entrySelect2
  });
  return withElapsed(entry);
};
var startBreak = async (userId) => {
  const open = await findOpenEntry(userId);
  if (!open) throw new AppError("You are not clocked in.", 409);
  if (open.status === "ON_BREAK") throw new AppError("You are already on a break.", 409);
  const entry = await prisma.timeEntry.update({
    where: { id: open.id },
    data: { status: "ON_BREAK", breakStartedAt: /* @__PURE__ */ new Date() },
    select: entrySelect2
  });
  return withElapsed(entry);
};
var endBreak = async (userId) => {
  const open = await findOpenEntry(userId);
  if (!open || open.status !== "ON_BREAK" || !open.breakStartedAt) {
    throw new AppError("You are not on a break.", 409);
  }
  const addedMinutes = Math.max(
    0,
    Math.round((Date.now() - open.breakStartedAt.getTime()) * MINUTES_PER_MS)
  );
  const entry = await prisma.timeEntry.update({
    where: { id: open.id },
    data: {
      status: "ACTIVE",
      breakStartedAt: null,
      breakMinutes: open.breakMinutes + addedMinutes
    },
    select: entrySelect2
  });
  return withElapsed(entry);
};
var clockOut = async (userId, data) => {
  const open = await findOpenEntry(userId);
  if (!open) throw new AppError("You are not clocked in.", 409);
  const now = /* @__PURE__ */ new Date();
  const extraBreak = open.status === "ON_BREAK" && open.breakStartedAt ? Math.max(0, Math.round((now.getTime() - open.breakStartedAt.getTime()) * MINUTES_PER_MS)) : 0;
  const breakMinutes = open.breakMinutes + extraBreak;
  const totalMinutes = Math.max(
    0,
    Math.round((now.getTime() - open.clockInAt.getTime()) * MINUTES_PER_MS)
  );
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes);
  const overtimeMinutes = open.shift ? Math.max(0, Math.round((now.getTime() - open.shift.endTime.getTime()) * MINUTES_PER_MS)) : null;
  const [entry] = await prisma.$transaction([
    prisma.timeEntry.update({
      where: { id: open.id },
      data: {
        status: "COMPLETED",
        clockOutAt: now,
        breakStartedAt: null,
        breakMinutes,
        workedMinutes,
        ...overtimeMinutes !== null ? { overtimeMinutes } : {},
        ...data.note !== void 0 ? { note: data.note } : {}
      },
      select: entrySelect2
    }),
    // Mirror actuals onto the roster shift for reporting/hours.
    ...open.shiftId ? [
      prisma.shift.update({
        where: { id: open.shiftId },
        data: {
          actualStartTime: open.clockInAt,
          actualEndTime: now,
          actualBreakMinutes: breakMinutes
        }
      })
    ] : []
  ]);
  return {
    entry,
    summary: {
      workedHours: Number((workedMinutes / 60).toFixed(2)),
      workedMinutes,
      breakMinutes,
      lateMinutes: entry.lateMinutes ?? 0,
      overtimeMinutes: overtimeMinutes ?? 0
    }
  };
};
var getCurrentStatus = async (userId) => {
  const open = await findOpenEntry(userId);
  return { active: open !== null, entry: open ? withElapsed(open) : null };
};
var getHistory = async (userId, query) => {
  const { page, limit, month } = query;
  const skip = (page - 1) * limit;
  const where = { userId, status: "COMPLETED" };
  if (month) {
    const anchor = /* @__PURE__ */ new Date(`${month}-01T00:00:00.000Z`);
    where.clockInAt = {
      gte: anchor,
      lt: new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1))
    };
  }
  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({
      where,
      skip,
      take: limit,
      orderBy: { clockInAt: "desc" },
      select: entrySelect2
    }),
    prisma.timeEntry.count({ where })
  ]);
  const totals = entries.reduce(
    (acc, e) => {
      acc.workedMinutes += e.workedMinutes ?? 0;
      acc.breakMinutes += e.breakMinutes;
      acc.lateCount += (e.lateMinutes ?? 0) > 0 ? 1 : 0;
      return acc;
    },
    { workedMinutes: 0, breakMinutes: 0, lateCount: 0 }
  );
  return {
    entries,
    totals: { ...totals, workedHours: Number((totals.workedMinutes / 60).toFixed(2)) },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var attendanceServices = {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getCurrentStatus,
  getHistory
};

// src/modules/user/attendance/attendance.controller.ts
var authUserId2 = (res) => res.locals.auth.userId;
var clockIn2 = async (req, res) => {
  const data = req.validated;
  const entry = await attendanceServices.clockIn(authUserId2(res), data);
  sendSuccess(res, {
    statusCode: 201,
    message: "Clocked in successfully.",
    data: { entry }
  });
};
var clockOut2 = async (req, res) => {
  const data = req.validated;
  const result = await attendanceServices.clockOut(authUserId2(res), data);
  sendSuccess(res, {
    statusCode: 200,
    message: "Clocked out successfully.",
    data: result
  });
};
var startBreak2 = async (_req, res) => {
  const entry = await attendanceServices.startBreak(authUserId2(res));
  sendSuccess(res, {
    statusCode: 200,
    message: "Break started.",
    data: { entry }
  });
};
var endBreak2 = async (_req, res) => {
  const entry = await attendanceServices.endBreak(authUserId2(res));
  sendSuccess(res, {
    statusCode: 200,
    message: "Break ended.",
    data: { entry }
  });
};
var getCurrentStatus2 = async (_req, res) => {
  const result = await attendanceServices.getCurrentStatus(authUserId2(res));
  sendSuccess(res, {
    statusCode: 200,
    message: "Attendance status fetched successfully.",
    data: result
  });
};
var getHistory2 = async (req, res) => {
  const query = req.validated;
  const result = await attendanceServices.getHistory(authUserId2(res), query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Attendance history fetched successfully.",
    data: { entries: result.entries, totals: result.totals },
    meta: { pagination: result.pagination }
  });
};

// src/modules/user/attendance/attendance.route.ts
var attendanceRouter = Router22();
attendanceRouter.use(authenticate, authorizeUser);
attendanceRouter.post(
  "/clock-in",
  validateRequest(clockInSchema),
  asyncHandler(clockIn2)
);
attendanceRouter.post(
  "/clock-out",
  validateRequest(clockOutSchema),
  asyncHandler(clockOut2)
);
attendanceRouter.post("/break-start", asyncHandler(startBreak2));
attendanceRouter.post("/break-end", asyncHandler(endBreak2));
attendanceRouter.get("/current", asyncHandler(getCurrentStatus2));
attendanceRouter.get(
  "/history",
  validateRequest(historyQuerySchema),
  asyncHandler(getHistory2)
);
var attendance_route_default2 = attendanceRouter;

// src/modules/user/leaves/leaves.route.ts
import { Router as Router23 } from "express";

// src/modules/user/leaves/leaves.validation.ts
import { z as z23 } from "zod";
var dateString5 = (label) => z23.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).refine((s) => !Number.isNaN(Date.parse(s)), {
  message: `${label} must be a valid date`
});
var createLeaveSchema = z23.object({
  leaveType: z23.enum(["VACATION", "SICK", "PERSONAL", "OTHER"], {
    errorMap: () => ({ message: "leaveType must be VACATION, SICK, PERSONAL or OTHER" })
  }),
  startDate: dateString5("Start date"),
  endDate: dateString5("End date"),
  reason: z23.string({ required_error: "Reason is required" }).trim().min(10, "Please give a reason of at least 10 characters").max(2e3)
}).refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
  message: "endDate must be on or after startDate",
  path: ["endDate"]
});
var myLeavesQuerySchema = z23.object({
  page: z23.coerce.number().int().min(1).default(1),
  limit: z23.coerce.number().int().min(1).max(100).default(20),
  status: z23.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional()
});

// src/utils/mail/mailer.ts
import nodemailer from "nodemailer";
var transporter = null;
var getTransporter = () => {
  if (!envConfig.SMTP_HOST || !envConfig.SMTP_USER || !envConfig.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: envConfig.SMTP_HOST,
      port: envConfig.SMTP_PORT ?? 587,
      secure: (envConfig.SMTP_PORT ?? 587) === 465,
      auth: { user: envConfig.SMTP_USER, pass: envConfig.SMTP_PASS }
    });
  }
  return transporter;
};
var sendEmail = async (options) => {
  const transport = getTransporter();
  if (!transport) {
    logger.info(
      { to: options.to, subject: options.subject },
      "SMTP not configured \u2014 email skipped (logged only)"
    );
    return false;
  }
  try {
    await transport.sendMail({
      from: envConfig.SMTP_FROM ?? envConfig.SMTP_USER,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      text: options.text,
      ...options.html ? { html: options.html } : {}
    });
    return true;
  } catch (err) {
    logger.error({ err, to: options.to, subject: options.subject }, "Failed to send email");
    return false;
  }
};

// src/modules/user/leaves/leaves.service.ts
var startOfUTCDay6 = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
var leaveSelect = {
  id: true,
  userId: true,
  leaveType: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  adminNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true
};
var displayName5 = (u) => u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);
var createLeave = async (userId, data) => {
  const startDate = startOfUTCDay6(new Date(data.startDate));
  const endDate = startOfUTCDay6(new Date(data.endDate));
  const today = startOfUTCDay6(/* @__PURE__ */ new Date());
  if (endDate < today) {
    throw new AppError("Leave cannot end in the past.", 400);
  }
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    },
    select: { id: true, status: true }
  });
  if (overlapping) {
    throw new AppError(
      `You already have a ${overlapping.status.toLowerCase()} leave request overlapping these dates.`,
      409
    );
  }
  const [leave, user, admins] = await Promise.all([
    prisma.leaveRequest.create({
      data: {
        userId,
        leaveType: data.leaveType,
        startDate,
        endDate,
        reason: data.reason
      },
      select: leaveSelect
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, firstName: true, lastName: true, email: true }
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      select: { email: true }
    })
  ]);
  if (user && admins.length > 0) {
    const name = displayName5(user);
    const range = `${leave.startDate.toISOString().slice(0, 10)} to ${leave.endDate.toISOString().slice(0, 10)}`;
    void sendEmail({
      to: admins.map((a) => a.email),
      subject: `New leave request \u2014 ${name}`,
      text: [
        `${name} has requested ${data.leaveType.toLowerCase()} leave.`,
        `Dates: ${range}`,
        `Reason: ${data.reason}`,
        "",
        "Review it in the admin dashboard under Leave Requests."
      ].join("\n")
    });
  }
  return leave;
};
var getMyLeaves = async (userId, query) => {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;
  const where = { userId };
  if (status) where.status = status;
  const [leaves, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: leaveSelect
    }),
    prisma.leaveRequest.count({ where })
  ]);
  return {
    leaves,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};
var cancelLeave = async (userId, leaveId) => {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    select: { id: true, userId: true, status: true }
  });
  if (!leave || leave.userId !== userId) throw new AppError("Leave request not found.", 404);
  if (leave.status !== "PENDING") {
    throw new AppError("Only a pending leave request can be cancelled.", 409);
  }
  return prisma.leaveRequest.update({
    where: { id: leaveId },
    data: { status: "CANCELLED" },
    select: leaveSelect
  });
};
var leavesServices = {
  createLeave,
  getMyLeaves,
  cancelLeave
};

// src/modules/user/leaves/leaves.controller.ts
var authUserId3 = (res) => res.locals.auth.userId;
var createLeave2 = async (req, res) => {
  const data = req.validated;
  const leave = await leavesServices.createLeave(authUserId3(res), data);
  sendSuccess(res, {
    statusCode: 201,
    message: "Leave request submitted. The admin team has been notified.",
    data: { leave }
  });
};
var getMyLeaves2 = async (req, res) => {
  const query = req.validated;
  const result = await leavesServices.getMyLeaves(authUserId3(res), query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Your leave requests fetched successfully.",
    data: { leaves: result.leaves },
    meta: { pagination: result.pagination }
  });
};
var cancelLeave2 = async (req, res) => {
  const leaveId = req.params.leaveId;
  const leave = await leavesServices.cancelLeave(authUserId3(res), leaveId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Leave request cancelled.",
    data: { leave }
  });
};

// src/modules/user/leaves/leaves.route.ts
var leavesRouter = Router23();
leavesRouter.use(authenticate, authorizeUser);
leavesRouter.post("/", validateRequest(createLeaveSchema), asyncHandler(createLeave2));
leavesRouter.get("/", validateRequest(myLeavesQuerySchema), asyncHandler(getMyLeaves2));
leavesRouter.post("/:leaveId/cancel", asyncHandler(cancelLeave2));
var leaves_route_default2 = leavesRouter;

// src/modules/user/schedule-swaps/schedule-swaps.route.ts
import { Router as Router24 } from "express";

// src/modules/user/schedule-swaps/schedule-swaps.validation.ts
import { z as z24 } from "zod";
var dateString6 = (label) => z24.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).refine((s) => !Number.isNaN(Date.parse(s)), {
  message: `${label} must be a valid date`
});
var searchSwapTargetsSchema = z24.object({
  date: dateString6("Date"),
  categoryId: z24.string().min(1).optional()
});
var createScheduleSwapSchema = z24.object({
  initiatorShiftId: z24.string({ required_error: "initiatorShiftId is required" }).min(1, "initiatorShiftId is required"),
  recipientUserId: z24.string({ required_error: "recipientUserId is required" }).min(1, "recipientUserId is required"),
  recipientShiftId: z24.string({ required_error: "recipientShiftId is required" }).min(1, "recipientShiftId is required")
});
var listMySwapsQuerySchema = z24.object({
  role: z24.enum(["initiated", "received"]).optional(),
  status: z24.enum([
    "PENDING_RECIPIENT",
    "PENDING_ADMIN_APPROVAL",
    "APPROVED",
    "REJECTED",
    "EXPIRED",
    "CANCELLED"
  ]).optional(),
  page: z24.coerce.number().int().min(1).default(1),
  limit: z24.coerce.number().int().min(1).max(100).default(20)
});
var respondSwapSchema = z24.object({
  action: z24.enum(["ACCEPT", "DECLINE"], {
    errorMap: () => ({ message: "action must be ACCEPT or DECLINE" })
  })
});

// src/modules/user/schedule-swaps/schedule-swaps.controller.ts
var authUserId4 = (res) => res.locals.auth.userId;
var searchSwapTargets2 = async (req, res) => {
  const query = req.validated;
  const result = await scheduleSwapsServices.searchSwapTargets(authUserId4(res), query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Swappable shifts fetched successfully.",
    data: result
  });
};
var createSwap4 = async (req, res) => {
  const data = req.validated;
  const swap = await scheduleSwapsServices.createSwap(authUserId4(res), data);
  sendSuccess(res, {
    statusCode: 201,
    message: "Swap request sent. The other employee has been notified.",
    data: { swap }
  });
};
var listMySwaps4 = async (req, res) => {
  const query = req.validated;
  const result = await scheduleSwapsServices.listMySwaps(authUserId4(res), query);
  sendSuccess(res, {
    statusCode: 200,
    message: "Your swap requests fetched successfully.",
    data: { swaps: result.swaps },
    meta: { pagination: result.pagination }
  });
};
var respondToSwap2 = async (req, res) => {
  const swapId = req.params.swapId;
  const data = req.validated;
  const swap = await scheduleSwapsServices.respondToSwap(authUserId4(res), swapId, data);
  sendSuccess(res, {
    statusCode: 200,
    message: data.action === "ACCEPT" ? "Swap accepted. It now awaits admin approval." : "Swap declined.",
    data: { swap }
  });
};
var cancelSwap4 = async (req, res) => {
  const swapId = req.params.swapId;
  const swap = await scheduleSwapsServices.cancelSwap(authUserId4(res), swapId);
  sendSuccess(res, {
    statusCode: 200,
    message: "Swap request cancelled.",
    data: { swap }
  });
};

// src/modules/user/schedule-swaps/schedule-swaps.route.ts
var scheduleSwapsRouter = Router24();
scheduleSwapsRouter.use(authenticate, authorizeUser);
scheduleSwapsRouter.get(
  "/search",
  validateRequest(searchSwapTargetsSchema),
  asyncHandler(searchSwapTargets2)
);
scheduleSwapsRouter.get(
  "/",
  validateRequest(listMySwapsQuerySchema),
  asyncHandler(listMySwaps4)
);
scheduleSwapsRouter.post(
  "/",
  validateRequest(createScheduleSwapSchema),
  asyncHandler(createSwap4)
);
scheduleSwapsRouter.post(
  "/:swapId/respond",
  validateRequest(respondSwapSchema),
  asyncHandler(respondToSwap2)
);
scheduleSwapsRouter.post("/:swapId/cancel", asyncHandler(cancelSwap4));
var schedule_swaps_route_default2 = scheduleSwapsRouter;

// src/routes/index.route.ts
var indexRouter = Router25();
indexRouter.use("/auth/admin", auth_route_default);
indexRouter.use("/auth/user", auth_route_default2);
indexRouter.use("/admin/overview", overview_route_default);
indexRouter.use("/admin/users", employees_route_default);
indexRouter.use("/admin/categories", categories_route_default);
indexRouter.use("/admin/shifts", shifts_route_default);
indexRouter.use("/admin/workload", workload_route_default);
indexRouter.use("/admin/demands", demands_route_default);
indexRouter.use("/admin/reports", reports_route_default);
indexRouter.use("/admin/settings", settings_route_default);
indexRouter.use("/admin/swaps", swaps_route_default);
indexRouter.use("/admin/availability", availability_route_default);
indexRouter.use("/admin/scheduling", scheduling_route_default);
indexRouter.use("/admin/attendance", attendance_route_default);
indexRouter.use("/admin/leaves", leaves_route_default);
indexRouter.use("/admin/schedule-swaps", schedule_swaps_route_default);
indexRouter.use("/shifts", shifts_route_default2);
indexRouter.use("/notifications", notifications_route_default);
indexRouter.use("/swaps", swaps_route_default2);
indexRouter.use("/availability", availability_route_default2);
indexRouter.use("/me", me_route_default);
indexRouter.use("/attendance", attendance_route_default2);
indexRouter.use("/leaves", leaves_route_default2);
indexRouter.use("/schedule-swaps", schedule_swaps_route_default2);
var index_route_default = indexRouter;

// src/app.ts
var app = express2();
app.set("trust proxy", envConfig.TRUST_PROXY_HOPS);
applyMiddleware(app);
if (envValidationError) {
  app.use((_req, res) => {
    res.status(500).json({
      success: false,
      message: "Server misconfigured: invalid or missing environment variables.",
      error: envValidationError
    });
  });
}
app.use("/api/v1", index_route_default);
app.get("/health", async (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/", (req, res) => {
  res.send("home");
});
app.use(notFound);
app.use(errorHandler);
var app_default = app;

// src/vercel.ts
var vercel_default = app_default;
export {
  vercel_default as default
};
