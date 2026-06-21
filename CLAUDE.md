# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev      # run with watch mode (primary dev loop)
npm run start:debug    # watch + Node inspector
npm run start:prod     # run compiled dist/main
npm run build          # nest build -> dist/
npm run lint           # eslint --fix over {src,apps,libs,test}
npm run format         # prettier --write

npm test                       # jest unit tests (*.spec.ts under src/)
npm run test:cov               # with coverage
npm test -- order.controller   # run a single spec by path fragment
npm run test:e2e               # e2e tests via test/jest-e2e.json
```

Jest config lives in `package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`). There is currently only one spec (`app.controller.spec.ts`).

## Environment

`.env` is required at startup. `src/config/envs.ts` validates it with Joi and **throws if any var is missing**: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Always import config through `src/config` (`import { envs } from './config'`), never `process.env` directly.

Gotcha: `envs.port` is mapped from **`DB_PORT`**, not the HTTP port. The HTTP server listens on `process.env.PORT ?? 3000` (read directly in `main.ts`), and TypeORM connects on `envs.port`.

## Architecture

A NestJS 11 backend that bridges a **customer-facing web frontend** and a **WhatsApp operator** to coordinate delivery orders. The flow:

1. Frontend POSTs an order → `OrdersModule`.
2. `OrderService.create()` saves the order to Postgres, then pushes a formatted WhatsApp message (to a hardcoded operator number) asking them to reply `/precio [amount]`.
3. `WhatsappService` listens for that `/precio` reply and, via `ChatGateway`, emits the quoted price over Socket.io to the frontend room named by the order id.

### Modules
- **OrdersModule** — single `POST /orders` endpoint. `Order` entity (`orders` table) carries status (`OrderStatus` enum: PENDING_QUOTATION → PENDING_PAYMENT → PAID/COMPLETED), delivery price, and an `mpPreference` field reserved for Mercado Pago.
- **ChatModule** — the WhatsApp + real-time layer.
  - `WhatsappService` wraps `whatsapp-web.js` (Puppeteer-driven WhatsApp Web). On boot it prints a QR code to the terminal for pairing; session is persisted by `LocalAuth` under `.wwebjs_auth/session-delivery-bot/`.
  - `ChatGateway` is a Socket.io gateway (CORS `*`). Frontend emits `join_order {orderId}` to join a per-order room; backend emits `price_quoted` into that room.
  - `WhatsappService` ↔ `ChatGateway` have a circular dependency resolved with `forwardRef()`. Preserve that pattern when touching either constructor.
- **PaymentsModule** — empty stub; Mercado Pago integration is not yet implemented.

### Persistence
TypeORM + Postgres with `autoLoadEntities: true` and **`synchronize: true`** (`app.module.ts`). Schema is auto-generated from entities on every boot — there are no migrations. Adding/changing an `@Entity` or `@Column` mutates the live DB. `Order` ↔ `ChatMessage` are wired `@OneToMany`/`@ManyToOne`. `WhatsappSeccion` entity exists for DB-backed session storage but is not yet used.

## Known incomplete wiring

Several things are mid-build — verify before assuming they work:
- `OrderService` injects `WhatsappService` and the `Order` repository, but `OrdersModule` does **not** import `ChatModule` or register `TypeOrmModule.forFeature([Order])`. Wiring these is likely needed for the order flow to run.
- `WhatsappService` has hardcoded test phone numbers and sends a test message on `ready` (`whatsapp.service.ts`), and the `/precio` socket emit uses a simulated `orden-prueba-123` order id rather than the real one.

## Conventions

- Comments and log messages are in **Spanish**; match that when editing existing files.
- DTOs use `class-validator` decorators (Spanish validation messages). Note: `ValidationPipe` is **not** globally registered in `main.ts`, so DTO validation does not currently run — add the pipe if you rely on it.
- The committed `.wwebjs_auth/` directory holds the live WhatsApp browser session; its files churn constantly and show up as noise in `git status`. Avoid committing those changes.
