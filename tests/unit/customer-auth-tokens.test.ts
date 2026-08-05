import { describe, expect, it } from "vitest";
import {
  ACTIVATION_TTL_MS,
  RECOVERY_TTL_MS,
} from "../../artifacts/api/src/services/customer-auth-tokens";

describe("vigencia de tokens de activación/recuperación", () => {
  it("activación dura 24 horas, distinta de recuperación (15 minutos)", () => {
    expect(ACTIVATION_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(RECOVERY_TTL_MS).toBe(15 * 60 * 1000);
    expect(ACTIVATION_TTL_MS).not.toBe(RECOVERY_TTL_MS);
  });
});
