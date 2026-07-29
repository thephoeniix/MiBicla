import "dotenv/config";
import crypto from "node:crypto";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { ZodError } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { loginSchema } from "@mi-bicla/api-contract";
import {
  createDatabase,
  administrators,
  auditLogs,
  permissions,
  rateLimits,
  rolePermissions,
  roles,
  sessions,
} from "@mi-bicla/db";
import {
  ACCOUNT_LOCK_ATTEMPTS,
  ACCOUNT_LOCK_MS,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  calculateSessionRenewal,
  generateCsrfToken,
  generateSessionToken,
  hashRateLimitKey,
  hashSessionToken,
  normalizeEmail,
  sanitizeAuditMetadata,
  safeTokenCompare,
  verifyPassword,
  parseEnv,
  type AppEnv,
} from "@mi-bicla/shared";
import { BusinessSettingsService } from "./services/business-settings.service.js";
import { createAdminBusinessSettingsRouter } from "./routes/admin/business-settings.js";
import { createPublicBusinessSettingsRouter } from "./routes/public/business-settings.js";
import { CustomersService } from "./services/customers.service.js";
import { LoyaltyService } from "./services/loyalty.service.js";
import { createPhase2AdminRouter } from "./routes/admin/phase-2.js";
import { createPublicCustomerRouter } from "./routes/public/customer.js";
import { WorkshopService } from "./services/workshop.service.js";
import { createWorkshopAdminRouter } from "./routes/admin/workshop.js";
import { createWorkshopPublicRouter } from "./routes/public/workshop.js";
import { CustomerAuthService } from "./services/customer-auth.service.js";
import {
  createCustomerAuthAdminRouter,
  createCustomerAuthRouter,
} from "./routes/customer-auth.js";
import { CustomerRegistrationService } from "./services/customer-registration.service.js";
import {
  createCustomerRegistrationAdminRouter,
  createCustomerRegistrationPublicRouter,
} from "./routes/customer-registration.js";
type Database = ReturnType<typeof createDatabase>["db"];

export function createApp(
  env: AppEnv = parseEnv(process.env),
  db: Database = createDatabase().db,
) {
const app = express();
app.set("trust proxy", Number(env.TRUST_PROXY));
app.use(
  helmet(),
  cors({ origin: env.ALLOWED_ORIGINS, credentials: true }),
  express.json({ limit: "32kb" }),
  cookieParser(),
);
app.use((req, res, next) => {
  const id = crypto.randomUUID();
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);
  next();
});
const cookie = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_ABSOLUTE_MS,
};
const audit = async (
  req: Request,
  action: string,
  success: boolean,
  administratorId?: string,
  reason?: string,
  metadata: unknown = {},
  entityId?: string,
) =>
  db.insert(auditLogs).values({
    requestId: req.res!.locals.requestId,
    administratorId,
    action,
    success,
    failureReasonCode: reason,
    entityType: entityId ? "payment_deposit_option" : undefined,
    entityId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    metadata: sanitizeAuditMetadata(metadata),
  });
function windowStart(now = new Date()) {
  return new Date(
    Math.floor(now.getTime() / LOGIN_WINDOW_MS) * LOGIN_WINDOW_MS,
  );
}
async function limit(scope: string, key: string) {
  const start = windowStart(),
    expires = new Date(start.getTime() + LOGIN_WINDOW_MS),
    hash = hashRateLimitKey(key);
  const rows = await db
    .insert(rateLimits)
    .values({
      scope,
      keyHash: hash,
      windowStartedAt: start,
      expiresAt: expires,
    })
    .onConflictDoUpdate({
      target: [
        rateLimits.scope,
        rateLimits.keyHash,
        rateLimits.windowStartedAt,
      ],
      set: {
        attemptCount: sql`${rateLimits.attemptCount}+1`,
        updatedAt: new Date(),
      },
    })
    .returning({ count: rateLimits.attemptCount });
  return (rows[0]?.count ?? 1) > LOGIN_MAX_ATTEMPTS;
}
const csrfGuard = (req: Request, res: Response, next: NextFunction) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.get("origin"),
    fetchSite = req.get("sec-fetch-site");
  if (
    !origin ||
    !env.ALLOWED_ORIGINS.includes(origin) ||
    (fetchSite && fetchSite === "cross-site")
  )
    return res.status(403).json({
      error: {
        code: "CSRF_ORIGIN",
        message: "Solicitud no permitida",
        requestId: res.locals.requestId,
      },
    });
  next();
};
app.use(csrfGuard);
app.post("/auth/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body),
      email = normalizeEmail(input.email),
      ip = req.ip ?? "unknown";
    const ipLimited = await limit("login:ip", `login:ip:${ip}`);
    const emailLimited = await limit(
      "login:ip-email",
      `login:ip-email:${ip}:${email}`,
    );
    if (ipLimited || emailLimited) {
      await audit(req, "auth.login", false, undefined, "RATE_LIMITED");
      return res.status(429).json({
        error: {
          code: "LOGIN_FAILED",
          message: "Credenciales inválidas",
          requestId: res.locals.requestId,
        },
      });
    }
    const [a] = await db
      .select()
      .from(administrators)
      .where(eq(administrators.emailNormalized, email))
      .limit(1);
    const valid =
      !!a &&
      a.isActive &&
      !a.deletedAt &&
      (!a.lockedUntil || a.lockedUntil <= new Date()) &&
      (await verifyPassword(a.passwordHash, input.password));
    if (!valid) {
      if (a)
        await db.transaction(async (tx) => {
          const count = a.failedLoginCount + 1;
          await tx
            .update(administrators)
            .set({
              failedLoginCount: count,
              lockedUntil:
                count >= ACCOUNT_LOCK_ATTEMPTS
                  ? new Date(Date.now() + ACCOUNT_LOCK_MS)
                  : a.lockedUntil,
              updatedAt: new Date(),
            })
            .where(eq(administrators.id, a.id));
          await tx.insert(auditLogs).values({
            requestId: res.locals.requestId,
            administratorId: a.id,
            action: "auth.login",
            success: false,
            failureReasonCode: "INVALID_CREDENTIALS",
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
            metadata: {},
          });
        });
      else
        await audit(req, "auth.login", false, undefined, "INVALID_CREDENTIALS");
      return res.status(401).json({
        error: {
          code: "LOGIN_FAILED",
          message: "Credenciales inválidas",
          requestId: res.locals.requestId,
        },
      });
    }
    const token = generateSessionToken(),
      csrf = generateCsrfToken(),
      now = new Date(),
      absolute = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
    await db.transaction(async (tx) => {
      await tx.insert(sessions).values({
        administratorId: a.id,
        tokenHash: hashSessionToken(token),
        csrfTokenHash: hashSessionToken(csrf),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        expiresAt: new Date(now.getTime() + SESSION_IDLE_MS),
        absoluteExpiresAt: absolute,
      });
      await tx
        .update(administrators)
        .set({
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: now,
          updatedAt: now,
        })
        .where(eq(administrators.id, a.id));
      await tx.insert(auditLogs).values({
        requestId: res.locals.requestId,
        administratorId: a.id,
        action: "auth.login",
        success: true,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        metadata: {},
      });
    });
    res
      .cookie("mb_session", token, cookie)
      .json({ authenticated: true, csrfToken: csrf });
  } catch (e) {
    next(e);
  }
});
async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies.mb_session as string | undefined;
    if (!token)
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Sesión requerida",
          requestId: res.locals.requestId,
        },
      });
    const [row] = await db
        .select({
          session: sessions,
          administrator: administrators,
          role: roles,
        })
        .from(sessions)
        .innerJoin(
          administrators,
          eq(sessions.administratorId, administrators.id),
        )
        .innerJoin(roles, eq(administrators.roleId, roles.id))
        .where(eq(sessions.tokenHash, hashSessionToken(token)))
        .limit(1),
      now = new Date();
    if (
      !row ||
      row.session.revokedAt ||
      row.session.expiresAt <= now ||
      row.session.absoluteExpiresAt <= now ||
      !row.administrator.isActive ||
      row.administrator.deletedAt
    ) {
      res.clearCookie("mb_session", { path: "/" });
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Sesión inválida",
          requestId: res.locals.requestId,
        },
      });
    }
    const csrf = req.get("x-csrf-token");
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      (!csrf ||
        !safeTokenCompare(hashSessionToken(csrf), row.session.csrfTokenHash))
    )
      return res.status(403).json({
        error: {
          code: "CSRF_TOKEN",
          message: "Token CSRF inválido",
          requestId: res.locals.requestId,
        },
      });
    const renewal = calculateSessionRenewal(
      now,
      row.session.lastSeenAt,
      row.session.absoluteExpiresAt,
    );
    if (renewal)
      await db
        .update(sessions)
        .set({ lastSeenAt: now, expiresAt: renewal })
        .where(eq(sessions.id, row.session.id));
    res.locals.auth = row;
    next();
  } catch (e) {
    next(e);
  }
}
app.get("/auth/session", auth, async (req, res) => {
  const a = res.locals.auth;
  const ps = await db
    .select({ name: permissions.name })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, a.role.id));
  res.json({
    authenticated: true,
    administrator: {
      id: a.administrator.id,
      name: a.administrator.name,
      email: a.administrator.email,
      role: a.role.name,
      permissions: ps.map((x) => x.name),
    },
  });
});
app.post("/auth/logout", auth, async (req, res) => {
  const a = res.locals.auth;
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokeReason: "logout" })
    .where(eq(sessions.id, a.session.id));
  await audit(req, "auth.logout", true, a.administrator.id);
  res.clearCookie("mb_session", { path: "/" }).status(204).end();
});
const requirePermission = (permission: string) => [
  auth,
  async (_req: Request, res: Response, next: NextFunction) => {
    const a = res.locals.auth;
    const [allowed] = await db
      .select()
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(rolePermissions.roleId, a.role.id),
          eq(permissions.name, permission),
        ),
      )
      .limit(1);
    if (!allowed)
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Permiso insuficiente",
          requestId: res.locals.requestId,
        },
      });
    next();
  },
];
const businessSettingsService = new BusinessSettingsService(db);
const customersService = new CustomersService(db),
  loyaltyService = new LoyaltyService(db);
const workshopService = new WorkshopService(db);
const customerAuthService = new CustomerAuthService(db, env.APP_BASE_URL);
const customerRegistrationService = new CustomerRegistrationService(db, env.APP_BASE_URL);
app.use(
  "/api/admin/settings",
  createAdminBusinessSettingsRouter(
    businessSettingsService,
    requirePermission,
    (req, action, success, administratorId, entityId) =>
      audit(req, action, success, administratorId, undefined, {}, entityId),
  ),
);
app.use(
  "/api/public",
  createPublicBusinessSettingsRouter(businessSettingsService),
);
app.use(
  "/api/admin",
  createPhase2AdminRouter(
    customersService,
    loyaltyService,
    requirePermission,
    audit,
  ),
);
app.use("/api/public", createPublicCustomerRouter(customersService));
app.use(
  "/api/admin",
  createCustomerAuthAdminRouter(customerAuthService, requirePermission, audit),
);
app.use(
  "/api/public",
  createCustomerRegistrationPublicRouter(customerRegistrationService, limit, audit),
);
app.use(
  "/api/admin",
  createCustomerRegistrationAdminRouter(customerRegistrationService, requirePermission, audit),
);
app.use(
  "/api/customer",
  createCustomerAuthRouter(
    customerAuthService,
    limit,
    audit,
    env.NODE_ENV === "production",
  ),
);
app.use(
  "/api/admin",
  createWorkshopAdminRouter(
    workshopService,
    requirePermission,
    audit,
    env.APP_BASE_URL,
  ),
);
app.use("/api/public", createWorkshopPublicRouter(workshopService));
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  void next;
  if (err instanceof ZodError) {
    const fieldErrors = Object.fromEntries(
      err.issues.map((issue) => [
        issue.path.join(".") || "payload",
        issue.message,
      ]),
    );
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Datos inválidos",
        requestId: res.locals.requestId,
        fieldErrors,
      },
    });
  }
  const internalCode =
    err && typeof err === "object" && "code" in err && typeof err.code === "string"
      ? err.code.slice(0, 32)
      : "UNEXPECTED_ERROR";
  if (env.NODE_ENV === "development")
    console.error({
      event: "request_failed",
      requestId: res.locals.requestId,
      method: req.method,
      route: req.route?.path ?? "unmatched",
      errorType: err instanceof Error ? err.name : typeof err,
      internalCode,
    });
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "No fue posible completar la solicitud",
      requestId: res.locals.requestId,
    },
  });
});
return app;
}
