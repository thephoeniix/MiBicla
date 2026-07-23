import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import {
  customerCreateSchema,
  customerListQuerySchema,
  customerScanTokenSchema,
  customerUpdateSchema,
  loyaltyAdjustmentSchema,
  loyaltySettingsSchema,
} from "@mi-bicla/api-contract";
import type { CustomersService } from "../../services/customers.service.js";
import type { LoyaltyService } from "../../services/loyalty.service.js";
type Guard = (
  p: string,
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
export function createPhase2AdminRouter(
  customers: CustomersService,
  loyalty: LoyaltyService,
  guard: Guard,
  audit: Audit,
) {
  const r = Router(),
    run =
      (fn: (req: Request, res: Response) => Promise<unknown>) =>
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          await fn(req, res);
        } catch (e) {
          next(e);
        }
      };
  r.get(
    "/customers",
    ...guard("view_customers"),
    run(async (req, res) =>
      res.json(await customers.list(customerListQuerySchema.parse(req.query))),
    ),
  );
  r.post(
    "/customers/resolve-token",
    ...guard("adjust_loyalty"),
    run(async (req, res) => {
      const { token } = customerScanTokenSchema.parse(req.body),
        result = await customers.resolvePublicToken(token);
      res.status(result ? 200 : 404).json(result ?? { error: "NOT_FOUND" });
    }),
  );
  r.post(
    "/customers",
    ...guard("manage_customers"),
    run(async (req, res) => {
      const admin = res.locals.auth.administrator.id,
        result = await customers.create(
          customerCreateSchema.parse(req.body),
          admin,
        );
      await audit(
        req,
        "customer.create",
        true,
        admin,
        undefined,
        {},
        result.customer.id,
      );
      res.status(201).json(result);
    }),
  );
  r.get(
    "/customers/:id",
    ...guard("view_customers"),
    run(async (req, res) => {
      const result = await customers.get(String(req.params.id));
      res.status(result ? 200 : 404).json(result ?? { error: "NOT_FOUND" });
    }),
  );
  r.put(
    "/customers/:id",
    ...guard("manage_customers"),
    run(async (req, res) => {
      const admin = res.locals.auth.administrator.id,
        result = await customers.update(
          String(req.params.id),
          customerUpdateSchema.parse(req.body),
          admin,
        );
      if (!result) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      await audit(
        req,
        "customer.update",
        true,
        admin,
        undefined,
        {},
        result.id,
      );
      res.json(result);
    }),
  );
  r.delete(
    "/customers/:id",
    ...guard("manage_customers"),
    run(async (req, res) => {
      const admin = res.locals.auth.administrator.id,
        id = String(req.params.id);
      if (!(await customers.remove(id, admin))) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      await audit(req, "customer.delete", true, admin, undefined, {}, id);
      res.status(204).end();
    }),
  );
  r.post(
    "/customers/:id/token",
    ...guard("manage_customers"),
    run(async (req, res) => {
      const admin = res.locals.auth.administrator.id,
        id = String(req.params.id),
        publicToken = await customers.regenerateToken(id);
      await audit(
        req,
        "customer.token.regenerate",
        true,
        admin,
        undefined,
        {},
        id,
      );
      res.json({ publicToken });
    }),
  );
  r.post(
    "/customers/:id/loyalty-adjustments",
    ...guard("adjust_loyalty"),
    run(async (req, res) => {
      const admin = res.locals.auth.administrator.id,
        id = String(req.params.id),
        input = loyaltyAdjustmentSchema.parse(req.body),
        result = await loyalty.adjust(id, input.units, admin);
      await audit(
        req,
        "loyalty.adjust",
        true,
        admin,
        undefined,
        { reason: input.reason, units: input.units },
        id,
      );
      res.json(result);
    }),
  );
  r.get(
    "/settings/loyalty",
    ...guard("view_loyalty"),
    run(async (_req, res) => res.json(await loyalty.settingsOrDefault())),
  );
  r.put(
    "/settings/loyalty",
    ...guard("manage_loyalty"),
    run(async (req, res) => {
      const admin = res.locals.auth.administrator.id,
        result = await loyalty.save(
          loyaltySettingsSchema.parse(req.body),
          admin,
        );
      await audit(req, "loyalty_settings.update", true, admin);
      res.json(result);
    }),
  );
  return r;
}
