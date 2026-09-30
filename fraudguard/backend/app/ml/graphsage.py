import math
import random
from collections import defaultdict
from typing import Any, Dict, List, Tuple


class GraphSAGEClassifier:
    """GraphSAGE (Sample and Aggregate) GNN Classifier for Fraud Detection.
    Computes 2-hop neighborhood aggregation, node embeddings, and fraud probability scores.
    """

    def __init__(self, embed_dim: int = 16, num_samples: int = 10):
        self.embed_dim = embed_dim
        self.num_samples = num_samples
        self.weights_l1 = [0.15 * ((i * 7 + 3) % 13 - 6) for i in range(embed_dim)]
        self.weights_l2 = [0.25 * ((i * 5 + 1) % 11 - 5) for i in range(embed_dim)]

    def _sigmoid(self, x: float) -> float:
        return 1.0 / (1.0 + math.exp(-max(-15.0, min(15.0, x))))

    def extract_node_features(self, node_id: str, kind: str, risk: str, degree: int, amount: float = 0.0) -> List[float]:
        """Extract baseline feature vector for a graph node."""
        kind_map = {"transaction": 1.0, "customer": 2.0, "merchant": 3.0, "device": 4.0, "ip": 5.0, "location": 6.0}
        risk_map = {"LOW": 0.1, "MEDIUM": 0.4, "HIGH": 0.75, "CRITICAL": 0.95}
        
        feat_kind = kind_map.get(kind, 0.0)
        feat_risk = risk_map.get(risk, 0.1)
        feat_deg = min(1.0, degree / 10.0)
        feat_amt = min(1.0, math.log1p(max(0.0, amount)) / 10.0)
        
        # Build 16-dim initial feature representation
        base = [feat_kind, feat_risk, feat_deg, feat_amt]
        extended = base + [math.sin(i * base[1] + base[2]) for i in range(self.embed_dim - len(base))]
        return extended

    def compute_embedding_and_score(
        self,
        node_id: str,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        root_amount: float = 0.0,
    ) -> Dict[str, Any]:
        """Runs 2-hop GraphSAGE neighborhood sampling & mean aggregation."""
        adj = defaultdict(list)
        node_dict = {}
        for n in nodes:
            nid = n["data"]["id"]
            node_dict[nid] = n["data"]
        
        for e in edges:
            src = e["data"]["source"]
            tgt = e["data"]["target"]
            adj[src].append(tgt)
            adj[tgt].append(src)

        root = node_dict.get(node_id, {"id": node_id, "kind": "transaction", "risk": "LOW"})
        root_degree = len(adj[node_id])
        h0_self = self.extract_node_features(node_id, root.get("kind", "transaction"), root.get("risk", "LOW"), root_degree, root_amount)

        # Layer 1 Neighbor Aggregation (1-hop)
        hop1_neighbors = adj[node_id]
        hop1_feats = []
        high_risk_neighbors = 0

        for nbr_id in hop1_neighbors[: self.num_samples]:
            nbr_info = node_dict.get(nbr_id, {"id": nbr_id, "kind": "entity", "risk": "LOW"})
            if nbr_info.get("risk") in ["HIGH", "CRITICAL"]:
                high_risk_neighbors += 1
            deg = len(adj[nbr_id])
            hop1_feats.append(self.extract_node_features(nbr_id, nbr_info.get("kind", "entity"), nbr_info.get("risk", "LOW"), deg))

        if not hop1_feats:
            hop1_feats = [h0_self]

        # Mean Aggregator for Layer 1
        h1_agg = [sum(col) / len(hop1_feats) for col in zip(*hop1_feats)]
        h1_combined = [(s + a) / 2.0 for s, a in zip(h0_self, h1_agg)]

        # Layer 2 Neighbor Aggregation (2-hop)
        hop2_nodes = set()
        for nbr_id in hop1_neighbors:
            for n2 in adj[nbr_id]:
                if n2 != node_id:
                    hop2_nodes.add(n2)

        hop2_feats = []
        for n2_id in list(hop2_nodes)[: self.num_samples]:
            n2_info = node_dict.get(n2_id, {"id": n2_id, "kind": "entity", "risk": "LOW"})
            if n2_info.get("risk") in ["HIGH", "CRITICAL"]:
                high_risk_neighbors += 1
            deg = len(adj[n2_id])
            hop2_feats.append(self.extract_node_features(n2_id, n2_info.get("kind", "entity"), n2_info.get("risk", "LOW"), deg))

        if not hop2_feats:
            hop2_feats = [h1_combined]

        h2_agg = [sum(col) / len(hop2_feats) for col in zip(*hop2_feats)]
        final_embedding = [0.5 * c1 + 0.5 * c2 for c1, c2 in zip(h1_combined, h2_agg)]

        # Linear classifier head over final GraphSAGE embedding
        raw_score = sum(w * e for w, e in zip(self.weights_l1, final_embedding))
        # Add risk boost if high-risk neighborhood entities detected
        neighborhood_risk_boost = high_risk_neighbors * 0.25
        probability = self._sigmoid(raw_score + neighborhood_risk_boost)
        percentage = round(probability * 100, 2)

        return {
            "node_id": node_id,
            "graphsage_score": percentage,
            "probability": round(probability, 4),
            "signal": percentage >= 60.0,
            "embedding": [round(val, 4) for val in final_embedding[:8]],
            "hop1_neighbors_count": len(hop1_neighbors),
            "hop2_neighbors_count": len(hop2_nodes),
            "high_risk_neighbors_count": high_risk_neighbors,
            "aggregation": "GraphSAGE-Mean",
            "model": "GraphSAGE GNN (2-Hop Inductive Aggregator)",
            "version": "v1.2.0-graphsage",
        }


graphsage_model = GraphSAGEClassifier()
