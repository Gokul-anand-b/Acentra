"""Train on downloaded canonical data using chronological train/validation/test splits."""

import argparse
import csv
import hashlib
import json
from collections import defaultdict, deque
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import numpy as np
import skops.io as sio
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from app.ml.features import FEATURE_NAMES, FEATURE_VERSION, features

ROOT = Path(__file__).resolve().parents[3]


def canonicalize(raw_path, target):
    rows = []
    with raw_path.open() as stream:
        for row in csv.DictReader(stream):
            rows.append(
                {
                    "id": "SP-" + row["trans_num"],
                    "customer_id": "SC-" + hashlib.sha256(row["cc_num"].encode()).hexdigest()[:20],
                    "merchant_id": "SM-" + hashlib.sha256(row["merchant"].encode()).hexdigest()[:20],
                    "amount": row["amt"],
                    "currency": "USD",
                    "timestamp": datetime.fromisoformat(row["trans_date_trans_time"])
                    .replace(tzinfo=UTC)
                    .isoformat(),
                    "fraud_label": int(row["is_fraud"]),
                }
            )
    rows = sorted({row["id"]: row for row in rows}.values(), key=lambda r: (r["timestamp"], r["id"]))
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    return rows


def metric(y, p, threshold):
    prediction = p >= threshold
    return {
        "rows": len(y),
        "positives": int(sum(y)),
        "precision": float(precision_score(y, prediction, zero_division=0)),
        "recall": float(recall_score(y, prediction, zero_division=0)),
        "f1": float(f1_score(y, prediction, zero_division=0)),
        "pr_auc": float(average_precision_score(y, p)),
        "roc_auc": float(roc_auc_score(y, p)),
        "confusion_matrix": confusion_matrix(y, prediction, labels=[0, 1]).tolist(),
    }


def train(raw_path, output):
    rows = canonicalize(raw_path, ROOT / "data/processed/sparkov_canonical.csv")
    if len(rows) < 1000:
        raise ValueError("At least 1,000 labeled records required")
    histories = defaultdict(lambda: deque(maxlen=200))
    recent = defaultdict(deque)
    matrix = []
    labels = []
    for row in rows:
        current = SimpleNamespace(
            **{**row, "amount": float(row["amount"]), "timestamp": datetime.fromisoformat(row["timestamp"])}
        )
        window = recent[current.customer_id]
        while window and (current.timestamp - window[0]).total_seconds() > 600:
            window.popleft()
        history = histories[current.customer_id]
        matrix.append(features(current, history, len(window)))
        labels.append(current.fraud_label)
        history.append(current)
        window.append(current.timestamp)
    train_end = int(len(rows) * 0.7)
    validation_end = int(len(rows) * 0.85)
    while rows[train_end]["timestamp"] == rows[train_end - 1]["timestamp"]:
        train_end += 1
    while rows[validation_end]["timestamp"] == rows[validation_end - 1]["timestamp"]:
        validation_end += 1
    X, y = np.asarray(matrix), np.asarray(labels)
    splits = {
        "train": (0, train_end),
        "validation": (train_end, validation_end),
        "test": (validation_end, len(rows)),
    }
    for name, (start, end) in splits.items():
        if len(np.unique(y[start:end])) < 2 or int(sum(y[start:end])) < 5:
            raise ValueError(
                f"{name} requires both classes and at least five fraud labels; download more rows"
            )
    model = RandomForestClassifier(
        n_estimators=120,
        max_depth=12,
        min_samples_leaf=4,
        class_weight="balanced_subsample",
        random_state=42,
        n_jobs=2,
    )
    model.fit(X[:train_end], y[:train_end])
    validation = model.predict_proba(X[train_end:validation_end])[:, 1]
    thresholds = np.linspace(0.05, 0.95, 37)
    threshold = float(
        max(thresholds, key=lambda t: f1_score(y[train_end:validation_end], validation >= t, zero_division=0))
    )
    # Test labels are never used for model fitting, hyperparameter search, or threshold selection.
    test = model.predict_proba(X[validation_end:])[:, 1]
    version = datetime.now(UTC).strftime("%Y%m%dT%H%M%S") + "-" + uuid4().hex[:6]
    output.mkdir(parents=True, exist_ok=True)
    artifact = f"random-forest-{version}.skops"
    sio.dump(model, output / artifact)
    metadata = {
        "model": "Random Forest",
        "version": version,
        "artifact": artifact,
        "currency": "USD",
        "feature_version": FEATURE_VERSION,
        "features": FEATURE_NAMES,
        "threshold": threshold,
        "trained_at": datetime.now(UTC).isoformat(),
        "seed": 42,
        "dataset_rows": len(rows),
        "positive_count": int(sum(y)),
        "synthetic": True,
        "dataset": "Sparkov public synthetic sample",
        "dataset_sha256": hashlib.sha256(raw_path.read_bytes()).hexdigest(),
        "split": {
            name: {
                "rows": end - start,
                "positives": int(sum(y[start:end])),
                "from": rows[start]["timestamp"],
                "to": rows[end - 1]["timestamp"],
            }
            for name, (start, end) in splits.items()
        },
        "validation": metric(y[train_end:validation_end], validation, threshold),
        "test": metric(y[validation_end:], test, threshold),
        "feature_importance": dict(zip(FEATURE_NAMES, map(float, model.feature_importances_))),
        "limitations": [
            "Synthetic sample only; not a full benchmark or real-bank validation.",
            "Timestamp without timezone in source is interpreted as UTC for reproducibility.",
            "No cardholder home coordinates, labels, IDs, merchant names, or profile names enter the feature vector.",
            "Uncalibrated output is advisory only; trained on USD amounts.",
            "Not a graph neural network. GraphSAGE remains unimplemented.",
        ],
    }
    tmp = output / "metadata.tmp"
    tmp.write_text(json.dumps(metadata, indent=2) + "\n")
    tmp.replace(output / "metadata.json")
    # A sample file contains future holdout events, never the training subset.
    samples = rows[validation_end : validation_end + 20]
    public = ROOT / "frontend/public/samples"
    public.mkdir(parents=True, exist_ok=True)
    with (public / "ml-holdout-sample.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(samples[0]))
        writer.writeheader()
        writer.writerows(samples)
    (ROOT / "data/processed/input-example.json").write_text(json.dumps(samples[0], indent=2) + "\n")
    (ROOT / "docs/ML_RESULTS.json").write_text(json.dumps(metadata, indent=2) + "\n")
    return metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, default=ROOT / "data/raw/sparkov_sample.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "models")
    args = parser.parse_args()
    result = train(args.csv, args.output)
    print(
        json.dumps(
            {
                "model": result["model"],
                "rows": result["dataset_rows"],
                "test": result["test"],
                "artifact": str(args.output / result["artifact"]),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
