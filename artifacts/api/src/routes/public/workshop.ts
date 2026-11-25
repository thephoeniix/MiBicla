import { Router } from "express";
import { workshopRequestSchema } from "@mi-bicla/api-contract";
import type { WorkshopService } from "../../services/workshop.service.js";
export function createWorkshopPublicRouter(s: WorkshopService) {
  const r = Router();
  r.use((_q, p, n) => {
    p.setHeader("X-Robots-Tag", "noindex, nofollow");
    p.setHeader("Cache-Control", "no-store");
    n();
  });
  r.post("/workshop/requests", async (q, p, n) => {
    try {
      if (
        (await s.rateLimit(q.ip ?? "unknown")) ||
        !(await s.publicRequestsEnabled())
      )
        return p.status(429).json({
          error: {
            code: "UNAVAILABLE",
            message: "No fue posible procesar la solicitud",
            requestId: p.locals.requestId,
          },
        });
      const x = await s.createRequest(workshopRequestSchema.parse(q.body));
      p.status(202).json({
        requestNumber: x?.requestNumber,
        status: "pending",
        publicUrl: x?.publicUrl,
      });
    } catch (e) {
      n(e);
    }
  });
  r.get("/workshop/catalog", async (_q, p, n) => {
    try { p.json(await s.publicCatalog()); } catch (e) { n(e); }
  });
  r.get("/workshop/availability", async (_q, p, n) => {
    try { p.json(await s.availability()); } catch (e) { n(e); }
  });
  r.get("/workshop/:token", async (q, p, n) => {
    try {
      if (await s.rateLimit(q.ip ?? "unknown", "tracking"))
        return p
          .status(429)
          .json({
            error: {
              code: "NOT_FOUND",
              message: "Seguimiento no disponible",
              requestId: p.locals.requestId,
            },
          });
      const x = await s.publicOrder(String(q.params.token));
      p.status(x ? 200 : 404).json(
        x ?? {
          error: {
            code: "NOT_FOUND",
            message: "Seguimiento no disponible",
            requestId: p.locals.requestId,
          },
        },
      );
    } catch (e) {
      n(e);
    }
  });
  return r;
}
