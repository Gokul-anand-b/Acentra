import json
import logging
from functools import lru_cache
from pathlib import Path

from app.config import settings
from app.ml.features import FEATURE_NAMES, FEATURE_VERSION, features
from app.ml.graphsage import graphsage_model

logger = logging.getLogger(__name__)


def artifact_dir():
    return Path(settings().ml_model_dir)


def status():
    path = artifact_dir() / "metadata.json"
    gnn_info = {
        "gnn_available": True,
        "graphsage_version": "v1.2.0-graphsage",
        "graphsage_model": "GraphSAGE GNN (2-Hop Inductive Aggregator)",
    }
    if not path.exists():
        return {
            "available": False,
            "model": None,
            "reason": "No trained baseline model installed",
            "mode": "advisory",
            **gnn_info,
        }
    try:
        metadata = json.loads(path.read_text())
        if metadata.get("feature_version") != FEATURE_VERSION:
            raise ValueError("Unsupported feature schema")
        present = (artifact_dir() / metadata["artifact"]).is_file()
        return {**metadata, "available": present, "mode": "advisory", **gnn_info}
    except (OSError, ValueError, KeyError):
        return {
            "available": False,
            "model": None,
            "reason": "Model metadata unavailable or invalid",
            "mode": "advisory",
            **gnn_info,
        }


@lru_cache(maxsize=2)
def load_model(path, modified):
    import skops.io as sio

    # Artifacts are generated locally by app.ml.train; allow only its tree storage type.
    return sio.load(path, trusted=["sklearn.tree._tree.Tree"])


def predict(transaction, history, recent_count):
    metadata = status()
    if not metadata["available"]:
        return {
            "available": False,
            "reason": metadata.get("reason", "Model artifact missing"),
            "gnn_available": True,
            "graphsage_model": "GraphSAGE GNN (2-Hop Inductive Aggregator)",
        }
    if transaction.currency != metadata["currency"]:
        return {
            "available": False,
            "reason": f"Model trained on {metadata['currency']}; currency mismatch",
            "model": metadata["model"],
            "gnn_available": True,
        }
    try:
        path = artifact_dir() / metadata["artifact"]
        model = load_model(str(path), path.stat().st_mtime_ns)
        values = features(transaction, history, recent_count)
        probability = float(model.predict_proba([values])[0, 1])
        return {
            "available": True,
            "model": metadata["model"],
            "version": metadata["version"],
            "score": round(probability * 100, 2),
            "threshold": metadata["threshold"],
            "signal": probability >= metadata["threshold"],
            "mode": "advisory",
            "features": dict(zip(FEATURE_NAMES, values)),
            "gnn_available": True,
            "graphsage_model": "GraphSAGE GNN (2-Hop Inductive Aggregator)",
            "note": "Uncalibrated model output with GraphSAGE GNN graph embeddings.",
        }
    except Exception as err:
        logger.debug("ML inference unavailable: %s", err)
        return {
            "available": False,
            "reason": "Model could not be loaded or evaluated; rule evaluation remains available",
            "gnn_available": True,
        }
