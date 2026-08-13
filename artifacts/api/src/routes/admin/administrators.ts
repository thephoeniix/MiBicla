import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import {
  createManagedAdministratorSchema,
  managedAdministratorSchema,
  resetManagedAdministratorPasswordSchema,
  updateManagedAdministratorRoleSchema,
  updateManagedAdministratorStatusSchema,
} from "@mi-bicla/api-contract";
import {
  AdministratorManagementError,
  type AdministratorsService,
} from "../../services/administrators.service.js";

type OwnerGuard = Array<
  (req: Request, res: Response, next: NextFunction) => unknown
>;
type Audit = (
  req: Request,
  action: string,
  success: boolean,
  administratorId?: string,
  reason?: string,
  metadata?: unknown,
) => Promise<unknown>;
const idSchema = z.string().uuid();

export function createAdministratorsAdminRouter(
  service: AdministratorsService,
  ownerGuard: OwnerGuard,
  audit: Audit,
) {
  const router = Router();
  const run = (
    handler: (req: Request, res: Response) => Promise<unknown>,
  ) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof AdministratorManagementError)
        return res.status(error.status).json({
          error: {
            code: error.code,
            message: error.message,
            requestId: res.locals.requestId,
          },
        });
      next(error);
    }
  };

  router.get(
    "/administrators",
    ...ownerGuard,
    run(async (_req, res) => {
      res.json(managedAdministratorSchema.array().parse(await service.list()));
    }),
  );
  router.post(
    "/administrators",
    ...ownerGuard,
    run(async (req, res) => {
      const actorId = res.locals.auth.administrator.id;
      const input = createManagedAdministratorSchema.parse(req.body);
      const created = await service.create(input);
      await audit(req, "administrator.create", true, actorId, undefined, {
        role: input.role,
      });
      res.status(201).json(managedAdministratorSchema.parse(created));
    }),
  );
  router.patch(
    "/administrators/:id/role",
    ...ownerGuard,
    run(async (req, res) => {
      const actorId = res.locals.auth.administrator.id;
      const targetId = idSchema.parse(req.params.id);
      const input = updateManagedAdministratorRoleSchema.parse(req.body);
      const updated = await service.setRole(actorId, targetId, input.role);
      await audit(req, "administrator.role_change", true, actorId, undefined, {
        role: input.role,
      });
      res.json(managedAdministratorSchema.parse(updated));
    }),
  );
  router.patch(
    "/administrators/:id/status",
    ...ownerGuard,
    run(async (req, res) => {
      const actorId = res.locals.auth.administrator.id;
      const targetId = idSchema.parse(req.params.id);
      const input = updateManagedAdministratorStatusSchema.parse(req.body);
      const updated = await service.setStatus(actorId, targetId, input.isActive);
      await audit(req, "administrator.status_change", true, actorId, undefined, {
        isActive: input.isActive,
      });
      res.json(managedAdministratorSchema.parse(updated));
    }),
  );
  router.post(
    "/administrators/:id/password/reset",
    ...ownerGuard,
    run(async (req, res) => {
      const actorId = res.locals.auth.administrator.id;
      const targetId = idSchema.parse(req.params.id);
      const input = resetManagedAdministratorPasswordSchema.parse(req.body);
      const updated = await service.resetPassword(actorId, targetId, input.newPassword);
      await audit(req, "administrator.password_reset", true, actorId);
      res.json(managedAdministratorSchema.parse(updated));
    }),
  );
  return router;
}
