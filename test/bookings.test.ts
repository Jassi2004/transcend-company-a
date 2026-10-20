import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/server/app.js";
import { openDatabase } from "../src/server/db.js";
const body = () => ({
  serviceId: "consultation",
  name: "Test Customer",
  email: "test@example.com",
  date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  time: "09:00",
  seats: 1,
});
test("capacity is enforced atomically across concurrent reservations", async () => {
  const db = openDatabase(":memory:");
  try {
    const app = createApp(db);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post("/api/bookings")
          .set("Idempotency-Key", randomUUID())
          .send(body()),
      ),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 4);
    assert.equal(results.filter((r) => r.status === 409).length, 6);
    const overview = await request(app).get("/api/overview");
    assert.equal(overview.body.metrics.occupiedSeats, 4);
  } finally {
    db.close();
  }
});
test("retrying the same request returns the original booking; changing its payload is rejected", async () => {
  const db = openDatabase(":memory:");
  try {
    const app = createApp(db),
      key = randomUUID(),
      input = body();
    const first = await request(app)
      .post("/api/bookings")
      .set("Idempotency-Key", key)
      .send(input);
    const retry = await request(app)
      .post("/api/bookings")
      .set("Idempotency-Key", key)
      .send(input);
    assert.equal(retry.status, 200);
    assert.equal(first.body.id, retry.body.id);
    const conflict = await request(app)
      .post("/api/bookings")
      .set("Idempotency-Key", key)
      .send({ ...input, seats: 2 });
    assert.equal(conflict.status, 409);
  } finally {
    db.close();
  }
});
test("cancellation is idempotent and releases capacity", async () => {
  const db = openDatabase(":memory:");
  try {
    const app = createApp(db);
    const booking = await request(app)
      .post("/api/bookings")
      .set("Idempotency-Key", randomUUID())
      .send({ ...body(), seats: 4 });
    assert.equal(booking.status, 201);
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await request(app)
            .post(`/api/bookings/${booking.body.id}/cancel`)
            .send({})
        ).status,
        200,
      );
    const next = await request(app)
      .post("/api/bookings")
      .set("Idempotency-Key", randomUUID())
      .send({ ...body(), seats: 4 });
    assert.equal(next.status, 201);
    assert.equal(
      (await request(app).get("/api/overview")).body.events.filter(
        (e: { type: string }) => e.type === "booking.cancelled",
      ).length,
      1,
    );
  } finally {
    db.close();
  }
});
test("invalid dates, oversized bookings, and unknown fields cannot enter storage", async () => {
  const db = openDatabase(":memory:");
  try {
    const app = createApp(db);
    for (const changes of [
      { date: "2099-01-01" },
      { date: "2026-02-30" },
      { time: "02:00" },
      { seats: 0 },
      { seats: 9 },
      { name: "X" },
      { email: "invalid" },
      { admin: true },
    ]) {
      const res = await request(app)
        .post("/api/bookings")
        .set("Idempotency-Key", randomUUID())
        .send({ ...body(), ...changes });
      assert.equal(res.status, 400);
    }
    assert.equal(
      (await request(app).get("/api/overview")).body.bookings.length,
      0,
    );
  } finally {
    db.close();
  }
});
test("demo controls are disabled by default and authenticated when enabled", async () => {
  const db = openDatabase(":memory:");
  try {
    assert.equal(
      (
        await request(createApp(db))
          .post("/api/demo/fault")
          .send({ kind: "capacity-regression" })
      ).status,
      404,
    );
    const app = createApp(db, {
      demoFaults: true,
      sandboxToken: "test-connector",
    });
    assert.equal(
      (
        await request(app)
          .post("/api/demo/fault")
          .send({ kind: "capacity-regression" })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(app)
          .post("/api/demo/fault")
          .set("Authorization", "Bearer test-connector")
          .send({ kind: "capacity-regression" })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .post("/api/bookings")
          .set("Idempotency-Key", randomUUID())
          .send(body())
      ).status,
      409,
    );
    assert.equal(
      (
        await request(app)
          .post("/api/demo/fault")
          .set("Authorization", "Bearer test-connector")
          .send({ kind: "none", expectedFault: "another-fault" })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(app)
          .post("/api/demo/fault")
          .set("Authorization", "Bearer test-connector")
          .send({ kind: "none", expectedFault: "capacity-regression" })
      ).status,
      200,
    );
  } finally {
    db.close();
  }
});
test("cross-origin state changes and malformed JSON are rejected", async () => {
  const db = openDatabase(":memory:");
  try {
    const app = createApp(db);
    assert.equal(
      (
        await request(app)
          .post("/api/bookings")
          .set("Origin", "https://untrusted.example")
          .send(body())
      ).status,
      403,
    );
    assert.equal(
      (
        await request(app)
          .post("/api/bookings")
          .set("Content-Type", "application/json")
          .send("{bad")
      ).status,
      400,
    );
  } finally {
    db.close();
  }
});

test("a same-kind replacement fault cannot be reset with stale approval evidence", async () => {
  const db = openDatabase(":memory:");
  try {
    const app = createApp(db, {
      demoFaults: true,
      sandboxToken: "connector-test",
    });
    const inject = () =>
      request(app)
        .post("/api/demo/fault")
        .set("Authorization", "Bearer connector-test")
        .send({ kind: "capacity-regression" });
    const first = await inject();
    const second = await inject();
    assert.notEqual(first.body.faultId, second.body.faultId);
    const stale = await request(app)
      .post("/api/demo/fault")
      .set("Authorization", "Bearer connector-test")
      .send({
        kind: "none",
        expectedFault: "capacity-regression",
        expectedFaultId: first.body.faultId,
      });
    assert.equal(stale.status, 409);
    assert.equal(
      (await request(app).get("/api/health")).body.faultId,
      second.body.faultId,
    );
    const fresh = await request(app)
      .post("/api/demo/fault")
      .set("Authorization", "Bearer connector-test")
      .send({
        kind: "none",
        expectedFault: "capacity-regression",
        expectedFaultId: second.body.faultId,
      });
    assert.equal(fresh.status, 200);
    assert.equal((await request(app).get("/api/health")).body.fault, "none");
    assert.equal(
      (await request(app).post("/api/bookings").set("Origin", "null").send({}))
        .status,
      403,
    );
  } finally {
    db.close();
  }
});
