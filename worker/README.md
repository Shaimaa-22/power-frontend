# Power API — Hono / Cloudflare Workers / D1 / Backblaze B2

The public API, image proxy and static administration interface use the same Worker. React/Vite is deployed separately to Pages. B2 remains the active storage provider; no R2 binding is required when `STORAGE_DRIVER=b2`.

Latest controlled release preparation: [PRODUCTION-ACTIONS.md](PRODUCTION-ACTIONS.md). Ambiguous remote npm aliases now refuse to run; use environment-specific commands only after their prerequisites. No new deployment was performed during that preparation. Image validation now checks container structure and PNG CRC; its precise limitations are documented in [tests/fixtures/README.md](tests/fixtures/README.md).

## Local development

Use Node.js 22.13 or newer (Node 22 is pinned in `.node-version`).

```sh
npm ci
```

Copy `.dev.vars.example` to ignored `.dev.vars`, supplying a random JWT secret of at least 32 characters and restricted B2 credentials. Non-secret storage settings are in `wrangler.jsonc`. Local requests using real B2 credentials can modify that bucket: use a separate development bucket/key. The tests use mocked storage and ephemeral databases.

For a NEW LOCAL database only:

```sh
npm run db:init:local
npm run db:migrate:local
npm run seed-admin -- admin@example.com --local
npm run dev
```

For an existing local database, run only the migration command, not schema initialization. Open `http://localhost:8787/admin`. Password entry in the seed script is hidden; do not pass a password as a command-line argument. New/reset passwords must contain 15–128 characters. `--sql-only` prepares a local ignored SQL file for manual application; protect and remove this file after use. `--remote` is an explicit production-capable option and was NOT used during this work.

## Migration and authentication

`schema.sql` is the unchanged baseline. Apply `migrations/0001_security_and_cleanup.sql` once after the baseline, before deploying the new code. It preserves existing content/password hashes and adds account state, token versions, optimistic item versions and a durable image-cleanup outbox. Old JWTs require signing in again. Existing password hashes still verify using their stored work factor. Changing/resetting a password or changing account state increments token versions through a D1 trigger; deletion is checked on every protected request. JWT remains a Bearer token, with no cookie migration.

`PBKDF2_ITERATIONS` controls new/reset hashes only: 20000–100000, default 100000. Existing hashes with 1000–100000 iterations remain verifiable. Workerd currently caps PBKDF2 at 100000, below OWASP's 600000 PBKDF2-SHA256 recommendation. No claim is made that this meets that recommendation. Local workerd tests cover 100000, but production CPU and plan limits must be measured; the Free plan's CPU allowance is not guaranteed to suffice. Do not silently lower the setting to hide CPU failures. Upgrading legacy hashes occurs through password change/reset, not a second expensive derivation during login.

Login and password changes use the native `AUTH_RATE_LIMITER` binding: 10 requests/minute per IP and separately per hashed normalized account key. Cloudflare counters are location-scoped and eventually consistent, not an exact global limit. Missing binding fails closed with 503. Confirm that namespace `10051001` is reserved for this app in the account.

## Storage and cleanup

Uploads count actual streamed request bytes before multipart parsing (5 MiB image, 512 KiB multipart overhead). MIME and file signatures must agree for JPG/PNG/WebP/GIF/AVIF. This is signature inspection, not full image decoding or malware scanning. New images use UUID filenames. D1 reserves cleanup before uploading; successful D1 batches attach the image and remove the reservation atomically. Failed/unattached uploads become eligible for cleanup after at most one hour.

Item/category deletion records old images through D1 triggers in the same transaction. Cleanup claims at most 10 jobs per invocation, deletes sequentially, checks live references, and retries failures with leases/backoff. A cron every five minutes drains pending work; request `waitUntil` accelerates it. No Queue, KV, Durable Object or new database is used. Watch `image_cleanup` backlog/attempts and Worker errors; sustained deletion beyond processing capacity requires operational review.

The Cache API uses a canonical image URL, five-minute freshness and correct 304/412 preconditions. UUID replacement busts updated image URLs. Deletion does not instantly purge all browsers or Cloudflare locations; old images can remain visible for their freshness window. Storage objects remain until durable cleanup succeeds.

## Configuration

| Name | Kind | Purpose |
| --- | --- | --- |
| JWT_SECRET | Worker secret / local `.dev.vars` | JWT signing; independent random value, at least 32 characters |
| B2_KEY_ID | Worker secret / local `.dev.vars` | Restricted B2 key identifier |
| B2_APPLICATION_KEY | Worker secret / local `.dev.vars` | B2 application credential |
| B2_ENDPOINT | Variable | Existing B2 S3 endpoint; hostname or HTTPS origin |
| B2_REGION | Variable | Region matching the endpoint |
| B2_BUCKET_NAME | Variable | Existing bucket |
| STORAGE_DRIVER | Variable | Keep `b2` |
| PBKDF2_ITERATIONS | Variable | New/reset password work factor |
| DB | D1 binding | Existing database, verify configured ID |
| AUTH_RATE_LIMITER | Native binding | Authentication throttling, configured in Wrangler |
| IMAGES | Optional R2 binding | Only for a future explicit switch to R2; not enabled |

## Verification without deployment

```sh
npm test
npx wrangler deploy --dry-run
```

Tests use Node's built-in runner, SQLite, and Wrangler's local Miniflare/workerd dependencies. They do not access production D1 or B2. See [CLOUDFLARE-READINESS.md](CLOUDFLARE-READINESS.md) for the change inventory, tested scope and Dashboard checklist. Do not treat a successful dry-run as proof of production credentials, permissions, CPU capacity or end-to-end browser behavior.
