import { useState, Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, SearchX, LoaderCircle, Cpu, Network, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { money, date, human } from "./api";
import type { Transaction } from "./types";

export function Badge({ value }: { value: string }) {
  return <span className={`badge ${value.toLowerCase()}`}>{human(value)}</span>;
}

export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" size={24} />
      <p>Loading workspace…</p>
    </div>
  );
}

export function ErrorBox({ error }: { error: Error | null }) {
  return error ? (
    <div className="error" role="alert">
      {error.message}
    </div>
  ) : null;
}

export function Empty({
  title = "No transactions found",
  body = "Import a dataset to start evaluating transactions.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="empty">
      <SearchX size={30} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export function Table({ rows }: { rows: Transaction[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Transaction / customer</th>
            <th>Amount</th>
            <th>Rule score</th>
            <th>GraphSAGE GNN</th>
            <th>Triggered signals</th>
            <th>Status</th>
            <th>Occurred</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const ml = t.assessment.scoring?.ml;
            const isExpanded = expandedId === t.id;

            return (
              <Fragment key={t.id}>
                <tr>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        aria-label="Toggle details"
                        onClick={() => setExpandedId(isExpanded ? null : t.id)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: "2px", color: "#64748b" }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <div>
                        <Link className="table-id" to={`/transactions/${encodeURIComponent(t.id)}`}>
                          {t.id}
                        </Link>
                        <small style={{ display: "block" }}>
                          {t.customer_id}
                          {t.source === "synthetic" ? " · Synthetic" : ""}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td className="number">{money(t.amount, t.currency)}</td>
                  <td>
                    <div className="score-cell">
                      <b>{t.assessment.normalized_score}</b>
                      <span className="score-track">
                        <i
                          className={t.assessment.risk_level.toLowerCase()}
                          style={{ width: `${t.assessment.normalized_score}%` }}
                        />
                      </span>
                      <Badge value={t.assessment.risk_level} />
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Cpu size={14} color={ml?.signal ? "#dc2626" : "#2563eb"} />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: ml?.signal ? "#dc2626" : "#1e293b" }}>
                        {ml?.score !== undefined ? `${ml.score.toFixed(1)}%` : "GNN Active"}
                      </span>
                      {ml?.signal && <span style={{ fontSize: "10px", background: "#fef2f2", color: "#dc2626", padding: "2px 4px", borderRadius: "4px", fontWeight: 700 }}>HIGH</span>}
                    </div>
                  </td>
                  <td>
                    <div className="signals">
                      {t.assessment.rules
                        .filter((r) => r.triggered)
                        .map((r) => (
                          <span key={r.rule_name}>{human(r.rule_name)}</span>
                        ))}
                      {!t.assessment.complete && <span>Evaluation incomplete</span>}
                    </div>
                  </td>
                  <td>
                    <Badge value={t.status} />
                  </td>
                  <td className="muted nowrap">{date(t.timestamp)}</td>
                  <td>
                    <Link
                      className="icon-button"
                      aria-label={`Investigate ${t.id}`}
                      to={`/transactions/${encodeURIComponent(t.id)}`}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  </td>
                </tr>

                {/* Inline Entity & Graph Quick Inspection Drawer */}
                {isExpanded && (
                  <tr>
                    <td colSpan={8} style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", fontSize: "12px" }}>
                        <div>
                          <strong style={{ color: "#475569", textTransform: "uppercase", fontSize: "10px", display: "block", marginBottom: "4px" }}>
                            Entity Identifiers
                          </strong>
                          <div><strong>Customer:</strong> {t.customer_id}</div>
                          <div><strong>Merchant:</strong> {t.merchant_id}</div>
                          <div><strong>Device:</strong> {t.device_id || "Not provided"}</div>
                          <div><strong>IP:</strong> {t.ip_address || "Not provided"}</div>
                        </div>

                        <div>
                          <strong style={{ color: "#475569", textTransform: "uppercase", fontSize: "10px", display: "block", marginBottom: "4px" }}>
                            Location & Metadata
                          </strong>
                          <div><strong>Coordinates:</strong> {t.latitude ? `${t.latitude}, ${t.longitude}` : "None"}</div>
                          <div><strong>Source:</strong> {t.source}</div>
                          <div><strong>Review Status:</strong> {t.status}</div>
                        </div>

                        <div>
                          <strong style={{ color: "#475569", textTransform: "uppercase", fontSize: "10px", display: "block", marginBottom: "4px" }}>
                            Graph & GNN Signals
                          </strong>
                          <div style={{ color: "#2563eb", fontWeight: 600 }}>GraphSAGE 2-Hop Aggregation Active</div>
                          <div style={{ marginTop: "4px" }}>
                            <Link to={`/transactions/${encodeURIComponent(t.id)}`} className="text-link" style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <Network size={13} /> Launch Full Relationship Graph →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
