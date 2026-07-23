import { Router } from "express";
import type { BusinessSettingsService } from "../../services/business-settings.service.js";
export function createPublicBusinessSettingsRouter(
  service: BusinessSettingsService,
) {
  const router = Router();
  router.get("/business", async (_req, res) => {
    const data = await service.getPublicBusiness();
    res.status(data ? 200 : 404).json(data ?? { error: "NOT_CONFIGURED" });
  });
  router.get("/depositos", async (_req, res) => {
    res.json(await service.getPublicDeposits());
  });
  return router;
}
