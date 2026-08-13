import { Router } from "express";
import {
  customerBicycleSchema,
  customerBicycleUpdateSchema,
  customerProfileUpdateSchema,
  customerPasswordChangeSchema,
  customerWorkshopRequestSchema,
} from "@mi-bicla/api-contract";
import type { CustomersService } from "../services/customers.service.js";
import type { WorkshopService } from "../services/workshop.service.js";
import type { CustomerGuard } from "./customer-auth.js";
import type { CustomerAuthService } from "../services/customer-auth.service.js";

export function createCustomerPortalRouter(
  customers: CustomersService,
  workshop: WorkshopService,
  auth: CustomerAuthService,
  appBaseUrl: string,
  requireCustomer: CustomerGuard,
) {
  const router = Router();
  router.use(requireCustomer, (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });
  const customerId = (res: Parameters<CustomerGuard>[1]) =>
    res.locals.customerAuth.customer.id as string;

  router.get("/loyalty", async (_req, res, next) => {
    try {
      const result = await customers.getLoyalty(customerId(res));
      res.status(result ? 200 : 404).json(result ?? { error: { code: "NOT_FOUND" } });
    } catch (error) { next(error); }
  });
  router.post("/card-link", async (_req, res, next) => {
    try {
      const token = await customers.regenerateToken(customerId(res));
      const cardUrl = new URL(`/c/${token}`, appBaseUrl).toString();
      res.status(201).json({ cardUrl });
    } catch (error) { next(error); }
  });
  router.get("/bicycles", async (_req, res, next) => {
    try { res.json(await workshop.listCustomerBicycles(customerId(res))); }
    catch (error) { next(error); }
  });
  router.post("/bicycles", async (req, res, next) => {
    try {
      const result = await workshop.createCustomerBicycle(
        customerId(res),
        customerBicycleSchema.parse(req.body),
      );
      res.status(201).json(result);
    } catch (error) { next(error); }
  });
  router.patch("/bicycles/:id", async (req, res, next) => {
    try {
      const result = await workshop.updateCustomerBicycle(
        customerId(res),
        String(req.params.id),
        customerBicycleUpdateSchema.parse(req.body),
      );
      res.status(result ? 200 : 404).json(result ?? { error: { code: "NOT_FOUND" } });
    } catch (error) { next(error); }
  });
  router.patch("/profile", async (req, res, next) => {
    try {
      const result = await customers.updateProfile(
        customerId(res),
        customerProfileUpdateSchema.parse(req.body),
      );
      res.status(result ? 200 : 404).json(result ?? { error: { code: "NOT_FOUND" } });
    } catch (error) { next(error); }
  });
  router.post("/password", async (req, res, next) => {
    try {
      const input = customerPasswordChangeSchema.parse(req.body);
      const match = res.locals.customerAuth;
      const changed = await auth.changePassword(
        match.credential.id,
        match.session.id,
        input.currentPassword,
        input.newPassword,
      );
      res.status(changed ? 204 : 400).end();
    } catch (error) { next(error); }
  });
  router.get("/workshop-requests", async (_req, res, next) => {
    try { res.json(await workshop.listCustomerRequests(customerId(res))); }
    catch (error) { next(error); }
  });
  router.post("/workshop-requests", async (req, res, next) => {
    try {
      const result = await workshop.createCustomerWorkshopRequest(
        customerId(res),
        customerWorkshopRequestSchema.parse(req.body),
      );
      res.status(result ? 202 : 404).json(result ?? { error: { code: "NOT_FOUND" } });
    } catch (error) { next(error); }
  });
  router.get("/orders", async (_req, res, next) => {
    try { res.json(await workshop.listCustomerOrders(customerId(res))); }
    catch (error) { next(error); }
  });
  router.get("/orders/:orderNumber", async (req, res, next) => {
    try {
      const result = await workshop.getCustomerOrder(
        customerId(res),
        String(req.params.orderNumber),
      );
      res.status(result ? 200 : 404).json(result ?? {
        error: { code: "NOT_FOUND", message: "Orden no disponible" },
      });
    } catch (error) { next(error); }
  });
  return router;
}
