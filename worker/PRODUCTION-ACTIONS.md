# Controlled production steps — prepared locally, not executed

Approved Pages target: **power-elec-site** (confirmed by the owner). Production API origin: **https://power-api.power-elec.workers.dev**, confirmed through read-only Cloudflare account subdomain metadata and the Worker's enabled workers.dev setting. This was not an application request to Production and does not establish application health.

No deployment, Production D1 query, migration, resource mutation or Production B2 request was performed during this preparation. No dependencies were added. The existing D1 schema/migration, B2 implementation and both Wrangler config files were left unchanged.

## Local changes and verification

- Image validation now walks bounded structures rather than accepting a short magic prefix. JPEG needs frame/scan data and EOI; PNG checks chunk boundaries/CRC and mandatory chunks; GIF checks frames/sub-blocks/trailer; WebP checks RIFF/chunks/frame headers, including animation; AVIF checks bounded BMFF containers and basic image metadata/media presence.
- This is NOT full codec decoding. In particular AVIF item extents/references and AV1 payload semantics are not fully validated. See `tests/fixtures/README.md` for the scope and synthetic fixture provenance.
- New default-command refusal prevents `npm run deploy`, `npm run db:init:remote`, and `npm run db:migrate:remote` from making a remote call. Explicit environment scripts below replace the ambiguous aliases. These names do not protect against an operator deliberately editing resource IDs or bypassing scripts with raw Wrangler; inspect the target config before every remote operation.
- Production Vite builds require the exact approved API origin. Preview builds require `--mode preview`. Custom domains require an intentional update to `PRODUCTION_API_ORIGIN` first.
- Existing `power-frontend/dist` is still the old Preview artifact. The new, ignored `power-frontend/dist-production` is the separate local Production artifact. Its JS contains the approved Production origin and contains neither `power-preview-20260924` nor `localhost`. Both retain the SPA `_redirects` rule.
- Local tests: Backend 30/30, including 11 new image-validation tests and workerd uploads for all five formats against mocked B2; Frontend 7/7. No package installation was necessary. Tests/build ran with Node 24.18.0 and the existing lockfiles; `.node-version` remains 22, so reproduce on the chosen deployment Node release if using a server-side build instead of this artifact.
- `git diff --check` passed in Frontend. Backend has no Git repository; `git diff --no-index --check` against an empty baseline checked all 12 changed text files with no whitespace errors. The same check covered all 7 changed Frontend text files, including untracked ones. CRLF conversion warnings are not test failures.
- Early test failures were resolved: the former inline PNG fixture had an invalid IDAT CRC; it was replaced with a real encoded fixture. A Node/Miniflare FormData interop issue in the new runtime test was corrected by sending serialized multipart HTTP bytes. The initial production artifact still retained an unreachable development localhost literal; separating the compile-time development branch removed it from the final bundle.

## Exact config and command targets — DO NOT RUN until separately authorized

| Target | Config | Worker | D1 | Storage |
| --- | --- | --- | --- | --- |
| Production | `wrangler.jsonc` | power-api | power-db (`dc900d00-5f29-4ad0-a798-5dbc36904d11`) | B2 power-images |
| Preview | `wrangler.preview.jsonc` | power-preview-20260924 | power-preview-20260924-db (`1f81c155-7bf6-4efa-8918-ac3311d40528`) | No B2 credentials/bucket |

Live Preview settings were re-read: only JWT_SECRET, DB, AUTH_RATE_LIMITER, STORAGE_DRIVER and PBKDF2_ITERATIONS were present. No B2 credential or bucket setting was present. Production config references secrets by name only; their values were not read/printed. No automatic secret inheritance exists between these separate Worker scripts.

From **C:\Users\paroot\Desktop\power-worker**, the following are future deployment commands, not validation commands:

```powershell
# Preview ONLY
npm run deploy:preview
# expands to: wrangler deploy --config wrangler.preview.jsonc --name power-preview-20260924

# Production ONLY, after the database and storage prerequisites below
npm run deploy:production
# expands to: wrangler deploy --config wrangler.jsonc --name power-api
```

Migration scripts are also explicit: `npm run db:migrate:preview` and `npm run db:migrate:production`, each using its named database and config. Production initialization is intentionally not provided as a replacement script. The existing `seed-admin --remote` option remains a Production account mutation; do not use it as a smoke test or run it unless an account creation/reset is specifically intended.

Use the installed, locked Wrangler binary for Pages, **from the Frontend directory**, with an explicit project and branch. The existing Wrangler version can delegate some Pages operations to Workers when no Pages project exists; `--force` explicitly opts out of that delegation. Never run these Pages commands from the Backend folder and never substitute `--name` for a complete environment config.

```powershell
Set-Location C:\Users\paroot\Desktop\power-frontend
# FUTURE Production Pages upload; not executed during this task:
node ..\power-worker\node_modules\wrangler\bin\wrangler.js pages deploy .\dist-production --project-name power-elec-site --branch main --force

# FUTURE Preview Pages upload, only after building Preview to its own output:
node ..\power-worker\node_modules\wrangler\bin\wrangler.js pages deploy .\dist --project-name power-preview-20260924 --branch audit --force
```

Local builds (do not themselves deploy):

```powershell
# Production artifact, preserve existing Preview dist:
$env:VITE_API_URL='https://power-api.power-elec.workers.dev'
npm run build -- --outDir dist-production

# Preview, only when intentionally replacing the local Preview artifact:
$env:VITE_API_URL='https://power-preview-20260924.power-elec.workers.dev'
npm run build -- --mode preview
```

Pages currently uses direct uploads, not a configured Git build. Changing a Dashboard variable does not change an already built bundle. If Git Builds are introduced later: build `npm run build`, output `dist`, set the approved VITE_API_URL in Production; configure Preview's command with `--mode preview`. `_redirects` handles SPA refresh. The prior Preview HTTP refresh checks passed; this new artifact was not deployed or browser-tested remotely.

## D1 migration safety and exact backup

Existing files: unchanged baseline `schema.sql`, and one migration `migrations/0001_security_and_cleanup.sql`.

The migration adds:

- `admins.token_version`, `admins.is_active`.
- `items.version`, `items.image_storage` (defaults old rows to B2).
- Table `image_cleanup` with filename/storage composite primary key, due time, attempts and lease.
- Indexes `idx_image_cleanup_due`, `idx_items_image`.
- Triggers `admins_revoke_sessions`, `items_cleanup_delete`, `items_cleanup_update`.

There is no DROP, TRUNCATE or immediate row DELETE in the migration. Its trigger bodies later update token versions and enqueue old images when items change or are deleted. Installing it alone does not run a storage deletion or populate cleanup for every existing image. It preserves existing hashes/content on the tested baseline. It is **not idempotent**: all four ALTER ADD COLUMN statements, the new table, indexes and triggers lack IF NOT EXISTS protection. Repeating it fails; tests verify that first failure. Adding IF NOT EXISTS would not prove existing definitions are compatible, so the migration was not rewritten.

Preview's applied migration was verified in the preceding read-only audit. Production's schema/history is **not verified in this task**. Do not claim applicability until a separately authorized preflight checks column definitions, trigger/index/table names, foreign keys, prior/partial migration state and that all legacy image keys really refer to B2. A full rollback may require coordination with image versions, since D1 restore does not restore B2.

Before applying once:

1. Freeze administrative writes and retain the deployed Worker version ID.
2. Record an exact D1 Time Travel bookmark/timestamp and verify its available recovery window.
3. Export the **complete existing power-db schema and data**, including admins/password hashes, services, categories, items, triggers/indexes and any migration table. Save outside Git with restricted access, for example `C:\Users\paroot\Backups\Power\power-db-before-security-YYYYMMDD-HHMM.sql`. Treat the export as confidential. Do not place it in public assets, tests or the frontend.
4. Validate that export through a restore rehearsal to a disposable local/test database before relying on it. Record table counts and schema inventory for comparison; do not expose password hashes in logs.
5. After confirming the migration is absent and no conflicting partial objects exist, apply it once using `npm run db:migrate:production` from the Backend directory. This command is listed for the future only; it was NOT run.
6. Let Wrangler record success. Its current migration table uses `id INTEGER PRIMARY KEY AUTOINCREMENT`, `name TEXT UNIQUE`, and `applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL`; it records the relative filename, not a checksum. Do not manually mark a partially applied migration complete. If there is a conflict, stop and reconcile actual schema/history rather than rerunning raw SQL.

## B2 review and safe test plan

Current non-secret config: HTTPS S3 endpoint `s3.us-east-005.backblazeb2.com`, region `us-east-005`, bucket `power-images`. Credentials are obtained only from Worker bindings. Endpoint validation rejects credentials, HTTP, paths, query strings and fragments. Region is passed to AWS signing but not independently matched against the endpoint; validate the pair operationally. Bucket names are trusted deployment configuration, not user input.

PUT and GET have a 20-second timeout; DELETE has 10 seconds. SDK retries are zero. Cleanup retries live in D1, are sequential, claim at most 10 jobs with five-minute leases, and back off up to one hour. A 15-second processing deadline stops starting additional work, but an in-flight request can finish after the deadline. Persistent failures need monitoring; no dead-letter service is added.

Uploads use UUID keys and an allowlisted MIME matching the validated structure. They reserve a D1 cleanup record before B2 upload. A crash/failed PUT/failed DB attach leaves a recoverable reservation, due within one hour; successful attachment and reservation removal use D1.batch. Replacements/cascades enqueue old keys. A lost response can leave an orphan temporarily, not silently exempt it from cleanup. DB-derived legacy cleanup keys and bucket ownership still need preflight verification; getStorage itself is not a general key-sanitization boundary. The public image route rejects path/control keys but proxies storage Content-Type and does not consult D1: confirm that the bucket contains only intended public images, including legacy objects.

Backblaze S3 DELETE without `versionId` creates a delete marker, rather than proving permanent deletion of every historical version. The current code does not supply versionId. Review Lifecycle/retention and delete-marker behavior before enabling Production cleanup. Retrying a delete may create further markers. Source: https://www.backblaze.com/apidocs/s3-delete-object

No real B2 test was run because no separately restricted test credentials/bucket were supplied. Safe future test:

1. Create or nominate a **separate test bucket**, with a new key restricted to that bucket and only needed read/write/delete permissions. Never copy Production secrets or use a shared key.
2. Use a separate local Worker/D1 test setup and explicitly configure the test endpoint, matching region, bucket and key. Check the target before the first PUT. Do not attach this key to Production.
3. Upload the five valid fixtures; reject MIME spoofing, truncated inputs, SVG and >5 MiB files before storage calls. Verify actual GET MIME/body and UUID keys.
4. Replace an image, delete an item, delete a test category with >10 images, and observe the D1 outbox draining in bounded batches. Verify live references remain intact.
5. Exercise failed credentials/temporary failures, restore the test key and verify retry recovery and orphan cleanup. Never simulate failures by changing Production credentials.
6. Inspect version/delete-marker results and storage usage in the test bucket; approve the Lifecycle policy before enabling Production cleanup. Remove only the test resources afterwards.

## Final controlled order

1. Commit/archive this complete release and lockfiles; select the build runtime and retain rollback artifacts. Current Backend is not a Git repository.
2. Complete the D1 preflight/backup/restore rehearsal and B2 isolated tests; verify CPU budget for 100000 PBKDF2 and container validation on the intended plan.
3. Freeze admin writes; apply the migration once; check schema and preserved data. Do not run schema.sql/seed as deployment hooks.
4. Verify Production bindings/secrets/rate-limit namespace and cleanup policy, then deploy only the explicit Production Worker target. Current config enables Cron immediately; satisfy storage/cleanup prerequisites BEFORE that deployment. Existing JWTs need a fresh login.
5. Verify the Worker, then upload the inspected `dist-production` artifact to `power-elec-site`. Keep the Preview project and database separate.
6. Run authorized smoke checks with dedicated disposable records: SPA refresh, public reads/CORS, unauthenticated rejection, login/reset/revocation, each image format, version conflicts and bounded cleanup. Do not use `smoke-preview.mjs` on Production: it rotates a secret and mutates test accounts.
7. Monitor 5xx, 401/429, CPU, D1 errors, cleanup backlog age/attempts and B2 failures/retained versions. Stop mutations and follow the coordinated rollback plan if a critical check fails.
