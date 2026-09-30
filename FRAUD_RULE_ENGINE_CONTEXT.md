# Fraud Rule Engine with Review Console — Complete Project Context

## 0. Scope

This context is strictly for the selected problem statement:

> **Python Problem Statement: Fraud Rule Engine with Review Console**
>
> Financial systems need to identify potentially fraudulent transactions based on different risk indicators. A flexible rule engine can evaluate transactions and allow reviewers to investigate suspicious activity.

### Minimum requirements

1. Rule engine for transaction risk evaluation.
2. At least three independent rules:
   - transaction velocity
   - unusual transaction amount
   - impossible geographical location
3. New rules must be addable without modifying the core engine.
4. Persist transactions and fraud flags.
5. React-based reviewer console.
6. Display flagged transactions.
7. Allow reviewers to mark transactions as reviewed or cleared.
8. Send an AWS SES email or SNS notification when a high-risk threshold is crossed.

The implementation should be a real, runnable system. Do not build a UI-only mockup, hardcoded dashboard, fake API, or fake model metrics.

---

# 1. Problem Definition

## What problem are we solving?

A financial transaction can be suspicious because of its relationship to a customer's transaction history, spending behavior, geographic movement, and other entities. Looking at transactions one at a time can miss patterns such as rapid bursts, amount anomalies, or impossible travel.

The system must therefore:

- ingest transactions;
- preserve transaction history;
- evaluate multiple independent risk rules;
- combine rule results into a risk assessment;
- persist the assessment and evidence;
- surface suspicious transactions to human reviewers;
- let reviewers resolve alerts;
- notify an operations/fraud channel when a high-risk threshold is crossed.

## Who is affected?

### Fraud analysts / reviewers

They need to investigate alerts quickly and understand why something was flagged.

### Banks / fintechs / payment platforms

They need transaction monitoring that can adapt when fraud patterns or business rules change.

### Customers

Poorly designed fraud systems can create false positives and block legitimate activity.

### Compliance / risk teams

They need a persistent trail of transactions, flags, reviewer decisions, and evidence.

---

# 2. Our Solution

Build a **Hybrid Fraud Risk & Review Platform**.

Core flow:

```text
Transaction
    |
    v
FastAPI Ingestion
    |
    v
Persist Transaction
    |
    v
Build Customer/Transaction Context
    |
    +-------------------+-------------------+
    |                   |                   |
    v                   v                   v
Velocity Rule      Amount Rule       Impossible-Geo Rule
    |                   |                   |
    +-------------------+-------------------+
                        |
                        v
                 Risk Aggregator
                        |
             +----------+----------+
             |                     |
             v                     v
        LOW/MEDIUM           HIGH/CRITICAL
             |                     |
             |                     +----> AWS SNS / SES
             |                     |
             v                     v
        PostgreSQL          React Reviewer Console
                                   |
                         Review / Clear / Confirm
                                   |
                                   v
                              Audit Trail
```

Advanced layer, only after the core system is working:

```text
Rules
  +
Behavioral Features
  +
Graph Features
  +
Optional GNN
  |
  v
Combined Risk Score
```

---

# 3. Mandatory Rule Design

## 3.1 Transaction Velocity Rule

Detect too many transactions within a configurable time window for the same customer/card/account.

Example:

```text
6 transactions in 10 minutes
threshold = 5
=> trigger
```

Suggested configuration:

```env
VELOCITY_WINDOW_MINUTES=10
VELOCITY_THRESHOLD=5
VELOCITY_SCORE=25
```

Return structured evidence:

```json
{
  "rule_name": "transaction_velocity",
  "triggered": true,
  "score": 25,
  "reason": "6 transactions occurred within 10 minutes",
  "evidence": {
    "transaction_count": 6,
    "window_minutes": 10,
    "threshold": 5
  }
}
```

## 3.2 Unusual Transaction Amount Rule

Compare the current transaction amount with the customer's historical behavior.

Minimum implementation:

```text
current_amount > historical_average * multiplier
```

Better implementation when sufficient history exists:

- mean
- median
- standard deviation
- percentile
- robust deviation / MAD where appropriate

Suggested configuration:

```env
AMOUNT_MULTIPLIER_THRESHOLD=5
AMOUNT_SCORE=30
```

Example evidence:

```text
Current amount: ₹85,000
Historical average: ₹4,200
Multiplier: 20.23x
```

## 3.3 Impossible Geographical Location Rule

Compare the previous and current transaction coordinates and timestamps.

Use the Haversine formula to calculate distance:

```text
distance_km = haversine(previous_lat, previous_lon, current_lat, current_lon)
```

Then:

```text
travel_speed_kmh = distance_km / elapsed_hours
```

Example threshold:

```env
IMPOSSIBLE_TRAVEL_SPEED_KMH=900
GEO_SCORE=40
```

The rule must return:

- previous transaction
- current transaction
- distance
- elapsed time
- estimated travel speed
- configured threshold
- explanation

Do not hardcode a list of cities. Use actual coordinates from transaction data.

---

# 4. Extensible Rule Engine — Critical Requirement

The core engine must not contain business-specific `if/elif` blocks for every rule.

Use a plugin/strategy interface:

```python
from abc import ABC, abstractmethod

class FraudRule(ABC):
    name: str

    @abstractmethod
    def evaluate(self, transaction, context):
        raise NotImplementedError
```

Use a registry:

```text
rules/
  base.py
  registry.py
  velocity.py
  unusual_amount.py
  impossible_location.py
  suspicious_device.py
  suspicious_merchant.py
```

The engine should iterate over registered rules:

```python
for rule in registry.enabled_rules():
    result = rule.evaluate(transaction, context)
```

Adding a new rule should require adding a new rule module/configuration, not editing the engine's decision logic.

---

# 5. Risk Scoring

Each triggered rule contributes a score.

Example:

```text
Velocity           +25
Unusual amount     +30
Impossible geo     +40
------------------------
Raw score          95
```

Normalize to 0-100 if necessary.

Suggested levels:

```text
0-29      LOW
30-59     MEDIUM
60-79     HIGH
80-100    CRITICAL
```

The thresholds must be configurable.

Persist both:

- raw score
- normalized score
- risk level

Do not hide rule-level contributions.

---

# 6. Explainability

Every flagged transaction must explain why it was flagged.

Bad:

```text
Fraud = true
```

Good:

```text
HIGH RISK

- 7 transactions in 8 minutes
- Current amount is 20.2x customer historical average
- 3,800 km travel detected in 22 minutes
```

Persist structured evidence in the database.

---

# 7. Persistence

Use PostgreSQL as the primary database.

Recommended tables:

### users

```text
id
email
password_hash
name
role
is_active
created_at
```

### customers

```text
id
external_customer_id
name
created_at
```

### merchants

```text
id
external_merchant_id
name
category
latitude
longitude
created_at
```

### devices

```text
id
device_fingerprint
first_seen
last_seen
```

### transactions

```text
id
external_transaction_id
customer_id
merchant_id
device_id
card_id
ip_address
amount
currency
timestamp
latitude
longitude
status
fraud_label
created_at
```

### fraud_assessments

```text
id
transaction_id
raw_score
normalized_score
risk_level
rule_score
behavior_score
graph_score
gnn_score
created_at
```

### fraud_rule_results

```text
id
assessment_id
rule_name
triggered
score
severity
reason
evidence_json
created_at
```

### reviews / cases

```text
id
case_number
transaction_id
status
severity
assigned_to
summary
created_at
updated_at
closed_at
```

### audit_logs

```text
id
user_id
action
resource_type
resource_id
old_value_json
new_value_json
ip_address
created_at
```

---

# 8. Reviewer Console

React + TypeScript + Vite + Tailwind.

Required pages:

1. Login
2. Dashboard
3. Flagged Transactions / Alerts
4. Transaction Details
5. Investigation Graph (advanced)
6. Cases
7. Rule Management (admin)
8. Audit Log

Required reviewer actions:

- Mark reviewed
- Clear
- Confirm fraud
- Escalate
- Add note
- Assign case

Every action creates an audit entry.

---

# 9. Dashboard

All numbers must come from the database/API.

Do not hardcode:

```text
Total = 120
High risk = 20
```

Required metrics:

- total transactions
- flagged transactions
- high risk
- critical
- pending review
- reviewed today
- cleared today
- confirmed fraud
- transaction volume over time
- risk-level distribution
- rule-trigger distribution

---

# 10. Transaction Details

Show:

- transaction ID
- customer
- amount
- currency
- timestamp
- merchant
- device
- IP
- current location
- risk score
- risk level
- triggered rules
- rule evidence
- related transactions
- reviewer history
- case status

For impossible travel show:

```text
Previous transaction
Current transaction
Distance
Elapsed time
Calculated travel speed
Threshold
```

---

# 11. AWS Notifications

Minimum requirement permits either AWS SES or SNS.

Implement both behind a common notification interface if practical.

Recommended configuration:

```env
NOTIFICATION_PROVIDER=console
AWS_REGION=ap-south-1
AWS_SNS_TOPIC_ARN=
AWS_SES_FROM_EMAIL=
AWS_SES_TO_EMAIL=
```

Local development:

```env
NOTIFICATION_PROVIDER=console
```

Production:

```env
NOTIFICATION_PROVIDER=sns
```

or:

```env
NOTIFICATION_PROVIDER=ses
```

Notification should occur asynchronously after the fraud assessment is persisted.

A notification failure must not lose the transaction or fraud assessment.

AWS references:

- SNS publish: https://docs.aws.amazon.com/sns/latest/dg/sns-publishing.html
- SES email API: https://docs.aws.amazon.com/ses/latest/dg/send-email-api.html
- SES with AWS SDK/Boto3: https://docs.aws.amazon.com/ses/latest/dg/send-an-email-using-sdk-programmatically.html

AWS documentation confirms SNS can publish to a topic and deliver to subscribed endpoints; SES supports sending through the API/SDK, including Boto3. 

---

# 12. Recommended Technology Stack

## Backend

- Python 3.12+
- FastAPI
- Pydantic
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- psycopg
- Redis
- Celery or equivalent worker
- Pytest
- Boto3

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- Recharts
- React Hook Form
- Zod

## Graph / Advanced

- NetworkX
- PyTorch
- PyTorch Geometric
- GraphSAGE first
- Optional GAT/HGT
- Cytoscape.js for investigation visualization

## DevOps

- Docker
- Docker Compose
- GitHub Actions optional

---

# 13. Data Requirements

The application must support real transaction records supplied by the user/team.

Do not hardcode a single dataset schema into the application.

Create a mapping layer for CSV imports.

Example mapping:

```json
{
  "transaction_id": "trans_num",
  "customer_id": "cc_num",
  "timestamp": "trans_date_trans_time",
  "amount": "amt",
  "latitude": "lat",
  "longitude": "long",
  "merchant_latitude": "merch_lat",
  "merchant_longitude": "merch_long"
}
```

The system should validate:

- required fields
- timestamps
- amounts
- coordinates
- duplicate IDs

Import endpoint:

```text
POST /api/import/csv
```

Return:

```json
{
  "rows_received": 10000,
  "inserted": 9970,
  "duplicates": 20,
  "invalid": 10,
  "processed": 9970,
  "flagged": 483
}
```

Do not silently discard malformed rows.

---

# 14. Most Relevant Datasets

## A. Transaction Fraud Detection — best direct fit

Kaggle:

https://www.kaggle.com/competitions/transaction-fraud-detection/data

The current Kaggle competition describes `FraudTrain.csv` and `FraudTest.csv` with transaction timestamps, amounts, merchant/cardholder details, cardholder latitude/longitude, merchant latitude/longitude, and fraud labels. The page currently describes slightly over 1.4M training records and 469,842 test records across 2024-2025; it also notes the test fraud labels are withheld for evaluation. 

Useful fields for this project include:

- transaction timestamp
- card/customer identifier
- amount
- merchant
- cardholder location
- merchant location
- transaction ID
- fraud label

This is the strongest single dataset for demonstrating:

- transaction velocity
- unusual amount
- geography/location analysis
- fraud labels

Note: the Kaggle competition may require login/invitation/rules acceptance for access to files.

## B. Fraud Detection Handbook — raw simulated data

GitHub:

https://github.com/Fraud-Detection-Handbook/simulated-data-raw

Project:

https://github.com/Fraud-Detection-Handbook/fraud-detection-handbook

The Handbook provides a reproducible simulator and associated raw/transformed data for credit-card fraud research. The simulator is explicitly described as synthetic/approximate rather than real-world data.

Useful for:

- reproducible testing
- time-dependent fraud scenarios
- rule-engine demonstrations
- benchmarking

Raw dataset repository:

https://github.com/Fraud-Detection-Handbook/simulated-data-raw

Transformed dataset repository:

https://github.com/Fraud-Detection-Handbook/simulated-data-transformed

Simulator notebook:

https://github.com/Fraud-Detection-Handbook/fraud-detection-handbook/blob/main/Chapter_3_GettingStarted/SimulatedDataset.ipynb

## C. IEEE-CIS Fraud Detection

Kaggle:

https://www.kaggle.com/competitions/ieee-fraud-detection/data

This benchmark includes transaction and identity files and is useful for richer behavioral/device/identity features. It is a competition dataset, so its competition rules apply.

Useful for:

- behavioral features
- device/identity patterns
- advanced ML
- graph construction using shared identifiers

It is less direct than the transaction-fraud dataset for the three mandatory geography fields.

## D. ULB Credit Card Fraud Detection

Kaggle:

https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud

Zenodo mirror:

https://zenodo.org/record/7395559

The dataset contains 284,807 transactions and 492 fraud cases. It is highly imbalanced and largely anonymized/PCA-transformed, with `Time`, `Amount`, and `Class` directly usable.

Useful for:

- amount analysis
- time/velocity-style research
- fraud classification benchmarking

Not suitable as the primary dataset for impossible geography because original location/merchant/device fields are not available.

## E. IBM AMLSim — optional graph/transaction-monitoring research

GitHub:

https://github.com/IBM/AMLSim

AMLSim generates synthetic banking transactions and known money-laundering patterns for research, graph algorithms, and transaction-monitoring experiments.

Use only as an optional advanced/graph reference. It is broader AML rather than a direct match to the three mandatory fraud rules.

---

# 15. Dataset Recommendation

## Primary dataset

Use:

**Kaggle Transaction Fraud Detection**

because it has the strongest direct field coverage for this problem statement, especially timestamp, amount, card/customer context, and geographic coordinates.

## Secondary/testing dataset

Use:

**Fraud Detection Handbook simulated data**

for reproducible rule testing and synthetic scenario generation.

## Advanced ML benchmark

Use:

**IEEE-CIS Fraud Detection**

when implementing richer behavioral/device/identity analysis.

## Do not use ULB as the only dataset

Its anonymized feature set is excellent for fraud ML benchmarking but does not directly provide the geographic/entity data needed for the mandatory geo rule.

---

# 16. Relevant Open-Source GitHub References

These are reference implementations only. Do not blindly clone or merge them. Study their architecture and implement an original system satisfying this problem statement.

## 16.1 Exact user-provided reference — Fraud Investigation System

https://github.com/SivaSabariGanesan/Fraud-Investigation-System

This is highly relevant for the reviewer/investigation side.

Its current repository describes:

- FastAPI backend
- React + TypeScript + Vite dashboard
- persistent SQLite audit storage
- TigerGraph Cloud
- Groq LLM reasoning
- deterministic R1-R10 policy rules
- evidence-request lifecycle
- case/investigation workflow
- interactive graph visualization
- chronological audit trail

Use it as inspiration for:

- case management
- graph investigation
- evidence display
- analyst workflow
- audit trail

Do not copy its architecture wholesale because the selected problem specifically requires a transaction risk rule engine with velocity, amount, and impossible-location rules plus AWS SES/SNS notification.

## 16.2 pelzade127/fraud-detector — very close to core rule logic

https://github.com/pelzade127/fraud-detector

Useful because it explicitly documents:

- real-time fraud scoring
- stateful transaction history
- velocity rules
- amount anomalies
- geolocation analysis
- impossible-travel detection using Haversine distance
- behavioral profiling
- explainable reason codes
- modular rules engine
- REST API
- synthetic test scenario generation

This is one of the best references for the **core Python fraud engine**.

## 16.3 ManasiNarkhede/transaction-fraud-detection

https://github.com/ManasiNarkhede/transaction-fraud-detection

Useful reference for:

- React frontend
- FastAPI backend
- ML risk scoring
- configurable rules
- dashboard
- audit logging
- transaction ingestion

## 16.4 lalitofficial/AEGIS

https://github.com/lalitofficial/AEGIS

Useful reference for:

- FastAPI
- React/Vite
- PostgreSQL
- real-time fraud analysis
- risk profiling
- graph anomaly/ring detection
- analyst dashboard
- fraud alerts
- case workflows
- Docker

Its README also describes Graph GNN support in its architecture.

Important: its roadmap identifies a pluggable rule engine as a future item in that repository, so our project should make the pluggable rule architecture a core requirement from day one.

## 16.5 opensyndicate/risk-triage

https://github.com/opensyndicate/risk-triage

Useful reference for:

- deterministic transaction risk scoring
- velocity checks
- geo mismatch
- device signals
- account history
- approve/review/block-style decisions
- explanation of signals

The project explicitly describes itself as heuristic/advisory rather than a trained fraud model. Use it as a rule-scoring reference, not as proof of production fraud accuracy.

## 16.6 sofeikov/ezrules

https://github.com/sofeikov/ezrules

Highly relevant to the extensible rule-engine requirement.

It describes an open-source transaction-monitoring engine with:

- business-rule management
- rule lifecycle
- testing/backtesting
- auditability
- cases
- graph-derived statistics
- access control
- PostgreSQL
- FastAPI
- Celery

Use it as an architectural reference for rule lifecycle and backtesting.

## 16.7 Vedag812/FraudLens

https://github.com/Vedag812/FraudLens

Useful as an advanced fraud-system reference for:

- FastAPI
- Celery/Redis
- large transaction processing
- anomaly detection
- vector similarity
- dashboard
- financial fraud intelligence

It is broader than the selected problem statement, so treat it as an advanced reference, not the baseline implementation.

## 16.8 GraphSAGE / GNN banking fraud reference

https://github.com/sudsho/gnn-fraud-detection-banking

Useful for the optional graph-intelligence layer.

It models transaction fraud as a graph and demonstrates graph-based fraud classification using PyTorch-style graph processing.

## 16.9 GNN comparison on IEEE-CIS

https://github.com/amey-21/GNN-for-Fraud-Detection

Useful as an advanced reference for comparing:

- GCN
- GAT
- GraphSAGE

on a transaction graph built from IEEE-CIS-style identifiers.

Do not copy reported metrics. Reproduce metrics only on your own actual training/validation split.

---

# 17. Repository Comparison for This Problem Statement

| Reference | Core rules | Geo | Velocity | React | FastAPI | Persistent DB | Investigation | Graph | GNN | Best use |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| SivaSabariGanesan/Fraud-Investigation-System | Yes | Partial/contextual | Policy rules | Yes | Yes | SQLite | Strong | TigerGraph | Not the core feature | Investigation UX |
| pelzade127/fraud-detector | Yes | Yes | Yes | No | Flask | SQLite | Limited | No | No | Core rule engine |
| ManasiNarkhede/transaction-fraud-detection | Yes | Not primary | Yes | Yes | Yes | Yes | Moderate | Not primary | ML | Full-stack transaction scoring |
| lalitofficial/AEGIS | Yes/roadmap | Graph | Risk signals | Yes | Yes | PostgreSQL | Yes | Yes | Yes | Full-stack architecture |
| opensyndicate/risk-triage | Yes | Geo mismatch | Yes | No | No | No | No | No | No | Rule scoring |
| sofeikov/ezrules | Yes | Configurable | Configurable | Web UI | Yes | PostgreSQL | Cases | Graph-derived stats | No | Rule lifecycle/backtesting |
| sudsho/gnn-fraud-detection-banking | No | Not primary | Feature-based | No | No | No | No | Yes | Yes | GNN reference |
| **Our system** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **PostgreSQL** | **Yes** | **Yes** | **Optional/Yes** | **Complete problem-specific system** |

---

# 18. Advanced Features — Add Only After Minimum Requirements Work

These are differentiators, not excuses to delay the core requirements.

## A. Behavioral Profiling

Calculate:

- average amount
- median amount
- amount percentile
- transaction frequency
- time-of-day behavior
- merchant diversity
- device diversity
- location history
- average transaction interval

## B. Shared Device / IP Detection

Detect devices or IPs associated with many customers.

## C. Suspicious Merchant Detection

Create a merchant risk score using historical flags and connected accounts.

## D. Fraud Ring Detection

Use graph relationships:

```text
Customer A --- Device X --- Customer B
     |                         |
  Merchant M ------------- Merchant M
```

Look for connected suspicious clusters.

## E. Investigation Graph

Use Cytoscape.js/React to let reviewers explore:

- customer
- card
- device
- IP
- merchant
- location
- transaction

## F. GraphSAGE GNN

Only implement after graph construction is correct.

Flow:

```text
PostgreSQL
   |
   v
Graph Construction
   |
   v
Node/Edge Features
   |
   v
GraphSAGE
   |
   v
GNN Risk Score
```

If labels exist, train supervised fraud detection.

If labels do not exist, use an explicit anomaly/unsupervised strategy. Never invent labels or metrics.

## G. Rule Simulation

Allow an admin to submit one transaction and see every rule result without persisting it.

## H. Rule Backtesting

Run a rule configuration against historical transactions and show:

- number evaluated
- number flagged
- alerts by rule
- high-risk/critical counts
- precision/recall/F1 only when real ground truth exists

## I. Natural-Language Reviewer Assistant

Optional.

Examples:

```text
Why was TXN-123 flagged?
Show high-risk transactions over ₹50,000 today.
Show customers sharing this device.
Which rule fired most today?
```

The assistant may summarize database/rule/graph evidence but must not invent evidence or silently change risk decisions.

## J. Human-in-the-Loop Feedback

Store reviewer decisions and use them as future training labels.

Do not automatically retrain production models on every click.

---

# 19. Real-Time Processing

Recommended flow:

```text
POST /transactions
       |
       v
Validate
       |
       v
Persist
       |
       v
Build context
       |
       v
Run rules
       |
       v
Persist assessment
       |
       v
If HIGH/CRITICAL
       |
       +----> async AWS notification
       |
       +----> WebSocket event
       |
       v
Reviewer console
```

Use Redis/worker queues for notifications and expensive graph/GNN work where appropriate.

---

# 20. API Endpoints

At minimum:

```text
POST   /api/auth/login

GET    /api/dashboard/summary
GET    /api/dashboard/trends

POST   /api/transactions
POST   /api/transactions/bulk
GET    /api/transactions
GET    /api/transactions/{id}

GET    /api/alerts
GET    /api/alerts/{id}

POST   /api/transactions/{id}/review
POST   /api/transactions/{id}/clear
POST   /api/transactions/{id}/confirm-fraud
POST   /api/transactions/{id}/escalate

GET    /api/cases
POST   /api/cases
GET    /api/cases/{id}
POST   /api/cases/{id}/notes

GET    /api/rules
POST   /api/rules
PUT    /api/rules/{id}
POST   /api/rules/{id}/enable
POST   /api/rules/{id}/disable
POST   /api/rules/simulate

POST   /api/import/csv

GET    /api/graph/transaction/{id}
GET    /api/graph/customer/{id}

GET    /api/audit

POST   /api/ml/train
GET    /api/ml/status
POST   /api/ml/predict
```

---

# 21. Project Structure

```text
fraudguard/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── rules/
│   │   ├── engine/
│   │   ├── services/
│   │   ├── graph/
│   │   ├── ml/
│   │   ├── notifications/
│   │   ├── workers/
│   │   └── auth/
│   ├── tests/
│   ├── alembic/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── lib/
│   ├── package.json
│   └── Dockerfile
├── scripts/
│   ├── generate_demo_data.py
│   ├── import_csv.py
│   └── train_gnn.py
├── docker-compose.yml
├── .env.example
├── README.md
└── Makefile
```

---

# 22. Demo/Synthetic Data

Provide a deterministic synthetic-data generator for local development.

Example command:

```bash
python -m app.cli generate-demo-data --transactions 50000 --seed 42
```

Generate scenario labels such as:

- normal
- velocity_fraud
- amount_anomaly
- impossible_travel
- shared_device
- suspicious_merchant_cluster

Label all generated data as **synthetic/demo data**.

Do not call it real-world data.

---

# 23. Testing Requirements

Write real tests for:

### Unit

- velocity rule
- amount rule
- geographic distance
- impossible travel
- registry/plugin loading
- score aggregation
- explanation generation

### Integration

```text
transaction ingest
 -> PostgreSQL
 -> rule evaluation
 -> fraud assessment
 -> alert
```

### API

Test all core endpoints.

### Review workflow

```text
PENDING
 -> REVIEWED
 -> CLEARED
```

and:

```text
PENDING
 -> CONFIRMED_FRAUD
```

### Notification

Test console/local notification mode without requiring AWS.

---

# 24. Required Acceptance Tests

## Normal transaction

Expected: LOW.

## Velocity scenario

Expected: velocity rule fires.

## Amount scenario

Expected: amount rule fires.

## Impossible travel scenario

Expected: geo rule fires.

## Combined scenario

Expected: HIGH/CRITICAL and notification event.

## Reviewer workflow

Expected:

```text
Flagged
 -> Review
 -> Cleared
```

and an audit row must be created.

## Extensibility

Create a new sample rule without changing engine logic and prove the engine can execute it.

---

# 25. Security Requirements

Implement:

- password hashing
- JWT authentication
- reviewer/admin roles
- input validation
- parameterized ORM queries
- CORS configuration
- secure headers
- secrets only through environment/IAM
- no passwords or AWS secrets in logs
- masked card/account identifiers where appropriate

---

# 26. Docker

The expected local startup should be:

```bash
docker compose up --build
```

Services:

```text
postgres
redis
backend
worker
frontend
```

---

# 27. Environment Variables

Create `.env.example`:

```env
APP_ENV=development
SECRET_KEY=
DATABASE_URL=postgresql+psycopg://fraudguard:fraudguard@postgres:5432/fraudguard
REDIS_URL=redis://redis:6379/0

JWT_SECRET=
JWT_EXPIRATION_MINUTES=60

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SNS_TOPIC_ARN=
AWS_SES_FROM_EMAIL=
AWS_SES_TO_EMAIL=
NOTIFICATION_PROVIDER=console

VELOCITY_WINDOW_MINUTES=10
VELOCITY_THRESHOLD=5
VELOCITY_SCORE=25

AMOUNT_MULTIPLIER_THRESHOLD=5
AMOUNT_SCORE=30

IMPOSSIBLE_TRAVEL_SPEED_KMH=900
GEO_SCORE=40

HIGH_RISK_THRESHOLD=60
CRITICAL_RISK_THRESHOLD=80
```

Never commit real credentials.

---

# 28. Core vs Advanced Feature Priority

## MUST HAVE — directly required by the problem statement

```text
1. Transaction ingestion
2. Python rule engine
3. Velocity rule
4. Unusual amount rule
5. Impossible geography rule
6. Extensible rule/plugin architecture
7. PostgreSQL persistence
8. Fraud flag persistence
9. React reviewer console
10. Flagged transaction list
11. Transaction detail view
12. Review action
13. Clear action
14. AWS SNS or SES alerting
15. Audit trail
16. Tests
17. Docker/local setup
```

## SHOULD HAVE — strong engineering additions

```text
18. Authentication
19. Cases
20. Reviewer notes
21. WebSocket live alerts
22. Rule management UI
23. Rule simulation
24. CSV import mapping
25. Backtesting
26. Behavioral profiling
27. Graph investigation
```

## OPTIONAL WOW — only after all MUST HAVE items work

```text
28. Shared device/IP graph analysis
29. Fraud-ring detection
30. GraphSAGE GNN
31. GNN model training/versioning
32. Natural-language analyst assistant
33. Human-in-the-loop model feedback
34. Advanced graph visualization
```

---

# 29. What NOT to Build

Do not drift away from the selected problem statement into:

- generic cybersecurity
- generic AML/sanctions screening
- cryptocurrency tracing
- insurance fraud
- healthcare fraud
- unrelated anomaly detection
- payment gateway processing
- card issuing
- full banking core systems

Optional advanced features must directly improve transaction fraud detection, investigation, review, or the required rule engine.

---

# 30. Important Data/ML Integrity Rules

Never fabricate:

- model accuracy
- fraud counts
- AWS delivery success
- real-world transaction claims
- investigation evidence
- GNN predictions

If ground-truth labels are unavailable, state that evaluation is unavailable.

If GNN is not trained, show GNN as unavailable or use an explicitly documented graph-anomaly fallback.

If AWS is not configured locally, use console notification mode.

---

# 31. Recommended Final Architecture

```text
                         React Reviewer Console
                                  |
                         REST + WebSocket
                                  |
                                  v
                           FastAPI Backend
                                  |
              +-------------------+-------------------+
              |                   |                   |
              v                   v                   v
       PostgreSQL            Rule Engine        Graph Service
                                  |                   |
                    +-------------+-------------+     |
                    |             |             |     |
                    v             v             v     v
                Velocity       Amount          Geo  Graph Features
                    |             |             |     |
                    +-------------+-------------+     |
                                  |                   |
                                  v                   v
                           Rule Risk Score        GNN (optional)
                                  |                   |
                                  +---------+---------+
                                            |
                                            v
                                      Risk Aggregator
                                            |
                           +----------------+----------------+
                           |                                 |
                           v                                 v
                    PostgreSQL                         SNS / SES
                           |
                           v
                    Reviewer Actions
                           |
                           v
                       Audit Log
                           |
                           v
                  Human Feedback Dataset
```

---

# 32. Final One-Line Project Description

> **A configurable, explainable fraud-risk and review platform that evaluates real transaction streams using velocity, amount, and impossible-travel rules, persists and explains fraud flags, alerts reviewers through AWS, and can be extended with behavioral and graph/GNN intelligence.**

---

# 33. Source Links

## Problem-specific/reference repositories

- Exact investigation reference: https://github.com/SivaSabariGanesan/Fraud-Investigation-System
- Core fraud engine reference: https://github.com/pelzade127/fraud-detector
- Full-stack transaction fraud reference: https://github.com/ManasiNarkhede/transaction-fraud-detection
- AEGIS full-stack fraud reference: https://github.com/lalitofficial/AEGIS
- Transaction risk scoring reference: https://github.com/opensyndicate/risk-triage
- Transaction monitoring/rule lifecycle: https://github.com/sofeikov/ezrules
- GNN banking fraud reference: https://github.com/sudsho/gnn-fraud-detection-banking
- GNN IEEE-CIS reference: https://github.com/amey-21/GNN-for-Fraud-Detection
- Advanced fraud/UPI reference: https://github.com/Vedag812/FraudLens
- IBM AMLSim (optional graph/transaction simulation): https://github.com/IBM/AMLSim

## Datasets

- Transaction Fraud Detection: https://www.kaggle.com/competitions/transaction-fraud-detection/data
- Fraud Detection Handbook: https://github.com/Fraud-Detection-Handbook/fraud-detection-handbook
- Fraud Detection Handbook raw data: https://github.com/Fraud-Detection-Handbook/simulated-data-raw
- Fraud Detection Handbook transformed data: https://github.com/Fraud-Detection-Handbook/simulated-data-transformed
- IEEE-CIS Fraud Detection: https://www.kaggle.com/competitions/ieee-fraud-detection/data
- ULB Credit Card Fraud Detection: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud
- ULB Zenodo mirror: https://zenodo.org/record/7395559
- IBM AMLSim: https://github.com/IBM/AMLSim

## AWS

- SNS publishing: https://docs.aws.amazon.com/sns/latest/dg/sns-publishing.html
- SES email API: https://docs.aws.amazon.com/ses/latest/dg/send-email-api.html
- SES with Python/Boto3: https://docs.aws.amazon.com/ses/latest/dg/send-an-email-using-sdk-programmatically.html

---

# 34. Implementation Instruction for a Coding Agent

Build this project as an actual runnable system.

Do not stop at architecture.

Do not use placeholder API responses.

Do not hardcode dashboard numbers.

Do not put the three rules directly into a monolithic `if/elif` engine.

Do not skip database persistence.

Do not skip the React review workflow.

Do not skip AWS notification support.

Do not claim ML/GNN results that were not computed.

Implement the mandatory system first, then the advanced features.

When a dependency such as AWS or a trained GNN is unavailable, provide a clearly documented local fallback without pretending that the external service/model succeeded.

The final project must run locally with Docker and demonstrate a complete end-to-end path:

```text
Transaction
 -> Persist
 -> Evaluate 3 required rules
 -> Calculate risk
 -> Persist fraud flag
 -> Display in React console
 -> Reviewer reviews/clears/confirms
 -> Audit action persisted
 -> High-risk notification emitted
```
