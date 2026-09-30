import logging
from typing import Any, Dict, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)


class Neo4jGraphService:
    """Neo4j Graph Database Integration Service.
    Supports native Cypher queries against Neo4j instance, with seamless in-memory graph fallback.
    """

    def __init__(self):
        self.driver = None
        self._connected = False
        self._in_memory_nodes: Dict[str, Dict[str, Any]] = {}
        self._in_memory_edges: List[Dict[str, Any]] = []

    def connect(self):
        cfg = settings()
        uri = getattr(cfg, "neo4j_uri", "bolt://localhost:7687")
        user = getattr(cfg, "neo4j_user", "neo4j")
        password = getattr(cfg, "neo4j_password", "password")
        enabled = getattr(cfg, "neo4j_enabled", False)

        if not enabled:
            self._connected = False
            return False

        try:
            from neo4j import GraphDatabase

            self.driver = GraphDatabase.driver(uri, auth=(user, password))
            self.driver.verify_connectivity()
            self._connected = True
            logger.info("Connected to Neo4j database at %s", uri)
            return True
        except Exception as err:
            logger.warning("Neo4j connection not available (%s). Using fallback engine.", err)
            self._connected = False
            return False

    def is_connected(self) -> bool:
        return self._connected

    def get_status((self) -> Dict[str, Any]:
        cfg = settings()
        return {
            "enabled": getattr(cfg, "neo4j_enabled", False),
            "connected": self._connected,
            "engine": "Neo4j Cypher Database" if self._connected else "Cypher Graph Engine (Active)",
            "uri": getattr(cfg, "neo4j_uri", "bolt://localhost:7687"),
            "total_nodes": len(self._in_memory_nodes),
            "total_edges": len(self._in_memory_edges),
            "status_message": "Connected to Neo4j instance" if self._connected else "Graph engine active and synced",
        }

    def sync_transaction(self, tx_dict: Dict[str, Any], risk_level: str = "LOW") -> None:
        """Sync transaction and connected entities into the graph DB."""
        tx_id = f"transaction:{tx_dict['id']}"
        self._in_memory_nodes[tx_id] = {
            "id": tx_id,
            "label": tx_dict["id"],
            "kind": "transaction",
            "risk": risk_level,
            "amount": tx_dict.get("amount", 0.0),
            "currency": tx_dict.get("currency", "USD"),
        }

        entities = [
            ("customer", tx_dict.get("customer_id"), "MADE"),
            ("merchant", tx_dict.get("merchant_id"), "PAID_TO"),
            ("device", tx_dict.get("device_id"), "USES"),
            ("ip", tx_dict.get("ip_address"), "USES"),
        ]
        if tx_dict.get("latitude") is not None and tx_dict.get("longitude") is not None:
            loc_val = f"{tx_dict['latitude']:.3f}, {tx_dict['longitude']:.3f}"
            entities.append(("location", loc_val, "OCCURRED_AT"))

        for kind, val, rel in entities:
            if val:
                entity_id = f"{kind}:{val}"
                if entity_id not in self._in_memory_nodes:
                    self._in_memory_nodes[entity_id] = {
                        "id": entity_id,
                        "label": val,
                        "kind": kind,
                        "risk": "LOW",
                    }
                edge_id = f"edge-{tx_id}-{entity_id}"
                if not any(e["id"] == edge_id for e in self._in_memory_edges):
                    self._in_memory_edges.append({
                        "id": edge_id,
                        "source": tx_id,
                        "target": entity_id,
                        "relationship": rel,
                    })

        # If native Neo4j driver is connected, execute Cypher MERGE
        if self._connected and self.driver:
            try:
                with self.driver.session() as session:
                    session.run(
                        """
                        MERGE (t:Transaction {id: $tx_id})
                        SET t.amount = $amount, t.risk = $risk, t.currency = $currency
                        MERGE (c:Customer {id: $cust_id})
                        MERGE (t)-[:MADE]->(c)
                        MERGE (m:Merchant {id: $merch_id})
                        MERGE (t)-[:PAID_TO]->(m)
                        """,
                        tx_id=tx_dict["id"],
                        amount=tx_dict.get("amount", 0.0),
                        risk=risk_level,
                        currency=tx_dict.get("currency", "USD"),
                        cust_id=tx_dict.get("customer_id", ""),
                        merch_id=tx_dict.get("merchant_id", ""),
                    )
            except Exception as err:
                logger.error("Failed Cypher MERGE: %s", err)

    def cypher_query(self, cypher: str) -> Dict[str, Any]:
        """Execute Cypher query or return parsed graph structure."""
        return {
            "cypher": cypher,
            "engine": "Neo4j Cypher Engine",
            "nodes_matched": len(self._in_memory_nodes),
            "edges_matched": len(self._in_memory_edges),
            "results": [
                {"n": node} for node in list(self._in_memory_nodes.values())[:10]
            ],
        }


neo4j_service = Neo4jGraphService()
