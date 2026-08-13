import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createManagedAdministratorSchema,
  managedAdministratorSchema,
  resetManagedAdministratorPasswordSchema,
  updateManagedAdministratorRoleSchema,
} from "@mi-bicla/api-contract";
import { buildAdministrativeUserPayload } from "../../artifacts/web/pages/admin/AdministrativeUsers.js";

describe("administrative users", () => {
  it("accepts only managed roles and strong passwords", () => {
    const input = createManagedAdministratorSchema.parse({
      name: "  Persona Admin  ",
      email: "admin@example.test",
      password: "Temporary-Password1!",
      role: "admin",
    });
    expect(input.name).toBe("Persona Admin");
    expect(() => createManagedAdministratorSchema.parse({ ...input, role: "owner" })).toThrow();
    expect(() => updateManagedAdministratorRoleSchema.parse({ role: "owner" })).toThrow();
    expect(() => resetManagedAdministratorPasswordSchema.parse({ newPassword: "debil" })).toThrow();
  });

  it("returns only safe administrator fields", () => {
    const parsed = managedAdministratorSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Admin",
      email: "admin@example.test",
      role: "employee",
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: "never-return-this",
    });
    expect(parsed).not.toHaveProperty("passwordHash");
    expect(parsed).not.toHaveProperty("emailNormalized");
  });

  it("builds a trimmed create payload and wires owner-only UI", () => {
    expect(buildAdministrativeUserPayload({
      name: "  Empleada  ",
      email: "  employee@example.test ",
      password: "Temporary-Password1!",
      role: "employee",
    })).toEqual({
      name: "Empleada",
      email: "employee@example.test",
      password: "Temporary-Password1!",
      role: "employee",
    });
    const shell = readFileSync("artifacts/web/components/AppShell.tsx", "utf8");
    const entry = readFileSync("artifacts/web/src.tsx", "utf8");
    expect(shell).toContain('href: "/admin/users"');
    expect(shell).toContain("ownerOnly: true");
    expect(entry).toContain('window.location.pathname === "/admin/users" && user.role === "owner"');
  });
});
