# Company A — a little less admin

A standalone booking SaaS for the MAYA demonstration. TypeScript, React, Express 5, and SQLite on Node.js 24. No external account or API key is needed.

## Run

```sh
npm ci
npm run dev
# http://localhost:4100
```

For production assets: `npm run build && npm start`. SQLite defaults to `./data/company-a.sqlite`; set `DATABASE_PATH` to a persistent volume in a deployment. All appointment times are **UTC**, all prices are USD cents, and the booking window is the next 30 days. No payment or email is sent. The dashboard is for a fictional demo business; it has no multiuser authentication and must not hold real customer data.

## Working features

- Three services, dated slots, capacity checked in an immediate SQLite transaction.
- Reservations, cancellation, search/status filters, computed metrics and seven-day calendar.
- Idempotency keys prevent duplicate reservations after a network retry.
- Stored activity trail; health and availability APIs.
- Optional authenticated fault controls for a controlled capacity regression.

## Verify

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests cover concurrent capacity, retries, cancellation, input validation, fault authorization, stale fault resets, and cross-origin writes. The browser test books and cancels a reservation and checks mobile overflow.

## CI / delivery

GitHub Actions runs type checks, formatting, API tests, a production build, browser tests, and a production-dependency audit. Only a successful main build can publish a Docker image to GHCR, tagged with the exact commit and `latest`. Render is configured in the MAYA repository's `render.yaml` to deploy after CI checks pass. A local Docker deployment is also available in the parent workspace.

## Controlled incidents

Disabled by default. Set `ENABLE_DEMO_FAULTS=true`. Network binding requires `SANDBOX_TOKEN`. MAYA keeps this token server-side.

`POST /api/demo/fault` accepts `{"kind":"capacity-regression"}` or `{"kind":"none","expectedFault":"capacity-regression"}`, with `Authorization: Bearer <sandbox token>`. A mismatched precondition returns 409. The injected fault makes real booking capacity appear zero. MAYA's approved recovery resets that demo configuration and probes real availability afterward. It does **not** edit code or create a merge request in this V1.

Other endpoints: `GET /api/overview`, `GET /api/health`, `GET /api/slots?serviceId=consultation&date=YYYY-MM-DD`, `POST /api/bookings` (Idempotency-Key required), `POST /api/bookings/:id/cancel`.

MIT licensed. Independent of MAYA when no connector is configured.
