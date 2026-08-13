import { and, asc, eq, isNull } from "drizzle-orm";
import {
  administrators,
  roles,
  sessions,
  type createDatabase,
} from "@mi-bicla/db";
import { hashPassword, normalizeEmail } from "@mi-bicla/shared";
import type {
  CreateManagedAdministratorInput,
  ManagedAdministratorRole,
} from "@mi-bicla/api-contract";

type Db = ReturnType<typeof createDatabase>["db"];

export class AdministratorManagementError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class AdministratorsService {
  constructor(private db: Db) {}

  list() {
    return this.db
      .select({
        id: administrators.id,
        name: administrators.name,
        email: administrators.email,
        role: roles.name,
        isActive: administrators.isActive,
        lastLoginAt: administrators.lastLoginAt,
        createdAt: administrators.createdAt,
        updatedAt: administrators.updatedAt,
      })
      .from(administrators)
      .innerJoin(roles, eq(administrators.roleId, roles.id))
      .where(isNull(administrators.deletedAt))
      .orderBy(asc(administrators.name));
  }

  async create(input: CreateManagedAdministratorInput) {
    const emailNormalized = normalizeEmail(input.email);
    const [existing] = await this.db
      .select({ id: administrators.id })
      .from(administrators)
      .where(eq(administrators.emailNormalized, emailNormalized))
      .limit(1);
    if (existing)
      throw new AdministratorManagementError(
        409,
        "ADMINISTRATOR_EMAIL_CONFLICT",
        "Ya existe una cuenta con ese correo",
      );
    const [role] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, input.role))
      .limit(1);
    if (!role) throw new Error("Rol administrativo no configurado");
    let created: { id: string } | undefined;
    try {
      [created] = await this.db
        .insert(administrators)
        .values({
          roleId: role.id,
          name: input.name,
          email: input.email.trim(),
          emailNormalized,
          passwordHash: await hashPassword(input.password),
        })
        .returning({ id: administrators.id });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505")
        throw new AdministratorManagementError(
          409,
          "ADMINISTRATOR_EMAIL_CONFLICT",
          "Ya existe una cuenta con ese correo",
        );
      throw error;
    }
    if (!created) throw new Error("No se pudo crear la cuenta");
    return this.get(created.id);
  }

  async setRole(actorId: string, targetId: string, roleName: ManagedAdministratorRole) {
    this.assertNotSelf(actorId, targetId);
    return this.db.transaction(async (tx) => {
      const target = await this.getManagedTarget(tx, targetId);
      const [role] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, roleName))
        .limit(1);
      if (!role) throw new Error("Rol administrativo no configurado");
      await tx
        .update(administrators)
        .set({ roleId: role.id, updatedAt: new Date() })
        .where(eq(administrators.id, target.id));
      await this.revokeSessions(tx, target.id, "role_changed");
      return this.get(target.id, tx);
    });
  }

  async setStatus(actorId: string, targetId: string, isActive: boolean) {
    this.assertNotSelf(actorId, targetId);
    return this.db.transaction(async (tx) => {
      const target = await this.getManagedTarget(tx, targetId);
      await tx
        .update(administrators)
        .set({
          isActive,
          failedLoginCount: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(administrators.id, target.id));
      if (!isActive)
        await this.revokeSessions(tx, target.id, "administrator_deactivated");
      return this.get(target.id, tx);
    });
  }

  async resetPassword(actorId: string, targetId: string, newPassword: string) {
    this.assertNotSelf(actorId, targetId);
    return this.db.transaction(async (tx) => {
      const target = await this.getManagedTarget(tx, targetId);
      await tx
        .update(administrators)
        .set({
          passwordHash: await hashPassword(newPassword),
          failedLoginCount: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(administrators.id, target.id));
      await this.revokeSessions(tx, target.id, "password_reset");
      return this.get(target.id, tx);
    });
  }

  private assertNotSelf(actorId: string, targetId: string) {
    if (actorId === targetId)
      throw new AdministratorManagementError(
        409,
        "ADMINISTRATOR_SELF_ACTION",
        "No puedes aplicar esta acción a tu propia cuenta",
      );
  }

  private async getManagedTarget(db: Db | Parameters<Parameters<Db["transaction"]>[0]>[0], id: string) {
    const target = await this.get(id, db);
    if (!target)
      throw new AdministratorManagementError(404, "ADMINISTRATOR_NOT_FOUND", "Cuenta no encontrada");
    if (target.role === "owner")
      throw new AdministratorManagementError(
        409,
        "OWNER_ACCOUNT_PROTECTED",
        "Las cuentas owner no se modifican desde este módulo",
      );
    return target;
  }

  private async revokeSessions(
    db: Db | Parameters<Parameters<Db["transaction"]>[0]>[0],
    administratorId: string,
    reason: string,
  ) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date(), revokeReason: reason })
      .where(
        and(
          eq(sessions.administratorId, administratorId),
          isNull(sessions.revokedAt),
        ),
      );
  }

  private async get(
    id: string,
    db: Db | Parameters<Parameters<Db["transaction"]>[0]>[0] = this.db,
  ) {
    const [row] = await db
      .select({
        id: administrators.id,
        name: administrators.name,
        email: administrators.email,
        role: roles.name,
        isActive: administrators.isActive,
        lastLoginAt: administrators.lastLoginAt,
        createdAt: administrators.createdAt,
        updatedAt: administrators.updatedAt,
      })
      .from(administrators)
      .innerJoin(roles, eq(administrators.roleId, roles.id))
      .where(and(eq(administrators.id, id), isNull(administrators.deletedAt)))
      .limit(1);
    return row ?? null;
  }
}
