import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { localCommerceUploadPath } from "../../artifacts/api/src/services/commerce.service";

const FILENAME = "279ed68c-035d-4e24-bfdd-1e869af84506.jpg";

describe("limpieza de eventos vencidos", () => {
  it("reconoce únicamente archivos generados dentro de uploads", () => {
    const storage = { uploadDir: "/var/lib/mibicla/uploads" };
    expect(
      localCommerceUploadPath(
        `http://192.168.100.21:3000/api/uploads/${FILENAME}`,
        storage,
      ),
    ).toBe(path.join(storage.uploadDir, FILENAME));
    expect(
      localCommerceUploadPath(
        "https://example.com/images/evento.jpg",
        storage,
      ),
    ).toBeNull();
    expect(
      localCommerceUploadPath(
        "https://example.com/api/uploads/../../evento.jpg",
        storage,
      ),
    ).toBeNull();
  });

  it("elimina el registro vencido y después limpia su imagen sin uso", () => {
    const service = readFileSync(
      new URL(
        "../../artifacts/api/src/services/commerce.service.ts",
        import.meta.url,
      ),
      "utf8",
    );
    expect(service).toContain("deleteExpiredEvents");
    expect(service).toContain("startsAt} + interval '24 hours'");
    expect(service).toContain(".delete(events)");
    expect(service).toContain("removeUnusedImages");
    expect(service).toContain("await unlink(file)");
    expect(service).toContain("inArray(products.imageUrl, candidates)");
  });

  it("ejecuta mantenimiento periódico además de limpiar durante consultas", () => {
    const index = readFileSync(
      new URL("../../artifacts/api/src/index.ts", import.meta.url),
      "utf8",
    );
    const routes = readFileSync(
      new URL(
        "../../artifacts/api/src/routes/admin/commerce.ts",
        import.meta.url,
      ),
      "utf8",
    );
    expect(index).toContain("setInterval(cleanExpiredEvents, 15 * 60 * 1000)");
    expect(routes).toContain('router.delete("/commerce/events/:id"');
  });
});
