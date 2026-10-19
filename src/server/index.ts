import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import express from "express";
import { createApp } from "./app.js";
import { openDatabase } from "./db.js";
const port = Number(process.env.PORT || 4100),
  host = process.env.HOST || "127.0.0.1";
if (
  process.env.ENABLE_DEMO_FAULTS === "true" &&
  !["127.0.0.1", "localhost", "::1"].includes(host) &&
  !process.env.SANDBOX_TOKEN
)
  throw new Error("Network demo faults require SANDBOX_TOKEN.");
const db = openDatabase(
  process.env.DATABASE_PATH || resolve("data/company-a.sqlite"),
);
const app = createApp(db, {
  demoFaults: process.env.ENABLE_DEMO_FAULTS === "true",
  sandboxToken: process.env.SANDBOX_TOKEN,
});
let vite: { close: () => Promise<void> } | undefined;
const client = fileURLToPath(new URL("../client", import.meta.url));
if (existsSync(resolve(client, "index.html"))) {
  app.use(express.static(client));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(resolve(client, "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const server = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  vite = server;
  app.use(server.middlewares);
}
const server = app.listen(port, host, () =>
  console.log(
    `Company A → http://${host}:${port} · demo faults ${process.env.ENABLE_DEMO_FAULTS === "true" ? "enabled" : "disabled"}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close(async () => {
      await vite?.close();
      db.close();
      process.exit(0);
    });
  });
