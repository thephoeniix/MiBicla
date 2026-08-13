import { Router } from "express";
import { catalogRequestCreateSchema } from "@mi-bicla/api-contract";
import type { CommerceService } from "../services/commerce.service.js";
import type { CustomerGuard } from "./customer-auth.js";

export function createCustomerCommerceRouter(
  service: CommerceService,
  requireCustomer: CustomerGuard,
) {
  const router = Router();
  router.use(requireCustomer, (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  const customerId = (res: Parameters<CustomerGuard>[1]) =>
    res.locals.customerAuth.customer.id as string;
  router.get("/requests", async (_req, res, next) => {
    try {
      res.json(await service.listCustomerRequests(customerId(res)));
    } catch (error) {
      next(error);
    }
  });
  router.post("/requests", async (req, res, next) => {
    try {
      const result = await service.createRequest(
        customerId(res),
        catalogRequestCreateSchema.parse(req.body),
      );
      if (result === false)
        return res.status(400).json({
          error: {
            code: "INVALID_PRODUCT_VARIANT",
            message: "Selecciona una talla y un color disponibles.",
          },
        });
      res
        .status(result ? 201 : 404)
        .json(result ?? { error: { code: "CATALOG_REFERENCE_NOT_FOUND" } });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
