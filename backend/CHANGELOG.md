# Changelog

## Unreleased

- Fix: Use `record_id` for `nutrition_records` and prevent SQL error during nutrition sync.
- Fix: Reuse shared DB pool in `scripts/test_db_connection.js` so SSL and URL parsing are applied.
- Fix: Allow mobile upsert flows to use admin where required during validation (temporary; no code changes remain).
- Cleanup: Removed debug logging added during troubleshooting.
