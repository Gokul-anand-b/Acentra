Absolutely. This can be built as a **Python FastAPI + PostgreSQL + React + AWS SES/SNS** application with a pluggable fraud-rule architecture.

## 1. Proposed Architecture

```text
                    ┌──────────────────────┐
                    │     React Console    │
                    │  Reviewer Dashboard  │
                    └──────────┬───────────┘
                               │ REST API
                               ▼
                    ┌──────────────────────┐
                    │    FastAPI Backend   │
                    │                      │
                    │  Transaction API     │
                    │  Review API          │
                    │  Fraud Rule Engine   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
       │ Rule 1      │  │ Rule 2      │  │ Rule 3       │
       │ Velocity    │  │ Amount      │  │ Geo          │
       └─────────────┘  └─────────────┘  └──────────────┘
              │                │                │
              └────────────────┼────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │   Fraud Assessment   │
                    │                      │
                    │ Risk Score           │
                    │ Risk Level           │
                    │ Triggered Rules      │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
             ┌─────────────┐       ┌──────────────┐
             │ PostgreSQL  │       │ AWS SES/SNS  │
             │             │       │              │
             │ Transactions│       │ High Risk    │
             │ Fraud Flags │       │ Notification │
             │ Reviews     │       └──────────────┘
             └─────────────┘
```

---

# 2. Recommended Tech Stack

| Component         | Technology                     |
| ----------------- | ------------------------------ |
| Backend           | Python + FastAPI               |
| Rule Engine       | Python Strategy/Plugin Pattern |
| Database          | PostgreSQL                     |
| ORM               | SQLAlchemy                     |
| Frontend          | React + Vite                   |
| UI                | Tailwind CSS                   |
| API               | REST                           |
| Notifications     | AWS SES or SNS                 |
| Authentication    | JWT                            |
| Containerization  | Docker                         |
| Testing           | Pytest                         |
| API Documentation | Swagger/OpenAPI                |

---

# 3. Core Fraud Rules

The minimum three rules can work independently.

### Rule 1 — Transaction Velocity

Detect too many transactions within a short period.

Example:

```text
More than 5 transactions
within 10 minutes
        ↓
   HIGH RISK
```

Example:

```text
User: 1001

10:00 → ₹500
10:02 → ₹700
10:04 → ₹400
10:06 → ₹900
10:08 → ₹600
10:09 → ₹800

6 transactions / 10 minutes
→ Velocity Rule Triggered
```

---

### Rule 2 — Unusual Transaction Amount

Compare the current transaction against the customer's historical behavior.

For example:

```text
Average historical transaction = ₹2,000

Current transaction = ₹75,000

75,000 >> 2,000
        ↓
Amount Rule Triggered
```

You can initially use:

```python
current_amount > average_amount * 5
```

Later this can be replaced with ML-based anomaly detection.

---

### Rule 3 — Impossible Geographical Location

Detect transactions from locations that are physically impossible within the time difference.

Example:

```text
10:00 AM
Chennai
       ↓
       ↓ 15 minutes
       ↓
10:15 AM
London
```

Since Chennai → London cannot realistically happen in 15 minutes:

```text
Impossible Travel
        ↓
HIGH RISK
```

---

# 4. Most Important Requirement

The problem specifically says:

> New rules should be addable without modifying the core engine.

So **do not write this**:

```python
if velocity:
    ...

elif unusual_amount:
    ...

elif impossible_location:
    ...
```

inside your main engine.

Instead, use a **Rule Interface**.

---

# 5. Rule Interface

```python
from abc import ABC, abstractmethod


class FraudRule(ABC):

    @abstractmethod
    def evaluate(self, transaction, context):
        pass
```

Every rule implements this interface.

---

# 6. Fraud Result

```python
class RuleResult:

    def __init__(
        self,
        triggered: bool,
        score: int,
        reason: str
    ):
        self.triggered = triggered
        self.score = score
        self.reason = reason
```

Example:

```text
VelocityRule

triggered = True
score = 30
reason = "6 transactions within 10 minutes"
```

---

# 7. Velocity Rule

```python
from datetime import timedelta


class VelocityRule(FraudRule):

    def evaluate(self, transaction, context):

        transactions = context["recent_transactions"]

        count = sum(
            1 for tx in transactions
            if transaction.timestamp - tx.timestamp
            <= timedelta(minutes=10)
        )

        if count >= 5:
            return RuleResult(
                triggered=True,
                score=30,
                reason=f"{count} transactions within 10 minutes"
            )

        return RuleResult(
            triggered=False,
            score=0,
            reason=""
        )
```

---

# 8. Unusual Amount Rule

```python
class UnusualAmountRule(FraudRule):

    def evaluate(self, transaction, context):

        average_amount = context["average_amount"]

        if average_amount <= 0:
            return RuleResult(False, 0, "")

        if transaction.amount > average_amount * 5:

            return RuleResult(
                triggered=True,
                score=30,
                reason=(
                    f"Transaction amount ₹{transaction.amount} "
                    f"is significantly higher than "
                    f"historical average ₹{average_amount}"
                )
            )

        return RuleResult(False, 0, "")
```

---

# 9. Impossible Location Rule

You can calculate geographical distance using latitude/longitude.

```python
from math import radians, sin, cos, sqrt, atan2


def calculate_distance(lat1, lon1, lat2, lon2):

    R = 6371

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(dlon / 2) ** 2
    )

    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return R * c
```

Then:

```python
class ImpossibleLocationRule(FraudRule):

    def evaluate(self, transaction, context):

        previous = context.get("previous_transaction")

        if not previous:
            return RuleResult(False, 0, "")

        distance = calculate_distance(
            previous.latitude,
            previous.longitude,
            transaction.latitude,
            transaction.longitude
        )

        hours = (
            transaction.timestamp -
            previous.timestamp
        ).total_seconds() / 3600

        if hours <= 0:
            return RuleResult(False, 0, "")

        speed = distance / hours

        if speed > 900:
            return RuleResult(
                triggered=True,
                score=40,
                reason=(
                    f"Impossible travel detected: "
                    f"{distance:.0f} km in {hours:.2f} hours"
                )
            )

        return RuleResult(False, 0, "")
```

---

# 10. Core Rule Engine

Now the important part.

```python
class FraudRuleEngine:

    def __init__(self, rules):
        self.rules = rules

    def evaluate(self, transaction, context):

        results = []

        total_score = 0

        for rule in self.rules:

            result = rule.evaluate(
                transaction,
                context
            )

            if result.triggered:
                results.append(result)
                total_score += result.score

        if total_score >= 70:
            risk_level = "HIGH"

        elif total_score >= 40:
            risk_level = "MEDIUM"

        else:
            risk_level = "LOW"

        return {
            "score": total_score,
            "risk_level": risk_level,
            "rules": results
        }
```

---

# 11. Adding a New Rule

This demonstrates that the architecture satisfies the requirement.

Suppose you want:

### New Rule — Suspicious Merchant

Create:

```python
class SuspiciousMerchantRule(FraudRule):

    def evaluate(self, transaction, context):

        suspicious_merchants = context[
            "suspicious_merchants"
        ]

        if transaction.merchant_id in suspicious_merchants:

            return RuleResult(
                triggered=True,
                score=50,
                reason="Merchant is marked as suspicious"
            )

        return RuleResult(False, 0, "")
```

Then simply register it:

```python
rules = [
    VelocityRule(),
    UnusualAmountRule(),
    ImpossibleLocationRule(),
    SuspiciousMerchantRule()
]
```

**Core engine doesn't change.**

That's exactly what the requirement is asking for.

---

# 12. Database Design

Use PostgreSQL.

### transactions

```text
transactions
--------------------------------
id
customer_id
amount
currency
timestamp
latitude
longitude
merchant_id
ip_address
created_at
```

### fraud_flags

```text
fraud_flags
--------------------------------
id
transaction_id
risk_score
risk_level
triggered_rules
reason
status
created_at
reviewed_at
reviewed_by
```

Possible status:

```text
PENDING
REVIEWED
CLEARED
CONFIRMED_FRAUD
```

---

# 13. Example Transaction

```json
{
  "customer_id": "CUS1001",
  "amount": 75000,
  "currency": "INR",
  "timestamp": "2026-09-30T10:30:00",
  "latitude": 13.0827,
  "longitude": 80.2707,
  "merchant_id": "MERCHANT_102"
}
```

Engine could return:

```json
{
  "risk_score": 70,
  "risk_level": "HIGH",
  "triggered_rules": [
    {
      "rule": "unusual_amount",
      "score": 30
    },
    {
      "rule": "velocity",
      "score": 40
    }
  ]
}
```

---

# 14. High-Risk Notification

For example:

```python
if result["risk_level"] == "HIGH":

    send_high_risk_notification(
        transaction,
        result
    )
```

Using AWS SNS:

```python
import boto3

sns = boto3.client(
    "sns",
    region_name="ap-south-1"
)


def send_high_risk_notification(transaction, result):

    sns.publish(
        TopicArn=AWS_SNS_TOPIC_ARN,
        Subject="High Risk Transaction Detected",
        Message=f"""
        High-risk transaction detected.

        Transaction ID:
        {transaction.id}

        Amount:
        ₹{transaction.amount}

        Risk Score:
        {result['score']}

        Risk Level:
        {result['risk_level']}
        """
    )
```

You can use **AWS SES** instead if the requirement specifically wants an email.

---

# 15. React Reviewer Console

The dashboard should have something like:

```text
┌─────────────────────────────────────────────────────────────┐
│                 FRAUD REVIEW CONSOLE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Total       High Risk      Pending       Reviewed         │
│    248           31             18            230           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Transaction │ Amount │ Score │ Risk │ Rules │ Status       │
├─────────────┼────────┼───────┼──────┼────────┼──────────────┤
│ TXN-1023    │ ₹75K   │ 85    │ HIGH │ Amount │ PENDING      │
│ TXN-1024    │ ₹12K   │ 70    │ HIGH │ Geo    │ PENDING      │
│ TXN-1025    │ ₹3K    │ 45    │ MED  │Velocity│ REVIEWED     │
└─────────────────────────────────────────────────────────────┘
```

Clicking a transaction:

```text
Transaction Details
────────────────────────────────

Transaction ID: TXN-1023
Customer: CUS1001
Amount: ₹75,000
Location: Chennai
Time: 10:30 AM

Risk Score: 85
Risk Level: HIGH

Triggered Rules:

✓ Unusual Amount
  Current: ₹75,000
  Average: ₹4,200

✓ Transaction Velocity
  7 transactions / 10 minutes

✓ Impossible Location
  1,800 km within 30 minutes

────────────────────────────────

[ Mark as Reviewed ]   [ Clear ]
```

---

# 16. Backend API

Recommended endpoints:

```text
POST   /api/transactions
GET    /api/transactions
GET    /api/transactions/flagged
GET    /api/transactions/{id}

POST   /api/transactions/{id}/review
POST   /api/transactions/{id}/clear

GET    /api/dashboard/stats
GET    /api/rules
```

Example:

```http
GET /api/transactions/flagged?risk_level=HIGH
```

Response:

```json
[
  {
    "id": "TXN-1023",
    "amount": 75000,
    "risk_score": 85,
    "risk_level": "HIGH",
    "status": "PENDING"
  }
]
```

---

# 17. Recommended Project Structure

```text
fraud-rule-engine/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   │
│   │   ├── api/
│   │   │   ├── transactions.py
│   │   │   ├── reviews.py
│   │   │   └── dashboard.py
│   │   │
│   │   ├── models/
│   │   │   ├── transaction.py
│   │   │   └── fraud_flag.py
│   │   │
│   │   ├── schemas/
│   │   │   └── transaction.py
│   │   │
│   │   ├── rules/
│   │   │   ├── base.py
│   │   │   ├── velocity.py
│   │   │   ├── unusual_amount.py
│   │   │   └── impossible_location.py
│   │   │
│   │   ├── engine/
│   │   │   └── fraud_engine.py
│   │   │
│   │   ├── services/
│   │   │   ├── notification.py
│   │   │   └── transaction_service.py
│   │   │
│   │   └── database.py
│   │
│   ├── tests/
│   │   ├── test_velocity.py
│   │   ├── test_amount.py
│   │   ├── test_geo.py
│   │   └── test_engine.py
│   │
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── TransactionTable.jsx
│   │   │   ├── TransactionDetails.jsx
│   │   │   └── RiskBadge.jsx
│   │   │
│   │   ├── pages/
│   │   │   └── ReviewConsole.jsx
│   │   │
│   │   ├── services/
│   │   │   └── api.js
│   │   │
│   │   └── App.jsx
│   │
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

## 18. End-to-End Flow

```text
Transaction received
        │
        ▼
Store transaction
        │
        ▼
Build customer context
        │
        ▼
┌───────────────────────────┐
│     Fraud Rule Engine     │
└─────────────┬─────────────┘
              │
       ┌──────┼──────┐
       ▼      ▼      ▼
   Velocity Amount   Geo
       │      │      │
       └──────┼──────┘
              ▼
        Calculate Score
              │
       ┌──────┴───────┐
       │              │
       ▼              ▼
    LOW/MEDIUM       HIGH
       │              │
       ▼              ▼
    Database       Database
                      │
                      ▼
                  AWS SNS/SES
                      │
                      ▼
                Reviewer Console
                      │
              ┌───────┴────────┐
              ▼                ▼
           Reviewed          Cleared
```

### Key design point

The strongest part of this implementation is the **plugin-style rule architecture**:

```text
                 FraudRule
                    │
        ┌───────────┼────────────┐
        │           │            │
    Velocity      Amount        Geo
        │           │            │
        └───────────┼────────────┘
                    │
              Fraud Engine
                    │
             Risk Assessment
```

So if tomorrow you need **IP reputation, suspicious merchant, blacklisted account, device fingerprint, failed-login velocity, or unusual country** rules, you create another class implementing `FraudRule` and register it—**the core engine remains unchanged**.
and 
Yes. I searched GitHub specifically for **open-source fraud/risk rule engines and reviewer-console projects** matching your requirements.

### 🔥 Closest matches to your problem

| Project                                                                                          | Stack                                | What matches your requirement                                                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------- |
| **[fraud-detector](https://github.com/pelzade127/fraud-detector)**                               | Python + Flask + SQLite              | ⭐ Velocity, unusual amount, impossible travel, modular rules, explainable risk scoring |
| **[AEGIS](https://github.com/lalitofficial/AEGIS)**                                              | FastAPI + React/Vite + PostgreSQL    | ⭐⭐⭐ Full-stack fraud platform, analyst dashboard, alerts, investigation workflows      |
| **[transaction-fraud-detection](https://github.com/ManasiNarkhede/transaction-fraud-detection)** | FastAPI + React + PostgreSQL         | ⭐⭐⭐ Configurable business rules, real-time dashboard, alerts, audit logging            |
| **[AegisPay](https://github.com/cipher20000/AegisPay)**                                          | React + FastAPI + PostgreSQL         | ⭐⭐ Fraud dashboard + risk scoring + PostgreSQL                                         |
| **[risk-triage](https://github.com/pandeyvishwas51-oss/risk-triage)**                            | Python                               | ⭐⭐ Clean weighted rule engine with velocity, geo, device and amount signals            |
| **[aml-rule-engine](https://github.com/duero2000/aml-rule-engine)**                              | Python + SQLite + Streamlit          | ⭐ Rule-based transaction monitoring + analyst review dashboard                         |
| **[FraudLens](https://github.com/Vedag812/FraudLens)**                                           | FastAPI + Celery + Redis             | ⭐ Advanced real-time UPI fraud detection                                               |
| **[ezrules](https://github.com/sofeikov/ezrules)**                                               | FastAPI + React + PostgreSQL + Redis | ⭐⭐⭐ Dedicated transaction-monitoring/rule-engine platform                              |

### 1. `pelzade127/fraud-detector`

[GitHub — fraud-detector](https://github.com/pelzade127/fraud-detector?utm_source=chatgpt.com)

This is **very close to your three required rules**. It already implements velocity checks, amount anomalies, geolocation/impossible travel, stateful transaction history, explainable risk scores and a modular rules engine. ([GitHub][1])

Its rules include:

```text
Velocity
Large Transaction
Impossible Travel
New Device
Device Velocity
Round Dollar
High-Risk Category
```

This is probably the best repository to study for the **Python fraud-rule-engine portion**.

---

### 2. `lalitofficial/AEGIS`

[GitHub — AEGIS](https://github.com/lalitofficial/AEGIS?utm_source=chatgpt.com)

This one is interesting for your **complete application architecture**.

It has:

```text
React/Vite
       ↓
FastAPI
       ↓
PostgreSQL
       ↓
Fraud / Risk Engine
       ↓
Analyst Dashboard
       ↓
Alerts + Investigation Workflow
```

It specifically describes a React-based analyst experience, FastAPI backend, PostgreSQL, risk scoring, alerts and investigation workflows. ([GitHub][2])

---

### 3. `ManasiNarkhede/transaction-fraud-detection`

[GitHub — transaction-fraud-detection](https://github.com/ManasiNarkhede/transaction-fraud-detection?utm_source=chatgpt.com)

This is another **very close architectural reference**.

It has:

* FastAPI
* React + TypeScript
* Tailwind
* PostgreSQL
* SQLAlchemy
* Configurable business rules
* Real-time monitoring
* Fraud alerts
* Audit logging
* Email notifications

([GitHub][3])

This could be useful for your **reviewer console + notification workflow**.

---

### 4. `sofeikov/ezrules`

[GitHub — ezrules](https://github.com/sofeikov/ezrules?utm_source=chatgpt.com)

This is particularly relevant to your requirement:

> "New rules should be addable without modifying the core engine."

It is specifically an open-source **transaction monitoring engine** for defining and executing business rules, with backtesting, alerts, cases, PostgreSQL, Redis, FastAPI, Celery and a web UI. ([GitHub][4])

This is worth studying if you want your project to look more like a **real rule-management platform** rather than just a fraud-detection script.

---

### 5. `risk-triage`

[GitHub — risk-triage](https://github.com/pandeyvishwas51-oss/risk-triage?utm_source=chatgpt.com)

This is a smaller Python implementation focused on transaction risk scoring.

It has signals for:

```text
Amount
Velocity
Geography
Device
Account age
Transaction history
Authentication
```

and produces a risk score, decision and explanation. ([GitHub][5])

Good reference for designing your **rule interface and scoring system**.

---

## My suggested approach for your project

Don't simply clone one of these.

Combine the strongest relevant ideas:

```text
                  YOUR PROJECT
                       │
          ┌────────────┴────────────┐
          │                         │
   Rule Engine                  Reviewer UI
          │                         │
   ┌──────┼──────┐             React + Vite
   │      │      │                  │
Velocity Amount   Geo           Transaction
   │      │      │              Investigation
   └──────┼──────┘                  │
          │                     Review/Clear
          ▼
    Risk Score
          │
          ▼
     PostgreSQL
          │
          ▼
    High Risk Event
          │
      AWS SES/SNS
```

### Best GitHub references by requirement

**Rule engine:** `fraud-detector` + `risk-triage` ([GitHub][1])

**React reviewer console:** `AEGIS` + `transaction-fraud-detection` ([GitHub][2])

**Extensible business-rule architecture:** `ezrules` ([GitHub][4])

**Advanced fraud detection ideas:** `FraudLens` ([GitHub][6])

**AML/rule-based monitoring:** `aml-rule-engine` ([GitHub][7])

[Browse GitHub's transaction-monitoring projects](https://github.com/topics/transaction-monitoring?utm_source=chatgpt.com) ([GitHub][8])

If your goal is to **actually build this quickly**, I would start from the `fraud-detector` rule logic and `AEGIS`/`transaction-fraud-detection` architecture, then implement your own FastAPI + PostgreSQL + React + AWS notification version.

[1]: https://github.com/pelzade127/fraud-detector?utm_source=chatgpt.com "GitHub - pelzade127/fraud-detector: Real-time fraud detection engine with velocity checks, geolocation analysis, and device fingerprinting. Stateful detection using SQLite with explainable risk assessments. · GitHub"
[2]: https://github.com/lalitofficial/AEGIS?utm_source=chatgpt.com "GitHub - lalitofficial/AEGIS: Fraud detection platform with a FastAPI backend and a React/Vite frontend. · GitHub"
[3]: https://github.com/ManasiNarkhede/transaction-fraud-detection?utm_source=chatgpt.com "GitHub - ManasiNarkhede/transaction-fraud-detection: AI-powered real-time transaction fraud detection system with ML-based risk scoring, configurable rules, OTP verification, audit logging, and an interactive analytics dashboard. · GitHub"
[4]: https://github.com/sofeikov/ezrules?utm_source=chatgpt.com "GitHub - sofeikov/ezrules: Welcome to an open-source transaction monitoring engine! This product is designed to simplify the definition and management of business rules while also offering a scalable infrastructure for rule execution and backtesting. · GitHub"
[5]: https://github.com/opensyndicate/risk-triage?utm_source=chatgpt.com "GitHub - opensyndicate/risk-triage: Open-source agent that triages payment fraud and risk. Scores a transaction from its signals, decides approve, review, or block, and explains why. Deterministic scoring engine plus a Claude agent for the borderline cases. Advisory only, gateway-agnostic. · GitHub"
[6]: https://github.com/Vedag812/FraudLens?utm_source=chatgpt.com "GitHub - Vedag812/FraudLens: Real-time UPI fraud detection engine with FAISS similarity search, causal inference (DiD), FastAPI, and Celery/Redis async pipeline — 1M+ transactions · GitHub"
[7]: https://github.com/duero2000/aml-rule-engine?utm_source=chatgpt.com "GitHub - duero2000/aml-rule-engine: AML Project · GitHub"
[8]: https://github.com/topics/transaction-monitoring?utm_source=chatgpt.com "transaction-monitoring · GitHub Topics · GitHub"
and If by **“all datasets”** you mean datasets you can use for your **Fraud Rule Engine with Review Console**, here is a broader list I found. I’ve grouped them by how useful they are for your three rules: **velocity, unusual amount, and impossible geography**.

## Fraud / Transaction Datasets

| Dataset                                  |           Size / Records | Amount |       Time      |       Location       |   Fraud Label  | Useful for |
| ---------------------------------------- | -----------------------: | :----: | :-------------: | :------------------: | :------------: | ---------- |
| **Fraud Detection Handbook – Simulated** |                   ~1.75M |    ✅   |        ✅        |    ⚠️ coordinates    |        ✅       | ⭐⭐⭐⭐⭐      |
| **Kaggle Credit Card Fraud (ULB 2013)**  |                  284,807 |    ✅   |        ✅        |           ❌          |        ✅       | ⭐⭐⭐        |
| **Kaggle Fraud Detection / Sparkov**     |                     ~1M+ |    ✅   |        ✅        |      ✅ lat/long      |        ✅       | ⭐⭐⭐⭐⭐      |
| **IEEE-CIS Fraud Detection**             |       ~590K transactions |    ✅   | ✅ relative time |      ⚠️ indirect     |        ✅       | ⭐⭐⭐⭐       |
| **PaySim**                               |                    ~6.3M |    ✅   |        ✅        |           ❌          |        ✅       | ⭐⭐⭐⭐       |
| **BankSim**                              |                    ~594K |    ✅   |        ✅        |           ❌          |        ✅       | ⭐⭐⭐        |
| **IBM AMLSim**                           | Synthetic / configurable |    ✅   |        ✅        |           ❌          |  AML patterns  | ⭐⭐⭐⭐       |
| **Elliptic Bitcoin**                     |       ~200K transactions | crypto |        ✅        |      blockchain      | illicit labels | ⭐⭐⭐        |
| **Elliptic++**                           |     203,769 transactions | crypto |        ✅        | wallet/address graph | illicit labels | ⭐⭐⭐        |
| **Credit Card Fraud 2023**               |                  568,630 |    ✅   |     limited     |           ❌          |        ✅       | ⭐⭐⭐        |

---

## 1. 🥇 Fraud Detection Handbook Simulated Dataset

This is **especially suitable for your rule engine**.

The official Fraud Detection Handbook simulator generates about **1.75 million transactions**, with customer ID, terminal ID, amount, timestamp and fraud labels. It deliberately includes time-dependent fraud scenarios and severe class imbalance. ([Fraud Detection Handbook][1])

Fields include:

```text
TRANSACTION_ID
TX_DATETIME
CUSTOMER_ID
TERMINAL_ID
TX_AMOUNT
TX_TIME_SECONDS
TX_TIME_DAYS
TX_FRAUD
TX_FRAUD_SCENARIO
```

The simulator also generates customer geographical coordinates and customer spending/transaction behavior. ([Fraud Detection Handbook][1])

**Official GitHub:**

[Fraud Detection Handbook GitHub](https://github.com/Fraud-Detection-Handbook/fraud-detection-handbook?utm_source=chatgpt.com)

**Raw simulated dataset repository:**

[Simulated Data Raw](https://github.com/Fraud-Detection-Handbook/simulated-data-raw?utm_source=chatgpt.com)

### Why it fits your project

You can derive:

```text
TX_DATETIME
     ↓
Velocity Rule

CUSTOMER_ID + TX_AMOUNT
     ↓
Unusual Amount Rule

Customer coordinates
     +
Transaction/terminal location
     ↓
Geographical Rule
```

One limitation: the standard dataset does **not directly provide real-world latitude/longitude for every transaction**, so you'd need to extend/simulate transaction location if **impossible travel** is a core demonstration.

---

# 2. Kaggle Credit Card Fraud Detection — ULB

This is the famous **284,807 transaction** dataset.

It contains:

```text
284,807 transactions
492 fraud
0.172% fraud rate
```

The dataset covers two days of transactions from European cardholders. Features are mostly anonymized PCA components, plus `Time`, `Amount`, and `Class`. ([Kaggle][2])

[Kaggle — Credit Card Fraud Detection](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud?utm_source=chatgpt.com)

### Problem for your project

It doesn't contain useful geographic information:

```text
❌ latitude
❌ longitude
❌ merchant location
❌ customer location
```

So it's good for:

```text
Amount Rule
Time/Velocity Rule
Fraud Classification
```

but **not ideal for Impossible Geographical Location**.

---

# 3. Sparkov / Kaggle Fraud Detection Dataset

This is one of the more interesting choices for your project because it contains transaction information such as:

```text
transaction timestamp
credit card
merchant
category
amount
customer information
city
state
ZIP
latitude
longitude
merchant latitude
merchant longitude
fraud label
```

The Kaggle transaction-fraud dataset documents fields including `trans_date_trans_time`, merchant, category, amount, cardholder address, `lat`, `long`, merchant coordinates, Unix time and `is_fraud`. ([Kaggle][3])

[Kaggle — Transaction Fraud Detection](https://www.kaggle.com/competitions/transaction-fraud-detection/data?utm_source=chatgpt.com)

### ⭐ This is very relevant to your project

You can directly build:

```text
                    Transaction
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
          Amount       Time        Location
             │           │           │
             ▼           ▼           ▼
         Amount       Velocity    Impossible
          Rule          Rule       Travel
```

This is probably the most convenient dataset if you want to **demonstrate all three rules with realistic-looking transaction data**.

---

# 4. IEEE-CIS Fraud Detection

A large online-payment fraud dataset.

It has separate:

```text
train_transaction.csv
train_identity.csv
test_transaction.csv
test_identity.csv
```

and they can be joined using `TransactionID`. ([Kaggle][4])

It contains features around:

```text
Transaction
Card
Address
Email
Device
Browser
Operating system
Identity
Timing
```

The full dataset is about **1.35 GB** and has hundreds of features. ([Kaggle][4])

[Kaggle — IEEE-CIS Fraud Detection](https://www.kaggle.com/competitions/ieee-fraud-detection/data?utm_source=chatgpt.com)

### Good for

```text
Device Rule
Amount Rule
Transaction Pattern Rule
Velocity
Identity Risk
```

### Not ideal for

```text
Actual latitude/longitude
Impossible travel
```

---

# 5. PaySim

PaySim is a **synthetic mobile-money transaction dataset** widely used for fraud-detection research.

Typical transaction information includes:

```text
step
type
amount
nameOrig
oldbalanceOrg
newbalanceOrig
nameDest
oldbalanceDest
newbalanceDest
isFraud
isFlaggedFraud
```

It is useful for building transaction-risk logic and studying suspicious transaction patterns.

For your project:

```text
Amount Rule       ✅
Velocity Rule     ✅
Balance anomaly  ✅
Fraud label       ✅
Geographical Rule ❌
```

So it is a good secondary dataset but not the best single dataset for your requirements.

---

# 6. BankSim

BankSim is another **synthetic banking/payment transaction dataset**.

It is useful for:

```text
customer behavior
merchant behavior
transaction amounts
time patterns
fraud classification
```

But again:

```text
Geographical coordinates ❌
```

So you'd need to add your own location data for the impossible-travel rule.

---

# 7. IBM AMLSim

This one is different.

It is designed for **Anti-Money Laundering (AML)** rather than ordinary credit-card fraud.

IBM's AMLSim generates synthetic banking transactions together with known money-laundering patterns. ([GitHub][5])

[IBM AMLSim GitHub](https://github.com/IBM/AMLSim?utm_source=chatgpt.com)

It can generate files such as:

```text
accounts.csv
transactions.csv
cash_tx.csv
alert_accounts.csv
alert_transactions.csv
sar_accounts.csv
transaction_log.csv
```

([GitHub][5])

This would be excellent if you later expand your project from:

**Fraud Detection → Financial Crime Risk Engine**

---

# 8. Elliptic Bitcoin Dataset

This is for **cryptocurrency transaction fraud/illicit activity** rather than card transactions.

It models transactions as a graph.

Useful concepts:

```text
Wallet
   │
   ├── Transaction
   │
   ├── Transaction
   │
   └── Transaction
```

Good for:

```text
Graph-based fraud
Suspicious wallets
Transaction tracing
Illicit activity
```

---

# 9. Elliptic++

The Elliptic++ transactions dataset contains:

```text
203,769 transactions
234,355 edges
49 time steps
183 features
4,545 illicit transactions
42,019 licit transactions
157,205 unknown
```

([GitHub][6])

[Elliptic++ GitHub Dataset](https://github.com/juicy-candy/Elliptic?utm_source=chatgpt.com)

This would be useful if you want to add a **graph-based fraud rule** later.

---

# 10. Credit Card Fraud Detection 2023

Another large credit-card dataset contains around:

```text
568,630 transactions
```

with anonymized features and a fraud class. A public GitHub dataset description lists it alongside the ULB 2013 dataset. ([GitHub][7])

However, it doesn't solve your geographic requirement.

---

# 🎯 Dataset choice for YOUR exact project

Your requirements are:

```text
1. Transaction velocity
2. Unusual transaction amount
3. Impossible geographical location
4. Extensible rule engine
5. Persist transactions
6. Persist fraud flags
7. React reviewer console
8. Review/Clear transactions
9. AWS notification
```

So I'd structure the data sources like this:

### Option A — One dataset + synthetic location

```text
Sparkov/Kaggle
       +
Generated GPS data
       ↓
Your Rule Engine
```

This is the simplest approach.

### Option B — Fraud Detection Handbook

```text
Fraud Detection Handbook
       +
Transaction location generator
       ↓
Velocity
Amount
Geo
       ↓
Fraud Rule Engine
```

The Handbook is particularly useful because its simulator explicitly generates temporal transaction behavior and customer profiles, and the raw data is publicly available through GitHub. ([Fraud Detection Handbook][1])

### Option C — Multiple datasets

For a more impressive system:

```text
                Dataset Adapter Layer
                         │
        ┌────────────────┼─────────────────┐
        ▼                ▼                 ▼
   Sparkov          PaySim          AMLSim
        │                │                 │
        └────────────────┼─────────────────┘
                         ▼
                  Normalized Schema
                         │
                         ▼
                   Rule Engine
```

This allows your engine to accept different financial datasets without changing the rules.

## My recommendation for implementation

Use **Sparkov/Kaggle as the primary demonstration dataset**, because it gives you timestamp, amount and both customer/merchant geographic coordinates. ([Kaggle][3])

Then create a normalized schema:

```text
Transaction
├── transaction_id
├── customer_id
├── timestamp
├── amount
├── currency
├── merchant_id
├── customer_lat
├── customer_lon
├── merchant_lat
├── merchant_lon
└── fraud_label
```

Your rules then become completely dataset-independent:

```text
                   Normalized Transaction
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
       VelocityRule   AmountRule   ImpossibleGeoRule
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                       Risk Score
                            │
                   ┌────────┴────────┐
                   ▼                 ▼
                Database          AWS SES/SNS
                   │
                   ▼
             React Console
```

This gives you a much cleaner **software-engineering project** than training a fraud ML model alone.

[1]: https://fraud-detection-handbook.github.io/fraud-detection-handbook/Chapter_3_GettingStarted/SimulatedDataset.html?utm_source=chatgpt.com "2. Transaction data simulator — Reproducible Machine Learning for Credit Card Fraud detection - Practical handbook"
[2]: https://www.kaggle.com/mlg-ulb/creditcardfraud/data?utm_source=chatgpt.com "Credit Card Fraud Detection"
[3]: https://www.kaggle.com/competitions/transaction-fraud-detection/data?utm_source=chatgpt.com "Transaction Fraud Detection | Kaggle"
[4]: https://www.kaggle.com/competitions/ieee-fraud-detection/data?utm_source=chatgpt.com "IEEE-CIS Fraud Detection | Kaggle"
[5]: https://github.com/IBM/AMLSim/?utm_source=chatgpt.com "GitHub - IBM/AMLSim: The AMLSim project is intended to provide a multi-agent based simulator that generates synthetic banking transaction data together with a set of known money laundering patterns - mainly for the purpose of testing machine learning models and graph algorithms. We welcome you to enhance this effort since the data set related to money laundering is critical to advance detection capabilities of money laundering activities. · GitHub"
[6]: https://github.com/juicy-candy/Elliptic/blob/main/Transactions%20Dataset/README.md?utm_source=chatgpt.com "Elliptic/Transactions Dataset/README.md at main · juicy-candy/Elliptic · GitHub"
[7]: https://github.com/U-Bryan/privacy-preserving-federated-fraud-detection/blob/main/docs/DATASETS.md?utm_source=chatgpt.com "privacy-preserving-federated-fraud-detection/docs/DATASETS.md at main · U-Bryan/privacy-preserving-federated-fraud-detection · GitHub"
and Here are the **direct dataset links** for your Fraud Rule Engine project:

### ⭐ Best match — Fraud transaction dataset with GPS

[Kaggle — Transaction Fraud Detection Dataset](https://www.kaggle.com/competitions/transaction-fraud-detection/data?utm_source=chatgpt.com)

It contains `timestamp`, `amount`, `lat`, `long`, `merch_lat`, `merch_long`, and `is_fraud`, so it can support your **velocity + unusual amount + geographical rules**. ([Kaggle][1])

### Other useful datasets

* [Fraud Detection Handbook — Simulated Dataset](https://github.com/Fraud-Detection-Handbook/simulated-data-raw?utm_source=chatgpt.com) — transaction timestamps, amounts, customers, terminals and fraud scenarios. ([Fraud Detection Handbook][2])
* [Fraud Detection Handbook — Transformed Dataset](https://github.com/Fraud-Detection-Handbook/simulated-data-transformed?utm_source=chatgpt.com) — ready-to-use transformed data. ([Fraud Detection Handbook][3])
* [Kaggle — PaySim Dataset](https://www.kaggle.com/datasets/ealaxi/paysim1?utm_source=chatgpt.com) — 6.36M synthetic mobile-money transactions. ([GitHub][4])
* [Kaggle — Credit Card Fraud Detection (ULB)](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud?utm_source=chatgpt.com) — 284K+ credit-card transactions.
* [Kaggle — Anomaly Detection/Fraud Dataset with GPS](https://www.kaggle.com/competitions/anomaly-detection-ai-ds-2024/data?utm_source=chatgpt.com) — includes transaction time, amount, cardholder coordinates, merchant coordinates and fraud label. ([Kaggle][5])

**For your exact project, use the first Kaggle dataset.** It already has the geographic fields needed to demonstrate the **Impossible Geographical Location** rule. ([Kaggle][1])

[1]: https://www.kaggle.com/competitions/transaction-fraud-detection/data?utm_source=chatgpt.com "Transaction Fraud Detection | Kaggle"
[2]: https://fraud-detection-handbook.github.io/fraud-detection-handbook/Chapter_3_GettingStarted/SimulatedDataset.html?utm_source=chatgpt.com "2. Transaction data simulator — Reproducible Machine Learning for Credit Card Fraud detection - Practical handbook"
[3]: https://fraud-detection-handbook.github.io/fraud-detection-handbook/Chapter_3_GettingStarted/BaselineFeatureTransformation.html?utm_source=chatgpt.com "3. Baseline feature transformation — Reproducible Machine Learning for Credit Card Fraud detection - Practical handbook"
[4]: https://github.com/imartinsorribes/fraud-detection-paysim/blob/main/data/README.md?utm_source=chatgpt.com "fraud-detection-paysim/data/README.md at main · imartinsorribes/fraud-detection-paysim · GitHub"
[5]: https://www.kaggle.com/competitions/anomaly-detection-ai-ds-2024/data?utm_source=chatgpt.com "Anomaly Detection - AI/DS 2024 | Kaggle"
and Yes. I searched the current open-source landscape around **fraud rule engines, transaction monitoring, reviewer consoles, datasets, and GNN-based fraud detection**. Based on that, here is a complete breakdown you can use to define the project.

# 1. The actual problem

Financial institutions process huge numbers of transactions. A fraudulent transaction may not look obviously fraudulent when viewed alone.

For example:

```text
Transaction A
₹1,500
Chennai
10:00 AM

Transaction B
₹2,000
Chennai
10:05 AM

Transaction C
₹85,000
London
10:12 AM
```

Individually, the third transaction may simply look like a large transaction.

But when you combine:

* transaction frequency,
* customer's historical spending,
* geographical movement,
* merchant behavior,
* device,
* account relationships,

the transaction becomes much more suspicious.

Fraud Detection Handbook research highlights exactly this challenge: fraud datasets are highly imbalanced and fraud scenarios can be **time-dependent**, requiring transaction history rather than looking at one transaction independently. ([Fraud Detection Handbook][1])

---

# 2. Who is affected?

### Primary users

**Banks / FinTech companies / payment processors**

They need to identify suspicious transactions before financial loss occurs.

### Fraud analysts

They receive potentially thousands of alerts.

Their problem is:

```text
10,000 transactions
       ↓
500 suspicious alerts
       ↓
Analyst manually investigates
       ↓
Large workload
```

### Customers

False positives can cause:

```text
Legitimate transaction
        ↓
Fraud system flags it
        ↓
Card/payment blocked
        ↓
Customer frustrated
```

### Compliance / AML teams

They need:

* explanations,
* audit trails,
* investigation history,
* risk scores,
* evidence for why something was flagged.

Open-source AML systems similarly emphasize rule explanations, transaction exploration, persistence and case management. ([GitHub][2])

---

# 3. What the problem statement is asking

Your original requirements essentially ask you to build:

### A. Rule engine

Evaluate every transaction against independent fraud rules.

### B. Three mandatory rules

```text
1. Transaction Velocity
2. Unusual Transaction Amount
3. Impossible Geographical Location
```

### C. Extensibility

This is important:

> New rules should be addable without modifying the core engine.

So your architecture must support:

```text
VelocityRule
AmountRule
GeoRule
       +
FutureRule1
FutureRule2
FutureRule3
```

without rewriting the engine.

### D. Persistence

Store:

```text
Transactions
Fraud flags
Risk scores
Triggered rules
Review status
Reviewer
Review timestamp
```

### E. Reviewer console

React UI where analysts can:

```text
View flagged transactions
       ↓
Open transaction
       ↓
See why it was flagged
       ↓
Review
       ↓
Clear / confirm
```

### F. Notification

If:

```text
Risk >= HIGH_THRESHOLD
```

send:

```text
AWS SES email
       OR
AWS SNS notification
```

---

# 4. Our solution

I would build this as a **Hybrid Explainable Fraud Risk Platform**.

Not just:

> "Fraud detection model"

but:

> **Real-time transaction risk engine + explainable rule system + graph intelligence + analyst review console.**

Architecture:

```text
                       TRANSACTION
                            │
                            ▼
                   ┌─────────────────┐
                   │ FastAPI Ingest  │
                   └────────┬────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Transaction Context  │
                 │                      │
                 │ Customer history     │
                 │ Device history       │
                 │ Location history     │
                 │ Merchant history     │
                 └──────────┬───────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
        Velocity         Amount           Geo
          Rule            Rule            Rule
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                  ┌───────────────────┐
                  │ Risk Score Engine │
                  └─────────┬─────────┘
                            │
                ┌───────────┴────────────┐
                │                        │
             Normal                   Suspicious
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                           GNN Risk              Rule Risk
                              │                     │
                              └──────────┬──────────┘
                                         ▼
                                 Final Risk Score
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                         PostgreSQL             HIGH RISK
                              │                     │
                              ▼                     ▼
                       React Console          AWS SES/SNS
```

---

# 5. Why a GNN could make this much more interesting

This is where you can go beyond the minimum requirements.

Traditional rule:

```text
Transaction
     ↓
Amount > threshold?
     ↓
FLAG
```

But fraud often involves **relationships**.

Example:

```text
              ┌── Merchant A
              │
Card 101 ─────┤
              │
              └── Card 205
                     │
                     └── Card 309
```

Suppose 20 different cards suddenly transact with the same suspicious merchant.

A normal transaction-level rule may not understand that relationship.

A graph can.

Open-source GNN fraud projects explicitly model accounts/cards and merchants as graph nodes and transactions as edges/nodes to capture network-level patterns such as fraud rings and compromised merchant relationships. ([GitHub][3])

---

# 6. Our graph model

You could construct:

```text
Customer
    │
    │ transaction
    ▼
Merchant
    │
    │ transaction
    ▼
Device
    │
    │ used by
    ▼
Customer
```

More formally:

```text
Nodes:
──────
Customer
Merchant
Device
Location
Transaction

Edges:
──────
CUSTOMER → TRANSACTION
TRANSACTION → MERCHANT
CUSTOMER → DEVICE
TRANSACTION → LOCATION
```

This becomes a **heterogeneous transaction graph**.

---

# 7. GNN architecture

You don't need an extremely complicated model.

Start with:

### GraphSAGE

```text
Customer
   │
   ├── Merchant
   │
   ├── Transaction
   │
   └── Device
        ↓
Neighbour aggregation
        ↓
Embedding
        ↓
Fraud probability
```

GraphSAGE is already used in public fraud-detection implementations with FastAPI and PyTorch Geometric. ([GitHub][3])

Another open-source implementation explores:

```text
GraphSAGE
GAT
HGT
```

on card–merchant–transaction graphs. ([GitHub][4])

---

# 8. But DON'T replace the rule engine with GNN

This is important.

Your project specifically asks for a **rule engine**.

So:

```text
                 Transaction
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
    Deterministic              GNN
       Rules                  Risk Model
          │                       │
          │                       │
          └───────────┬───────────┘
                      ▼
                Risk Aggregator
                      │
                      ▼
                 Final Score
```

Example:

```text
Velocity Rule        +25
Amount Rule          +30
Geo Rule             +40
GNN Score            +20
──────────────────────────
Final Risk            115
```

Normalize to:

```text
0–29     LOW
30–59    MEDIUM
60–79    HIGH
80–100   CRITICAL
```

This gives you **explainable deterministic rules + learned network intelligence**.

---

# 9. Repository comparison

I searched several open-source projects.

| Repository                             | Rule Engine | Geo       | Velocity | React | API     | DB         | GNN | Review/Analyst |
| -------------------------------------- | ----------- | --------- | -------- | ----- | ------- | ---------- | --- | -------------- |
| `pelzade127/fraud-detector`            | ✅           | ✅         | ✅        | ❌     | Flask   | SQLite     | ❌   | Limited        |
| `ArnavK269/transaction-monitoring`     | ✅           | ⚠️        | ✅        | ❌     | REST    | DB         | ❌   | ⚠️             |
| `surihoney/aml-transaction-monitoring` | ✅           | Country   | ✅        | ✅     | Express | SQLite     | ❌   | Explorer       |
| `ArayikGevorgyan/AML_System`           | ✅           | Sanctions | ✅        | ✅     | FastAPI | SQLite     | ML  | ✅              |
| `nbharwad/fraud-detection-gnn`         | ❌           | ❌         | Feature  | ❌     | FastAPI | —          | ✅   | ❌              |
| `sudsho/gnn-fraud-detection-banking`   | ❌           | ❌         | Feature  | ❌     | —       | —          | ✅   | ❌              |
| **Our proposed system**                | ✅           | ✅         | ✅        | ✅     | FastAPI | PostgreSQL | ✅   | ✅              |

The `pelzade127/fraud-detector` repository is particularly close to your required rule logic: it has stateful detection, velocity, amount anomalies, geospatial analysis using Haversine distance and explainable reason codes. ([GitHub][5])

The `surihoney` project demonstrates a React-based transaction explorer and rule-based scoring/persistence workflow, while its rules include large amount, daily volume, structuring, rapid transactions and circular transactions. ([GitHub][2])

The `ArayikGevorgyan/AML_System` project adds a more complete analyst-style platform with React, FastAPI, transactions, alerts, cases, rules, audit and ML/statistical components. ([GitHub][6])

---

# 10. What our solution adds

This is the key difference.

### Existing open-source implementations generally specialize in one area:

```text
Project A → Rule engine
Project B → GNN
Project C → AML dashboard
Project D → Transaction monitoring
```

### Your project combines them:

```text
             ┌─────────────────────────┐
             │ Transaction Risk Engine │
             └────────────┬────────────┘
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
       ▼                  ▼                  ▼
    Rules              Behavioral          Graph
       │                Analytics          GNN
       │                  │                  │
       └──────────────────┼──────────────────┘
                          ▼
                    Risk Aggregator
                          │
                          ▼
                  Explainable Alert
                          │
                          ▼
                  Reviewer Console
```

---

# 11. CORE FEATURES

These are the features I would put under **Core Features** in your project presentation.

### 1. Real-time transaction ingestion

```text
POST /transactions
```

Transaction immediately enters the risk engine.

---

### 2. Pluggable fraud rule engine

Mandatory:

```text
Velocity
Unusual Amount
Impossible Travel
```

Future:

```text
Device anomaly
IP reputation
Merchant risk
Account age
Failed authentication
Country risk
Structuring
```

---

### 3. Risk scoring

Each rule contributes a score.

```text
Rule               Score
─────────────────────────
Velocity              25
Amount                30
Geo                   40
Device                20
─────────────────────────
Total                 115
```

---

### 4. Explainable fraud flags

Instead of:

```text
FRAUD = TRUE
```

show:

```text
HIGH RISK

Reasons:
✓ 8 transactions within 10 minutes
✓ Amount is 7.2× customer's average
✓ 4,200 km movement within 20 minutes
```

This is extremely useful for the reviewer.

---

### 5. PostgreSQL persistence

Store:

```text
Transaction
Risk Assessment
Triggered Rules
Risk Score
Review Status
Reviewer
Review Timestamp
```

---

### 6. React reviewer console

```text
Dashboard
Transactions
Flagged Transactions
Transaction Details
Risk Explanation
Review
Clear
Audit History
```

---

### 7. AWS notification

```text
Risk >= 80
      ↓
AWS SNS / SES
      ↓
Fraud Analyst
```

---

# 12. WOW FACTORS 🔥

These are **additional features**, not things you need to satisfy the minimum requirements.

## WOW #1 — GNN Fraud Ring Detection

This would be my biggest technical addition.

Detect:

```text
Card A ──┐
Card B ──┼── Merchant X
Card C ──┤
Card D ──┘
```

The system says:

> "Multiple accounts exhibit suspicious connectivity around Merchant X."

This captures **network-level fraud** that individual transaction rules can miss. Public GNN implementations specifically motivate this because fraud can involve rings and shared accounts/merchants. ([GitHub][3])

---

# 13. WOW #2 — Explainable AI

Don't just show:

```text
Risk = 87
```

Show:

```text
Risk Score: 87

Contributors

Velocity       ██████████  +25
Amount         ███████████ +30
Geo            ████████████ +40
GNN            ██████       +12

Why flagged:
• 6 transactions / 10 minutes
• 6.8× historical amount
• Impossible travel detected
• Connected to suspicious merchant cluster
```

---

# 14. WOW #3 — Fraud Investigation Graph

When an analyst opens a transaction:

```text
                 Merchant
                    │
                    │
Device ───── Customer ───── Transaction
                    │
                    │
                 Location
```

Make this interactive.

The reviewer can visually investigate relationships.

This is where **React + Cytoscape.js / React Flow / D3** can be useful.

---

# 15. WOW #4 — "Why was this flagged?"

Give every alert a natural-language explanation:

> **High Risk:** The transaction is 6.4× the customer's normal transaction amount, occurred shortly after five previous transactions, and the customer's previous transaction originated 3,900 km away.

This makes the project much more usable than a black-box classifier.

---

# 16. WOW #5 — Rule Management UI

Instead of hardcoding everything:

```text
Admin → Rules

Velocity Rule
Enabled: ON
Window: 10 minutes
Threshold: 5 transactions
Score: 25

Amount Rule
Enabled: ON
Multiplier: 5×
Score: 30

Geo Rule
Enabled: ON
Maximum Speed: 900 km/h
Score: 40
```

Then:

```text
[ Add New Rule ]
```

This directly demonstrates the requirement:

> New rules should be addable without modifying the core engine.

---

# 17. WOW #6 — Rule Simulation / Backtesting

Give the reviewer:

```text
Upload historical CSV
        ↓
Run rules
        ↓
Compare results
```

Dashboard:

```text
Transactions analyzed: 100,000

Flagged: 1,283
High risk: 347
Medium risk: 936

Rule performance

Velocity         431
Amount           612
Geo              219
GNN              156
```

This is a strong feature for demonstrating that your rule engine is configurable.

---

# 18. WOW #7 — Human-in-the-loop learning

Reviewer decision:

```text
AI/Rules → Flag
              ↓
          Human Review
          ↙          ↘
       Fraud       Cleared
```

Store reviewer decisions.

Later:

```text
Historical Reviews
        ↓
Training Data
        ↓
Improve GNN / ML
        ↓
Better Risk Scoring
```

Now your architecture becomes:

**Rules → AI → Human → Learning**

---

# 19. WOW #8 — Dynamic risk thresholds

Instead of:

```python
if score > 70:
```

allow:

```text
LOW       0–29
MEDIUM   30–59
HIGH     60–79
CRITICAL 80–100
```

configurable from the admin console.

---

# 20. WOW #9 — Fraud Ring Alert

Example:

```text
🚨 FRAUD RING DETECTED

12 customers
3 devices
2 merchants

Connected transactions:
₹18.4 Lakhs

Network risk: CRITICAL
```

This is much more impressive visually than just a table of fraud transactions.

---

# 21. WOW #10 — Natural Language Investigation

This idea is already appearing in newer open-source transaction-monitoring systems: one project combines rule-based detection with ML anomaly scoring and a React dashboard that supports natural-language analyst searches. ([GitHub][7])

You could add:

```text
Analyst:

"Show high-risk transactions above ₹50,000
from new devices in the last 24 hours."
```

System converts it to:

```text
risk_level = HIGH
amount > 50000
device_age < threshold
timestamp >= now - 24h
```

Then displays the results.

This would be a **major WOW factor**.

---

# 22. Final feature hierarchy

I'd present it like this:

## CORE

```text
✓ Transaction ingestion
✓ Fraud Rule Engine
✓ Velocity Rule
✓ Unusual Amount Rule
✓ Impossible Geo Rule
✓ Extensible rule architecture
✓ Risk scoring
✓ Explainable flags
✓ PostgreSQL persistence
✓ React reviewer console
✓ Review / Clear
✓ AWS SES/SNS notification
```

## ADVANCED

```text
★ GNN fraud detection
★ Fraud ring detection
★ Behavioral profiling
★ Device fingerprint analysis
★ Merchant risk scoring
★ Graph investigation
★ Rule management UI
★ Rule backtesting
★ Audit trail
★ Human-in-the-loop learning
```

## WOW / INNOVATION

```text
🔥 Hybrid Rules + GNN
🔥 Interactive fraud graph
🔥 Natural-language investigation
🔥 Explainable AI
🔥 Fraud-ring detection
🔥 Dynamic rule configuration
🔥 Historical backtesting
🔥 Analyst feedback → model improvement
```

---

# 23. The final architecture I'd recommend

```text
                         ┌────────────────────┐
                         │   React Console    │
                         │                    │
                         │ Dashboard          │
                         │ Alerts             │
                         │ Investigation      │
                         │ Fraud Graph        │
                         │ Rule Management    │
                         └─────────┬──────────┘
                                   │
                              REST / WebSocket
                                   │
                                   ▼
                         ┌────────────────────┐
                         │      FastAPI       │
                         └─────────┬──────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
             Rule Engine                     Feature Engine
                    │                             │
       ┌────────────┼────────────┐                │
       ▼            ▼            ▼                ▼
   Velocity       Amount        Geo          Behavioral
     Rule          Rule         Rule           Features
       │            │            │                │
       └────────────┼────────────┘                │
                    ▼                             │
             Rule Risk Score                     │
                    │                             │
                    └──────────────┬──────────────┘
                                   ▼
                          ┌─────────────────┐
                          │   Graph Engine  │
                          │                 │
                          │ GraphSAGE/GAT   │
                          └────────┬────────┘
                                   │
                                   ▼
                           GNN Risk Score
                                   │
                                   ▼
                       ┌─────────────────────┐
                       │  Risk Aggregator    │
                       │                     │
                       │ Rules + GNN +       │
                       │ Behavioral Signals │
                       └──────────┬──────────┘
                                  │
                        ┌─────────┴─────────┐
                        ▼                   ▼
                   PostgreSQL          AWS SES/SNS
                        │
                        ▼
                 Review / Clear
                        │
                        ▼
                 Feedback Dataset
                        │
                        ▼
                  Model Improvement
```

### The one-line project definition

> **An explainable hybrid fraud-risk platform that combines configurable transaction rules, behavioral analysis, and graph neural networks to detect suspicious transactions and fraud rings, while giving analysts an interactive console to investigate, review, and resolve alerts.**

That is substantially broader than simply making a "fraud detection system": the **rule engine satisfies the given problem**, while **GNN + fraud graph + explainability + human-in-the-loop** become your differentiating layer.

[1]: https://fraud-detection-handbook.github.io/fraud-detection-handbook/Chapter_3_GettingStarted/SimulatedDataset.html?utm_source=chatgpt.com "2. Transaction data simulator — Reproducible Machine Learning for Credit Card Fraud detection - Practical handbook"
[2]: https://github.com/surihoney/aml-transaction-monitoring?utm_source=chatgpt.com "GitHub - surihoney/aml-transaction-monitoring: Rule-based Anti-Money Laundering (AML) Transaction Monitoring System · GitHub"
[3]: https://github.com/nbharwad/fraud-detection-gnn?utm_source=chatgpt.com "GitHub - nbharwad/fraud-detection-gnn: Graph Neural Network (GNN) system for financial fraud detection using GraphSAGE and PyTorch Geometric · GitHub"
[4]: https://github.com/sudsho/gnn-fraud-detection-banking?utm_source=chatgpt.com "GitHub - sudsho/gnn-fraud-detection-banking: Graph Neural Network fraud detection on transaction graphs with PyG · GitHub"
[5]: https://github.com/pelzade127/fraud-detector?utm_source=chatgpt.com "GitHub - pelzade127/fraud-detector: Real-time fraud detection engine with velocity checks, geolocation analysis, and device fingerprinting. Stateful detection using SQLite with explainable risk assessments. · GitHub"
[6]: https://github.com/ArayikGevorgyan/AML_System?utm_source=chatgpt.com "GitHub - ArayikGevorgyan/AML_System: AML Transaction Monitoring System — A compliance platform for detecting suspicious financial activity using rule-based detection, OFAC sanctions screening, and case management. · GitHub"
[7]: https://github.com/ArnavK269/transaction-monitoring?utm_source=chatgpt.com "GitHub - ArnavK269/transaction-monitoring: A hybrid Anti-Money Laundering (AML) monitoring engine that combines rule-based detection with machine learning anomaly scoring to flag suspicious financial transactions and trades. · GitHub"
and Yes — I checked the exact repository you gave:

[SivaSabariGanesan/Fraud-Investigation-System](https://github.com/SivaSabariGanesan/Fraud-Investigation-System?utm_source=chatgpt.com)

This changes the comparison quite a bit. **That repository is much more advanced on the investigation/agent side than the basic rule-engine projects we discussed.** ([GitHub][1])

## 1. What that repository actually has

The repository describes itself as an **Autonomous Fraud Investigation System** with:

* FastAPI backend
* React + TypeScript + Vite analyst dashboard
* SQLite persistent audit storage
* TigerGraph Cloud
* Groq LLM reasoning
* deterministic R1–R10 policy rules
* evidence-request lifecycle
* SAR workflow
* interactive graph visualization
* investigation history
* chronological audit trail ([GitHub][1])

Its architecture is roughly:

```text
React Analyst Dashboard
          │
          ▼
       FastAPI
          │
   ┌──────┼────────┐
   ▼      ▼        ▼
TigerGraph Groq   SQLite
   │      │
   └──────┼────────┘
          ▼
Autonomous Investigator
          │
    R1–R10 Rules
          │
          ▼
 Investigation Result
```

The graph contains entities such as **Customer, Card, Transaction, DeviceProfile, BillingRegion, EmailDomain, ClosedCase and EvidenceRequest**, with relationships connecting them. ([GitHub][1])

---

# 2. Direct comparison

| Capability                    | SivaSabariGanesan                                  | **Our proposed system**       |
| ----------------------------- | -------------------------------------------------- | ----------------------------- |
| Python backend                | ✅ FastAPI                                          | ✅ FastAPI                     |
| React dashboard               | ✅                                                  | ✅                             |
| Transaction persistence       | ✅ SQLite                                           | ✅ PostgreSQL                  |
| Fraud rules                   | ✅ R1–R10                                           | ✅ Pluggable rules             |
| Velocity                      | ⚠️ Not the main 3-rule design                      | ✅ Core                        |
| Unusual amount                | ⚠️                                                 | ✅ Core                        |
| Impossible travel             | ⚠️                                                 | ✅ Core                        |
| Rule extensibility            | ✅ Policy rules                                     | ⭐ Plugin architecture         |
| Graph database                | ✅ TigerGraph                                       | Optional Neo4j                |
| Graph analysis                | ✅                                                  | ✅                             |
| GNN                           | ❌                                                  | ⭐ Planned                     |
| LLM reasoning                 | ✅ Groq                                             | ⭐ Optional                    |
| Evidence management           | ✅                                                  | Optional/Advanced             |
| SAR workflow                  | ✅                                                  | Optional                      |
| Case management               | ✅                                                  | ⭐                             |
| Audit trail                   | ✅                                                  | ✅                             |
| Fraud graph visualization     | ✅                                                  | ⭐                             |
| AWS SES/SNS                   | Not central                                        | ✅ Required                    |
| PostgreSQL                    | ❌                                                  | ✅                             |
| Real-time transaction scoring | ⚠️ Investigation-centric                           | ⭐ Core                        |
| Rule management UI            | Not primary                                        | ⭐                             |
| Rule backtesting              | Not primary                                        | ⭐                             |
| Human feedback → ML           | Not primary                                        | ⭐                             |
| Fraud-ring GNN                | Graph intelligence, but not GNN-based in this repo | ⭐                             |
| Dataset-oriented detection    | Not the primary focus                              | ⭐                             |
| Primary objective             | Investigation automation                           | **Detection + investigation** |

The repository's own roadmap also mentions a **pluggable rules engine**, streaming ingest, Redis caching and an analyst case timeline as future work, which are areas we can deliberately make core to our implementation. ([GitHub][2])

---

# 3. The biggest difference

The easiest way to explain it is:

### Their project

**"A suspicious case already exists. Let's investigate it intelligently."**

```text
Flagged Case
     ↓
Retrieve evidence
     ↓
Graph traversal
     ↓
LLM reasoning
     ↓
Policy rules
     ↓
Investigation result
```

The repository's documented 12-step workflow starts by loading a case and retrieving its transactions, customer/card information, historical transactions, telemetry, connected cases and evidence before reasoning over that context. ([GitHub][1])

### Our project

**"A transaction arrives. Let's detect whether it is suspicious, explain why, and then investigate it."**

```text
Transaction arrives
       ↓
Real-time rules
       ↓
Behavior analysis
       ↓
Graph analysis
       ↓
GNN
       ↓
Risk score
       ↓
Flag
       ↓
Reviewer
       ↓
Investigation
```

That distinction is important.

---

# 4. Their strongest area: Investigation

They are significantly ahead if the focus is **case investigation**.

They have a 12-step autonomous investigator that gathers graph evidence, normalizes it, builds an investigation context, invokes Groq reasoning and then applies deterministic policy rules. ([GitHub][1])

They also have:

```text
Case
 ├── Transactions
 ├── Customer
 ├── Cards
 ├── Devices
 ├── Billing Regions
 ├── Email Domains
 ├── Evidence Requests
 └── Previous Cases
```

This is a strong architecture.

---

# 5. Their strongest technical feature: Graph

Their TigerGraph schema is actually very useful as inspiration.

They model:

```text
Customer
   │
   └── OWNS → Card
                  │
                  └── MADE ← Transaction
                                  │
                  ┌───────────────┼──────────────┐
                  ▼               ▼              ▼
               Device          Region        Email
```

and connect transactions/cases as well. ([GitHub][1])

That means you **should not simply say "we use a graph" as your WOW factor**, because this repository already does graph-based fraud investigation.

---

# 6. Where we can go beyond it: GNN

This is where I would change our previous proposal.

Instead of:

> "We have a fraud graph."

make it:

> **"We use a heterogeneous transaction graph + GNN to calculate network-level fraud risk."**

For example:

```text
             Customer A
             /        \
           Card       Device X
            │            │
            ▼            │
       Transaction       │
            │            │
            ▼            │
        Merchant M ◄─────┘
            │
            ▼
       Customer B
```

Then a GNN learns from the neighborhood.

Potential models:

```text
GraphSAGE
GAT
HGT
```

There are already open-source fraud projects demonstrating GraphSAGE/GAT/GCN and heterogeneous financial graphs. ([GitHub][3])

---

# 7. Don't copy their architecture exactly

If you use:

```text
FastAPI
React
Graph
LLM
Rules
```

you'll have a hard time explaining what is genuinely different.

Instead:

## Our architecture should be

```text
                TRANSACTION
                     │
                     ▼
             ┌──────────────┐
             │ Rule Engine  │
             └──────┬───────┘
                    │
       ┌────────────┼─────────────┐
       ▼            ▼             ▼
   Velocity       Amount       Geo Travel
       │            │             │
       └────────────┼─────────────┘
                    ▼
              Rule Score
                    │
                    ▼
           ┌────────────────┐
           │ Feature Engine │
           └───────┬────────┘
                   ▼
            Transaction Graph
                   │
                   ▼
             ┌───────────┐
             │    GNN    │
             │ GraphSAGE │
             └─────┬─────┘
                   ▼
               GNN Score
                   │
                   ▼
        ┌─────────────────────┐
        │  Risk Aggregator    │
        │                     │
        │ Rules + GNN +       │
        │ Behavioral Signals  │
        └──────────┬──────────┘
                   ▼
             FINAL SCORE
                   │
          ┌────────┴────────┐
          ▼                 ▼
       NORMAL             HIGH RISK
                            │
                            ▼
                     Reviewer Console
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
              CLEARED                FRAUD
```

---

# 8. What we should borrow from their project

### Definitely borrow the concepts, not their code:

**1. Investigation graph**

Their entity relationship design is excellent. ([GitHub][1])

**2. Evidence-based investigation**

Instead of just:

> Fraud detected

show:

> These 7 pieces of evidence caused the alert.

**3. Case management**

```text
Alert
 ↓
Case
 ↓
Investigation
 ↓
Evidence
 ↓
Decision
```

**4. Audit trail**

Every reviewer action gets stored.

**5. LLM as an assistant**

Their LLM is explicitly constrained from inventing evidence or making the final fraud/policy decision. ([GitHub][1])

That is a very good design principle.

---

# 9. What we should NOT duplicate

I wouldn't make these our headline features:

```text
❌ Just FastAPI + React
❌ Just TigerGraph
❌ Just LLM investigation
❌ Just rule engine
❌ Just graph visualization
❌ Just case management
```

Because the referenced repository already demonstrates those concepts.

---

# 10. Our actual differentiation

I'd position your project as:

## **Hybrid Real-Time Fraud Risk & Investigation Engine**

### Layer 1 — Deterministic

```text
Velocity
Amount
Impossible Travel
Device
Merchant
IP
```

### Layer 2 — Behavioral

```text
Customer spending profile
Transaction frequency
Merchant behavior
Device behavior
Location patterns
```

### Layer 3 — Graph AI

```text
Customer
Card
Device
Merchant
IP
Location
Transaction
       ↓
Heterogeneous Graph
       ↓
GraphSAGE / GAT
       ↓
Network Risk
```

### Layer 4 — Human investigation

```text
Risk Alert
    ↓
Case
    ↓
Evidence
    ↓
Graph Investigation
    ↓
Reviewer Decision
```

### Layer 5 — Feedback

```text
Reviewer Decision
       ↓
Feedback Dataset
       ↓
GNN / ML Retraining
       ↓
Improved Risk Detection
```

---

# 11. And this is where the AWS requirement fits

The given problem explicitly asks for:

> AWS SES email or SNS notification when high-risk threshold is crossed.

So make this an actual event-driven pipeline:

```text
              Risk Score
                  │
             score >= 80
                  │
                  ▼
            HIGH_RISK_EVENT
                  │
                  ▼
             AWS SNS/SQS
                  │
          ┌───────┴────────┐
          ▼                ▼
     Fraud Analyst       Audit
          │
          ▼
       React UI
```

Or directly:

```text
Risk Engine
    ↓
AWS SES
    ↓
fraud-team@company.com
```

---

# 12. Final feature comparison

### Existing repository

**Detection → Investigation automation**

```text
TigerGraph
     +
LLM
     +
R1–R10
     +
Evidence
     +
Case workflow
```

### Your project

**Detection → AI risk → Investigation → Human feedback**

```text
Rules
  +
Behavior
  +
GNN
  +
Graph
  +
Explainability
  +
Reviewer
  +
Feedback
  +
AWS notification
```

That's a much stronger differentiation.

---

# 13. One particularly strong WOW feature

I'd make this the centerpiece of your demo:

### 🔥 "Why is this transaction suspicious?"

Reviewer clicks:

**TXN-84921**

The screen generates:

```text
                 RISK SCORE
                    87
                 CRITICAL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE EVIDENCE

✓ Velocity
  7 transactions in 8 minutes
  +25

✓ Amount anomaly
  ₹85,000 vs ₹4,200 average
  +30

✓ Impossible travel
  3,800 km in 22 minutes
  +20

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GRAPH INTELLIGENCE

⚠ Shared device with 4 accounts

⚠ Merchant connected to 11
  previously flagged accounts

⚠ 3-hop suspicious cluster detected

GNN NETWORK RISK: 0.91

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINAL DECISION

87 / 100 — HIGH RISK

[ Investigate ]   [ Clear ]
```

**That is the story I'd build around.**

The referenced repository already has graph investigation, LLM reasoning, evidence and deterministic policy evaluation, so your differentiation should be **real-time detection + explicit three-rule engine + GNN network risk + configurable rules + reviewer feedback loop**, rather than simply adding another LLM or graph dashboard. ([GitHub][1])

[1]: https://github.com/SivaSabariGanesan/Fraud-Investigation-System "GitHub - SivaSabariGanesan/Fraud-Investigation-System · GitHub"
[2]: https://github.com/lalitofficial/AEGIS?utm_source=chatgpt.com "GitHub - lalitofficial/AEGIS: Fraud detection platform with a FastAPI backend and a React/Vite frontend. · GitHub"
[3]: https://github.com/Alwaysgaurav1/financial-fraud-gnn?utm_source=chatgpt.com "GitHub - Alwaysgaurav1/financial-fraud-gnn: Real-time financial fraud detection platform leveraging Heterogeneous Graph Neural Networks (GraphSAGE/GAT/GCN), dynamic subgraph sampling with Neo4j, GNNExplainer explainability, and Kafka event streaming. · GitHub"
