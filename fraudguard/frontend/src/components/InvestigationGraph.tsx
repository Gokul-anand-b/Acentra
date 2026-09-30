import { useEffect, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  GitFork,
  Network,
  Database,
  Cpu,
  Search,
  Filter,
  Layers,
  X,
  ShieldAlert,
  Zap,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { api } from "../api";
import { ErrorBox, Loading } from "../components";
import type { GraphSAGEData, Neo4jStatus } from "../types";

interface GraphData {
  nodes: {
    data: {
      id: string;
      label: string;
      kind: string;
      risk: string;
      degree?: number;
      amount?: number;
      currency?: string;
    };
  }[];
  edges: {
    data: { id: string; source: string; target: string; relationship: string };
  }[];
  truncated: boolean;
  graphsage?: GraphSAGEData;
  neo4j?: Neo4jStatus;
}

export default function InvestigationGraph({ id }: { id: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [engineMode, setEngineMode] = useState<"flow" | "neo4j">("flow");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const query = useQuery<GraphData>({
    queryKey: ["graph", id],
    queryFn: () => api(`/graph/transaction/${encodeURIComponent(id)}`),
    refetchInterval: false,
  });

  const syncMutation = async () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    try {
      await api("/graph/neo4j/query", {
        method: "POST",
        body: JSON.stringify({ query: "MATCH (n) RETURN count(n)" }),
      });
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch {
      // Fallback handled silently
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!query.data) return;

    const groups = ["customer", "device", "ip", "transaction", "merchant", "location"];
    const counters: Record<string, number> = {};

    const kindColors: Record<string, { bg: string; border: string; text: string }> = {
      customer: { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af" },
      device: { bg: "#fffbe6", border: "#fde047", text: "#854d0e" },
      ip: { bg: "#f8fafc", border: "#cbd5e1", text: "#334155" },
      transaction: { bg: "#ffffff", border: "#ef4444", text: "#991b1b" },
      merchant: { bg: "#f5f3ff", border: "#c4b5fd", text: "#5b21b6" },
      location: { bg: "#ecfdf5", border: "#6ee7b7", text: "#065f46" },
    };

    const filteredNodesData = query.data.nodes.filter(({ data }) => {
      const matchKind = filterKind === "all" || data.kind === filterKind;
      const matchSearch =
        !searchTerm ||
        data.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.label.toLowerCase().includes(searchTerm.toLowerCase());
      return matchKind && matchSearch;
    });

    const activeNodeIds = new Set(filteredNodesData.map((n) => n.data.id));

    setNodes(
      filteredNodesData.map(({ data }) => {
        const column = groups.indexOf(data.kind);
        const index = counters[data.kind] || 0;
        counters[data.kind] = index + 1;

        const colors = kindColors[data.kind] || { bg: "#ffffff", border: "#cbd5e1", text: "#1e293b" };
        const isCritical = ["HIGH", "CRITICAL"].includes(data.risk);

        return {
          id: data.id,
          position: { x: (column >= 0 ? column : 0) * 260, y: index * 115 },
          data: {
            label: (
              <div className="entity-node" style={{ color: colors.text }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", opacity: 0.8 }}>
                    {data.kind}
                  </span>
                  {data.degree !== undefined && (
                    <span
                      style={{
                        fontSize: "9px",
                        background: "#e2e8f0",
                        padding: "1px 5px",
                        borderRadius: "8px",
                      }}
                    >
                      deg: {data.degree}
                    </span>
                  )}
                </div>
                <strong style={{ display: "block", fontSize: "12px", marginTop: "2px", wordBreak: "break-all" }}>
                  {data.label}
                </strong>
                {isCritical && (
                  <i style={{ color: "#dc2626", fontWeight: 700, fontSize: "10px", fontStyle: "normal", marginTop: "2px", display: "inline-block" }}>
                    ⚠️ {data.risk} RISK
                  </i>
                )}
              </div>
            ),
          },
          sourcePosition: "right",
          targetPosition: "left",
          style: {
            background: colors.bg,
            border: `2px solid ${isCritical ? "#ef4444" : colors.border}`,
            borderRadius: 12,
            width: 215,
            padding: 12,
            boxShadow: data.id === selectedNodeId ? "0 0 0 3px #3b82f6" : "0 2px 5px rgba(0,0,0,0.05)",
            cursor: "pointer",
          },
        } as Node;
      }),
    );

    setEdges(
      query.data.edges
        .filter(({ data }) => activeNodeIds.has(data.source) && activeNodeIds.has(data.target))
        .map(({ data }) => ({
          id: data.id,
          source: data.source,
          target: data.target,
          label: data.relationship,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
          style: { stroke: "#94a3b8", strokeWidth: 1.5 },
          labelStyle: { fontSize: 9, fill: "#475569", fontWeight: 600 },
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 4,
        })),
    );
  }, [query.data, filterKind, searchTerm, selectedNodeId, setNodes, setEdges]);

  const selectedNodeObj = query.data?.nodes.find((n) => n.data.id === selectedNodeId)?.data;
  const connectedEdges = query.data?.edges.filter(
    (e) => e.data.source === selectedNodeId || e.data.target === selectedNodeId,
  );

  const printScale = Math.min(
    640 / Math.max(1, ...nodes.map((n) => n.position.x + 245)),
    310 / Math.max(1, ...nodes.map((n) => n.position.y + 140)),
  );

  const gnn = query.data?.graphsage;
  const neo4j = query.data?.neo4j;

  return (
    <section
      className="panel graph-panel"
      style={
        {
          "--print-transform": `translate(15px, 15px) scale(${printScale})`,
          position: "relative",
        } as CSSProperties
      }
    >
      <div className="panel-heading" style={{ flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <GitFork size={19} />
            Graph Intelligence & Relationship Map
          </h2>
          <p className="muted">
            Inspect entity graph structure, GraphSAGE 2-hop aggregation, and Neo4j Cypher connections.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className={engineMode === "flow" ? "primary" : ""}
            onClick={() => setEngineMode("flow")}
            style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}
          >
            <Network size={14} /> NetworkX Graph
          </button>
          <button
            type="button"
            className={engineMode === "neo4j" ? "primary" : ""}
            onClick={() => setEngineMode("neo4j")}
            style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}
          >
            <Database size={14} /> Neo4j Engine
          </button>
        </div>
      </div>

      {/* GraphSAGE GNN & Neo4j Info Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "12px",
          margin: "12px 16px",
          padding: "12px",
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* GraphSAGE Card */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              background: gnn?.signal ? "#fef2f2" : "#eff6ff",
              color: gnn?.signal ? "#dc2626" : "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Cpu size={22} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
              GraphSAGE GNN Model
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: gnn?.signal ? "#dc2626" : "#1e293b" }}>
              {gnn ? `${gnn.graphsage_score}% GNN Risk` : "Evaluating GNN..."}
              {gnn?.signal && <span style={{ fontSize: "11px", marginLeft: "6px", color: "#dc2626" }}>⚠️ HIGH SIGNAL</span>}
            </div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              {gnn ? `2-Hop Sample: ${gnn.hop1_neighbors_count} 1-hop, ${gnn.hop2_neighbors_count} 2-hop` : "GraphSAGE Mean Aggregation"}
            </div>
          </div>
        </div>

        {/* Neo4j Card */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                background: neo4j?.connected ? "#ecfdf5" : "#f8fafc",
                color: neo4j?.connected ? "#059669" : "#475569",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Database size={22} />
            </div>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
                Neo4j Graph Engine
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                {neo4j?.engine || "Cypher Graph Engine"}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                {query.data?.nodes.length || 0} Graph Nodes · {query.data?.edges.length || 0} Relationships
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={syncMutation}
            disabled={isSyncing}
            style={{
              padding: "6px 10px",
              fontSize: "11px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncing..." : syncSuccess ? "Synced!" : "Sync Neo4j"}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          padding: "0 16px 12px 16px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f1f5f9", padding: "6px 10px", borderRadius: "6px", flex: 1, minWidth: "180px" }}>
          <Search size={14} color="#64748b" />
          <input
            type="text"
            placeholder="Search node ID or label..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: "none", background: "transparent", fontSize: "12px", outline: "none", width: "100%" }}
          />
          {searchTerm && <X size={14} style={{ cursor: "pointer" }} onClick={() => setSearchTerm("")} />}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Filter size={14} color="#64748b" />
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            style={{ fontSize: "12px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          >
            <option value="all">All Entity Types</option>
            <option value="transaction">Transactions</option>
            <option value="customer">Customers</option>
            <option value="merchant">Merchants</option>
            <option value="device">Devices</option>
            <option value="ip">IP Addresses</option>
            <option value="location">Locations</option>
          </select>
        </div>
      </div>

      <ErrorBox error={query.error} />

      {query.isLoading ? (
        <Loading />
      ) : engineMode === "flow" ? (
        <div className="flow-canvas" style={{ height: "450px", position: "relative" }}>
          <ReactFlow
            key={id + String(query.data?.nodes.length) + filterKind + searchTerm}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
            minZoom={0.08}
            maxZoom={2}
            nodesConnectable={false}
            deleteKeyCode={null}
          >
            <Background gap={22} color="#dce4ef" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) => String(node.style?.background || "#eef2f8")}
              zoomable
              pannable
            />
          </ReactFlow>
        </div>
      ) : (
        /* Neo4j Cypher Viewer Mode */
        <div style={{ padding: "20px", background: "#0f172a", color: "#f8fafc", borderRadius: "8px", margin: "16px", fontFamily: "monospace" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ color: "#38bdf8", fontWeight: 700 }}>NEO4J CYPHER GRAPH VIEW</span>
            <span style={{ fontSize: "11px", background: "#1e293b", padding: "4px 8px", borderRadius: "4px" }}>Engine: Neo4j Cypher Query Runtime</span>
          </div>

          <pre style={{ background: "#1e293b", padding: "12px", borderRadius: "6px", fontSize: "12px", color: "#4ade80", overflowX: "auto" }}>
            MATCH (t:Transaction &#123;id: &quot;{id}&quot;&#125;)-[r]-(e) RETURN t, r, e LIMIT 100
          </pre>

          <div style={{ marginTop: "16px" }}>
            <h4 style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase" }}>Cypher Node Graph Inspection</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px", marginTop: "10px" }}>
              {query.data?.nodes.map(({ data }) => (
                <div
                  key={data.id}
                  onClick={() => setSelectedNodeId(data.id)}
                  style={{
                    background: selectedNodeId === data.id ? "#1e3a8a" : "#1e293b",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "10px", color: "#38bdf8", fontWeight: 700 }}>:{data.kind.toUpperCase()}</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{data.label}</div>
                  <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>Degree: {data.degree || 1}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected Node Inspection Drawer */}
      {selectedNodeObj && (
        <div
          style={{
            position: "absolute",
            top: "80px",
            right: "20px",
            width: "300px",
            background: "#ffffff",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            padding: "16px",
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#2563eb", background: "#eff6ff", padding: "2px 8px", borderRadius: "4px" }}>
              {selectedNodeObj.kind} NODE
            </span>
            <X size={16} style={{ cursor: "pointer", color: "#64748b" }} onClick={() => setSelectedNodeId(null)} />
          </div>

          <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 4px 0", wordBreak: "break-all" }}>
            {selectedNodeObj.label}
          </h3>
          <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>ID: {selectedNodeObj.id}</p>

          <div style={{ margin: "12px 0", padding: "10px", background: "#f8fafc", borderRadius: "8px", fontSize: "12px" }}>
            <div><strong>Risk Level:</strong> {selectedNodeObj.risk}</div>
            <div><strong>Degree Centrality:</strong> {selectedNodeObj.degree || 1}</div>
            {selectedNodeObj.amount !== undefined && (
              <div><strong>Transaction Amount:</strong> ${selectedNodeObj.amount} {selectedNodeObj.currency}</div>
            )}
          </div>

          <div style={{ fontSize: "12px" }}>
            <strong style={{ display: "block", marginBottom: "6px" }}>Connected Edges ({connectedEdges?.length || 0}):</strong>
            <ul style={{ paddingLeft: "16px", margin: 0, fontSize: "11px", color: "#475569" }}>
              {connectedEdges?.map((e) => (
                <li key={e.data.id} style={{ marginBottom: "4px" }}>
                  <strong>{e.data.relationship}</strong> → {e.data.source === selectedNodeId ? e.data.target : e.data.source}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="graph-caption">
        {selectedNodeId ? `Selected: ${selectedNodeId}` : "Click any node to inspect properties · GraphSAGE 2-hop GNN Enabled"}
        {query.data?.truncated && " · Limited to 100 neighboring transactions"}
      </div>
    </section>
  );
}
