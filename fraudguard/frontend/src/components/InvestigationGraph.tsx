import { useState, useEffect, useCallback, useMemo, CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  GitFork,
  Network,
  Database,
  Cpu,
  Search,
  Filter,
  X,
  Building2,
  Shuffle,
  Zap,
  Wallet,
  Target,
  Copy,
  Check,
  LayoutGrid,
  RefreshCw,
  Layers,
  CircleDot,
  Radio,
  Share2,
  HardDrive,
  Globe,
  MapPin,
  CreditCard,
} from "lucide-react";
import { api } from "../api";
import { ErrorBox, Loading } from "../components";
import type { GraphSAGEData, Neo4jStatus } from "../types";

/* ── Forensic Entity Color & Theme Config ──────────────────────────────── */
const FORENSIC_ENTITY_CONFIG: Record<
  string,
  { color: string; accent: string; border: string; bg: string; iconBg: string; label: string; badge: string }
> = {
  transaction: {
    color: "#EF4444",
    accent: "#DC2626",
    border: "#FCA5A5",
    bg: "#FEF2F2",
    iconBg: "#FEE2E2",
    label: "Transaction Event",
    badge: "TRANSACTION",
  },
  customer: {
    color: "#2563EB",
    accent: "#3B82F6",
    border: "#BFDBFE",
    bg: "#EFF6FF",
    iconBg: "#DBEAFE",
    label: "Customer Account",
    badge: "CUSTOMER",
  },
  merchant: {
    color: "#7C3AED",
    accent: "#8B5CF6",
    border: "#DDD6FE",
    bg: "#F5F3FF",
    iconBg: "#EDE9FE",
    label: "Merchant Receiver",
    badge: "MERCHANT",
  },
  device: {
    color: "#D97706",
    accent: "#F59E0B",
    border: "#FDE68A",
    bg: "#FFFBEB",
    iconBg: "#FEF3C7",
    label: "Shared Device",
    badge: "DEVICE",
  },
  ip: {
    color: "#475569",
    accent: "#64748B",
    border: "#CBD5E1",
    bg: "#F8FAFC",
    iconBg: "#F1F5F9",
    label: "IP Network",
    badge: "IP ADDRESS",
  },
  location: {
    color: "#059669",
    accent: "#10B981",
    border: "#A7F3D0",
    bg: "#F0FDF4",
    iconBg: "#DCFCE7",
    label: "Geo Location",
    badge: "LOCATION",
  },
};

/* ── Custom Forensic Graph Node Component ───────────────────────────── */
function ForensicNodeCard({ data, isConnectable }: { data: any; isConnectable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const kind = (data.kind || "transaction").toLowerCase();
  const cfg = FORENSIC_ENTITY_CONFIG[kind] || FORENSIC_ENTITY_CONFIG.customer;

  const isSelected = data.isSelected;
  const isCritical = ["HIGH", "CRITICAL"].includes(data.risk);
  const isNodeMode = data.nodeDisplayMode !== "CARD";

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.label) {
      navigator.clipboard.writeText(data.label);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const getIcon = (size = 20) => {
    if (kind === "transaction") return <CreditCard size={size} color={cfg.color} strokeWidth={2.2} />;
    if (kind === "customer") return <Wallet size={size} color={cfg.color} strokeWidth={2.2} />;
    if (kind === "merchant") return <Building2 size={size} color={cfg.color} strokeWidth={2.2} />;
    if (kind === "device") return <HardDrive size={size} color={cfg.color} strokeWidth={2.2} />;
    if (kind === "ip") return <Globe size={size} color={cfg.color} strokeWidth={2.2} />;
    return <MapPin size={size} color={cfg.color} strokeWidth={2.2} />;
  };

  const displayName = data.label || data.id;
  const shortName = displayName.length > 16 ? `${displayName.slice(0, 7)}...${displayName.slice(-5)}` : displayName;

  /* ── 1. CIRCULAR GRAPH NODE MODE ── */
  if (isNodeMode) {
    const nodeDiameter = kind === "transaction" ? 58 : 52;
    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 140,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div
          style={{
            position: "relative",
            width: nodeDiameter,
            height: nodeDiameter,
            borderRadius: kind === "merchant" || kind === "device" ? 14 : "50%",
            background: isSelected ? "#EFF6FF" : "#FFFFFF",
            border: isSelected
              ? "3px solid #2563EB"
              : isCritical
              ? "3px solid #EF4444"
              : `2.5px solid ${cfg.color}`,
            boxShadow: isSelected
              ? "0 0 0 5px rgba(37, 99, 235, 0.25)"
              : isCritical
              ? "0 0 0 4px rgba(239, 68, 68, 0.25)"
              : "0 4px 12px -2px rgba(0, 0, 0, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease",
          }}
        >
          <Handle type="target" position={Position.Left} isConnectable={isConnectable} style={{ background: cfg.color }} />
          {getIcon(22)}
          <div
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 99,
              background: isCritical ? "#DC2626" : cfg.color,
              color: "#FFFFFF",
              fontSize: "8.5px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              border: "2px solid #FFFFFF",
            }}
          >
            {data.degree || 1}
          </div>
          <Handle type="source" position={Position.Right} isConnectable={isConnectable} style={{ background: cfg.color }} />
        </div>

        <div style={{ marginTop: 6, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, maxWidth: 136 }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#0F172A",
              background: "rgba(255, 255, 255, 0.96)",
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid #CBD5E1",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
            title={displayName}
          >
            {shortName}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {data.amount !== undefined ? (
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#047857", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "1px 5px", borderRadius: 4 }}>
                ${data.amount} {data.currency || "USD"}
              </span>
            ) : (
              <span style={{ fontSize: "9px", fontFamily: "monospace", color: "#64748B", background: "#F1F5F9", padding: "1px 4px", borderRadius: 3 }}>
                {cfg.badge}
              </span>
            )}
            <button onClick={handleCopy} title="Copy ID" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: copied ? "#10B981" : "#94A3B8" }}>
              {copied ? <Check size={10} /> : <Copy size={9} />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── 2. DETAILED CARD MODE ── */
  return (
    <div
      style={{
        position: "relative",
        width: 220,
        minHeight: 74,
        background: "#FFFFFF",
        borderRadius: 10,
        border: isSelected ? "2px solid #2563EB" : isCritical ? "2px solid #EF4444" : `1.5px solid ${cfg.border}`,
        borderLeft: `5px solid ${cfg.color}`,
        boxShadow: "0 2px 8px -1px rgba(0, 0, 0, 0.05)",
        padding: "9px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} style={{ background: cfg.color }} />
      <div style={{ width: 38, height: 38, borderRadius: 8, background: cfg.iconBg, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {getIcon(20)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", color: cfg.color, letterSpacing: 0.5 }}>
            {cfg.badge}
          </span>
          {isCritical && <span style={{ fontSize: "8.5px", fontWeight: 800, background: "#FEF2F2", color: "#DC2626", padding: "1px 4px", borderRadius: 3 }}>HIGH</span>}
        </div>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={displayName}>
          {shortName}
        </div>
        <div style={{ fontSize: "10px", color: "#64748B", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <span>Deg: {data.degree || 1}</span>
          <button onClick={handleCopy} title="Copy ID" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: copied ? "#10B981" : "#94A3B8" }}>
            {copied ? <Check size={10} /> : <Copy size={9} />}
          </button>
        </div>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} style={{ background: cfg.color }} />
    </div>
  );
}

/* ── Custom Forensic Edge Component ───────────────────────────── */
function ForensicEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.28,
  });

  const rel = (data as any)?.relationship;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: "#94a3b8", strokeWidth: 1.8 }} />
      {rel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: "9px",
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.95)",
              color: "#334155",
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              pointerEvents: "all",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            {rel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { custom: ForensicNodeCard };
const edgeTypes = { forensic: ForensicEdge };

/* ── Inner Graph Canvas ───────────────────────── */
function GraphCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onNodeClick: any;
}) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodes && nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.2, duration: 400, maxZoom: 1.0, minZoom: 0.4 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  return (
    <div style={{ flex: 1, width: "100%", height: "450px", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.2}
        maxZoom={2.4}
        style={{ background: "#F8FAFC" }}
      >
        <Controls style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8 }} />
        <MiniMap
          style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, width: 140, height: 80 }}
          nodeColor={(n) => {
            const kind = (n.data?.kind || "").toString().toLowerCase();
            return FORENSIC_ENTITY_CONFIG[kind]?.color || "#3B82F6";
          }}
        />
        <Background gap={22} color="#E2E8F0" />
      </ReactFlow>
    </div>
  );
}

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
  const [nodeDisplayMode, setNodeDisplayMode] = useState<"NODE" | "CARD">("NODE");
  const [engineMode, setEngineMode] = useState<"flow" | "neo4j">("flow");
  const [isSyncing, setIsSyncing] = useState(false);

  const query = useQuery<GraphData>({
    queryKey: ["graph", id],
    queryFn: () => api(`/graph/transaction/${encodeURIComponent(id)}`),
    refetchInterval: false,
  });

  const syncMutation = async () => {
    setIsSyncing(true);
    try {
      await api("/graph/neo4j/query", {
        method: "POST",
        body: JSON.stringify({ query: "MATCH (n) RETURN count(n)" }),
      });
    } catch {
      // Handled silently
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!query.data) return;

    const groups = ["customer", "device", "ip", "transaction", "merchant", "location"];
    const counters: Record<string, number> = {};

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

        const posX = (column >= 0 ? column : 0) * (nodeDisplayMode === "CARD" ? 250 : 200);
        const posY = index * (nodeDisplayMode === "CARD" ? 110 : 120);

        return {
          id: data.id,
          type: "custom",
          position: { x: posX, y: posY },
          data: {
            ...data,
            isSelected: data.id === selectedNodeId,
            nodeDisplayMode,
          },
        } as Node;
      }),
    );

    setEdges(
      query.data.edges
        .filter(({ data }) => activeNodeIds.has(data.source) && activeNodeIds.has(data.target))
        .map(({ data }) => ({
          id: data.id,
          type: "forensic",
          source: data.source,
          target: data.target,
          data: { ...data },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
        })),
    );
  }, [query.data, filterKind, searchTerm, selectedNodeId, nodeDisplayMode, setNodes, setEdges]);

  const selectedNodeObj = query.data?.nodes.find((n) => n.data.id === selectedNodeId)?.data;
  const connectedEdges = query.data?.edges.filter(
    (e) => e.data.source === selectedNodeId || e.data.target === selectedNodeId,
  );

  const gnn = query.data?.graphsage;
  const neo4j = query.data?.neo4j;

  return (
    <section className="panel graph-panel" style={{ position: "relative" }}>
      <div className="panel-heading" style={{ flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <GitFork size={19} />
            Graph Intelligence & Forensic Map
          </h2>
          <p className="muted">
            Interactive multi-hop relationship viewer with GraphSAGE GNN & Neo4j Cypher engine.
          </p>
        </div>

        {/* View Mode & Engine Controls */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: "#F1F5F9", padding: "3px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <button
              type="button"
              onClick={() => setNodeDisplayMode("NODE")}
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                background: nodeDisplayMode === "NODE" ? "#FFFFFF" : "transparent",
                color: nodeDisplayMode === "NODE" ? "#2563EB" : "#64748B",
                cursor: "pointer",
                boxShadow: nodeDisplayMode === "NODE" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Circle Vertices
            </button>
            <button
              type="button"
              onClick={() => setNodeDisplayMode("CARD")}
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                background: nodeDisplayMode === "CARD" ? "#FFFFFF" : "transparent",
                color: nodeDisplayMode === "CARD" ? "#2563EB" : "#64748B",
                cursor: "pointer",
                boxShadow: nodeDisplayMode === "CARD" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Forensic Cards
            </button>
          </div>

          <button
            type="button"
            className={engineMode === "flow" ? "primary" : ""}
            onClick={() => setEngineMode("flow")}
            style={{ padding: "5px 10px", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px" }}
          >
            <Network size={13} /> ReactFlow Canvas
          </button>
          <button
            type="button"
            className={engineMode === "neo4j" ? "primary" : ""}
            onClick={() => setEngineMode("neo4j")}
            style={{ padding: "5px 10px", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px" }}
          >
            <Database size={13} /> Neo4j Cypher Engine
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
          background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
          borderRadius: "10px",
          border: "1px solid #E2E8F0",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              background: gnn?.signal ? "#FEF2F2" : "#EFF6FF",
              color: gnn?.signal ? "#DC2626" : "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Cpu size={22} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748B" }}>
              GraphSAGE GNN Aggregator
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: gnn?.signal ? "#DC2626" : "#1E293B" }}>
              {gnn ? `${gnn.graphsage_score}% GNN Fraud Risk` : "Evaluating GNN..."}
              {gnn?.signal && <span style={{ fontSize: "11px", marginLeft: "6px", color: "#DC2626" }}>⚠️ HIGH RISK SIGNAL</span>}
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>
              {gnn ? `2-Hop Sample: ${gnn.hop1_neighbors_count} 1-hop, ${gnn.hop2_neighbors_count} 2-hop` : "GraphSAGE Mean Aggregator"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                background: neo4j?.connected ? "#ECFDF5" : "#F8FAFC",
                color: neo4j?.connected ? "#059669" : "#475569",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Database size={22} />
            </div>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748B" }}>
                Neo4j Graph Database
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>
                {neo4j?.engine || "Cypher Graph Engine"}
              </div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>
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
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncing..." : "Sync Neo4j"}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", gap: "12px", padding: "0 16px 12px 16px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#F1F5F9", padding: "6px 10px", borderRadius: "6px", flex: 1, minWidth: "180px" }}>
          <Search size={14} color="#64748B" />
          <input
            type="text"
            placeholder="Search node ID or entity label..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: "none", background: "transparent", fontSize: "12px", outline: "none", width: "100%" }}
          />
          {searchTerm && <X size={14} style={{ cursor: "pointer" }} onClick={() => setSearchTerm("")} />}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Filter size={14} color="#64748B" />
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            style={{ fontSize: "12px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1" }}
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
        <ReactFlowProvider>
          <GraphCanvasInner
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_: any, node: Node) => setSelectedNodeId(node.id)}
          />
        </ReactFlowProvider>
      ) : (
        /* Neo4j Cypher Mode */
        <div style={{ padding: "20px", background: "#0F172A", color: "#F8FAFC", borderRadius: "8px", margin: "16px", fontFamily: "monospace" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ color: "#38BDF8", fontWeight: 700 }}>NEO4J CYPHER GRAPH VIEW</span>
            <span style={{ fontSize: "11px", background: "#1E293B", padding: "4px 8px", borderRadius: "4px" }}>Engine: Neo4j Cypher Runtime</span>
          </div>

          <pre style={{ background: "#1E293B", padding: "12px", borderRadius: "6px", fontSize: "12px", color: "#4ADE80", overflowX: "auto" }}>
            MATCH (t:Transaction &#123;id: &quot;{id}&quot;&#125;)-[r]-(e) RETURN t, r, e LIMIT 100
          </pre>

          <div style={{ marginTop: "16px" }}>
            <h4 style={{ color: "#94A3B8", fontSize: "12px", textTransform: "uppercase" }}>Cypher Node Graph Inspection</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px", marginTop: "10px" }}>
              {query.data?.nodes.map(({ data }) => (
                <div
                  key={data.id}
                  onClick={() => setSelectedNodeId(data.id)}
                  style={{
                    background: selectedNodeId === data.id ? "#1E3A8A" : "#1E293B",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "10px", color: "#38BDF8", fontWeight: 700 }}>:{data.kind.toUpperCase()}</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{data.label}</div>
                  <div style={{ fontSize: "10px", color: "#94A3B8", marginTop: "4px" }}>Degree: {data.degree || 1}</div>
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
            background: "#FFFFFF",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
            padding: "16px",
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#2563EB", background: "#EFF6FF", padding: "2px 8px", borderRadius: "4px" }}>
              {selectedNodeObj.kind} NODE
            </span>
            <X size={16} style={{ cursor: "pointer", color: "#64748B" }} onClick={() => setSelectedNodeId(null)} />
          </div>

          <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 4px 0", wordBreak: "break-all" }}>
            {selectedNodeObj.label}
          </h3>
          <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>ID: {selectedNodeObj.id}</p>

          <div style={{ margin: "12px 0", padding: "10px", background: "#F8FAFC", borderRadius: "8px", fontSize: "12px" }}>
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
        {selectedNodeId ? `Selected: ${selectedNodeId}` : "Click any node to inspect properties · ReactFlow Forensic Node Cards · GraphSAGE 2-Hop Enabled"}
      </div>
    </section>
  );
}
