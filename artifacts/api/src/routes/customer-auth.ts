import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import {
  customerAuthTokenSchema,
  customerLoginSchema,
  customerPasswordTokenSchema,
} from "@mi-bicla/api-contract";
import {
  SESSION_ABSOLUTE_MS,
  hashSessionToken,
  safeTokenCompare,
} from "@mi-bicla/shared";
import type { CustomerAuthService } from "../services/customer-auth.service.js";

type Guard = (
  permission: string,
) => Array<(req: Request, res: Response, next: NextFunction) => unknown>;
type Audit = (
  req: Request,
  action: string,
  success: boolean,
  administratorId?: string,
  reason?: string,
  metadata?: unknown,
  entityId?: string,
) => Promise<unknown>;
type RateLimit = (scope: string, key: string) => Promise<boolean>;
export type CustomerGuard = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

const genericAuthError = (res: Response, status = 401) =>
  res.status(status).json({
    error: {
      code: status === 429 ? "CUSTOMER_AUTH_RATE_LIMITED" : "CUSTOMER_AUTH_FAILED",
      message: "No fue posible completar la autenticación",
      requestId: res.locals.requestId,
    },
  });

export function createRequireCustomer(
  service: CustomerAuthService,
): CustomerGuard {
  return async (req, res, next) => {
    try {
      const token = req.cookies.mb_customer_session as string | undefined;
      const match = token ? await service.session(token) : null;
      if (!match) {
        res.clearCookie("mb_customer_session", { path: "/" });
        return res.status(401).json({
          error: {
            code: "CUSTOMER_UNAUTHORIZED",
            message: "Sesión de cliente requerida",
            requestId: res.locals.requestId,
          },
        });
      }
      if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
        const csrf = req.get("x-csrf-token");
        if (
          !csrf ||
          !safeTokenCompare(
            hashSessionToken(csrf),
            match.session.csrfTokenHash,
          )
        )
          return res.status(403).json({
            error: {
              code: "CUSTOMER_CSRF_TOKEN",
              message: "Token CSRF inválido",
              requestId: res.locals.requestId,
            },
          });
      }
      res.locals.customerAuth = match;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createCustomerAuthAdminRouter(
  service: CustomerAuthService,
  guard: Guard,
  audit: Audit,
) {
  const router = Router();
  const create =
    (purpose: "activation" | "recovery") =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const administratorId = res.locals.auth.administrator.id as string;
        const result = await service.generateLink(
          String(req.params.id),
          purpose,
          administratorId,
        );
        if (!result)
          return res.status(409).json({
            error: {
              code: "CUSTOMER_AUTH_UNAVAILABLE",
              message: "La cuenta no puede procesarse",
              requestId: res.locals.requestId,
            },
          });
        await audit(
          req,
          `customer.auth.${purpose}.link_created`,
          true,
          administratorId,
        );
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    };
  router.post(
    "/customers/:id/auth/activation",
    ...guard("manage_customers"),
    create("activation"),
  );
  router.post(
    "/customers/:id/auth/recovery",
    ...guard("manage_customers"),
    create("recovery"),
  );
  return router;
}

export function createCustomerAuthRouter(
  service: CustomerAuthService,
  rateLimit: RateLimit,
  audit: Audit,
  production: boolean,
) {
  const router = Router();
  const cookie = {
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_ABSOLUTE_MS,
  };
  const tokenRateLimited = async (
    req: Request,
    token: string,
    scope: string,
  ) => {
    const ip = req.ip ?? "unknown";
    const tokenHash = hashSessionToken(token);
    const [ipLimited, tokenLimited] = await Promise.all([
      rateLimit(`${scope}:ip`, `${scope}:ip:${ip}`),
      rateLimit(
        `${scope}:ip-token`,
        `${scope}:ip-token:${ip}:${tokenHash}`,
      ),
    ]);
    return ipLimited || tokenLimited;
  };

  const requireCustomer = createRequireCustomer(service);

  router.post("/auth/activation/validate", async (req, res, next) => {
    try {
      const { token } = customerAuthTokenSchema.parse(req.body);
      if (await tokenRateLimited(req, token, "customer-activation-validate"))
        return genericAuthError(res, 429);
      res.json({ valid: await service.validateToken(token, "activation") });
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/activate", async (req, res, next) => {
    try {
      const { token, password } = customerPasswordTokenSchema.parse(req.body);
      if (await tokenRateLimited(req, token, "customer-activation-consume"))
        return genericAuthError(res, 429);
      const result = await service.consumePasswordToken(
        token,
        password,
        "activation",
      );
      await audit(
        req,
        "customer.auth.activation",
        !!result,
        undefined,
        result ? undefined : "INVALID_OR_EXPIRED_TOKEN",
      );
      if (!result) return genericAuthError(res);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/recovery/reset", async (req, res, next) => {
    try {
      const { token, password } = customerPasswordTokenSchema.parse(req.body);
      if (await tokenRateLimited(req, token, "customer-recovery-consume"))
        return genericAuthError(res, 429);
      const result = await service.consumePasswordToken(
        token,
        password,
        "recovery",
      );
      await audit(
        req,
        "customer.auth.recovery",
        !!result,
        undefined,
        result ? undefined : "INVALID_OR_EXPIRED_TOKEN",
      );
      if (!result) return genericAuthError(res);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/login", async (req, res, next) => {
    try {
      const input = customerLoginSchema.parse(req.body);
      const ip = req.ip ?? "unknown";
      const limited =
        (await rateLimit("customer-login:ip", `customer-login:ip:${ip}`)) ||
        (await rateLimit(
          "customer-login:ip-phone",
          `customer-login:ip-phone:${ip}:${input.phone}`,
        ));
      if (limited) {
        await audit(
          req,
          "customer.auth.login",
          false,
          undefined,
          "RATE_LIMITED",
        );
        return genericAuthError(res, 429);
      }
      const session = await service.authenticateAndCreateSession(
        input.phone,
        input.password,
        req.ip,
        req.get("user-agent"),
      );
      if (!session) {
        await audit(
          req,
          "customer.auth.login",
          false,
          undefined,
          "INVALID_CREDENTIALS",
        );
        return genericAuthError(res);
      }
      await audit(req, "customer.auth.login", true);
      res
        .cookie("mb_customer_session", session.token, cookie)
        .json({ authenticated: true, csrfToken: session.csrfToken });
    } catch (error) {
      next(error);
    }
  });

  router.get("/session", requireCustomer, async (_req, res, next) => {
    try {
      const match = res.locals.customerAuth;
      const csrfToken = await service.rotateCsrf(match.session.id);
      if (!csrfToken) return genericAuthError(res);
      res.json({
        authenticated: true,
        csrfToken,
        customer: {
          id: match.customer.id,
          firstName: match.customer.firstName,
          lastName: match.customer.lastName,
          name: `${match.customer.firstName} ${match.customer.lastName}`,
          phone: match.customer.phone,
          email: match.customer.email,
          birthDate: match.customer.birthDate,
          accountStatus: "active",
          updatedAt: match.customer.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireCustomer, (_req, res) => {
    const match = res.locals.customerAuth;
    res.json({
      id: match.customer.id,
      firstName: match.customer.firstName,
      lastName: match.customer.lastName,
      name: `${match.customer.firstName} ${match.customer.lastName}`,
      phone: match.customer.phone,
      email: match.customer.email,
      birthDate: match.customer.birthDate,
      accountStatus: "active",
      updatedAt: match.customer.updatedAt,
    });
  });

  router.post("/auth/logout", requireCustomer, async (req, res, next) => {
    try {
      await service.logout(res.locals.customerAuth.session.id);
      await audit(req, "customer.auth.logout", true);
      res
        .clearCookie("mb_customer_session", { path: "/" })
        .status(204)
        .end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
