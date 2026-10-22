# Kalpriti API — PostgreSQL

The Express API uses PostgreSQL through `pg`. Web and Android keep the same API routes, `_id` strings, project version order, and authentication format. MongoDB is used only by the optional legacy import script.

The complete [database reference](db/README.md) includes the exported DDL schema, DML examples, DCL roles/grants, column dictionary, and relationship diagram.

See [DEPLOYMENT.md](DEPLOYMENT.md) for production configuration, CSRF/session handling, proxy/rate limits, health endpoints, and release steps.

## Setup

Use Node.js 24 or newer and pnpm 10. Install dependencies with `pnpm install --frozen-lockfile`.

For a new environment, copy `.env.example` to `.env` and fill in the credentials. For an existing environment, keep the existing JWT, SMTP, Stripe, and AI settings; update the database settings deliberately rather than replacing the file.

Set `DATABASE_URL` to a PostgreSQL URL. Use your hosted provider's required SSL parameters. To use the supplied local database instead, start Docker Desktop, set `POSTGRES_PASSWORD` and the matching password in `DATABASE_URL`, then run:

```sh
docker compose up -d postgres
pnpm run db:migrate
pnpm run dev
```

For hosted PostgreSQL, skip the Docker command. Run schema migrations before starting the API. Migration files are applied once in a transaction with an advisory lock and recorded checksums. Do not edit applied migration files; add a new SQL migration.

## Selected environment setup

The selected setup for this project starts empty: use local PostgreSQL for testing and a separate hosted PostgreSQL database for production. The local database is `kalpriti_test` on `127.0.0.1:55432` (`POSTGRES_PORT` controls the host port). Run only `db:migrate`; do not run the MongoDB import. Existing MongoDB data stays untouched. Keep the production `DATABASE_URL` in the hosting provider's environment settings, with that provider's required TLS parameters, and run `pnpm run db:migrate` there before starting the API. Local Docker credentials belong only to development.

## Preserve existing MongoDB data (optional)

The following import instructions apply if you later decide to preserve legacy data.

The importer preserves existing IDs, password hashes, balances, timestamps, project code, messages, versions, and payment history. It reads MongoDB without changing it and refuses to import into nonempty PostgreSQL application tables.

1. Back up MongoDB. Configure `MONGODB_URI` and the explicit `MONGODB_DATABASE` source name in `.env`. `DATABASE_URL` must point to the new PostgreSQL target.
2. Run `pnpm run db:migrate` against the target.
3. Run `pnpm run db:import:mongodb`. This defaults to a validation-only dry run and reports collection counts.
4. Resolve validation errors before proceeding. Orphan records, invalid references, and duplicate normalized emails are rejected rather than discarded. Older project deletions may have left orphan messages or versions; archive or repair these deliberately in the source.
5. Stop application writes to MongoDB, take a final backup, and run `pnpm run db:import:mongodb --apply`. The import either commits all application tables or rolls back all changes. Keep writes stopped until verification and cutover finish.
6. Check the reported counts, existing account login, balances, project code and version history, and payment records. Then start this API with the PostgreSQL URL and reconnect the web/Android clients to it.

The `mongodb` package is a development dependency needed only for this import command; install development dependencies on the migration machine. A fresh empty application needs only the schema migration.

Legacy transactions with `isPaid=true` are treated as already credited so importing payment history cannot grant those credits again. Review any historical payment/balance inconsistencies before cutover. New settlements lock the payment row and update its paid marker and user balance in one SQL transaction.

The source remains available for rollback before new PostgreSQL writes begin. Once users write to PostgreSQL, switching back requires reconciling those new writes; the importer is not a continuous synchronization tool.

## Checks

Database connection failures return a friendly HTTP 503 JSON message. The API stays available during a database outage and retries the connection on later requests. Query and transaction promises still reject on failure so the API error handler can report the failure; failed writes are rolled back, never reported as successful. If rollback fails, the connection is discarded. Unexpected internal SQL details are excluded from error responses.

The shared Expo client displays API failures in its global toast component on web and Android. Repeated identical messages are suppressed, notifications can be dismissed, and normal signed-out session checks remain silent.

```sh
pnpm test
```

Tests use PGlite's embedded PostgreSQL engine for schema, queries, transaction rollback, authentication, ownership, version ordering, payment idempotency, importing, and HTTP routes. Email, AI, and Stripe calls are mocked. These checks do not replace a connection test against the deployment database or live payment verification.

Keep secrets in environment configuration. The container image reads runtime environment variables and contains no embedded database or service credentials.
