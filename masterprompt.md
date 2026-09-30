# MASTER BUILD PROMPT

## Build a Production-Style Hybrid Fraud Risk & Investigation System

You are a senior software architect, Python backend engineer, React engineer, ML engineer, graph engineer, DevOps engineer, and security engineer.

Build the complete application described below.

The objective is to create a **fully working, end-to-end fraud detection and investigation platform** based on a configurable fraud rule engine, behavioral analysis, graph intelligence, optional/advanced GNN analysis, and a React reviewer console.

Do NOT create only a prototype, wireframe, static UI, pseudo-code, or partially implemented scaffold.

Everything must be connected and executable.

---

# 1. PRODUCT NAME

Use the working project name:

**FraudGuard**

Subtitle:

**Hybrid Real-Time Fraud Risk & Investigation Platform**

Architecture principle:

> Detect → Explain → Investigate → Review → Learn

---

# 2. CORE PROBLEM

Financial systems process large numbers of transactions. Fraud cannot always be detected by looking at one transaction independently.

A transaction may become suspicious because of:

* unusually high amount
* unusually high transaction frequency
* impossible geographical movement
* suspicious device relationships
* suspicious merchant relationships
* repeated connections between accounts
* unusual customer behavior
* graph-level relationships between customers, devices, merchants and transactions

Fraud analysts also need to understand **why** a transaction was flagged and must be able to review, clear, or escalate it.

Build a system that:

1. receives transactions
2. persists them
3. evaluates them using independent fraud rules
4. calculates a risk score
5. generates explainable fraud flags
6. uses graph intelligence for network-level risk
7. optionally uses a GNN for additional risk scoring
8. sends notifications for high-risk events
9. presents alerts in a React reviewer console
10. allows reviewers to investigate and resolve cases
11. records all actions in an audit trail
12. can learn from reviewer decisions later

---

# 3. IMPORTANT IMPLEMENTATION RULE

The application must work with **actual transaction records**, not hardcoded dashboard numbers.

Do NOT create fake cards such as:

```text
Total Transactions: 120
High Risk: 24
```

with hardcoded values.

All dashboard numbers must come from PostgreSQL queries.

Do NOT hardcode example transactions directly into React.

All transaction rows must come from APIs/database.

The application must support:

### A. CSV/JSON transaction import

AND

### B. REST transaction ingestion

AND

### C. realistic demo-data generation for local testing

Never label generated data as real financial data.

If generated data is used, explicitly label it:

**Demo / Synthetic Data**

The UI must not falsely claim synthetic data is real.

---

# 4. TECHNOLOGY STACK

## Backend

Use:

* Python 3.12+
* FastAPI
* Pydantic
* SQLAlchemy 2.x
* Alembic
* PostgreSQL
* psycopg
* Redis
* Celery or an equivalent reliable background-job system
* Pytest

## Fraud Engine

Pure Python architecture with:

* abstract base rule interface
* rule registry
* configurable rule weights
* configurable thresholds
* rule result objects
* explainability metadata

## Graph Intelligence

Use:

* NetworkX for lightweight graph traversal/analysis
* PyTorch Geometric for GNN
* GraphSAGE as the first implemented GNN
* optionally support GAT/HGT later

Do NOT make the entire application dependent on a separate graph database if that makes the project fragile.

PostgreSQL remains the primary source of truth.

You may additionally implement Neo4j as an optional graph backend, but the application must work without it.

## Frontend

Use:

* React
* TypeScript
* Vite
* Tailwind CSS
* React Router
* TanStack Query
* Recharts
* React Hook Form
* Zod

For interactive graph investigation use one of:

* React Flow
* Cytoscape.js

Prefer Cytoscape.js for relationship visualization.

## Notifications

Implement:

* AWS SNS
* AWS SES

with configuration:

```env
NOTIFICATION_PROVIDER=sns
```

or:

```env
NOTIFICATION_PROVIDER=ses
```

Also implement:

```env
NOTIFICATION_PROVIDER=console
```

for local development.

The local mode must not require AWS credentials.

Production mode must support real AWS credentials through environment variables or IAM roles.

## Authentication

Implement:

* JWT authentication
* password hashing using Argon2 or bcrypt
* reviewer role
* admin role

Do not store plaintext passwords.

---

# 5. HIGH-LEVEL ARCHITECTURE

Build this architecture:

```text
                    ┌────────────────────────┐
                    │      React Console     │
                    │                        │
                    │ Dashboard              │
                    │ Alerts                 │
                    │ Transaction Details   │
                    │ Investigation Graph    │
                    │ Cases                  │
                    │ Rules                  │
                    │ Audit Log              │
                    └───────────┬────────────┘
                                │
                           REST/WebSocket
                                │
                                ▼
                    ┌────────────────────────┐
                    │        FastAPI         │
                    │        Backend         │
                    └───────────┬────────────┘
                                │
              ┌─────────────────┼──────────────────┐
              │                 │                  │
              ▼                 ▼                  ▼
       Transaction API    Fraud Rule Engine   Graph Service
              │                 │                  │
              ▼                 │                  ▼
         PostgreSQL             │            Graph Features
                                │                  │
                     ┌──────────┼──────────┐       │
                     ▼          ▼          ▼       ▼
                 Velocity     Amount      Geo     GNN
                   Rule        Rule       Rule   GraphSAGE
                     │          │          │       │
                     └──────────┼──────────┘       │
                                ▼                  │
                        Rule Risk Score            │
                                │                  │
                                └────────┬─────────┘
                                         ▼
                                Risk Aggregator
                                         │
                            ┌────────────┴────────────┐
                            ▼                         ▼
                       Normal/Medium             High/Critical
                                                     │
                                                     ▼
                                                AWS SNS/SES
                                                     │
                                                     ▼
                                               Reviewer Console
                                                     │
                                             ┌───────┴───────┐
                                             ▼               ▼
                                          Review           Clear
                                             │               │
                                             └───────┬───────┘
                                                     ▼
                                                 Audit Log
                                                     │
                                                     ▼
                                              Feedback Dataset
```

---

# 6. MANDATORY CORE RULES

Implement these three rules as independent plugins.

## RULE 1 — Transaction Velocity

Purpose:

Detect abnormal transaction frequency for the same customer.

Configurable parameters:

```env
VELOCITY_WINDOW_MINUTES=10
VELOCITY_THRESHOLD=5
VELOCITY_SCORE=25
```

Example:

```text
7 transactions
within 10 minutes
→ rule triggered
```

The rule must return:

* triggered
* score
* rule name
* severity
* evidence
* human-readable explanation
* machine-readable metadata

Example:

```json
{
  "rule_name": "transaction_velocity",
  "triggered": true,
  "score": 25,
  "severity": "HIGH",
  "reason": "7 transactions occurred within 10 minutes",
  "evidence": {
    "transaction_count": 7,
    "window_minutes": 10,
    "threshold": 5
  }
}
```

---

# 7. RULE 2 — UNUSUAL TRANSACTION AMOUNT

Compare the current transaction against the customer's historical behavior.

Example:

```text
Historical average = ₹4,200
Current transaction = ₹85,000

85,000 / 4,200 = 20.23x
```

Configurable:

```env
AMOUNT_MULTIPLIER_THRESHOLD=5
AMOUNT_SCORE=30
```

Also calculate:

* historical average
* median
* standard deviation
* transaction percentile

Do not rely only on a single multiplier.

Use robust calculations where sufficient historical data exists.

Return clear evidence:

```text
Current amount: ₹85,000
Historical average: ₹4,200
Deviation multiplier: 20.23x
```

---

# 8. RULE 3 — IMPOSSIBLE GEOGRAPHICAL LOCATION

Use:

* previous transaction latitude/longitude
* current transaction latitude/longitude
* previous timestamp
* current timestamp

Calculate geographical distance using the Haversine formula.

Calculate:

```text
distance / elapsed time = travel speed
```

Default threshold:

```env
IMPOSSIBLE_TRAVEL_SPEED_KMH=900
GEO_SCORE=40
```

Example:

```text
Previous:
Chennai
10:00 AM

Current:
London
10:22 AM

Impossible travel
→ rule triggered
```

Do not use a fixed city list.

Use actual coordinates from transaction records.

Return:

* distance
* elapsed minutes
* estimated speed
* configured threshold
* previous transaction
* current transaction

Example explanation:

```text
3,820 km traveled in 22 minutes
Estimated travel speed: 10,418 km/h
Configured maximum: 900 km/h
```

---

# 9. EXTENSIBLE RULE ENGINE

This is one of the most important requirements.

The core engine must NOT contain:

```python
if velocity:
elif amount:
elif geo:
```

Instead implement:

```python
class FraudRule(ABC):

    @abstractmethod
    def evaluate(self, transaction, context) -> RuleResult:
        ...
```

Implement a rule registry:

```text
rules/
    base.py
    registry.py
    velocity.py
    unusual_amount.py
    impossible_location.py
    suspicious_device.py
    suspicious_merchant.py
    ip_reputation.py
```

The engine should discover/register rules through configuration or the registry.

Adding:

```text
device_rule.py
```

must not require modifying the fraud engine itself.

---

# 10. FUTURE RULES

Implement at least these additional optional rules where practical:

### Suspicious Device Rule

Detect:

* one device used by many customers
* new device + large amount
* device suddenly changes geographic region

### Suspicious Merchant Rule

Detect:

* unusual fraud rate for merchant
* merchant connected with multiple flagged customers

### New Device Rule

Flag:

```text
new device
+
high transaction amount
```

### Burst Rule

Detect:

```text
many small transactions
followed by
one large transaction
```

### Dormant Account Rule

Detect:

```text
inactive for long period
+
sudden high-value activity
```

Keep all these modular.

---

# 11. RISK SCORING

Every triggered rule contributes a score.

Example:

```text
Velocity          +25
Unusual Amount    +30
Impossible Geo   +40
Device            +20
Merchant          +15
```

Normalize final result to:

```text
0–29    LOW
30–59   MEDIUM
60–79   HIGH
80–100  CRITICAL
```

If raw scores exceed 100, normalize or cap the final score at 100 but preserve raw score internally.

Return:

```json
{
  "raw_score": 115,
  "normalized_score": 100,
  "risk_level": "CRITICAL"
}
```

---

# 12. HYBRID AI SCORE

Add a second risk layer.

Final risk should combine:

```text
Rule Risk
+
Behavioral Risk
+
Graph Risk
+
GNN Risk
```

Example weighted configuration:

```env
RULE_WEIGHT=0.50
BEHAVIOR_WEIGHT=0.15
GRAPH_WEIGHT=0.15
GNN_WEIGHT=0.20
```

Make these configurable.

Do not hide the components.

The UI must show exactly how the final score was constructed.

---

# 13. BEHAVIORAL RISK

Build customer-level behavioral features:

* average transaction amount
* median transaction amount
* standard deviation
* transactions per hour
* transactions per day
* unique merchants
* unique devices
* unique locations
* nighttime transaction percentage
* average transaction interval
* amount percentile
* recent activity burst

Persist calculated features where practical.

Do not repeatedly perform expensive full-table scans when cached/aggregated information can be maintained.

---

# 14. GRAPH MODEL

Represent the transaction ecosystem as a graph.

Nodes:

```text
Customer
Transaction
Merchant
Device
IP
Location
Card
```

Relationships:

```text
Customer --MADE--> Transaction
Transaction --PAID_TO--> Merchant
Customer --USES--> Device
Customer --USES--> IP
Transaction --OCCURRED_AT--> Location
Customer --OWNS--> Card
Card --USED_FOR--> Transaction
```

Implement graph construction from PostgreSQL data.

Support graph queries such as:

* customers sharing devices
* customers sharing IPs
* customers connected to the same merchant
* suspicious merchant clusters
* two-hop and three-hop relationships
* number of previously flagged accounts connected to a customer
* number of flagged transactions connected to a merchant

---

# 15. FRAUD RING DETECTION

Build a graph-level suspicious cluster detector.

Example:

```text
Customer A ─┐
Customer B ─┼── Device X ── Merchant Y
Customer C ─┤
Customer D ─┘
```

If many accounts share a device and transact with the same merchant, calculate network risk.

Create a signal:

```text
shared_device_customer_count
```

and similar graph features.

Show graph cluster information to reviewers.

---

# 16. GNN IMPLEMENTATION

Implement an actual working GNN layer.

Preferred first model:

**GraphSAGE**

Use:

* PyTorch
* PyTorch Geometric

Create a training pipeline.

The training data must come from the application's transaction database.

Do not create a fake prediction method that simply returns random numbers.

GNN workflow:

```text
PostgreSQL
   ↓
Graph Extraction
   ↓
Graph Construction
   ↓
Feature Engineering
   ↓
PyTorch Geometric Data
   ↓
Train GraphSAGE
   ↓
Validation
   ↓
Save Model
   ↓
Inference
   ↓
GNN Risk Score
```

Support:

```text
training
validation
model persistence
model loading
inference
```

Use real labels when available.

If labels are not available for some imported data, the application must clearly mark GNN training as unavailable rather than pretending to have trained a supervised model.

Implement a practical fallback:

```text
graph anomaly score
```

for unlabeled data.

Do NOT fabricate accuracy metrics.

---

# 17. GNN OUTPUT

For each transaction return:

```json
{
  "gnn_score": 0.91,
  "model": "GraphSAGE",
  "top_graph_signals": [
    "shared device with 4 accounts",
    "merchant connected to 11 flagged accounts",
    "high-risk 3-hop neighborhood"
  ]
}
```

---

# 18. EXPLAINABILITY

Every alert must answer:

## Why was this transaction flagged?

Show:

```text
Rule Evidence
Behavior Evidence
Graph Evidence
GNN Evidence
```

Do not simply display:

```text
Fraud = true
```

Instead display:

```text
WHY FLAGGED

1. 7 transactions in 10 minutes
2. Amount is 20.2× historical average
3. Geographical movement is physically implausible
4. Device shared by 4 customers
5. Connected merchant has 11 previously flagged accounts
6. GraphSAGE network risk = 0.91
```

---

# 19. REVIEW CONSOLE

Build a professional analyst dashboard.

Pages:

### Dashboard

Display database-derived:

* total transactions
* flagged transactions
* high risk
* critical
* pending review
* reviewed today
* cleared today
* confirmed fraud
* high-risk trend
* rule trigger distribution
* fraud amount by day
* risk distribution

Use charts.

---

# 20. ALERTS PAGE

Table columns:

```text
Transaction ID
Customer
Amount
Time
Risk Score
Risk Level
Triggered Rules
GNN Risk
Status
Created At
Actions
```

Filters:

* risk level
* status
* date range
* customer
* merchant
* rule
* minimum amount
* score threshold

Sorting:

* highest risk
* newest
* highest amount
* most rules triggered

---

# 21. TRANSACTION DETAILS PAGE

Display:

```text
Transaction information
Customer information
Merchant information
Amount
Timestamp
Location
Device
IP
Risk Score
Risk Level
Rule Evidence
Behavior Evidence
Graph Evidence
GNN Evidence
Related transactions
```

Include a timeline.

---

# 22. INVESTIGATION GRAPH PAGE

Interactive graph visualization.

Show:

```text
Customer
Card
Device
IP
Merchant
Transaction
Location
```

Allow:

* zoom
* pan
* node selection
* relationship inspection
* neighboring nodes
* risk highlighting
* flagged nodes
* graph path exploration

Clicking a node should show its details.

Example:

```text
Customer C102
Risk: HIGH

Connected Devices: 3
Connected Merchants: 5
Flagged Transactions: 8
```

---

# 23. CASE MANAGEMENT

Create a case when a high-risk transaction is escalated.

Case states:

```text
OPEN
INVESTIGATING
PENDING_REVIEW
CLEARED
CONFIRMED_FRAUD
CLOSED
```

Case contains:

* case ID
* linked transactions
* assigned reviewer
* severity
* evidence
* notes
* decisions
* timestamps
* audit history

---

# 24. REVIEW ACTIONS

Reviewer must be able to:

```text
Mark Reviewed
Clear
Confirm Fraud
Escalate
Add Note
Assign Case
```

Every action must create an audit log.

---

# 25. AUDIT LOG

Create immutable-style application audit records:

```text
user
action
resource_type
resource_id
old_value
new_value
timestamp
IP
```

Examples:

```text
Reviewer A
MARKED_REVIEWED
TXN-10234
```

```text
Reviewer B
CLEARED
CASE-102
```

Never silently modify historical review actions.

---

# 26. AWS NOTIFICATIONS

When:

```text
normalized risk >= HIGH_THRESHOLD
```

send notification.

Implement:

### AWS SNS

Topic-based notification.

Message should include:

```text
Transaction ID
Customer ID
Amount
Risk Score
Risk Level
Top triggered rules
Timestamp
```

### AWS SES

Send a formatted HTML email.

Subject example:

```text
[CRITICAL FRAUD ALERT] Transaction TXN-10234
```

Use environment variables:

```env
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SNS_TOPIC_ARN=
AWS_SES_FROM_EMAIL=
AWS_SES_TO_EMAIL=
```

Never hardcode credentials.

Do not print secrets in logs.

---

# 27. LOCAL NOTIFICATION MODE

For local development:

```env
NOTIFICATION_PROVIDER=console
```

Print the notification payload cleanly.

Optionally provide a MailHog-compatible development path.

The application must still work without AWS.

---

# 28. LIVE ALERT UPDATES

Implement WebSocket support.

When a new critical transaction is created:

```text
Transaction
    ↓
Rule Engine
    ↓
Critical Risk
    ↓
Database
    ↓
WebSocket event
    ↓
React Dashboard
```

The reviewer console should update without a manual full-page refresh.

---

# 29. DATABASE DESIGN

Use PostgreSQL.

Implement at least:

## users

```text
id
email
password_hash
name
role
is_active
created_at
```

## customers

```text
id
external_customer_id
name
country
created_at
```

## merchants

```text
id
external_merchant_id
name
category
latitude
longitude
risk_level
created_at
```

## devices

```text
id
device_fingerprint
first_seen
last_seen
```

## transactions

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

## fraud_assessments

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

## fraud_rule_results

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

## cases

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

## case_notes

```text
id
case_id
user_id
note
created_at
```

## review_actions

```text
id
case_id
user_id
action
reason
created_at
```

## audit_logs

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

# 30. DATA IMPORT

Implement:

```text
POST /api/import/csv
```

The import pipeline must:

1. validate columns
2. normalize fields
3. validate timestamps
4. validate amounts
5. validate coordinates
6. deduplicate transactions
7. resolve customers
8. resolve merchants
9. resolve devices
10. store valid transactions
11. report invalid rows
12. optionally process transactions through the rule engine

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

Do not silently discard bad rows.

---

# 31. DEMO DATA GENERATOR

Create a deterministic data-generation command:

```bash
python -m app.cli generate-demo-data --transactions 50000
```

Use a configurable random seed.

Generate realistic but synthetic:

* customers
* merchants
* cards
* devices
* IPs
* coordinates
* timestamps
* transaction amounts
* transaction histories
* normal patterns
* anomalous patterns
* velocity fraud
* unusual amount fraud
* impossible travel patterns
* shared-device patterns
* suspicious merchant clusters

Do not claim this data is real.

Add labels describing generated scenarios.

Example:

```text
velocity_fraud
amount_anomaly
impossible_travel
shared_device
merchant_cluster
normal
```

---

# 32. DATASET IMPORT SHOULD STILL BE FIRST-CLASS

The user may provide an external transaction CSV.

Do not assume a single exact column naming scheme.

Build a configurable field-mapping layer.

Example:

```json
{
  "transaction_id": "trans_id",
  "customer_id": "customer_id",
  "amount": "amount",
  "timestamp": "trans_date_trans_time",
  "latitude": "lat",
  "longitude": "long",
  "merchant_latitude": "merch_lat",
  "merchant_longitude": "merch_long"
}
```

Make this mapping configurable instead of hardcoding a dataset-specific schema.

---

# 33. API DESIGN

Implement:

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

GET    /api/graph/transaction/{id}
GET    /api/graph/customer/{id}

GET    /api/rules
POST   /api/rules
PUT    /api/rules/{id}
POST   /api/rules/{id}/enable
POST   /api/rules/{id}/disable

POST   /api/import/csv

GET    /api/audit

POST   /api/ml/train
GET    /api/ml/status
POST   /api/ml/predict
```

Create proper OpenAPI schemas.

---

# 34. RULE MANAGEMENT UI

Admin page:

```text
Fraud Rules
──────────────────────────────────────

Velocity
Enabled
Window: 10 min
Threshold: 5
Score: 25

Unusual Amount
Enabled
Multiplier: 5x
Score: 30

Impossible Travel
Enabled
Threshold: 900 km/h
Score: 40
```

Buttons:

```text
Edit
Enable
Disable
Test
```

Add:

```text
Create Rule
```

The design must reinforce that the engine is extensible.

---

# 35. RULE TEST/SIMULATION

Allow an administrator to submit a transaction to:

```text
POST /api/rules/simulate
```

and receive:

```text
All rules evaluated
Triggered rules
Scores
Explanations
Final score
```

This should not persist unless explicitly requested.

---

# 36. BACKTESTING

Implement:

```text
POST /api/backtest
```

Input:

```text
date range
rules enabled
threshold configuration
```

Return:

```text
transactions evaluated
alerts generated
alerts by rule
high-risk count
critical count
precision/recall only when ground-truth labels exist
```

Never invent evaluation metrics.

If labels do not exist:

```text
"Model evaluation unavailable: ground-truth labels were not provided."
```

---

# 37. MODEL METRICS

For the GNN, calculate only real metrics from actual labels:

* precision
* recall
* F1
* ROC-AUC when appropriate
* PR-AUC
* confusion matrix

Also record:

```text
dataset size
positive class count
negative class count
train/validation split
random seed
model version
training timestamp
```

Do not make up a 99% accuracy claim.

---

# 38. MODEL VERSIONING

Store:

```text
model name
model type
version
training dataset identifier
feature version
training timestamp
metrics
artifact path
active/inactive
```

Example:

```text
GraphSAGE
v1.0.0
trained_at=...
F1=...
PR-AUC=...
```

---

# 39. SECURITY

Implement:

* password hashing
* JWT
* role-based authorization
* input validation
* parameterized database queries through ORM
* rate limiting for public APIs
* CORS configuration
* secure headers
* environment-based secrets
* no secret values in source
* no stack traces in production responses

---

# 40. OBSERVABILITY

Implement structured logging.

Log:

```text
request ID
user
transaction ID
rule evaluation duration
risk score
notification result
errors
```

Do not log:

* passwords
* AWS secret keys
* complete payment-card numbers

Mask sensitive identifiers where appropriate.

---

# 41. ERROR HANDLING

The system must gracefully handle:

* malformed transaction
* missing location
* invalid timestamp
* duplicate transaction
* database error
* rule failure
* notification failure
* GNN unavailable
* model loading error
* AWS unavailable

A notification failure must NOT cause the transaction itself to disappear.

Persist the transaction and assessment first, then handle notification asynchronously.

---

# 42. PERFORMANCE

Avoid evaluating historical transaction queries naively for every transaction.

Use:

* indexes
* database aggregation
* Redis caching
* background jobs
* batch processing
* pagination

Indexes at minimum:

```text
transactions(customer_id)
transactions(timestamp)
transactions(merchant_id)
transactions(device_id)
transactions(ip_address)
fraud_assessments(risk_level)
fraud_assessments(created_at)
cases(status)
```

---

# 43. FRONTEND DESIGN

Create a professional fraud analyst interface.

Design language:

* clean
* enterprise
* dark/light theme
* risk colors used consistently
* responsive desktop layout
* data-heavy but readable
* no excessive animations

Use badges:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Make tables searchable and paginated.

---

# 44. DASHBOARD KPI CARDS

Display real database values:

```text
Transactions Today
Flagged Today
High Risk
Critical
Pending Review
Confirmed Fraud
Cleared
Fraud Amount
```

---

# 45. CHARTS

Implement:

1. transactions over time
2. risk score distribution
3. alerts by rule
4. risk level distribution
5. high-risk amount over time
6. fraud decision breakdown
7. graph cluster statistics

All charts must come from API/database data.

---

# 46. INVESTIGATION EXPERIENCE

When opening a high-risk transaction, the reviewer should see:

```text
TRANSACTION SUMMARY
        ↓
RISK SCORE
        ↓
WHY FLAGGED
        ↓
RELATED TRANSACTIONS
        ↓
GRAPH
        ↓
CUSTOMER HISTORY
        ↓
DEVICE / IP HISTORY
        ↓
MERCHANT HISTORY
        ↓
CASE NOTES
        ↓
DECISION
```

---

# 47. NATURAL-LANGUAGE INVESTIGATION — OPTIONAL WOW FEATURE

Add an optional analyst assistant.

Examples:

```text
"Show me high-risk transactions above ₹50,000 in the last 24 hours."

"Why was TXN-123 flagged?"

"Show all customers sharing the same device as this customer."

"Show transactions connected to this merchant."

"Which rules triggered the most alerts today?"
```

Do not allow an LLM to directly alter risk scores.

LLM may assist with:

* summarization
* querying
* explanation
* investigation guidance

The deterministic rule engine remains authoritative.

---

# 48. LLM SAFETY PRINCIPLE

Never allow the LLM to invent evidence.

All factual evidence must originate from:

* database
* rule engine
* graph engine
* GNN output
* audit data

The LLM may summarize those facts.

If evidence is unavailable, say:

```text
Insufficient evidence.
```

Do not fabricate.

---

# 49. HUMAN-IN-THE-LOOP LEARNING

Reviewer decisions must be stored.

Flow:

```text
Risk Engine
     ↓
Alert
     ↓
Human Review
     ↓
Confirmed Fraud / Cleared
     ↓
Feedback Dataset
     ↓
Future Model Training
```

Do not automatically retrain production models after every review.

Provide an explicit model-training action.

---

# 50. PROJECT STRUCTURE

Create a clean monorepo:

```text
fraudguard/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   │
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── rules/
│   │   ├── engine/
│   │   ├── graph/
│   │   ├── ml/
│   │   ├── notifications/
│   │   ├── workers/
│   │   ├── auth/
│   │   └── utils/
│   │
│   ├── tests/
│   ├── alembic/
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── types/
│   │   └── router/
│   │
│   ├── package.json
│   └── Dockerfile
│
├── scripts/
│   ├── generate_demo_data.py
│   ├── import_csv.py
│   └── train_gnn.py
│
├── docker-compose.yml
├── .env.example
├── README.md
└── Makefile
```

---

# 51. DOCKER

Provide:

```bash
docker compose up --build
```

The stack should include:

```text
PostgreSQL
Redis
Backend
Worker
Frontend
```

The application must start without manual source-code modifications.

---

# 52. ENVIRONMENT VARIABLES

Create `.env.example`.

Include:

```env
APP_ENV=development
SECRET_KEY=

DATABASE_URL=postgresql+psycopg://...
REDIS_URL=redis://...

JWT_SECRET=
JWT_EXPIRATION_MINUTES=60

AWS_REGION=
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

RULE_WEIGHT=0.5
BEHAVIOR_WEIGHT=0.15
GRAPH_WEIGHT=0.15
GNN_WEIGHT=0.20

HIGH_RISK_THRESHOLD=60
CRITICAL_RISK_THRESHOLD=80
```

Never commit secrets.

---

# 53. TESTING

Write real tests.

## Unit tests

Test:

* velocity rule
* unusual amount rule
* impossible travel
* rule registry
* risk aggregation
* Haversine calculation
* graph features

## Integration tests

Test:

```text
transaction ingestion
→ database
→ rule engine
→ fraud assessment
→ notification
```

## API tests

Test all critical endpoints.

## Frontend

Test:

* login
* alert rendering
* review action
* clear action
* dashboard data
* filters

---

# 54. REQUIRED TEST CASES

Create deterministic test scenarios.

### Scenario 1 — Normal

```text
₹2,000
normal location
normal transaction frequency
```

Expected:

```text
LOW
```

### Scenario 2 — Velocity

```text
6 transactions in 10 minutes
```

Expected:

```text
Velocity triggered
```

### Scenario 3 — Amount

```text
normal avg = ₹2,000
current = ₹25,000
```

Expected:

```text
Amount rule triggered
```

### Scenario 4 — Impossible travel

```text
Chennai
10:00

London
10:20
```

Expected:

```text
Geo rule triggered
```

### Scenario 5 — Combined

Trigger all three.

Expected:

```text
HIGH / CRITICAL
notification generated
```

### Scenario 6 — Reviewer clear

Flagged transaction:

```text
PENDING
```

Reviewer clicks:

```text
CLEAR
```

Expected:

```text
status = CLEARED
audit record created
```

---

# 55. NO FAKE SUCCESS

This rule is mandatory.

Never show:

```text
Model accuracy: 98.7%
```

unless it was actually computed.

Never show:

```text
AWS notification sent
```

if AWS failed.

Instead show:

```text
Notification failed
Reason: ...
```

Never show:

```text
GNN score
```

if the model has not actually run.

Show:

```text
GNN unavailable
```

or:

```text
Graph anomaly score used
```

depending on the implemented fallback.

---

# 56. NO PLACEHOLDER BUTTONS

Every button must actually work.

Do not create UI buttons saying:

```text
View
Review
Clear
Investigate
Train Model
Backtest
```

unless the corresponding functionality exists.

---

# 57. README

Create a complete README containing:

1. project overview
2. problem
3. architecture
4. features
5. tech stack
6. setup
7. environment variables
8. database migration
9. demo data generation
10. CSV import
11. backend start
12. frontend start
13. Docker start
14. AWS setup
15. rule engine architecture
16. GNN architecture
17. API documentation
18. testing
19. screenshots section
20. limitations
21. future improvements

Do not include a dataset download URL.

Do not claim any synthetic/generated data is real-world data.

---

# 58. DEMO FLOW

The completed project must support this demonstration:

### Step 1

Start system:

```bash
docker compose up --build
```

### Step 2

Login to reviewer console.

### Step 3

Load/import transaction data.

### Step 4

Process transactions.

### Step 5

System evaluates:

```text
Velocity
Amount
Geo
Behavior
Graph
GNN
```

### Step 6

Critical alert appears in dashboard.

### Step 7

Reviewer opens it.

### Step 8

System displays:

```text
Risk Score
Why Flagged
Rule Evidence
Behavior Evidence
Graph Evidence
GNN Evidence
Related Transactions
```

### Step 9

Reviewer investigates graph.

### Step 10

Reviewer chooses:

```text
Clear
OR
Confirm Fraud
OR
Escalate
```

### Step 11

Audit trail is updated.

### Step 12

High-risk notification is emitted through SNS/SES when configured.

---

# 59. DIFFERENTIATION FROM TYPICAL FRAUD PROJECTS

The system should clearly differentiate itself through:

```text
1. Pluggable deterministic rule engine
2. Real-time transaction scoring
3. Historical behavioral profiling
4. Impossible-travel detection
5. Transaction relationship graph
6. Fraud-ring detection
7. GraphSAGE-based network risk
8. Explainable risk decomposition
9. Reviewer investigation console
10. Case management
11. Human-in-the-loop feedback
12. AWS alerting
13. Rule simulation
14. Rule backtesting
15. Live dashboard updates
```

---

# 60. WOW FACTOR

Make this experience especially polished.

When a reviewer opens a critical transaction:

```text
┌──────────────────────────────────────────────────────────┐
│                 CRITICAL FRAUD ALERT                     │
├──────────────────────────────────────────────────────────┤
│ Transaction: TXN-84921                                   │
│ Amount: ₹85,000                                           │
│ Risk Score: 94 / 100                                     │
│                                                          │
│ WHY FLAGGED                                               │
│                                                          │
│ ✓ 7 transactions in 8 minutes             +25           │
│ ✓ 20.2× historical average                 +30           │
│ ✓ Impossible travel                        +40           │
│ ✓ Shared device with 4 accounts            +12           │
│ ✓ Suspicious merchant cluster               +8           │
│                                                          │
│ GNN NETWORK RISK: 0.91                                  │
│                                                          │
│ [ INVESTIGATE GRAPH ] [ CLEAR ] [ CONFIRM FRAUD ]       │
└──────────────────────────────────────────────────────────┘
```

The graph screen should then visually show the connected fraud network.

---

# 61. IMPORTANT ENGINEERING PRINCIPLES

Follow:

* SOLID principles
* dependency injection
* separation of concerns
* typed schemas
* repository/service pattern where useful
* transactional database operations
* asynchronous processing where appropriate
* clear interfaces
* no giant monolithic files
* no business logic in React components
* no SQL embedded throughout route handlers
* no secrets in code

---

# 62. DEVELOPMENT PHASES

Implement in this order:

## Phase 1

Repository structure
PostgreSQL
SQLAlchemy
Alembic
FastAPI
authentication

## Phase 2

Transaction ingestion
data validation
persistence

## Phase 3

Pluggable fraud engine
velocity
amount
geo

## Phase 4

Risk aggregation
explanations
fraud flags

## Phase 5

React dashboard
alerts
transaction details
review workflow

## Phase 6

AWS SNS/SES

## Phase 7

Graph features
investigation graph
fraud-ring detection

## Phase 8

GNN GraphSAGE

## Phase 9

backtesting
rule simulation
model training UI

## Phase 10

WebSocket live updates
polish
tests
Docker
README

Do not stop after Phase 1 or create placeholders for later phases.

Complete the entire system.

---

# 63. ACCEPTANCE CRITERIA

The project is complete only when:

### Backend

* FastAPI starts
* PostgreSQL works
* migrations work
* authentication works
* transactions can be ingested
* CSV import works
* fraud engine evaluates transactions
* all three required rules work
* adding a new rule does not require modifying engine logic
* risk scores are persisted
* fraud flags are persisted
* audit logs are persisted

### Frontend

* login works
* dashboard loads real data
* alert table loads real data
* filters work
* transaction details work
* graph visualization works
* review/clear/confirm actions work
* case management works
* rule management works

### Notifications

* local mode works
* SNS mode works with AWS configuration
* SES mode works with AWS configuration
* notification failures are handled safely

### ML

* GNN training runs when labeled data is available
* model can be saved
* model can be loaded
* predictions work
* metrics are real
* no fake metrics

### Deployment

```bash
docker compose up --build
```

must bring up the full application.

---

# 64. FINAL OUTPUT EXPECTATION FROM YOU

Do not merely explain what should be built.

Actually create the complete implementation.

At the end provide:

1. project tree
2. key architecture explanation
3. setup commands
4. environment setup
5. database migration command
6. demo data generation command
7. CSV import command
8. backend startup command
9. frontend startup command
10. Docker command
11. test command
12. GNN training command
13. API documentation route
14. default reviewer/admin credentials for local development
15. list of implemented features
16. known limitations

If you encounter an implementation decision that does not materially affect the requirements, choose a sensible production-style option instead of asking for clarification.

Do not leave TODO comments for core functionality.

Do not use mock API responses.

Do not use hardcoded dashboard statistics.

Do not claim real-world data where the data is synthetic.

The final result must be a **fully connected, runnable, realistic fraud risk and investigation system**.
