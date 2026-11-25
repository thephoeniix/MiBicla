/* global URL, document, fetch, process, setTimeout, window */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const webRoot = path.join(repositoryRoot, "artifacts", "web");
const distRoot = path.join(webRoot, "dist");
const viteBin = path.join(webRoot, "node_modules", "vite", "bin", "vite.js");
const port = Number(process.env.PRERENDER_PORT || 4178);
const origin = `http://127.0.0.1:${port}`;
const routes = [
  "/",
  "/taller",
  "/productos",
  "/marcas",
  "/eventos",
];

const preview = spawn(
  process.execPath,
  [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: webRoot, stdio: ["ignore", "pipe", "pipe"] },
);

let previewOutput = "";
preview.stdout.on("data", (chunk) => { previewOutput += chunk; });
preview.stderr.on("data", (chunk) => { previewOutput += chunk; });

async function waitForPreview() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (preview.exitCode !== null)
      throw new Error(`Vite preview terminó antes de iniciar.\n${previewOutput}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // El proceso todavía está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite preview no respondió en ${origin}.\n${previewOutput}`);
}

let browser;
try {
  await waitForPreview();
  browser = await chromium.launch({ headless: true });
  for (const route of routes) {
    const page = await browser.newPage();
    await page.route("**/api/**", (request) => request.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "PRERENDER_API_UNAVAILABLE" }),
    }));
    await page.addInitScript(() => {
      window.__MB_APP_READY__ = false;
      window.addEventListener("mb:app-ready", () => {
        window.__MB_APP_READY__ = true;
      }, { once: true });
    });
    await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__MB_APP_READY__ === true, null, {
      timeout: 10_000,
    });
    await page.evaluate(() => document.getElementById("brand-preloader")?.remove());
    const html = await page.content();
    const outputDirectory = route === "/"
      ? distRoot
      : path.join(distRoot, route.slice(1));
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(path.join(outputDirectory, "index.html"), html, "utf8");
    await page.close();
    process.stdout.write(`Prerendered ${route}\n`);
  }
} finally {
  await browser?.close();
  preview.kill("SIGTERM");
}
