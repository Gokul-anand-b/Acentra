Python Problem Statement: Fraud Rule Engine with Review Console
Problem Description:

Financial systems need to identify potentially fraudulent transactions based on different risk indicators. A flexible rule engine can evaluate transactions and allow reviewers to investigate suspicious activity.

Minimum Requirements:

·        Rule engine for transaction risk evaluation

·        At least three independent rules: transaction velocity, unusual transaction amount, and impossible geographical location

·        New rules should be addable without modifying the core engine

·        Persist transactions and fraud flags

·        React-based reviewer console

·        Display flagged transactions

·        Allow reviewers to mark transactions as reviewed or cleared

·        Send an AWS SES email or SNS notification when a high-risk threshold is crossed
