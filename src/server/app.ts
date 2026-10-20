import express from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { recordEvent, type DB } from "./db.js";
import type { Booking, Service } from "../shared/types.js";

export const SLOT_TIMES = [
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
];
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function validateDate(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  const today = new Date().toISOString().slice(0, 10);
  const last = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date < today ||
    date > last
  )
    throw new HttpError(400, "Choose a valid date within the next 30 days.");
}
export function createApp(
  db: DB,
  options: { demoFaults?: boolean; sandboxToken?: string } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (
        req.get("origin") &&
        (!URL.canParse(req.get("origin")!) ||
          new URL(req.get("origin")!).host !== req.get("host"))
      )
        return res
          .status(403)
          .json({ error: "Cross-origin changes are not allowed." });
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Use application/json." });
    }
    next();
  });
  const fault = () =>
    options.demoFaults
      ? String(
          (
            db
              .prepare("SELECT value FROM settings WHERE key='fault'")
              .get() as { value: string }
          ).value,
        )
      : "none";
  const services = () =>
    db
      .prepare("SELECT * FROM services ORDER BY price")
      .all() as unknown as Service[];
  const faultId = () =>
    String(
      (
        db.prepare("SELECT value FROM settings WHERE key='faultId'").get() as {
          value: string;
        }
      ).value,
    );
  const bookings = () =>
    db
      .prepare(
        "SELECT b.id,b.serviceId,s.name AS serviceName,b.name,b.email,b.date,b.time,b.seats,b.status,b.createdAt FROM bookings b JOIN services s ON s.id=b.serviceId ORDER BY b.createdAt DESC",
      )
      .all() as unknown as Booking[];
  const remaining = (service: Service, date: string, time: string) => {
    const used = db
      .prepare(
        "SELECT COALESCE(SUM(seats),0) AS count FROM bookings WHERE serviceId=? AND date=? AND time=? AND status='confirmed'",
      )
      .get(service.id, date, time) as { count: number };
    return Math.max(
      0,
      (fault() === "capacity-regression" ? 0 : service.capacity) - used.count,
    );
  };
  app.get("/api/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    const healthy = fault() !== "dependency-unavailable";
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "healthy" : "degraded",
      service: "company-a",
      version: "1.0.0",
      database: "connected",
      fault: fault(),
      faultId: faultId(),
      timestamp: new Date().toISOString(),
    });
  });
  app.get("/api/overview", (_req, res) => {
    const all = bookings(),
      confirmed = all.filter((b) => b.status === "confirmed"),
      prices = new Map(services().map((s) => [s.id, s.price]));
    res.json({
      services: services(),
      bookings: all,
      events: db
        .prepare("SELECT * FROM events ORDER BY id DESC LIMIT 30")
        .all(),
      health: fault() === "none" ? "healthy" : "degraded",
      demoFaultsEnabled: !!options.demoFaults && !options.sandboxToken,
      fault: fault(),
      metrics: {
        confirmed: confirmed.length,
        cancelled: all.length - confirmed.length,
        revenue: confirmed.reduce(
          (sum, b) => sum + (prices.get(b.serviceId) ?? 0) * b.seats,
          0,
        ),
        occupiedSeats: confirmed.reduce((sum, b) => sum + b.seats, 0),
      },
    });
  });
  app.get("/api/slots", (req, res) => {
    const date = z.string().parse(req.query.date);
    validateDate(date);
    const service = services().find((s) => s.id === req.query.serviceId);
    if (!service) throw new HttpError(404, "Service not found.");
    res.json(
      SLOT_TIMES.map((time) => {
        const seats = remaining(service, date, time);
        return {
          time,
          remaining: seats,
          available:
            seats > 0 && new Date(`${date}T${time}:00Z`).getTime() > Date.now(),
        };
      }),
    );
  });
  app.post("/api/bookings", (req, res) => {
    const body = z
      .object({
        serviceId: z.string().max(50),
        name: z.string().trim().min(2).max(80),
        email: z.email().max(200),
        date: z.string(),
        time: z.enum(SLOT_TIMES as [string, ...string[]]),
        seats: z.number().int().min(1).max(8),
      })
      .strict()
      .parse(req.body);
    const key = z.string().min(8).max(100).parse(req.get("idempotency-key"));
    const payload = JSON.stringify(body);
    db.exec("BEGIN IMMEDIATE");
    try {
      const previous = db
        .prepare("SELECT id,payload FROM bookings WHERE idempotencyKey=?")
        .get(key) as { id: string; payload: string } | undefined;
      if (previous) {
        if (previous.payload !== payload)
          throw new HttpError(
            409,
            "That request key was already used for a different booking.",
          );
        db.exec("COMMIT");
        return res
          .status(200)
          .json(bookings().find((b) => b.id === previous.id));
      }
      validateDate(body.date);
      if (new Date(`${body.date}T${body.time}:00Z`).getTime() <= Date.now())
        throw new HttpError(400, "That slot has already passed.");
      const service = services().find((s) => s.id === body.serviceId);
      if (!service) throw new HttpError(404, "Service not found.");
      if (remaining(service, body.date, body.time) < body.seats)
        throw new HttpError(
          409,
          "Not enough seats left. Choose another time or fewer seats.",
        );
      const id = randomUUID();
      db.prepare("INSERT INTO bookings VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(
        id,
        body.serviceId,
        body.name,
        body.email,
        body.date,
        body.time,
        body.seats,
        "confirmed",
        new Date().toISOString(),
        key,
        payload,
      );
      recordEvent(
        db,
        "booking.created",
        `Reservation ${id.slice(0, 8)} confirmed · ${service.name} · ${body.seats} seat${body.seats === 1 ? "" : "s"}`,
      );
      db.exec("COMMIT");
      res.status(201).json(bookings().find((b) => b.id === id));
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
  app.post("/api/bookings/:id/cancel", (req, res) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const booking = bookings().find((b) => b.id === req.params.id);
      if (!booking) throw new HttpError(404, "Booking not found.");
      if (booking.status === "confirmed") {
        db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(
          booking.id,
        );
        recordEvent(
          db,
          "booking.cancelled",
          `Reservation ${booking.id.slice(0, 8)} cancelled · seats released`,
        );
      }
      db.exec("COMMIT");
      res.json({ ...booking, status: "cancelled" });
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
  app.post("/api/demo/fault", (req, res) => {
    if (!options.demoFaults)
      throw new HttpError(404, "Demo fault controls are disabled.");
    if (options.sandboxToken) {
      const supplied = Buffer.from(
          req.get("authorization")?.replace(/^Bearer /, "") || "",
        ),
        expected = Buffer.from(options.sandboxToken);
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        throw new HttpError(401, "A sandbox connector token is required.");
    }
    const { kind, expectedFault, expectedFaultId } = z
      .object({
        kind: z.enum(["none", "capacity-regression", "dependency-unavailable"]),
        expectedFault: z.string().optional(),
        expectedFaultId: z.string().min(1).max(100).optional(),
      })
      .strict()
      .parse(req.body);
    db.exec("BEGIN IMMEDIATE");
    try {
      if (
        (expectedFault && fault() !== expectedFault) ||
        (expectedFaultId && faultId() !== expectedFaultId)
      )
        throw new HttpError(
          409,
          "The fault changed after the proposal was captured.",
        );
      db.prepare("UPDATE settings SET value=? WHERE key='fault'").run(kind);
      const nextFaultId = randomUUID();
      db.prepare("UPDATE settings SET value=? WHERE key='faultId'").run(
        nextFaultId,
      );
      recordEvent(db, "demo.fault", `Local fault changed to ${kind}`);
      db.exec("COMMIT");
      res.json({ fault: kind, faultId: nextFaultId });
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof ZodError
            ? 400
            : (error as { status?: number }).status === 400
              ? 400
              : 500;
      res.status(status).json({
        error:
          error instanceof ZodError
            ? error.issues
                .map((i) => `${i.path.join(".") || "request"}: ${i.message}`)
                .join("; ")
            : status === 500
              ? "Something went wrong. Please try again."
              : (error as Error).message,
      });
    },
  );
  return app;
}
