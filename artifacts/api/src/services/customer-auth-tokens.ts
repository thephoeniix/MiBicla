import { and, eq, isNull } from "drizzle-orm";
import { customerAuthTokens, type createDatabase } from "@mi-bicla/db";
import { generateSessionToken, hashSessionToken } from "@mi-bicla/shared";
import type { CustomerAuthPurpose } from "@mi-bicla/api-contract";

type Db = ReturnType<typeof createDatabase>["db"];
export type CustomerAuthTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export const ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;
export const RECOVERY_TTL_MS = 15 * 60 * 1000;

// Único lugar que emite un token de activación/recuperación. Revoca
// cualquier token previo sin consumir de ese mismo propósito, genera el
// token crudo una sola vez, guarda solo su hash, y devuelve el crudo
// exclusivamente para que quien llama arme la respuesta inmediata (enlace o
// wa.me) — nunca se registra en logs ni se persiste en texto plano. Debe
// ejecutarse dentro de una transacción (recibe `tx`, no `db`), para que
// revocar+crear sea atómico junto con lo que haga el llamador (aprobar una
// solicitud, vincular un cliente, etc.).
export async function issueCustomerAuthToken(
  tx: CustomerAuthTx,
  params: {
    credentialId: string;
    purpose: CustomerAuthPurpose;
    administratorId: string;
  },
): Promise<{ token: string; expiresAt: Date }> {
  const now = new Date();
  await tx
    .update(customerAuthTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(customerAuthTokens.credentialId, params.credentialId),
        eq(customerAuthTokens.purpose, params.purpose),
        isNull(customerAuthTokens.consumedAt),
        isNull(customerAuthTokens.revokedAt),
      ),
    );
  const token = generateSessionToken();
  const expiresAt = new Date(
    now.getTime() +
      (params.purpose === "activation" ? ACTIVATION_TTL_MS : RECOVERY_TTL_MS),
  );
  await tx.insert(customerAuthTokens).values({
    credentialId: params.credentialId,
    purpose: params.purpose,
    tokenHash: hashSessionToken(token),
    expiresAt,
    createdBy: params.administratorId,
    createdAt: now,
  });
  return { token, expiresAt };
}
