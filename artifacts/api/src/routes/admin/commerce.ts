import { Router, type NextFunction, type Request, type Response } from "express";
import express from "express";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  catalogRequestPatchSchema,
  eventCreateSchema,
  eventProductsUpdateSchema,
  eventUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
} from "@mi-bicla/api-contract";
import type { CommerceService } from "../../services/commerce.service.js";

type Guard = (permission: string) => Array<(req: Request, res: Response, next: NextFunction) => unknown>;
const idSchema = z.string().uuid();

export function createAdminCommerceRouter(service: CommerceService, guard: Guard, uploadDir: string, apiBaseUrl: string) {
  const router = Router();
  const run = (fn: (req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try { await fn(req, res); } catch (error) { next(error); }
    };
  const id = (req: Request) => idSchema.parse(req.params.id);
  const imageTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

  router.post("/commerce/uploads", ...guard("manage_products"), express.raw({ type: [...imageTypes.keys()], limit: "8mb" }), run(async (req, res) => {
    const extension = imageTypes.get(req.get("content-type")?.split(";")[0] ?? "");
    if (!extension || !Buffer.isBuffer(req.body) || req.body.length === 0)
      return res.status(400).json({ error: { code: "INVALID_IMAGE" } });
    await mkdir(uploadDir, { recursive: true });
    const filename = `${crypto.randomUUID()}.${extension}`;
    await writeFile(path.join(uploadDir, filename), req.body, { flag: "wx" });
    res.status(201).json({ url: new URL(`/api/uploads/${filename}`, apiBaseUrl).toString() });
  }));

  router.get("/commerce/products", ...guard("manage_products"), run(async (_req, res) => res.json(await service.listProducts())));
  router.post("/commerce/products", ...guard("manage_products"), run(async (req, res) => res.status(201).json(await service.createProduct(productCreateSchema.parse(req.body)))));
  router.put("/commerce/products/:id", ...guard("manage_products"), run(async (req, res) => {
    const result = await service.updateProduct(id(req), productUpdateSchema.parse(req.body));
    res.status(result ? 200 : 404).json(result ?? { error: { code: "NOT_FOUND" } });
  }));
  router.get("/commerce/events", ...guard("manage_events"), run(async (_req, res) => res.json(await service.listEvents())));
  router.post("/commerce/events", ...guard("manage_events"), run(async (req, res) => res.status(201).json(await service.createEvent(eventCreateSchema.parse(req.body)))));
  router.put("/commerce/events/:id", ...guard("manage_events"), run(async (req, res) => {
    const result = await service.updateEvent(id(req), eventUpdateSchema.parse(req.body));
    if (result === false) return res.status(400).json({ error: { code: "EVENT_DATE_ORDER" } });
    res.status(result ? 200 : 404).json(result ?? { error: { code: "NOT_FOUND" } });
  }));
  router.delete("/commerce/events/:id", ...guard("manage_events"), run(async (req, res) => {
    const deleted = await service.deleteEvent(id(req));
    res.status(deleted ? 204 : 404).end();
  }));
  router.put("/commerce/events/:id/products", ...guard("manage_events"), run(async (req, res) => {
    const result = await service.replaceEventProducts(id(req), eventProductsUpdateSchema.parse(req.body).productIds);
    if (result === null) return res.status(404).json({ error: { code: "NOT_FOUND" } });
    if (result === false) return res.status(400).json({ error: { code: "INVALID_PRODUCT_IDS" } });
    res.json({ productIds: result });
  }));
  router.get("/commerce/requests", ...guard("manage_catalog_requests"), run(async (_req, res) => res.json(await service.listRequests())));
  router.patch("/commerce/requests/:id", ...guard("manage_catalog_requests"), run(async (req, res) => {
    const result = await service.patchRequest(id(req), catalogRequestPatchSchema.parse(req.body));
    res.status(result ? 200 : 404).json(result ?? { error: { code: "NOT_FOUND" } });
  }));
  router.get("/dashboard", ...guard("view_reports"), run(async (_req, res) => res.json(await service.dashboard())));
  return router;
}
