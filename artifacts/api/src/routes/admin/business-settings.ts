import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  businessSettingsSchema,
  depositReorderSchema,
  depositSettingsSchema,
  depositStatusSchema,
} from "@mi-bicla/api-contract";
import type { BusinessSettingsService } from "../../services/business-settings.service.js";
type Guard = (
  permission: string,
) => Array<(req: Request, res: Response, next: NextFunction) => unknown>;
type Audit = (
  req: Request,
  action: string,
  success: boolean,
  administratorId?: string,
  entityId?: string,
) => Promise<unknown>;
export function createAdminBusinessSettingsRouter(
  service: BusinessSettingsService,
  guard: Guard,
  audit: Audit,
) {
  const router = Router();
  router.get("/", ...guard("view_business_settings"), async (_req, res) =>
    res.json(await service.getBusiness()),
  );
  router.put(
    "/",
    ...guard("manage_business_settings"),
    async (req, res, next) => {
      try {
        const id = res.locals.auth.administrator.id,
          result = await service.saveBusiness(
            businessSettingsSchema.parse(req.body),
            id,
          );
        await audit(req, "business_settings.update", true, id);
        res.json(result);
      } catch (e) {
        next(e);
      }
    },
  );
  router.get(
    "/deposits",
    ...guard("view_deposit_settings"),
    async (_req, res) => res.json(await service.listDepositsAdmin()),
  );
  router.post(
    "/deposits",
    ...guard("manage_deposit_settings"),
    async (req, res, next) => {
      try {
        const id = res.locals.auth.administrator.id,
          result = await service.createDeposit(
            depositSettingsSchema.parse(req.body),
            id,
          );
        await audit(req, "deposit_option.create", true, id, result.id);
        res.status(201).json(result);
      } catch (e) {
        next(e);
      }
    },
  );
  router.patch(
    "/deposits/reorder",
    ...guard("manage_deposit_settings"),
    async (req, res, next) => {
      try {
        const id = res.locals.auth.administrator.id,
          input = depositReorderSchema.parse(req.body),
          result = await service.reorderDeposits(input.items, id);
        await audit(req, "deposit_options.reorder", true, id);
        res.json(result);
      } catch (e) {
        next(e);
      }
    },
  );
  router.get(
    "/deposits/:id",
    ...guard("view_deposit_settings"),
    async (req, res) => {
      const result = await service.getDepositAdmin(String(req.params.id));
      res.status(result ? 200 : 404).json(result ?? { error: "NOT_FOUND" });
    },
  );
  router.put(
    "/deposits/:id",
    ...guard("manage_deposit_settings"),
    async (req, res, next) => {
      try {
        const id = res.locals.auth.administrator.id,
          result = await service.updateDeposit(
            String(req.params.id),
            depositSettingsSchema.parse(req.body),
            id,
          );
        if (!result) return res.status(404).json({ error: "NOT_FOUND" });
        await audit(req, "deposit_option.update", true, id, result.id);
        res.json(result);
      } catch (e) {
        next(e);
      }
    },
  );
  router.delete(
    "/deposits/:id",
    ...guard("manage_deposit_settings"),
    async (req, res, next) => {
      try {
        const id = res.locals.auth.administrator.id,
          deleted = await service.deleteDeposit(String(req.params.id));
        if (!deleted) return res.status(404).json({ error: "NOT_FOUND" });
        await audit(
          req,
          "deposit_option.delete",
          true,
          id,
          String(req.params.id),
        );
        res.status(204).end();
      } catch (e) {
        next(e);
      }
    },
  );
  router.patch(
    "/deposits/:id/status",
    ...guard("manage_deposit_settings"),
    async (req, res, next) => {
      try {
        const id = res.locals.auth.administrator.id,
          { isActive } = depositStatusSchema.parse(req.body),
          result = await service.setDepositStatus(
            String(req.params.id),
            isActive,
            id,
          );
        if (!result) return res.status(404).json({ error: "NOT_FOUND" });
        await audit(req, "deposit_option.status", true, id, result.id);
        res.json(result);
      } catch (e) {
        next(e);
      }
    },
  );
  return router;
}
