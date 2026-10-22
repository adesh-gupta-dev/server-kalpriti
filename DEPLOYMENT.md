# Production deployment

The API and shared Expo app are separate deployments. Keep the current design and deploy both repositories together when the API contract changes.

## API environment

Use Node 24 and pnpm 10.33.0. Configure these values through the hosting platform; do not commit a populated `.env`:

- `NODE_ENV=production`.
- `DATABASE_URL`: hosted PostgreSQL connection URL with `sslmode=verify-full` and the provider's trusted CA configuration. Keep migration-owner and runtime credentials separate.
- `JWT_SECRET_KEY`: at least 32 bytes from a cryptographically random source.
- `CLIENT_URL`: the canonical HTTPS frontend base URL. Password reset links use only this setting.
- `CORS_ORIGINS`: optional comma-separated exact additional HTTPS origins, without paths/trailing slashes. Null, localhost, private LAN, and Expo browser origins are denied in production. Native bearer requests without an Origin remain supported.
- `TRUST_PROXY`: the precise hop count (1-10), trusted addresses, or CIDRs documented by the host. Leave unset for direct access. Never use unconditional `true`. Verify the host overwrites forwarding headers.
- `GOOGLE_GEMINI_API_KEY` and optionally `GOOGLE_GEMINI_MODEL`; the former is the canonical AI key name. The client initializes lazily and unavailable services return handled errors.
- Stripe secret key and endpoint webhook secret. Set the endpoint to `/payment/webhook` or `/api/payment/webhook`.
- SMTP host/service, user, password, and sender address.
- `DATABASE_POOL_SIZE` and `DATABASE_STATEMENT_TIMEOUT_MS` appropriate to the host's connection limit. Queries and idle transactions have bounded timeouts.
- `DEPLOYMENT_INSTANCES=1` for a single instance using memory limits. For multiple instances, configure `REDIS_URL` (use authenticated TLS `rediss://` for a hosted provider) and set the instance count. Readiness fails if multiple instances have no shared store or the configured store is unavailable.

The configuration checker reports missing setting names without printing credential values. Invalid production configuration keeps readiness and business routes at 503 while the process remains available for liveness and friendly errors.

## Schema and startup

```sh
pnpm install --frozen-lockfile
pnpm run db:migrate
pnpm start
```

Run migrations with the owner URL before switching the API to its restricted runtime URL. The selected deployment starts empty; do not run the MongoDB importer. Migration `002_session_version.sql` adds revocable sessions without rewriting the applied initial schema. SQL line endings are pinned to LF to preserve checksums across Windows/Linux.

Use [db/dcl/roles.sql](db/dcl/roles.sql) to grant the runtime/reporting groups deliberately. The runtime group can read/write application tables but cannot migrate the schema. Provision actual login passwords through the provider. See [db/README.md](db/README.md) for SQL details.

For a first administrator, register and verify the intended account, then use the migration owner's SQL access to change that specific account's role to `ADMIN`. Do not expose a public administrator-registration endpoint or seed a shared password.

## Health and request protection

- `/live` and `/health/live`: process liveness, independent of PostgreSQL and ordinary user rate limits.
- `/ready`, `/health/ready`, and `/check`: return 200 only when schema, required production configuration, and configured rate-limit storage are ready; otherwise 503. Configure the host's readiness/load-balancer check here.
- Signed Stripe webhooks are separate from user API rate budgets. Invalid signatures/payloads return 400, and transient processing failures return retryable 503.
- Cookie-authenticated writes require `X-CSRF-Token`, returned with successful authentication and authenticated profile reads. The shared client attaches it automatically. Explicit bearer requests work for native clients and take precedence over cookies.
- Password changes, resets, and logout invalidate older tokens through `users.session_version`. Logout currently signs out all sessions for that account. Updated password/reset responses issue replacement tokens, which the shared client stores automatically.
- Email changes atomically clear prior verification and OTP/reset challenges. The user must verify the new address.
- Public write endpoints validate types and lengths. Password creation/reset/change requires 8-64 characters and at most 72 UTF-8 bytes for bcrypt.

Generation requests can take longer than ordinary API calls. Set the host's request-duration limit to accommodate the configured AI timeout and two generation stages. Move long jobs to a queue before using a host with a shorter hard request limit. Shutdown stops new connections and bounds connection draining to 30 seconds.

## Containers

```sh
docker build -t kalpriti-api .
```

The image runs as the non-root `node` user, excludes populated environment files, and has a readiness health check. Supply runtime configuration using the platform's secret/environment settings. Building an image does not run migrations or configure the hosted database.

## Local/network verification

```sh
pnpm test
pnpm audit --prod
pnpm run db:verify
```

`db:verify` checks the current schema, rollback, and real concurrent once-only settlement using temporary fixture rows, then removes its own fixtures. Run it against local/staging PostgreSQL, not as a production health probe. It does not contact Stripe.

To test shared limits locally, start the optional Redis profile and configure the verification command's `REDIS_URL` to `redis://127.0.0.1:56379`:

```sh
docker compose --profile rate-limits up -d --wait redis
pnpm run rate:verify
```

The Redis check uses a unique short-lived rate key across two temporary HTTP servers. CI supplies PostgreSQL and Redis services and runs these checks plus the production image build.

## Client release

Set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_APP_URL`, and `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` in the frontend/EAS production environment. Only publishable Stripe keys belong in the client. Build from `Kalpriti/mobile` using `pnpm run build:production`; it rejects missing/local/insecure endpoints and avoids the development `.env`. EAS's production profile uses the production environment and the same validation.

The frontend Git repository is `Kalpriti`; `mobile/` is a normal directory, not a nested repository or submodule. The previous empty Git metadata is preserved under ignored `.migration-backups`. Include `mobile/patches`, the lockfile, and root CI workflow when committing. Use Node 24 and pnpm 10.33.0 for clean installation.

Before public traffic, verify the actual hosted TLS/credentials, backups and restore, sender delivery/reset links, Stripe test-mode redirect/webhook/retry flows, signed Android installation/deep links, and monitoring/load limits. Local builds and mocks do not establish those provider/device results.
