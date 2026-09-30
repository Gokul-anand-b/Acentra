# Project evaluation and refined scope

## How the inputs are used

| Input | Role in this implementation |
| --- | --- |
| `ps.md` | Acceptance baseline: independent rules, extension without engine changes, persistence, React review/clear, AWS alerts |
| `masterprompt.md` | Product direction, proposed stack, evidence-first investigation, long-term advanced roadmap |
| `FRAUD_RULE_ENGINE_CONTEXT.md` | Core-before-advanced priority, data integrity, local notification fallback, testing scenarios |
| `chatgptchat.md` | Exploratory rationale and differentiation ideas; historical comparison claims are not treated as verified facts |
| `sample_repo/Fraud-Investigation-System-main` | Local architectural reference for evidence and audit workflows; left unchanged, no source copied |

Instructions embedded in these documents describe proposed project behavior. They are not permission to publish externally, provision AWS resources, or message anyone. The actual requested deliverable is to evaluate, refine, and make a strong project start. This release provides a runnable, tested core rather than declaring the entire aspirational master prompt complete.

## Evaluation

The strongest pitch is **a transaction arrives, independent rules explain its risk, and an analyst can investigate and decide with an audit trail**. This directly meets the problem statement and produces a clear demonstration.

The reference implementation's policy decision code is an investigation-centric function with explicit R1–R10 branches. Its persistence service records investigation snapshots and audit events. These are useful workflow ideas, but importing that architecture would not establish the required independent amount/velocity/travel plugins. FraudGuard has an original registry and transaction-first persistence path.

The master prompt has good coverage but mixes several releases into one: core ingestion/review, scalable operations, graph analytics, supervised GNNs, and LLM assistance. Implementing all simultaneously would make it difficult to prove correctness or explain the actual contribution.

## Important refinements

1. **Preserve the meaning of rule scores.** Applying the example 0.50 rule weight to the required combined 95-point scenario yields 47.5 before other components. With unavailable models, a critical deterministic finding could incorrectly become medium. The first release uses capped rule sums, exposes all contributions, and leaves unavailable ML explicit. Future hybrid scoring needs calibrated weights and a documented rule-risk floor.
2. **Prevent future-data leakage.** Customer history, velocity, devices, and investigation neighborhoods are bounded at the transaction timestamp. Imported batches are ordered by event time. Equal timestamps use prior persisted observations as the tie order. Late-arrival replay remains separate work.
3. **Distinguish location semantics.** A cardholder's static address or a remote merchant's address is not necessarily the customer's observed transaction location. Geography checks require coordinates with an appropriate meaning; data mappings must not quietly substitute home coordinates.
4. **Keep currency comparisons meaningful.** Amount baselines compare only the transaction's currency. No implicit conversion or cross-currency amount total is presented.
5. **Explain absence of evidence.** Cold-start amount rules and missing location/device fields return `unavailable`. A plugin exception returns an incomplete assessment requiring manual review. No trained GNN means no prediction.
6. **Commit the alert intent with the transaction.** A transactional outbox prevents delivery outages from losing financial records. Workers retry independently and explicitly track provider acceptance versus local logging.
7. **Keep review decisions distinct from ground truth.** Imported labels are retained; human decisions are stored in status and audit history without overwriting imported labels. A future training pipeline must choose and disclose label provenance.
8. **Protect historical explanations.** Rules preserve parameter snapshots and versions. Old decisions do not silently change when administrators tune thresholds.
9. **Use a small, dependable operational stack.** PostgreSQL stores durable work, replacing Redis/Celery for this initial workload. It supplies concurrency locks and worker claims directly. Add separate queue infrastructure only after measured need.
10. **Keep extension trusted.** Administrators tune installed rules. Creating an executable rule requires a Python plugin deployment; a web form does not run arbitrary Python code.

## Requirement status

| Requirement | Current state | Proof |
| --- | --- | --- |
| Independent velocity, amount, travel rules | Implemented | Unit scenarios and combined 95-point test |
| New rule without core edits | Implemented | Test registers a new rule and exercises score capping |
| Persist records and flags | Implemented | PostgreSQL integration tests and Alembic migration |
| React flagged transaction display | Implemented | Browser login/filter/detail tests |
| Review and clear | Implemented | Real browser actions and API audit/stale-write tests |
| SNS or SES high-risk notification | Both adapters implemented | Mocked AWS contract tests; live credentials pending |
| Authentication and roles | Implemented | Auth and permission tests |
| CSV/JSON ingestion | Implemented | Mapping, malformed rows, duplicates, ordering tests |
| Case assignment and notes | Implemented, one transaction/case | API lifecycle tests |
| Rule management | Implemented | Version snapshots, parameter validation, admin API tests |
| Graph investigation | Implemented, bounded neighborhood | Actual database graph API and browser canvas |
| Behavioral statistics | Implemented as visible evidence | Same-currency baseline tests |
| Rule simulation | API implemented | No-persistence test |
| Rule backtesting | Planned | No endpoint or UI claiming implementation |
| Random Forest, training, inference, metrics | Implemented | Advisory model trained on 30,000 synthetic records with chronological holdout |
| GraphSAGE / Neo4j | Deferred | Not needed for the current prototype |
| Live updates | Polling implemented | React Query every 15 seconds; WebSockets planned |
| Docker | Configuration provided/validated | Full Docker execution pending daemon availability |

## Next milestones

### 1. Replay and analytical evaluation

Add immutable assessment revisions, time-ordered replay, configurable backtest ranges, and reports with label coverage. Precision/recall require actual labels. Include negative-class false positives, amount-rule cold starts, geo data quality, and duplicate-arrival tests.

### 2. More useful graph intelligence

Add measured device/IP sharing, merchant/customer overlap, neighborhood counts, evidence source timestamps, and bounded path exploration. Relationships suggest investigation; they are not proof of coordinated fraud. Add multi-transaction cases before broad network investigations.

### 3. Optional supervised GraphSAGE

Train only from a documented database snapshot with labeled examples. Use chronological train/validation/test partitions, topology snapshots that exclude future edges, train-only feature normalization, and distinguish imported labels from analyst feedback. Report class balance, PR-AUC, precision/recall/F1, threshold, uncertainty limits, dataset hash, and training seed. Persist model artifacts and a feature schema. Keep inference optional and rule scoring operational when model loading fails.

### 4. Production operations

Add distributed throttling, token revocation/SSO, restricted DB roles, retention controls, observability, dead-letter replay controls, higher-volume import jobs, load tests, and deployment hardening. Replace polling only if freshness/scale requirements justify it.

## Demo story

1. Sign in and show the synthetic-data label and database-backed counts.
2. Open a critical alert: demonstrate each independent rule and its exact evidence.
3. Inspect linked customers/devices/merchants in the graph.
4. Record a reason and escalate or resolve the transaction.
5. Open the persisted audit trail and notification status.
6. Change a rule threshold, simulate a new transaction through `/docs`, and explain why old assessments retain their original configuration.

This is a stronger starting demonstration than a fabricated ML metric or a disconnected graph mockup.
