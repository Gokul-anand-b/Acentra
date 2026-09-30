# FraudGuard

**An explainable fraud rule engine with a working analyst review console.**

Detect → Explain → Investigate → Review

**Prototype update:** trained Random Forest, React Flow, single-record input, case details, notification center, and print reports are now connected. Start with [the complete usage guide](docs/PROTOTYPE_GUIDE.md). GraphSAGE and Neo4j remain deferred.

This is the first runnable implementation of the supplied `ps.md`, refined using the master prompt, context document, prior discussion, and sample investigation repository. It implements the complete core transaction-to-review path, plus graph investigation, case notes, rule configuration, authentication, and imports. It does **not** claim to implement every advanced feature in the master prompt. See [evaluation and scope](docs/PROJECT_EVALUATION.md).

![Database-backed analyst overview](docs/screenshots/overview.png)

## What works

- Python plugin registry with independent velocity, unusual amount, impossible travel, and shared-device rules.
- PostgreSQL transactions, persisted assessment snapshots, versioned configuration, review decisions, cases, audit events, and notification outbox. SQLite is available for single-process development and unit tests.
- REST ingestion; mapped CSV and JSON imports with row-level validation, deduplication, and chronological processing within each batch.
- Real database-derived dashboard, filtered/paginated alerts, evidence details, and React Flow relationship investigation.
- Mark reviewed, clear, confirm fraud, escalate; assign cases and add notes. Stale review/configuration writes return HTTP 409.
- Argon2 passwords, expiring JWTs, admin/reviewer permissions, required secrets, login throttling, and secure response headers.
- A separate durable outbox worker with console, AWS SNS, and AWS SES adapters. Failed delivery never deletes a transaction.
- Deterministic, explicitly labeled synthetic scenarios. No fabricated dashboard metrics, predictions, or AWS delivery confirmations.
- API-only rule simulation without persistence. The UI uses 15-second polling.

## Quick start: Docker

Requires Docker Compose, Python 3 for generating configuration, and available ports 5173 and 8000.

```bash
cd fraudguard
python3 scripts/init-env.py
docker compose up --build -d
docker compose exec backend python -m app.cli create-user --email admin@example.com --name "Risk Admin" --role admin
docker compose exec backend python -m app.cli create-user --email reviewer@example.com --name "Risk Analyst" --role reviewer
docker compose exec backend python -m app.cli generate-demo-data --transactions 500
```

The user commands securely prompt for a password of at least 12 characters. There are **no default or hardcoded credentials**. The configuration script generates ignored secrets and preserves existing `.env` files.

- Console: http://localhost:5173
- API documentation: http://localhost:8000/docs
- Health: http://localhost:8000/health

Compose starts PostgreSQL, migrations, API, notification worker, and frontend. The PostgreSQL outbox replaces the Redis/Celery combination proposed in the master prompt; queue state and transaction state share a commit.

```bash
# Explicit migration and operational commands
docker compose run --rm migrate
docker compose logs -f worker
docker compose down
```

`down` preserves the named database volume. Migration execution is a separate service so multiple API/worker processes do not race to apply the schema.

## Local development

Requires Python 3.12+, uv, Node 22.12+ (or 20.19+), and npm.

```bash
cd fraudguard
python3 scripts/init-env.py
cd backend
uv sync --frozen
uv run alembic upgrade head
uv run python -m app.cli init-rules
uv run python -m app.cli create-user --email admin@example.com --role admin
uv run python -m app.cli generate-demo-data --transactions 500
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```bash
cd fraudguard/backend
uv run python -m app.worker
```

In a third terminal:

```bash
cd fraudguard/frontend
npm ci
npm run dev
```

The generated backend `.env` initially uses `sqlite:///./fraudguard.db`. For PostgreSQL, change only `DATABASE_URL` before migration:

```text
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/fraudguard
```

Use PostgreSQL for concurrent ingestion and multiple notification workers. SQLite cannot provide PostgreSQL advisory locks or `SKIP LOCKED` semantics. Vite proxies `/api` to port 8000; Docker's Nginx performs the equivalent routing.

This workspace also has a running local PostgreSQL demonstration; its specific paths and restart commands are in [local session notes](docs/LOCAL_SESSION.md).

## Data import

Sign in as admin, open **Data import**, and upload a CSV or JSON array. Required fields:

```text
id,customer_id,merchant_id,amount,timestamp
```

Optional: `currency` (defaults to INR), `latitude`, `longitude`, `device_id`, `ip_address`, `card_id` (token identifier), `fraud_label`.

- Amounts must be positive finite decimal values, with at most two decimal places.
- Timestamps must include timezone information, e.g. `2025-01-01T10:00:00+05:30`; future times are rejected.
- Both coordinates must be present, or both omitted. Use observed transaction locations, not a cardholder's home address.
- Use tokenized card identifiers, never full payment-card numbers.
- IDs are unique; duplicates are reported rather than overwritten.
- JSON accepts canonical fields; CSV additionally supports column mappings.
- Limit: 2,500 rows/request; CSV 5 MB. Larger imports should be split chronologically.

Example mapping in the UI or multipart `mapping` field:

```json
{"id":"trans_num","customer_id":"customer","merchant_id":"merchant","amount":"amt","timestamp":"event_time"}
```

Use the authenticated interactive API docs for REST ingestion, bulk import, and simulation. If a shell token is already set in `TOKEN`:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  -F 'file=@transactions.csv' \
  -F 'mapping={}' \
  http://localhost:8000/api/import/csv
```

Import responses contain received, inserted, duplicate, invalid, and processed counts plus row errors. File-order ties are preserved when timestamps match. Persisted assessments are not retroactively rewritten if older transactions arrive later.

## Rules and scoring

| Plugin | Default trigger | Contribution |
| --- | --- | --- |
| Transaction velocity | More than 5 transactions in 10 minutes, including the current event | 25 |
| Unusual amount | At least 5 same-currency observations; amount > 5× median and robust deviation check | 30 |
| Impossible travel | More than 50 km at >900 km/h, or simultaneous distant locations | 40 |
| Shared device | Device observed across at least 3 distinct customers | 20 |

Amount evidence includes mean, median, population standard deviation, MAD, and empirical percentile. The baseline uses same-currency records from the latest 200 prior customer transactions. Velocity is an indexed count over the configured time window and is not limited to those 200 records.

The current raw score is the sum of triggered rule contributions. The displayed score is `min(raw_score, 100)`. Levels: LOW <30; MEDIUM 30–59; HIGH 60–79; CRITICAL ≥80. High/critical cutoffs are configurable in environment settings. Any triggered rule appears in the alert queue, even if its total score is LOW. Rule failures and an empty enabled-rule set also enter manual review with `complete=false`.

Behavioral statistics and graph context are visible, but are not multiplied into a speculative hybrid score. Shared-device points are counted once, in their own rule. **GNN is deferred. A trained Random Forest now provides a separate advisory output for USD records; see Model intelligence. Rule scores remain review priorities, not probabilities.**

Admin changes in **Rule engine** affect future assessments only. Evidence preserves a copy of the parameters and configuration version.

To add a plugin:

1. Add a Python module implementing `FraudRule` from `app/rules/base.py`.
2. Register its class with `@register`, define defaults/bounds, and implement `evaluate` returning `RuleResult`.
3. Include the trusted module in the JSON `RULE_MODULES` environment setting alongside existing modules.
4. Run `python -m app.cli init-rules` and restart the API. No engine edits are needed.

Example configuration:

```text
RULE_MODULES=["app.rules.velocity","app.rules.amount","app.rules.geo","app.rules.device","app.rules.my_rule"]
```

Web users cannot upload or execute arbitrary Python. `POST /api/rules/simulate` runs current rule configuration against supplied transaction data without persistence.

## Notifications

`NOTIFICATION_PROVIDER=console` is the default. Worker output is recorded as `LOCAL_LOGGED`, never `SENT`.

For SNS, configure:

```text
NOTIFICATION_PROVIDER=sns
AWS_REGION=ap-south-1
AWS_SNS_TOPIC_ARN=your-topic-arn
```

For SES, configure:

```text
NOTIFICATION_PROVIDER=ses
AWS_REGION=ap-south-1
AWS_SES_FROM_EMAIL=verified-sender@example.com
AWS_SES_TO_EMAIL=fraud-team@example.com
```

Provide AWS credentials through environment variables, a configured profile for local execution, or the runtime's IAM role. Never commit credentials. SNS needs a topic with the intended subscriptions and `sns:Publish` permission. SES needs an eligible sender/recipient setup and `ses:SendEmail` permission. See the official [SNS publish API](https://docs.aws.amazon.com/boto3/latest/reference/services/sns/client/publish.html) and [SES send_email API](https://docs.aws.amazon.com/boto3/latest/reference/services/ses/client/send_email.html).

A persisted score ≥ `HIGH_RISK_THRESHOLD` produces one uniquely keyed outbox event. Worker attempts use exponential delay and stop at `FAILED` after five failures. Detail pages show provider, status, attempts, and failure type. Rows retain the provider selected when created; reconfiguring the environment does not reinterpret historical events.

Delivery is **at least once**: if a worker crashes after AWS accepts a message but before the database commit, a retry can duplicate the external message. Every payload includes an event ID for consumer deduplication. Console output is not AWS delivery. AWS `SENT` means the API accepted the request, not that a human read the notification. Live AWS was not exercised in this workspace.

## Structure

```text
fraudguard/
├── backend/
│   ├── app/
│   │   ├── api.py, main.py, auth.py, config.py
│   │   ├── models.py, schemas.py, database.py
│   │   ├── rules/         # interface, registry, independent plugins
│   │   ├── services/      # evaluation, persistence, graph, import, delivery
│   │   ├── cli.py, demo.py, worker.py
│   ├── alembic/           # versioned schema migration
│   ├── tests/             # unit, API, AWS contract, concurrency tests
│   └── pyproject.toml, uv.lock, Dockerfile
├── frontend/
│   ├── src/pages/         # overview, alerts, details, rules, operations
│   ├── src/               # typed API client, shared UI, app shell
│   ├── e2e/               # real browser workflow checks
│   └── package.json, package-lock.json, Dockerfile
├── docs/                  # evaluation, architecture, verification, screenshots
├── scripts/init-env.py
├── compose.yaml, .env.example, Makefile
└── README.md
```

## Verification

```bash
cd backend
uv run pytest -q
uv run ruff check app tests
uv run alembic check
```

By default tests create/dispose an in-memory SQLite database. To test PostgreSQL, use an **empty disposable database with a name ending in `_test`**; the suite creates and drops its tables:

```bash
TEST_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/fraudguard_test uv run pytest -q
```

Browser tests need the API and frontend running in development mode. The ML workflow also requires the trained artifact: follow the dataset download/training commands in [the usage guide](docs/PROTOTYPE_GUIDE.md) first:

```bash
cd backend
uv run python -m tests.prepare_browser
cd ../frontend
npx playwright install chromium
npm run test:e2e
npm run build
```

The browser fixture command creates explicitly synthetic transactions and a dedicated browser-test account. It writes generated credentials to ignored `.runtime/e2e.json`; no secrets are placed in the test source. Rerun it before repeating the decision test because final review decisions are intentionally immutable through the API.

See [verification results](docs/VERIFICATION.md) and [investigation screenshot](docs/screenshots/investigation.png).

## Boundaries and next work

This is a verified development foundation, not a claim of production certification or a completed GNN platform.

- GraphSAGE, Neo4j, backtesting UI, and the natural-language assistant remain deferred. Random Forest training, versioned artifacts, live advisory inference, and chronological holdout metrics are implemented; see the usage guide.
- Graph investigation is bounded to 100 neighboring transactions sharing customer/device/IP, includes merchant/location nodes, and marks truncation. It is not a complete fraud-ring detector.
- Cases currently link one transaction. Multi-transaction cases and reopening final decisions need explicit workflow design.
- Late events use available event-time history but do not rescore subsequent persisted events. A revision/replay pipeline is the next correctness extension.
- Login throttling is per process. Distributed limits, token revocation, MFA/SSO, production TLS, retention policy, and restricted database roles are deployment work.
- Audit history is append-only through the API; it is not cryptographically tamper-proof against a database administrator.
- PostgreSQL locks serialize per-customer ingestion. Shared-device observations across different customers are current committed snapshots, not globally serialized device locks.
- Imports are synchronous, bounded batches. Graph rendering and some detail loading use bounded multiple queries. No throughput benchmark is claimed.
- The console polls every 15 seconds rather than using WebSockets. CSS is custom; Tailwind, React Hook Form, and Zod are not dependencies.
- Docker Compose configuration is validated; the full Docker build/run was not exercised because the host Docker daemon was stopped. PostgreSQL, API, worker, and browser were run natively.
