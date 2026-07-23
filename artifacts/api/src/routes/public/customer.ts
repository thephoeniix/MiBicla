import { Router } from "express";
import type { CustomersService } from "../../services/customers.service.js";
export function createPublicCustomerRouter(service: CustomersService) {
  const r = Router();
  r.get("/customer/:token", async (req, res, next) => {
    try {
      const result = await service.getPublic(String(req.params.token));
      res.status(result ? 200 : 404).json(result ?? { error: "NOT_FOUND" });
    } catch (e) {
      next(e);
    }
  });
  return r;
}
