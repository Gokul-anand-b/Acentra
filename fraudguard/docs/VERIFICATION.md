# Verification record

Executed locally on 2026-09-30. These are observed results, not performance or fraud-accuracy claims.

| Check | Result |
| --- | --- |
| Backend tests on native PostgreSQL 15 | 37 passed |
| SQLite test suite before final case-close refinement | 33 passed, 2 PostgreSQL-specific tests skipped |
| Ruff application/test checks | Passed |
| Alembic initial upgrade on PostgreSQL | Passed |
| Alembic model/schema drift check | No new upgrade operations |
| TypeScript and Vite production build | Passed, split chart/graph bundles |
| Playwright desktop investigation workflow | Passed: login, DB dashboard, filters, graph, review, clear, audit evidence |
| Playwright rules/import/audit workflow | Passed |
| Playwright mobile overflow regression | Passed at 390px viewport |
| SNS/SES adapter contracts | Passed with mocked SDK responses; no live AWS call |
| Local worker delivery | Ran against PostgreSQL; synthetic critical alerts marked LOCAL_LOGGED |
| Docker Compose configuration | Validated |
| Full Docker image build and Compose execution | Not run: Docker daemon stopped |
| GitHub Actions | Workflow provided, not executed remotely |
| Random Forest training and live inference | Trained on 30,000 synthetic records; browser verified persisted ML output |
| Input, case notes, notifications, print workflow | Passed in Playwright; PDF generated from case workspace |
| GraphSAGE / Neo4j | Deferred per request; not implemented |

The test suite covers positive/negative rule scenarios, amount currency isolation, missing geography, simultaneous transactions, historical cutoffs, registry extension, capping, plugin failures, malformed inputs, authentication, roles, login throttling, idempotency, mapped imports, row errors, simulation without persistence, persisted rule snapshots, stale review/configuration writes, case lifecycle, UTC daily aggregation, and notification retries.

PostgreSQL-specific tests also verify that simultaneous customer ingestion is serialized and another worker skips an already-locked outbox event. The final case-close refinement has an API regression test proving a case cannot close before its transaction is resolved, then can transition from CLEARED to CLOSED. Blank review reasons are rejected after whitespace normalization.

The backend test dependency emits one Starlette/httpx deprecation warning. Tests pass; a future dependency update should follow the test client's documented replacement.

Screenshots are from the running application with explicitly synthetic database records:

- [Overview](screenshots/overview.png)
- [Investigation](screenshots/investigation.png)
- [Mobile](screenshots/mobile.png)

The sample repository and original user documents were not modified. The new project has its own Git repository with uncommitted implementation files. Generated credentials, local database storage, environments, and dependencies are ignored.

## Prototype completion pass

The four browser scenarios passed (three core scenarios in the first run; the added ML/case/print scenario passed after correcting the model loader to explicitly allow the locally trained scikit-learn tree storage type). No browser page errors were observed. Production build, Ruff, and Docker Compose configuration validation passed. No live AWS delivery was attempted.

The added API regression verifies the flagged demo, notification retry eligibility, retry audit path, case detail retrieval, and administrator restrictions. Random Forest metrics and reproducible provenance are in [ML_RESULTS.json](ML_RESULTS.json); live predictions remain advisory.

New artifacts: [input workbench](screenshots/workbench.png), [case workspace](screenshots/case-workspace.png), [model report screen](screenshots/model.png), and [printed investigation PDF](FraudGuard-investigation-report.pdf).
