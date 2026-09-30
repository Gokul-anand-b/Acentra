import { useState, useEffect, CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  GitFork,
  Database,
  Cpu,
  Search,
  X,
  Building2,
  Wallet,
  Copy,
  Check,
  RefreshCw,
  HardDrive,
  Globe,
  MapPin,
  CreditCard,
  Maximize2,
  Folder,
  User,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";
import { api } from "../api";
import { ErrorBox, Loading } from "../components";
import type { GraphSAGEData, Neo4jStatus } from "../types";

/* ── Dark Forensic Node Card Component ───────────────────────────── */
function DarkForensicNode({ data, isConnectable }: { data: any; isConnectable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const kind = (data.kind || "transaction").toLowerCase();
  const isSelected = data.isSelected;
  const isCritical = ["HIGH", "CRITICAL"].includes(data.risk);
  const isCase = kind === "case" || data.id.startsWith("CASE");

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.label) {
      navigator.clipboard.writeText(data.label);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const getIcon = () => {
    if (isCase) return <Folder size={16} color="#F97316" />;
    if (kind === "customer") return <User size={16} color="#38BDF8" />;
    if (kind === "card" || kind === "device") return <CreditCard size={16} color="#A78BFA" />;
    if (kind === "transaction") return <DollarSign size={16} color="#4ADE80" />;
    if (kind === "merchant") return <Building2 size={16} color="#F472B6" />;
    if (kind === "ip") return <Globe size={16} color="#94A3B8" />;
    return <MapPin size={16} color="#34D399" />;
  };

  const getBorderColor = () => {
    if (isSelected) return "#38BDF8";
    if (isCase) return "#F97316";
    if (isCritical) return "#EF4444";
    if (kind === "customer") return "#0284C7";
    if (kind === "transaction") return "#16A34A";
    return "#334155";
  };

  return (
    <div
      style={{
        position: "relative",
        minWidth: 210,
        background: isCase ? "#1E1B4B" : "#0F172A",
        borderRadius: 8,
        border: `1.5px solid ${getBorderColor()}`,
        boxShadow: isSelected
          ? "0 0 0 3px rgba(56, 189, 248, 0.3), 0 8px 20px rgba(0,0,0,0.5)"
          : isCritical
          ? "0 0 0 3px rgba(239, 68, 68, 0.3)"
          : "0 4px 14px rgba(0,0,0,0.4)",
        padding: "10px 12px",
        color: "#F8FAFC",
        fontFamily: "Inter, system-ui, sans-serif",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: getBorderColor(), width: 8, height: 8 }} />

      {/* Node Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ background: "rgba(255,255,255,0.08)", padding: 4, borderRadius: 6, display: "flex" }}>
            {getIcon()}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#F8FAFC", wordBreak: "break-all" }}>
            {data.label || data.id}
          </span>
        </div>
        <button onClick={handleCopy} title="Copy ID" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: copied ? "#4ADE80" : "#64748B" }}>
          {copied ? <Check size={12} /> : <Copy size={11} />}
        </button>
      </div>

      {/* Subtitle / Kind Badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "9px", textTransform: "uppercase", letterSpacing: 0.5, color: "#94A3B8" }}>
        <span>{isCase ? "CASE" : kind.toUpperCase()}</span>
        {isCase && <span style={{ background: "#F97316", color: "#FFFFFF", padding: "1px 5px", borderRadius: 3, fontWeight: 800 }}>CURRENT INVESTIGATION</span>}
      </div>

      {/* Financial Amount & Risk Badge for Transactions */}
      {data.amount !== undefined && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: "1px solid #1E293B", fontSize: "11px" }}>
          <span style={{ color: "#4ADE80", fontWeight: 800 }}>${data.amount} {data.currency || "USD"}</span>
          <span style={{ fontSize: "10px", color: isCritical ? "#EF4444" : "#94A3B8", background: isCritical ? "rgba(239, 68, 68, 0.15)" : "#1E293B", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
            Risk: {data.risk}
          </span>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: getBorderColor(), width: 8, height: 8 }} />
    </div>
  );
}

/* ── Curved Dark Forensic Edge ───────────────────────────── */
function DarkForensicEdge({
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
    curvature: 0.35,
  });

  const rel = (data as any)?.relationship;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: "#475569", strokeWidth: 1.8 }} />
      {rel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: "8.5px",
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: 4,
              background: "#0F172A",
              color: "#CBD5E1",
              border: "1px solid #334155",
              boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
              pointerEvents: "all",
              userSelect: "none",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {rel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { custom: DarkForensicNode };
const edgeTypes = { forensic: DarkForensicEdge };

/* ── Inner Canvas Component ───────────────────────── */
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
        fitView({ padding: 0.15, duration: 400, maxZoom: 1.0, minZoom: 0.3 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  return (
    <div style={{ flex: 1, width: "100%", height: "520px", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.15}
        maxZoom={2.4}
        style={{ background: "#090D16" }}
      >
        <Controls style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, fill: "#94A3B8" }} />
        <MiniMap
          style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, width: 140, height: 80 }}
          nodeColor={(n) => (n.data?.kind === "customer" ? "#38BDF8" : n.data?.kind === "transaction" ? "#4ADE80" : "#F97316")}
          maskColor="rgba(9, 13, 22, 0.8)"
        />
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#1E293B" />
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

  /* ── Top-to-Bottom Hierarchical Tree Layout Algorithm ── */
  useEffect(() => {
    if (!query.data) return;

    const filteredNodesData = query.data.nodes.filter(({ data }) => {
      const matchKind = filterKind === "all" || data.kind === filterKind;
      const matchSearch =
        !searchTerm ||
        data.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.label.toLowerCase().includes(searchTerm.toLowerCase());
      return matchKind && matchSearch;
    });

    const activeNodeIds = new Set(filteredNodesData.map((n) => n.data.id));

    // Categorize nodes into Hierarchical Levels (Top to Bottom)
    const level0_Case: any[] = [];
    const level1_Customer: any[] = [];
    const level2_CardsDevices: any[] = [];
    const level3_Transactions: any[] = [];

    filteredNodesData.forEach((n) => {
      const k = n.data.kind;
      if (k === "case" || n.data.id.startsWith("CASE")) level0_Case.push(n);
      else if (k === "customer") level1_Customer.push(n);
      else if (k === "card" || k === "device" || k === "ip") level2_CardsDevices.push(n);
      else level3_Transactions.push(n);
    });

    // Default Case Node if none exists
    if (level0_Case.length === 0) {
      level0_Case.push({
        data: { id: `CASE-${id.slice(0, 8)}`, label: `CASE ${id.slice(0, 8)}`, kind: "case", risk: "HIGH" },
      });
    }

    const calculatedNodes: Node[] = [];

    // Level 0 (Top: Case)
    level0_Case.forEach((n, idx) => {
      calculatedNodes.push({
        id: n.data.id,
        type: "custom",
        position: { x: 340 + idx * 240, y: 30 },
        data: { ...n.data, isSelected: n.data.id === selectedNodeId },
      });
    });

    // Level 1 (Customer)
    level1_Customer.forEach((n, idx) => {
      calculatedNodes.push({
        id: n.data.id,
        type: "custom",
        position: { x: 340 + idx * 240, y: 160 },
        data: { ...n.data, isSelected: n.data.id === selectedNodeId },
      });
    });

    // Level 2 (Cards / Devices / IPs)
    const cardWidth = 240;
    const cardStartX = 340 - ((level2_CardsDevices.length - 1) * cardWidth) / 2;
    level2_CardsDevices.forEach((n, idx) => {
      calculatedNodes.push({
        id: n.data.id,
        type: "custom",
        position: { x: Math.max(40, cardStartX + idx * cardWidth), y: 300 },
        data: { ...n.data, isSelected: n.data.id === selectedNodeId },
      });
    });

    // Level 3 (Transactions at Bottom)
    const txWidth = 240;
    const txStartX = 340 - ((level3_Transactions.length - 1) * txWidth) / 2;
    level3_Transactions.forEach((n, idx) => {
      calculatedNodes.push({
        id: n.data.id,
        type: "custom",
        position: { x: Math.max(40, txStartX + idx * txWidth), y: 440 },
        data: { ...n.data, isSelected: n.data.id === selectedNodeId },
      });
    });

    setNodes(calculatedNodes);

    // Build edges with top-to-bottom Bezier connectors
    setEdges(
      query.data.edges
        .filter(({ data }) => activeNodeIds.has(data.source) || activeNodeIds.has(data.target))
        .map(({ data }) => ({
          id: data.id,
          type: "forensic",
          source: data.source,
          target: data.target,
          data: { ...data },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
        })),
    );
  }, [query.data, filterKind, searchTerm, selectedNodeId, setNodes, setEdges, id]);

  const selectedNodeObj = query.data?.nodes.find((n) => n.data.id === selectedNodeId)?.data;
  const connectedEdges = query.data?.edges.filter(
    (e) => e.data.source === selectedNodeId || e.data.target === selectedNodeId,
  );

  const gnn = query.data?.graphsage;
  const neo4j = query.data?.neo4j;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "16px", marginTop: "16px" }}>
      {/* Left Active Case & Services Sidebar (Matches Screenshot) */}
      <aside style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, padding: "16px", color: "#F8FAFC" }}>
        <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#94A3B8", letterSpacing: 0.8, marginBottom: 12 }}>
          ACTIVE CASE
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: "11px", color: "#64748B" }}>Case Ref</div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#F97316", margin: "2px 0 12px 0" }}>
            HHG-{id.slice(-3)}
          </div>
          <Link
            to="/input"
            style={{
              display: "block",
              textAlign: "center",
              background: "#F97316",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: "12px",
              padding: "8px 12px",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            Open Workbench
          </Link>
        </div>

        <hr style={{ borderColor: "#1E293B", margin: "16px 0" }} />

        <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#94A3B8", letterSpacing: 0.8, marginBottom: 12 }}>
          SERVICES & ENGINES
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#94A3B8", display: "flex", alignItems: "center", gap: 5 }}>
              <Database size={13} color="#F97316" /> Graph Engine
            </span>
            <span style={{ fontWeight: 700, color: "#F8FAFC" }}>Neo4j / Cypher</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#94A3B8", display: "flex", alignItems: "center", gap: 5 }}>
              <Cpu size={13} color="#A78BFA" /> Reasoning GNN
            </span>
            <span style={{ fontWeight: 700, color: "#F8FAFC" }}>GraphSAGE</span>
          </div>
        </div>
      </aside>

      {/* Main Dark Graph Canvas Panel */}
      <section className="panel" style={{ background: "#0B0F19", border: "1px solid #1E293B", padding: 0, position: "relative" }}>
        {/* Top Filter Pills Toolbar (Matches Screenshot) */}
        <div style={{ background: "#0F172A", borderBottom: "1px solid #1E293B", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#94A3B8", background: "#1E293B", padding: "3px 8px", borderRadius: 4 }}>
              INVESTIGATION GRAPH
            </span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#F8FAFC" }}>HHG-{id.slice(-3)}</span>
          </div>

          {/* Filter Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {["Customer", "Card", "Transaction", "Device", "Email Domain", "Billing Region", "Case"].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setFilterKind(filterKind === filter.toLowerCase() ? "all" : filter.toLowerCase())}
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "1px solid #1E293B",
                  background: filterKind === filter.toLowerCase() ? "#1E3A8A" : "#1E293B",
                  color: filterKind === filter.toLowerCase() ? "#38BDF8" : "#94A3B8",
                  cursor: "pointer",
                }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Action Bar inside Canvas */}
        <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#090D16" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#0F172A", border: "1px solid #1E293B", padding: "4px 10px", borderRadius: "6px", width: "220px" }}>
            <Search size={13} color="#64748B" />
            <input
              type="text"
              placeholder="Search Entity ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: "11px", outline: "none", color: "#F8FAFC", width: "100%" }}
            />
            {searchTerm && <X size={12} style={{ cursor: "pointer", color: "#94A3B8" }} onClick={() => setSearchTerm("")} />}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={syncMutation}
              disabled={isSyncing}
              style={{ padding: "5px 10px", fontSize: "11px", background: "#0F172A", border: "1px solid #1E293B", borderRadius: "6px", color: "#94A3B8", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing..." : "Sync Neo4j"}
            </button>
          </div>
        </div>

        <ErrorBox error={query.error} />

        {query.isLoading ? (
          <Loading />
        ) : (
          <ReactFlowProvider>
            <GraphCanvasInner
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_: any, node: Node) => setSelectedNodeId(node.id)}
            />
          </ReactFlowProvider>
        )}

        {/* Selected Node Inspection Drawer */}
        {selectedNodeObj && (
          <div
            style={{
              position: "absolute",
              top: "90px",
              right: "20px",
              width: "280px",
              background: "#0F172A",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              borderRadius: "10px",
              border: "1px solid #334155",
              padding: "14px",
              color: "#F8FAFC",
              zIndex: 100,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#38BDF8", background: "#1E293B", padding: "2px 8px", borderRadius: "4px" }}>
                {selectedNodeObj.kind} NODE
              </span>
              <X size={15} style={{ cursor: "pointer", color: "#94A3B8" }} onClick={() => setSelectedNodeId(null)} />
            </div>

            <h4 style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 4px 0", wordBreak: "break-all" }}>
              {selectedNodeObj.label}
            </h4>
            <p style={{ fontSize: "10px", color: "#94A3B8", margin: 0 }}>ID: {selectedNodeObj.id}</p>

            <div style={{ margin: "10px 0", padding: "8px", background: "#1E293B", borderRadius: "6px", fontSize: "11px" }}>
              <div><strong>Risk Level:</strong> {selectedNodeObj.risk}</div>
              <div><strong>Degree Centrality:</strong> {selectedNodeObj.degree || 1}</div>
              {selectedNodeObj.amount !== undefined && (
                <div><strong>Transaction Amount:</strong> ${selectedNodeObj.amount} {selectedNodeObj.currency}</div>
              )}
            </div>

            <div style={{ fontSize: "11px" }}>
              <strong style={{ display: "block", marginBottom: "4px", color: "#94A3B8" }}>Connected Edges ({connectedEdges?.length || 0}):</strong>
              <ul style={{ paddingLeft: "14px", margin: 0, fontSize: "10.5px", color: "#CBD5E1" }}>
                {connectedEdges?.map((e) => (
                  <li key={e.data.id} style={{ marginBottom: "3px" }}>
                    <strong>{e.data.relationship}</strong> → {e.data.source === selectedNodeId ? e.data.target : e.data.source}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
