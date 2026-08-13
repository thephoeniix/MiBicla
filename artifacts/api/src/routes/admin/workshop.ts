import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  bicycleSchema,
  bicycleUpdateSchema,
  workshopConvertSchema,
  workshopOrderSchema,
  workshopOrderUpdateSchema,
  workshopPartSchema,
  workshopRequestStatusSchema,
  workshopServiceSchema,
  workshopServiceCatalogSchema,
  workshopSettingsSchema,
  workshopStatusSchema,
  workshopUpdateSchema,
  workshopWhatsappSchema,
  agreementSchema,
  affiliationReviewSchema,
  teamSchema,
  workshopAgreementApplicationSchema,
  workshopFavorApplicationSchema,
  workshopMovementReversalSchema,
  workshopMovementSchema,
  workshopRefundSchema,
} from "@mi-bicla/api-contract";
import type { WorkshopService } from "../../services/workshop.service.js";
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
export function createWorkshopAdminRouter(
  s: WorkshopService,
  guard: Guard,
  audit: Audit,
  baseUrl: string,
) {
  const r = Router(),
    run =
      (fn: (q: Request, p: Response) => Promise<unknown>) =>
      async (q: Request, p: Response, n: NextFunction) => {
        try {
          await fn(q, p);
        } catch (e) {
          n(e);
        }
      },
    aid = (p: Response) => p.locals.auth.administrator.id,
    id = (q: Request, key = "id") => String(q.params[key]);
  const pricingGuard = Router().use(...guard("manage_workshop_pricing"));
  const requirePricingForPriceChanges = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const body = req.body;
    if (
      !body ||
      typeof body !== "object" ||
      (!("quantity" in body) && !("unitPriceCents" in body))
    )
      return next();
    pricingGuard(req, res, next);
  };
  const financeAudit = (q: Request) => ({ requestId: q.res!.locals.requestId as string, ipAddress: q.ip, userAgent: q.get("user-agent") });
  r.get(
    "/bicycles",
    ...guard("view_bicycles"),
    run(async (q, p) =>
      p.json(
        await s.listBicycles(
          typeof q.query.customerId === "string"
            ? q.query.customerId
            : undefined,
        ),
      ),
    ),
  );
  r.get("/workshop/teams", ...guard("manage_workshop_agreements"), run(async (q, p) => p.json(await s.listTeams(q.query.includeInactive === "true"))));
  r.post("/workshop/teams", ...guard("manage_workshop_agreements"), run(async (q, p) => p.status(201).json(await s.createTeam(teamSchema.parse(q.body), aid(p)))));
  r.put("/workshop/teams/:id", ...guard("manage_workshop_agreements"), run(async (q, p) => p.json(await s.updateTeam(id(q), teamSchema.partial().parse(q.body), aid(p)))));
  r.get("/workshop/agreements", ...guard("manage_workshop_agreements"), run(async (q, p) => p.json(await s.listAgreements(q.query.includeInactive === "true"))));
  r.post("/workshop/agreements", ...guard("manage_workshop_agreements"), run(async (q, p) => p.status(201).json(await s.createAgreement(agreementSchema.parse(q.body), aid(p)))));
  r.put("/workshop/agreements/:id", ...guard("manage_workshop_agreements"), run(async (q, p) => p.json(await s.updateAgreement(id(q), agreementSchema.innerType().partial().parse(q.body), aid(p)))));
  r.get("/workshop/affiliations", ...guard("manage_workshop_agreements"), run(async (q, p) => p.json(await s.listAffiliations(typeof q.query.status === "string" ? q.query.status : undefined))));
  r.patch("/workshop/affiliations/:id", ...guard("manage_workshop_agreements"), run(async (q, p) => { const input = affiliationReviewSchema.parse(q.body); p.json(await s.reviewAffiliation(id(q), input.status, input.evidenceNote, aid(p))); }));
  r.get(
    "/workshop/service-catalog",
    ...guard("view_workshop_orders"),
    run(async (_q, p) => p.json(await s.listServiceCatalog())),
  );
  r.get("/workshop/orders/:id/movements", ...guard("view_workshop_financials"), run(async (q, p) => p.json(await s.listFinancialMovements(id(q)))));
  r.post("/workshop/orders/:id/movements", ...guard("manage_workshop_financials"), run(async (q, p) => p.status(201).json(await s.createFinancialMovement(id(q), workshopMovementSchema.parse(q.body), aid(p), financeAudit(q)))));
  r.post("/workshop/movements/:id/reverse", ...guard("manage_workshop_financials"), run(async (q, p) => { const input = workshopMovementReversalSchema.parse(q.body); p.status(201).json(await s.reverseFinancialMovement(id(q), input.reason, aid(p), financeAudit(q))); }));
  r.post("/workshop/orders/:id/apply-favor", ...guard("manage_workshop_financials"), run(async (q, p) => { const input = workshopFavorApplicationSchema.parse(q.body); p.status(201).json(await s.applyFavor(id(q), input.targetOrderId, input.amountCents, input.occurredDate, input.note, aid(p), financeAudit(q))); }));
  r.post("/workshop/orders/:id/refund-favor", ...guard("manage_workshop_financials"), run(async (q, p) => p.status(201).json(await s.refundFavor(id(q), workshopRefundSchema.parse(q.body), aid(p), financeAudit(q)))));
  r.post("/workshop/orders/:id/agreement", ...guard("manage_workshop_agreements"), run(async (q, p) => { const input = workshopAgreementApplicationSchema.parse(q.body); p.status(201).json(await s.applyAgreement(id(q), input.agreementId, input.occurredDate, aid(p), financeAudit(q))); }));
  r.post(
    "/workshop/service-catalog",
    ...guard("manage_workshop_services"),
    run(async (q, p) => {
      const row = await s.createCatalogService(
        workshopServiceCatalogSchema.parse(q.body),
        aid(p),
      );
      await audit(
        q,
        "workshop.service_catalog.create",
        true,
        aid(p),
        undefined,
        {},
        row?.id,
      );
      p.status(201).json(row);
    }),
  );
  r.put(
    "/workshop/service-catalog/:id",
    ...guard("manage_workshop_services"),
    run(async (q, p) =>
      p.json(
        await s.updateCatalogService(
          id(q),
          workshopServiceCatalogSchema.partial().parse(q.body) as never,
          aid(p),
        ),
      ),
    ),
  );
  r.delete(
    "/workshop/service-catalog/:id",
    ...guard("manage_workshop_services"),
    run(async (q, p) =>
      p.json({ result: await s.deleteCatalogService(id(q), aid(p)) }),
    ),
  );
  r.get(
    "/workshop/technicians",
    ...guard("view_workshop_orders"),
    run(async (_q, p) => p.json(await s.listTechnicians())),
  );
  r.post(
    "/bicycles",
    ...guard("manage_bicycles"),
    run(async (q, p) => {
      const x = await s.createBicycle(bicycleSchema.parse(q.body), aid(p));
      await audit(q, "bicycle.create", true, aid(p), undefined, {}, x?.id);
      p.status(201).json(x);
    }),
  );
  r.get(
    "/bicycles/:id",
    ...guard("view_bicycles"),
    run(async (q, p) => p.json(await s.getBicycle(id(q)))),
  );
  r.put(
    "/bicycles/:id",
    ...guard("manage_bicycles"),
    run(async (q, p) =>
      p.json(
        await s.updateBicycle(
          id(q),
          bicycleUpdateSchema.parse(q.body) as never,
          aid(p),
        ),
      ),
    ),
  );
  r.delete(
    "/bicycles/:id",
    ...guard("manage_bicycles"),
    run(async (q, p) => {
      await s.deleteBicycle(id(q), aid(p));
      await audit(q, "bicycle.delete", true, aid(p), undefined, {}, id(q));
      p.status(204).end();
    }),
  );
  r.get(
    "/customers/:customerId/bicycles",
    ...guard("view_bicycles"),
    run(async (q, p) => p.json(await s.listBicycles(id(q, "customerId")))),
  );
  r.get(
    "/workshop/requests",
    ...guard("view_workshop_requests"),
    run(async (_q, p) => p.json(await s.listRequests())),
  );
  r.get(
    "/workshop/requests/:id",
    ...guard("view_workshop_requests"),
    run(async (q, p) => p.json(await s.getRequest(id(q)))),
  );
  r.patch(
    "/workshop/requests/:id/status",
    ...guard("manage_workshop_requests"),
    run(async (q, p) => {
      const x = workshopRequestStatusSchema.parse(q.body),
        row = await s.requestStatus(id(q), x.status, aid(p), x.rejectionReason);
      await audit(
        q,
        "workshop.request.status",
        true,
        aid(p),
        undefined,
        { status: x.status },
        id(q),
      );
      p.json(row);
    }),
  );
  r.post(
    "/workshop/requests/:id/convert",
    ...guard("create_workshop_orders"),
    run(async (q, p) => {
      const x = await s.convertRequest(
        id(q),
        workshopConvertSchema.parse(q.body) as never,
        aid(p),
      );
      await audit(
        q,
        "workshop.request.convert",
        true,
        aid(p),
        undefined,
        {},
        x.order.id,
      );
      p.status(201).json(x);
    }),
  );
  r.get(
    "/workshop/orders",
    ...guard("view_workshop_orders"),
    run(async (_q, p) => p.json(await s.listOrders())),
  );
  r.post(
    "/workshop/orders",
    ...guard("create_workshop_orders"),
    run(async (q, p) => {
      const x = await s.createOrder(workshopOrderSchema.parse(q.body), aid(p));
      await audit(
        q,
        "workshop.order.create",
        true,
        aid(p),
        undefined,
        {},
        x.order.id,
      );
      p.status(201).json(x);
    }),
  );
  r.get(
    "/workshop/orders/:id",
    ...guard("view_workshop_orders"),
    run(async (q, p) => p.json(await s.getOrder(id(q)))),
  );
  r.get(
    "/workshop/orders/:id/financials",
    ...guard("view_workshop_financials"),
    run(async (q, p) => p.json(await s.getOrder(id(q), true))),
  );
  r.put(
    "/workshop/orders/:id",
    ...guard("update_workshop_orders"),
    run(async (q, p) =>
      p.json(
        await s.updateOrder(
          id(q),
          workshopOrderUpdateSchema.parse(q.body),
          aid(p),
        ),
      ),
    ),
  );
  r.patch(
    "/workshop/orders/:id/status",
    ...guard("manage_workshop_status"),
    run(async (q, p) => {
      const x = workshopStatusSchema.parse(q.body),
        result = await s.status(
          id(q),
          x,
          aid(p),
          p.locals.auth.role.name === "owner",
        );
      await audit(
        q,
        "workshop.order.status",
        true,
        aid(p),
        x.internalReason ?? undefined,
        { status: x.status },
        id(q),
      );
      p.json(result);
    }),
  );
  function lines(kind: "services" | "parts") {
    const permission =
        kind === "services"
          ? "manage_workshop_services"
          : "manage_workshop_parts",
      schema = kind === "services" ? workshopServiceSchema : workshopPartSchema;
    r.post(
      `/workshop/orders/:id/${kind}`,
      ...guard(permission),
      ...guard("manage_workshop_pricing"),
      run(async (q, p) => {
        const value = schema.parse(q.body),
          row =
            kind === "services"
              ? await s.addService(id(q), value as never)
              : await s.addPart(id(q), value as never);
        await audit(
          q,
          `workshop.${kind}.create`,
          true,
          aid(p),
          undefined,
          {},
          row?.id,
        );
        p.status(201).json(row);
      }),
    );
    r.put(
      `/workshop/orders/:id/${kind}/:lineId`,
      ...guard(permission),
      requirePricingForPriceChanges,
      run(async (q, p) => {
        const value = schema.partial().parse(q.body);
        const row =
            kind === "services"
              ? await s.updateService(id(q, "lineId"), value as never)
              : await s.updatePart(id(q, "lineId"), value as never);
        p.json(row);
      }),
    );
    r.delete(
      `/workshop/orders/:id/${kind}/:lineId`,
      ...guard(permission),
      ...guard("manage_workshop_pricing"),
      run(async (q, p) => {
        if (kind === "services") await s.deleteService(id(q, "lineId"));
        else await s.deletePart(id(q, "lineId"));
        p.status(204).end();
      }),
    );
  }
  lines("services");
  lines("parts");
  r.post(
    "/workshop/orders/:id/updates",
    ...guard("publish_workshop_updates"),
    run(async (q, p) => {
      const row = await s.addUpdate(
        id(q),
        workshopUpdateSchema.parse(q.body),
        aid(p),
      );
      await audit(
        q,
        "workshop.update.publish",
        true,
        aid(p),
        undefined,
        {},
        row?.id,
      );
      p.status(201).json(row);
    }),
  );
  r.put(
    "/workshop/orders/:id/updates/:updateId",
    ...guard("publish_workshop_updates"),
    run(async (q, p) =>
      p.json(
        await s.updateUpdate(
          id(q, "updateId"),
          workshopUpdateSchema.partial().parse(q.body) as never,
        ),
      ),
    ),
  );
  r.delete(
    "/workshop/orders/:id/updates/:updateId",
    ...guard("publish_workshop_updates"),
    run(async (q, p) => {
      await s.deleteUpdate(id(q, "updateId"));
      p.status(204).end();
    }),
  );
  r.post(
    "/workshop/orders/:id/regenerate-token",
    ...guard("update_workshop_orders"),
    run(async (q, p) => {
      const token = await s.regenerateToken(id(q));
      await audit(
        q,
        "workshop.token.regenerate",
        true,
        aid(p),
        undefined,
        {},
        id(q),
      );
      p.json({ publicToken: token, publicUrl: new URL(`/l/${token}`, baseUrl).toString() });
    }),
  );
  r.post(
    "/workshop/orders/:id/whatsapp",
    ...guard("notify_workshop_customers"),
    run(async (q, p) => {
      workshopWhatsappSchema.parse(q.body);
      const x = await s.whatsapp(id(q), aid(p), baseUrl);
      await audit(
        q,
        "workshop.whatsapp.open",
        true,
        aid(p),
        undefined,
        {},
        id(q),
      );
      p.json(x);
    }),
  );
  r.post(
    "/workshop/orders/:id/mark-delivered",
    ...guard("manage_workshop_status"),
    run(async (q, p) => {
      const x = await s.status(
        id(q),
        {
          status: "delivered",
          publicMessage: "Bicicleta entregada",
          internalReason: null,
          customerVisible: true,
          force: false,
        },
        aid(p),
        false,
      );
      await audit(
        q,
        "workshop.order.delivered",
        true,
        aid(p),
        undefined,
        {},
        id(q),
      );
      p.json(x);
    }),
  );
  r.get(
    "/settings/workshop",
    ...guard("manage_workshop_settings"),
    run(async (_q, p) => p.json(await s.getSettings())),
  );
  r.put(
    "/settings/workshop",
    ...guard("manage_workshop_settings"),
    run(async (q, p) => {
      const row = await s.saveSettings(
        workshopSettingsSchema.parse(q.body),
        aid(p),
      );
      await audit(q, "workshop.settings.update", true, aid(p));
      p.json(row);
    }),
  );
  return r;
}
