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
import { GitFork, Network } from "lucide-react";
import { api } from "../api";
import { ErrorBox, Loading } from "../components";
interface GraphData {
  nodes: { data: { id: string; label: string; kind: string; risk: string } }[];
  edges: {
    data: { id: string; source: string; target: string; relationship: string };
  }[];
  truncated: boolean;
}
export default function InvestigationGraph({ id }: { id: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState("");
  const query = useQuery<GraphData>({
    queryKey: ["graph", id],
    queryFn: () => api(`/graph/transaction/${encodeURIComponent(id)}`),
    refetchInterval: false,
  });
  useEffect(() => {
    if (!query.data) return;
    const groups = [
      "customer",
      "device",
      "ip",
      "transaction",
      "merchant",
      "location",
    ];
    const counters: Record<string, number> = {};
    const colors: Record<string, string> = {
      customer: "#e9f0ff",
      device: "#fef0cf",
      ip: "#eff2f7",
      transaction: "#fff",
      merchant: "#ebe7fb",
      location: "#e4f4ef",
    };
    setNodes(
      query.data.nodes.map(({ data }) => {
        const column = groups.indexOf(data.kind);
        const index = counters[data.kind] || 0;
        counters[data.kind] = index + 1;
        return {
          id: data.id,
          position: { x: column * 260, y: index * 105 },
          data: {
            label: (
              <div className="entity-node">
                <span>{data.kind}</span>
                <strong>{data.label}</strong>
                {["HIGH", "CRITICAL"].includes(data.risk) && <i>{data.risk}</i>}
              </div>
            ),
          },
          sourcePosition: "right",
          targetPosition: "left",
          style: {
            background: colors[data.kind] || "#fff",
            border: `1px solid ${data.risk === "CRITICAL" ? "#df7369" : "#c9d6e5"}`,
            borderRadius: 12,
            width: 205,
            padding: 12,
          },
        } as Node;
      }),
    );
    setEdges(
      query.data.edges.map(({ data }) => ({
        id: data.id,
        source: data.source,
        target: data.target,
        label: data.relationship,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#a6b3c4" },
        style: { stroke: "#a6b3c4" },
        labelStyle: { fontSize: 9, fill: "#758398" },
        labelBgPadding: [5, 3],
        labelBgBorderRadius: 4,
      })),
    );
  }, [query.data, setNodes, setEdges]);
  const printScale = Math.min(
    640 / Math.max(1, ...nodes.map((n) => n.position.x + 245)),
    310 / Math.max(1, ...nodes.map((n) => n.position.y + 140)),
  );
  return (
    <section
      className="panel graph-panel"
      style={
        {
          "--print-transform": `translate(15px, 15px) scale(${printScale})`,
        } as CSSProperties
      }
    >
      <div className="panel-heading">
        <div>
          <h2>
            <GitFork size={19} />
            Relationship graph
          </h2>
          <p>Follow the connections. Select a node to inspect it.</p>
        </div>
        <span className="subtle-badge">
          <Network size={12} /> React Flow
        </span>
      </div>
      <ErrorBox error={query.error} />
      {query.isLoading ? (
        <Loading />
      ) : (
        <div className="flow-canvas">
          <ReactFlow
            key={id + String(query.data?.nodes.length)}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => setSelected(node.id)}
            onEdgeClick={(_, edge) => setSelected(String(edge.label))}
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
      )}
      <div className="graph-caption">
        {selected || "Observed relationships only · Drag nodes · Zoom and pan"}
        {query.data?.truncated && " · Limited to 100 neighboring transactions"}
      </div>
    </section>
  );
}
