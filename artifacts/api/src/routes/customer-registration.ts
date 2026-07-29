import { Router, type NextFunction, type Request, type Response } from "express";
import {
  customerRegistrationSchema,
  registrationRejectionSchema,
  registrationReviewIdSchema,
} from "@mi-bicla/api-contract";
import { sha256 } from "@mi-bicla/shared";
import type { CustomerRegistrationService } from "../services/customer-registration.service.js";

type Guard = (permission: string) => Array<(req: Request, res: Response, next: NextFunction) => unknown>;
type RateLimit = (scope: string, key: string) => Promise<boolean>;
type Audit = (
  req: Request, action: string, success: boolean, administratorId?: string,
  reason?: string, metadata?: unknown,
) => Promise<unknown>;

export function createCustomerRegistrationPublicRouter(
  service: CustomerRegistrationService,
  rateLimit: RateLimit,
  audit: Audit,
) {
  const router = Router();
  router.post("/customer-registration", async (req, res, next) => {
    try {
      const input = customerRegistrationSchema.parse(req.body);
      const ip = req.ip ?? "unknown";
      const phoneHash = sha256(input.phone);
      const [ipLimited, phoneLimited] = await Promise.all([
        rateLimit("customer-registration:ip", `customer-registration:ip:${ip}`),
        rateLimit("customer-registration:ip-phone", `customer-registration:ip-phone:${ip}:${phoneHash}`),
      ]);
      if (ipLimited || phoneLimited) {
        await audit(req, "customer.registration.create", false, undefined, "RATE_LIMITED");
        return res.status(429).json({
          error: { code: "REGISTRATION_UNAVAILABLE", message: "No fue posible recibir la solicitud", requestId: res.locals.requestId },
        });
      }
      const result = await service.create(input);
      await audit(req, "customer.registration.create", true);
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export function createCustomerRegistrationAdminRouter(
  service: CustomerRegistrationService,
  guard: Guard,
  audit: Audit,
) {
  const router = Router();
  router.get("/customer-registration-requests", ...guard("manage_customers"), async (_req, res, next) => {
    try { res.json(await service.list()); } catch (error) { next(error); }
  });
  router.get("/customer-registration-requests/:reviewId", ...guard("manage_customers"), async (req, res, next) => {
    try {
      const reviewId = registrationReviewIdSchema.parse(req.params.reviewId);
      const result = await service.get(reviewId);
      res.status(result ? 200 : 404).json(result ?? { error: "NOT_FOUND" });
    } catch (error) { next(error); }
  });
  router.post("/customer-registration-requests/:reviewId/approve", ...guard("manage_customers"), async (req, res, next) => {
    try {
      const reviewId = registrationReviewIdSchema.parse(req.params.reviewId);
      const administratorId = res.locals.auth.administrator.id as string;
      const result = await service.approve(reviewId, administratorId);
      await audit(req, "customer.registration.approve", !!result, administratorId, result ? undefined : "CONFLICT");
      res.status(result ? 200 : 409).json(result ?? { error: "REGISTRATION_CONFLICT" });
    } catch (error) { next(error); }
  });
  router.post("/customer-registration-requests/:reviewId/reject", ...guard("manage_customers"), async (req, res, next) => {
    try {
      const reviewId = registrationReviewIdSchema.parse(req.params.reviewId);
      const { reason } = registrationRejectionSchema.parse(req.body);
      const administratorId = res.locals.auth.administrator.id as string;
      const rejected = await service.reject(reviewId, administratorId, reason);
      await audit(req, "customer.registration.reject", rejected, administratorId, rejected ? undefined : "CONFLICT");
      res.status(rejected ? 204 : 409).end();
    } catch (error) { next(error); }
  });
  return router;
}
