import { Router } from "express";
import type { CustomerAuthService } from "../services/customer-auth.service.js";
import type { CustomersService } from "../services/customers.service.js";
import type { PublicLinksService } from "../services/public-links.service.js";
import type { WorkshopService } from "../services/workshop.service.js";
import { z } from "zod";

const passwordSchema = z.string().min(12).max(128)
  .regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/);

export function createPublicLinksRouter(
  links: PublicLinksService,
  customers: CustomersService,
  workshop: WorkshopService,
  auth: CustomerAuthService,
) {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });
  router.get("/links/:code", async (req, res, next) => {
    try {
      const result = await links.resolveLink(String(req.params.code));
      if (result.state === "invalid" && await links.invalidResolutionLimited(req.ip ?? "unknown")) {
        return res.status(429).json({ state: "invalid", message: "Demasiados intentos. Inténtalo más tarde." });
      }
      if (result.state !== "active" || !result.link) {
        const messages = { invalid: "Enlace inválido.", expired: "Este enlace venció.", consumed: "Este enlace ya fue utilizado.", revoked: "Este enlace fue revocado." } as const;
        const state = result.state as keyof typeof messages;
        return res.status(state === "invalid" ? 404 : 410).json({ state, message: messages[state] });
      }
      const link = result.link;
      if (link.purpose === "workshop_tracking" && link.workshopOrderId) {
        const data = await workshop.publicOrderById(link.workshopOrderId);
        return res.status(data ? 200 : 410).json(data ? { state: "active", purpose: link.purpose, data } : { state: "revoked", message: "Seguimiento desactivado." });
      }
      if (link.purpose === "customer_card" && link.customerId) {
        const data = await customers.getPublicById(link.customerId);
        return res.status(data ? 200 : 410).json(data ? { state: "active", purpose: link.purpose, data } : { state: "revoked", message: "Tarjeta no disponible." });
      }
      if (link.purpose === "workshop_request" && link.workshopRequestId) {
        const data = await workshop.publicRequest(link.workshopRequestId);
        return res.status(data ? 200 : 404).json(data ? { state: "active", purpose: link.purpose, data } : { state: "invalid", message: "Solicitud no disponible." });
      }
      if (link.customerAuthTokenId) {
        const purpose = link.purpose === "password_recovery" ? "recovery" : "activation";
        const valid = await auth.validateTokenId(link.customerAuthTokenId, purpose);
        return res.status(valid ? 200 : 410).json(valid
          ? { state: "active", purpose: link.purpose }
          : { state: "consumed", purpose: link.purpose, message: purpose === "activation" ? "Tu cuenta ya fue activada o el enlace ya no está disponible." : "Este enlace ya no está disponible." });
      }
      return res.status(404).json({ state: "invalid", message: "Enlace inválido." });
    } catch (error) { next(error); }
  });
  router.post("/links/:code/password", async (req, res, next) => {
    try {
      const result = await links.resolveLink(String(req.params.code));
      if (result.state !== "active" || !result.link?.customerAuthTokenId) return res.status(410).json({ error: { code: "LINK_UNAVAILABLE", message: "El enlace ya no está disponible." } });
      const purpose = result.link.purpose === "password_recovery" ? "recovery" : "activation";
      const password = passwordSchema.parse(req.body?.password);
      const consumed = await auth.consumePasswordTokenId(result.link.customerAuthTokenId, password, purpose);
      if (!consumed) return res.status(410).json({ error: { code: "LINK_UNAVAILABLE", message: "El enlace ya no está disponible." } });
      await links.consume(result.link.id);
      res.status(204).end();
    } catch (error) { next(error); }
  });
  return router;
}
