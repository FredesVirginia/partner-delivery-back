# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev      # run with watch mode (primary dev loop)
npm run start:debug    # watch + Node inspector
npm run start:prod     # run compiled dist/main
npm run build          # nest build -> dist/

npm run lint           # eslint --fix over {src,apps,libs,test}
npm run format         # prettier --write over src/ and test/

npm test                       # jest unit tests (*.spec.ts under src/)
npm run test:cov               # with coverage
npm run test:watch             # watch mode
npm test -- app.controller     # run a single spec by path fragment
npm run test:e2e               # e2e tests via test/jest-e2e.json
```

Jest config lives in `package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`). There is currently only one spec (`app.controller.spec.ts`); the rest of the app is untested.

## Environment

`.env` is required at startup. `src/config/envs.ts` validates it with Joi and **throws if a required var is missing**. Required: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `MP_ACCESS_TOKEN`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. Optional: `PUBLIC_URL` (defaults to `http://localhost:3000`), `JWT_ACCESS_TTL` (default `15m`), `JWT_REFRESH_TTL` (default `7d`). Always import config through `src/config` (`import { envs } from './config'`), never `process.env` directly.

Two gotchas:
- `envs.port` is mapped from **`DB_PORT`** and is used only for the TypeORM Postgres connection. The HTTP server listens on `process.env.PORT ?? 3000` (read directly in `main.ts`).
- Runtime flag `WA_DISABLED=true` skips launching the WhatsApp bot (Puppeteer/QR) on boot — use it to run the API locally/CI without the browser or session-lock conflicts.
- `PUBLIC_URL` must be a public HTTPS URL (e.g. an ngrok tunnel or a real domain) for Mercado Pago to reach the webhook and for `auto_return` to activate. On plain `http`/localhost, `auto_return` is omitted and no real payment callback will arrive — the flow only completes end-to-end behind a public URL.

## Architecture

A NestJS 11 backend that coordinates delivery orders between a **customer-facing web frontend**, a **WhatsApp operator** ("la amiga"), and **Mercado Pago**. All three legs are wired and functional.

### The end-to-end order flow

1. Frontend `POST /orders` → `OrderService.create()` saves the order (`status = PENDING_QUOTATION`), then `OrderController` calls `WhatsappService.notifyNewOrder(order)`.
2. `notifyNewOrder` sends a formatted WhatsApp message to the **hardcoded operator number** (`numeroAmiga` in `whatsapp.service.ts`) and stores the sent message's `id._serialized` on the order via `OrderService.attachWhatsappMessageId()`. This id is the join key for the next step.
3. The operator **replies (quotes) that message** with `/precio [monto]`. The `message_create` handler in `WhatsappService` reads the quoted message id, looks up the order with `OrderService.updatePriceByMessageId()`, which:
   - sets `deliveryPrice` and `status = QUOTED`,
   - calls `PaymentsService.createDeliveryPreference()` to create a Mercado Pago Checkout Pro preference and stores its `init_point` URL in `order.mpPreference`,
   - emits `price_quoted` (with `mpLink`) over Socket.io to the room named by the order id.
4. Customer opens `mpPreference` and pays. Mercado Pago calls `POST /payments/webhook` → `PaymentsService.processWebhookNotification()` verifies the real payment status; if `approved` it returns the `external_reference` (the order id) → `OrderService.markAsPaid()` sets `status = PAID` and emits `order_paid` over the socket.
5. MP also redirects the customer to `GET /payments/success|pending|failure` (simple HTML pages).

Note the two WhatsApp handlers: `message` only replies with a confirmation and does **not** look up an order; the real quote logic lives in `message_create` (which also fires for messages sent from the linked account's own devices) and requires the operator to **quote/reply** to the original order message so the id can be matched.

### Auth (users, JWT, roles)
`UsersModule` + `AuthModule` provide registration/login independent of the delivery flow.
- **UsersModule** — owns the `User` entity (`users`) and `UsersService` (create/lookup). Knows nothing about JWT. Exports `UsersService`.
- **AuthModule** — `AuthController` (`POST /auth/register|login|refresh|logout`, `GET /auth/me`), `AuthService`, `JwtStrategy` (passport-jwt), and owns the `RefreshToken` entity (`refresh_tokens`).
- **Tokens:** access JWT (short-lived, `JWT_ACCESS_SECRET`, payload `{sub,email,role}`) + refresh JWT (`JWT_REFRESH_SECRET`, payload `{sub,tokenId}`). Only the **argon2 hash** of the refresh token is stored in `refresh_tokens`. Refresh **rotates** (old row `revokedAt`, new pair issued); reusing a rotated/revoked token revokes all of the user's sessions (theft defense).
- **Password hashing:** `argon2` (argon2id). Login verifies against a dummy hash when the email doesn't exist to avoid timing leaks.
- **Guards are global** via `APP_GUARD` in `AuthModule`: `JwtAuthGuard` (extends `AuthGuard('jwt')`, honors `@Public()`) then `RolesGuard` (reads `@Roles()`). **Everything is protected by default** — routes that must stay open are marked `@Public()` (currently: `AppController` root, `OrderController POST /orders`, the whole `PaymentsController`). When adding a new public route, remember `@Public()`.
- **Decorators:** `@Public()`, `@Roles(...UserRole)`, `@CurrentUser()` (returns the `User` from `req.user`). Roles enum: `UserRole { ADMIN, CLIENT }` (extensible).
- **Serialization:** `User.passwordHash` is `@Exclude()`d; `main.ts` registers a global `ClassSerializerInterceptor` so returning a `User` never leaks the hash.
- **Shared columns:** all new entities `extend AbstractEntity` (`src/common/entities/abstract.entity.ts`) which provides `id` (uuid), `created_at`, `updated_at`. Do **not** redeclare these per entity.

### Modules
- **OrdersModule** — `POST /orders`. Owns the `Order` and `Message` entities and `OrderService` (order lifecycle, price/payment updates, chat message persistence). Exports `OrderService`.
- **ChatModule** — the WhatsApp + real-time layer.
  - `WhatsappService` wraps `whatsapp-web.js` (Puppeteer-driven WhatsApp Web). On boot it prints a QR to the terminal for pairing; the session is persisted by `LocalAuth` (clientId `delivery-bot`) under `.wwebjs_auth/`.
  - `ChatGateway` is a Socket.io gateway (CORS `*`). It injects the `Message` repository directly to persist chat messages.
- **PaymentsModule** — `PaymentsController` (MP redirect pages + webhook) and `PaymentsService` (Mercado Pago SDK: preference creation + payment verification). Currency is hardcoded `ARS`.

### Circular dependencies
Resolved with `forwardRef()` at the **module** level: `OrdersModule ↔ ChatModule` and `OrdersModule ↔ PaymentsModule`. Inside `WhatsappService`, `ChatGateway` and `OrderService` are also injected with `@Inject(forwardRef(() => ...))`. Preserve these patterns when touching any of those constructors or module `imports`.

### Socket.io contract
- Client → server: `join_order {orderId}` (joins the per-order room), `send_message {orderId, sender: 'CLIENT'|'ADMIN', text}`.
- Server → client: `joined_room`, `new_message`, `price_quoted {orderId, price, status, mpLink}`, `order_paid {orderId, price, status}`.
- The room name is the order id as a string. `price_quoted` and `order_paid` are intentionally separate events so the frontend's payment-button logic isn't overwritten.

### Persistence
TypeORM + Postgres with `autoLoadEntities: true` and **`synchronize: true`** (`app.module.ts`). Schema is auto-generated from entities on every boot — there are **no migrations**. Adding/changing an `@Entity` or `@Column` mutates the live DB. Entities: `Order` (`orders`, int PK) ↔ `Message` (`messages`, uuid PK, `@ManyToOne` on `order_id`, cascade delete). `ChatMessage` and `WhatsappSeccion` entities exist and are registered but are **not yet used** by any flow.

## Known incomplete / rough edges

Verify before assuming these are intentional:
- `WhatsappService` still sends a **hardcoded test message** to `numeroPrueba` on the `ready` event.
- The operator number (`numeroAmiga`) and test number are hardcoded in `whatsapp.service.ts`.
- Type mismatch: `Message.orderId` is typed `string` while `Order.id` is a numeric int; order ids are stringified when used as socket room names and MP `external_reference`.
- Refresh tokens are returned in the JSON body (SPA-friendly). Hardening to httpOnly cookies is deliberately deferred.

Resolved recently (were previously listed here): global `ValidationPipe` is now registered in `main.ts` (`whitelist`/`forbidNonWhitelisted`/`transform`), and the duplicate `PaymentsModule` import in `app.module.ts` was removed.

## Conventions

- Comments and log messages are in **Spanish** (often with emojis); match that when editing existing files.
- DTOs use `class-validator` with Spanish validation messages.
- The `.wwebjs_auth/` directory holds the live WhatsApp browser session; its files churn constantly and show up as noise in `git status`. Avoid committing those changes.

## Skills & orchestration

Four specialized skills are installed under `.claude/skills/` (symlinked into the `.agents/skills/` store): `nestjs-best-practices` (rich, with a `rules/` folder), `nodejs-backend-patterns`, `nodejs-best-practices`, `typescript-advanced-types`.

A project **orchestrator** routes work to the right skill:
- `.claude/skills/skill-orchestrator/SKILL.md` — a router. When starting/planning any backend task, consult it to pick the skill(s) + rules to apply (e.g. auth/guards/DTOs → `nestjs-best-practices` rules `security-auth-jwt`, `security-use-guards`, `api-use-dto-serialization`).
- `.claude/hooks/skill-router.mjs` + `.claude/settings.json` — a `UserPromptSubmit` hook that detects backend-related prompts (keywords) and injects a one-line reminder to consult the orchestrator. Edit the keyword list in the `.mjs` to tune it.
