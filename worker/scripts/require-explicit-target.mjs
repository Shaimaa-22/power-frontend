// Intentionally performs no network calls, subprocesses or file writes.
console.error('Ambiguous remote command disabled. Choose deploy:preview, deploy:production, db:migrate:preview or db:migrate:production only after checking the named config and resource IDs. Never initialize the existing production database. See PRODUCTION-ACTIONS.md.');
process.exitCode = 1;
