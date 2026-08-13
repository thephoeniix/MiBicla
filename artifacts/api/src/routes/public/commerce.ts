import { Router } from "express";
import {
  publicEventQuerySchema,
  publicProductQuerySchema,
} from "@mi-bicla/api-contract";
import type { CommerceService } from "../../services/commerce.service.js";

export function createPublicCommerceRouter(service: CommerceService) {
  const router = Router();
  router.get("/products", async (req, res, next) => {
    try {
      res.json(
        await service.listPublicProducts(
          publicProductQuerySchema.parse(req.query),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get("/events", async (req, res, next) => {
    try {
      res.json(
        await service.listPublicEvents(
          publicEventQuerySchema.parse(req.query).category,
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  return router;
}
