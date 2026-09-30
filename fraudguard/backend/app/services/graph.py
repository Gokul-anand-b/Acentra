import networkx as nx
from sqlalchemy import or_, select

from app.models import Assessment, Transaction


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
        graph.add_node(
            tx, label=transaction.id, kind="transaction", risk=assessment.risk_level if assessment else "LOW"
        )
        entities = [
            ("customer", transaction.customer_id, "MADE"),
            ("merchant", transaction.merchant_id, "PAID_TO"),
            ("device", transaction.device_id, "USES"),
            ("ip", transaction.ip_address, "USES"),
        ]
        if transaction.latitude is not None:
            entities.append(
                ("location", f"{transaction.latitude:.3f}, {transaction.longitude:.3f}", "OCCURRED_AT")
            )
        # Do not expose full card tokens via graph IDs or labels.
        for kind, value, relationship in entities:
            if value:
                node = f"{kind}:{value}"
                graph.add_node(node, label=value, kind=kind, risk="LOW")
                graph.add_edge(tx, node, relationship=relationship)
    return {
        "nodes": [{"data": {"id": node, **attrs}} for node, attrs in graph.nodes(data=True)],
        "edges": [
            {"data": {"id": f"edge-{i}", "source": a, "target": b, **attrs}}
            for i, (a, b, attrs) in enumerate(graph.edges(data=True))
        ],
        "truncated": truncated,
        "transaction_limit": 100,
        "note": "Observed relationships are investigation evidence, not proof of fraud.",
    }
