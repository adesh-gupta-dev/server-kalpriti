# Production readiness fixes

Updated: 20 October 2026 (Asia/Kolkata).

The issues identified by the earlier audit have been addressed in code. Public release still needs verification on the selected hosting provider and a signed Android device build. Nothing has been deployed or pushed.

## Changes

- Password-reset links use the validated configured frontend URL, never request headers. Production origins use an exact HTTPS allowlist; cookie writes require CSRF tokens, while native bearer requests remain supported.
- Password reset, password change, and logout revoke prior sessions through migration `002_session_version.sql`. Logout signs out all sessions. Email changes clear verification and old challenges atomically.
- Write endpoints validate input types, lengths, email addresses, and the bcrypt byte limit. Authentication, OTP, and delivery attempts have separate limits.
- Liveness and readiness are separate. Missing schema, PostgreSQL outages, missing production configuration, and unavailable configured Redis produce safe 503 responses. Business routes reject incomplete production configuration. Existing shared error toasts display failures.
- Hosted proxy trust is explicit. Optional Redis shares limits across instances; multiple-instance production requires it. Health and signed Stripe webhooks have separate treatment. Invalid webhook signatures return 400; transient processing failures return retryable 503.
- AI configuration consistently uses `GOOGLE_GEMINI_API_KEY`; lazy initialization allows safe startup with unavailable dependencies. Error responses and logging omit internal details.
- The container uses Node 24, a frozen production lockfile, a non-root user, and readiness health checks. Root CI workflows now run verification for each repository.
- The shared app is a normal directory within the frontend repository. Its previous empty nested Git metadata was preserved in the ignored migration backup. Clean source installation is checked independently of existing dependencies.
- Dependencies were updated compatibly with Expo SDK 54. Backend production audit reports no known vulnerabilities. Three upstream client-tool advisories have no published fixed version: braces, node-forge, and sprintf-js. Reproducible local patches and exploit regression tests mitigate them; raw audit still reports their original versions. The client audit gate permits only those exact tested mitigations and rejects new findings. See `../Kalpriti/mobile/patches/README.md`.

## Verification

- All 47 backend tests passed: authentication, authorization, schema, SQL permissions, validation, readiness, CSRF, session revocation, payment settlement, and signed-webhook regression tests.
- Frontend TypeScript, lint, seven Jest suites with 20 tests, dependency regression tests, and the production audit gate.
- Production web export and Android JavaScript/assets export; these preserve the shared screens and original design.
- Local networked PostgreSQL migration, transaction rollback, and concurrent once-only settlement. Verification removes its own fixture rows.
- Real Redis rate-limit sharing across two temporary HTTP servers, plus safe handling of unavailable Redis.
- Production image build and non-root container startup passed: liveness returned 200 and missing-configuration readiness returned 503. All desktop/phone browser checks passed with intercepted API fixtures, including both themes and error toasts. No live payments or email were sent by the tests.

## Required deployment evidence

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for configuration and commands. Before public traffic, verify:

- Actual HTTPS domains, hosted PostgreSQL certificate verification, restricted runtime credentials, pool limits, migration execution, and backup restoration.
- Production secrets and sender delivery; real reset/verification links, Gemini responses, Stripe test-mode checkout, redirects, retries, and reconciliation.
- Signed Android installation, authentication, keyboard/layout behavior, network-error toast, and payment return links on a device or emulator.
- CI on the pushed repositories, host proxy behavior, monitoring/alerts, request-duration limits, and representative load.

Local fixtures and exports establish regression coverage; they do not establish those hosted or device outcomes. No populated environment files, original-source archives, or preserved nested Git metadata should be committed.
