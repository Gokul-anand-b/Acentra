import networkx as nx
from sqlalchemy import or_, select

from app.ml.graphsage import graphsage_model
from app.models import Assessment, Transaction
from app.services.neo4j_graph import neo4j_service


def investigation_graph(db, root):
    conditions = [Transaction.customer_id == root.customer_id]
    if root.device_id:
        conditions.append(Transaction.device_id == root.device_id)
    if root.ip_address:
        conditions.append(Transaction.ip_address == root.ip_address)
    candidates = list(
        db.scalars(
            select(Transaction)
            .where(or_(*conditions), Transaction.timestamp <= root.timestamp)
            .order_by(Transaction.timestamp.desc())
            .limit(101)
        )
    )
    truncated = len(candidates) > 100
    rows = [root] + [t for t in candidates[:100] if t.id != root.id]
    graph = nx.Graph()

    for transaction in rows:
        assessment = db.get(Assessment, transaction.id)
        tx = f"transaction:{transaction.id}"
        risk = assessment.risk_level if assessment else "LOW"
        graph.add_node(
            tx,
            label=transaction.id,
            kind="transaction",
            risk=risk,
            amount=transaction.amount,
            currency=transaction.currency,
        )

        # Sync to Neo4j graph engine
        neo4j_service.sync_transaction({
            "id": transaction.id,
            "customer_id": transaction.customer_id,
            "merchant_id": transaction.merchant_id,
            "device_id": transaction.device_id,
            "ip_address": transaction.ip_address,
            "latitude": transaction.latitude,
            "longitude": transaction.longitude,
            "amount": transaction.amount,
            "currency": transaction.currency,
        }, risk_level=risk)

        entities = [
            ("customer", transaction.customer_id, "MADE"),
            ("merchant", transaction.merchant_id, "PAID_TO"),
            ("device", transaction.device_id, "USES"),
            ("ip", transaction.ip_address, "USES"),
        ]
        if transaction.latitude is not None and transaction.longitude is not None:
            entities.append(
                ("location", f"{transaction.latitude:.3f}, {transaction.longitude:.3f}", "OCCURRED_AT")
            )
        for kind, value, relationship in entities:
            if value:
                node = f"{kind}:{value}"
                if not graph.has_node(node):
                    graph.add_node(node, label=value, kind=kind, risk="LOW", degree=0)
                graph.add_edge(tx, node, relationship=relationship)

    # Compute network degree centrality
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
        "truncated": truncated,
        "transaction_limit": 100,
        "graphsage": graphsage_result,
        "neo4j": neo4j_status,
        "note": "Observed relationships with GraphSAGE GNN 2-hop aggregation & Neo4j graph context.",
    }
