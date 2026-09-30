# FraudGuard: input, ML, cases, reports, and notifications

## What is now implemented

The prototype uses four deterministic fraud rules **plus a trained Random Forest**. React Flow displays transaction relationships. GraphSAGE and Neo4j are deferred; neither is required to run this version.

The ML result is advisory and shown separately from the rule score. It does not silently change alert thresholds or decide that a transaction is fraud. The model was trained on USD amounts; INR/EUR/GBP records continue to use the rules and explicitly report the currency mismatch for ML.

## Fastest complete demo

1. Sign in with your existing demo administrator account.
2. Open **New transaction** in the sidebar.
3. Click **Run flagged demo**. This creates five synthetic baseline records plus one suspicious record, then opens its investigation.
4. Follow the pipeline: Received → Rules evaluated → ML analysis → Relationships → Human review → Notification.
5. Expand the rule evidence. Explore the **React Flow** graph by dragging nodes, panning, zooming, or selecting an entity.
6. Enter a reason and click **Escalate to case**. Use **Open case workspace** to open the actual case detail page, assign a reviewer, and add notes.
7. Clear or confirm the linked transaction. A resolved case can then be closed.
8. Click **Print report** and choose your printer or **Save as PDF**.
9. Open **Notifications** to see the actual outbox event and its provider/status. Local mode reports **Local logged**.

## Where to enter your input

### One transaction

Open **New transaction** (`/input`). Enter:

- Transaction ID: unique reference, e.g. `TX-MY-001`.
- Customer ID and merchant ID: identifiers consistent with previous records.
- Amount and currency.
- Event time: your local time; the app converts it to timezone-aware UTC.
- Optional device and IP address.
- Optional observed latitude and longitude, provided together.

**Fill example** fills a valid synthetic example. Check **Synthetic / test data** for generated examples; leave it unchecked for your own non-synthetic transaction records. Click **Evaluate transaction** to persist the input and open the analysis.

The rules need history. A single brand-new customer cannot demonstrate an amount baseline or impossible travel. Use **Run flagged demo** for a complete history-based example.

### CSV or JSON batch

Open **Data import** (`/import`). Sample download buttons are provided on that page.

Files already available in this project:

| File | Purpose |
| --- | --- |
| `frontend/public/samples/transactions.csv` | Six synthetic events; final event triggers the three required rules |
| `frontend/public/samples/transactions.json` | Same six events in JSON; choose either CSV or JSON |
| `frontend/public/samples/ml-holdout-sample.csv` | Twenty public synthetic records from the model's test period |

Select the file, leave CSV mapping as `{}`, check **Synthetic / test data**, and click **Import and evaluate**. Re-importing the same IDs reports duplicates. CSV limit is 5 MB and both import formats accept up to 2,500 records per request.

Required canonical headers:

```text
id,customer_id,merchant_id,amount,timestamp
```

Optional:

```text
currency,latitude,longitude,device_id,ip_address,card_id,fraud_label
```

Example row:

```csv
id,customer_id,merchant_id,amount,currency,timestamp,latitude,longitude
TX-MY-001,CUSTOMER-001,MERCHANT-001,49.99,USD,2025-07-01T10:00:00Z,13.0827,80.2707
```

When your CSV headers differ, enter a mapping from canonical name to source column, e.g. `{"id":"trans_num","customer_id":"customer","merchant_id":"merchant","amount":"amt","timestamp":"event_time"}`. A model label is optional for inference. Do not put a label in an input merely to influence the result: it is excluded from the feature vector.

## Dataset and training

Downloaded: **30,000 public synthetic Sparkov transaction records** from a Hugging Face CSV mirror of the Kaggle dataset. This is a bounded sample, not the full dataset and not real financial data.

Local paths:

```text
fraudguard/data/raw/sparkov_sample.csv             downloaded sample
fraudguard/data/dataset_manifest.json             URLs, SHA-256, provenance
fraudguard/data/processed/sparkov_canonical.csv    normalized training records
fraudguard/data/processed/input-example.json      example canonical input
fraudguard/models/metadata.json                   active model and metrics
fraudguard/models/random-forest-*.skops           trained model artifact
fraudguard/docs/ML_RESULTS.json                   measured results report
```

The raw sample is normalized to canonical identifiers. Synthetic card numbers are hashed into customer IDs; names, addresses, and card numbers are not used as features. Location fields are intentionally omitted because home/merchant coordinates do not prove customer travel. No fake device IDs or coordinates are fabricated for downloaded data.

Model inputs: log amount, cyclical hour, weekday, prior same-currency history count/mean/median/deviation, amount-to-median ratio, and recent transaction count. Historical features are computed before appending each transaction to its customer's history. Labels, record IDs, merchant names, and source profile names are excluded.

Chronological split: 21,000 training, 4,500 validation, 4,500 test records (timestamp ties remain in one partition). The decision threshold is chosen using validation F1; the test labels are not used for training or threshold selection.

Measured test results:

- Precision: **73.6%**
- Recall: **62.9%**
- F1: **0.678**
- PR-AUC: **0.716**
- Test fraud labels: **62** of 4,500 records
- Confusion matrix: 4,424 true negatives, 14 false positives, 23 false negatives, 39 true positives

These are synthetic-sample measurements, not production guarantees. Model output has not been probability-calibrated. New customers have limited historical features. A holdout CSV imported without the earlier history can produce different live predictions from the offline evaluation; this is explicitly a cold-start demonstration.

Open **Model intelligence** (`/model`) to inspect these measured results and print the model report. Existing assessments are historical snapshots: they are not rewritten after model installation. Submit a new transaction to see the ML result stored with its assessment.

Reproduce locally:

```bash
cd fraudguard
python3 scripts/download_dataset.py --rows 30000
cd backend
uv sync --frozen
uv run python -m app.ml.train
```

The training command saves a new version and atomically updates the metadata pointer. The application reads the new version on subsequent evaluations. Training is an explicit CLI action in this prototype, not a web button that executes arbitrary code. Model artifacts use skops safe loading; models supplied by external users are not accepted.

## Notifications

A persisted rule score ≥60 automatically queues an outbox event. The worker delivers it asynchronously.

- `PENDING`: queued.
- `LOCAL_LOGGED`: payload logged locally; **no external message sent**.
- `SENT`: AWS SNS/SES accepted the request and returned a message ID.
- `RETRY`: a delivery failure is waiting for another attempt.
- `FAILED`: attempts exhausted; administrators can use **Retry** to requeue it.

To send real notifications, configure SNS or SES in `backend/.env` for native execution, or root `.env` for Docker, using the README instructions. Restart API/worker after changing provider configuration. Newly ingested events use the configured provider; existing outbox records retain their original provider. No AWS resources were provisioned and no live email/SMS delivery is claimed.

## Printing

Transaction and case investigation pages have **Print report**. Model intelligence has **Print model report**. The print stylesheet removes navigation and action controls, preserves evidence and the graph, and supports browser **Save as PDF**. Printing opens your browser/system print dialog; it does not automatically send a document to a physical printer.
