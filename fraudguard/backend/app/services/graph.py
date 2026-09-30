import networkx as nx
from sqlalchemy import or_, select

from app.ml.graphsage import graphsage_model
from app.models import Assessment, Transaction
from app.services.neo4j_graph import neo4j_service


def investigation_graph(db, root):
    """Builds a clean, focused, non-cluttered 5-8 node investigation subgraph matching Screenshot 2.
    Tree structure: Case (Top) -> Customer (Level 1) -> Cards/Devices (Level 2) -> Transactions (Level 3).
    """
    # 1. Fetch 1 related baseline transaction for the same customer to show comparison
    related_txs = list(
        db.scalars(
            select(Transaction)
            .where(Transaction.customer_id == root.customer_id, Transaction.id != root.id)
            .order_by(Transaction.timestamp.desc())
            .limit(1)
        )
    )
    rows = [root] + related_txs

    graph = nx.Graph()

    # Case Node at Top
    case_id = f"CASE-{root.id}"
    graph.add_node(case_id, label=f"CASE HHG-{root.id[-3:]}", kind="case", risk="HIGH")

    # Customer Node
    cust_node = f"customer:{root.customer_id}"
    graph.add_node(cust_node, label=f"Customer {root.customer_id}", kind="customer", risk="LOW")
    graph.add_edge(case_id, cust_node, relationship="INVOLVES")

    for tx in rows:
        assessment = db.get(Assessment, tx.id)
        tx_node = f"transaction:{tx.id}"
        risk_score = assessment.normalized_score if assessment else 10.0
        risk_level = assessment.risk_level if assessment else "LOW"

        # Card / Device Node (Level 2)
        card_label = tx.device_id if tx.device_id else f"Card {tx.id[-7:]}"
        card_node = f"card:{card_label}"
        if not graph.has_node(card_node):
            graph.add_node(card_node, label=card_label, kind="card", risk="LOW")
            graph.add_edge(cust_node, card_node, relationship="OWNS")

        # Transaction Node (Level 3)
        graph.add_node(
            tx_node,
            label=f"Txn {tx.id}",
            kind="transaction",
            risk=risk_level,
            amount=tx.amount,
            currency=tx.currency,
            risk_score=round(risk_score / 100.0, 2),
        )
        graph.add_edge(card_node, tx_node, relationship="MADE")

        # Sync to Neo4j Graph Engine
        neo4j_service.sync_transaction({
            "id": tx.id,
            "customer_id": tx.customer_id,
            "merchant_id": tx.merchant_id,
            "device_id": tx.device_id,
            "ip_address": tx.ip_address,
            "latitude": tx.latitude,
            "longitude": tx.longitude,
            "amount": tx.amount,
            "currency": tx.currency,
        }, risk_level=risk_level)

    # Compute Network Degree Centrality
    degrees = dict(graph.degree())
    for node in graph.nodes():
        graph.nodes[node]["degree"] = degrees.get(node, 1)

    nodes_list = [{"data": {"id": node, **attrs}} for node, attrs in graph.nodes(data=True)]
    edges_list = [
        {"data": {"id": f"edge-{i}", "source": a, "target": b, **attrs}}
        for i, (a, b, attrs) in enumerate(graph.edges(data=True))
    ]

    # Compute GraphSAGE GNN embedding & risk score for root transaction
    root_node_id = f"transaction:{root.id}"
    graphsage_result = graphsage_model.compute_embedding_and_score(
        root_node_id, nodes_list, edges_list, root_amount=root.amount
    )

    neo4j_status = neo4j_service.get_status()

    return {
        "nodes": nodes_list,
        "edges": edges_list,
        "truncated": False,
        "transaction_limit": 5,
        "graphsage": graphsage_result,
        "neo4j": neo4j_status,
        "note": "Focused investigation tree (Case -> Customer -> Card -> Transactions).",
    }
