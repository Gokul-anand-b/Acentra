import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import InvestigationGraph from "../components/InvestigationGraph";
import Pipeline from "../components/Pipeline";
import { ArrowLeft, Check, ShieldAlert, Clock3, Printer } from "lucide-react";
import { api, money, date, human } from "../api";
import { Badge, ErrorBox, Loading } from "../components";
import type { Transaction } from "../types";

export default function Detail({
  transactionId,
}: { transactionId?: string } = {}) {
  const params = useParams();
  const id = transactionId || params.id;
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState("");
  const query = useQuery<Transaction>({
    queryKey: ["transaction", id],
    queryFn: () => api(`/transactions/${encodeURIComponent(id!)}`),
  });
  const action = useMutation({
    mutationFn: (name: string) =>
      api(`/transactions/${encodeURIComponent(id!)}/${name}`, {
        method: "POST",
        body: JSON.stringify({ reason, version: query.data?.version }),
      }),
    onSuccess: () => {
      setSuccess("Decision saved to the audit trail.");
      setReason("");
      client.invalidateQueries();
    },
  });
  if (query.isLoading) return <Loading />;
  if (!query.data) return <ErrorBox error={query.error} />;
  const t = query.data;
  const a = t.assessment;
  const final = ["CLEARED", "CONFIRMED_FRAUD"].includes(t.status);
  return (
    <>
      <Link to="/alerts" className="back-link">
        <ArrowLeft size={15} />
        Back to alert queue
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">TRANSACTION INVESTIGATION</p>
          <h1>{t.id}</h1>
          <p className="muted">
            {t.customer_id} <span className="slash">/</span> {date(t.timestamp)}{" "}
            {t.source === "synthetic" && (
              <span className="synthetic-label">Demo / Synthetic Data</span>
            )}
          </p>
        </div>
        <div className="button-row">
          <Badge value={t.status} />
          <button className="print-button" onClick={() => window.print()}>
            <Printer size={16} />
            Print report
          </button>
        </div>
      </div>
      <Pipeline transaction={t} />
      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel score-panel">
            <div className={`score-orb ${a.risk_level.toLowerCase()}`}>
              <strong>{a.normalized_score}</strong>
              <span>/ 100</span>
            </div>
            <div>
              <Badge value={a.risk_level} />
              <h2>
                {a.flagged
                  ? "This transaction needs a closer look."
                  : "No configured rule triggered."}
              </h2>
              <p>
                {a.rules.filter((r) => r.triggered).length} signals · Raw score{" "}
                {a.raw_score} · Capped at 100
              </p>
              {!a.complete && (
                <div className="error">
                  Evaluation incomplete. Manual review required.
                </div>
              )}
              <small>{a.scoring.note}</small>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Why was this flagged?</h2>
                <p>
                  Independent rules, with preserved evidence and configuration
                </p>
              </div>
              <ShieldAlert size={20} />
            </div>
            <div className="evidence-list">
              {a.rules.map((r) => (
                <details
                  key={r.rule_name}
                  className={`evidence ${r.triggered ? "triggered" : ""}`}
                  open={r.triggered}
                >
                  <summary>
                    <span className="evidence-icon">
                      {r.triggered ? (
                        <ShieldAlert size={16} />
                      ) : (
                        <Check size={16} />
                      )}
                    </span>
                    <div>
                      <strong>{human(r.rule_name)}</strong>
                      <p>{r.reason}</p>
                    </div>
                    <span className="contribution">
                      {r.triggered
                        ? `+${r.score}`
                        : r.status === "unavailable"
                          ? "N/A"
                          : "0"}
                    </span>
                  </summary>
                  <div className="evidence-body">
                    <dl>
                      {Object.entries(r.evidence).map(([k, v]) => (
                        <div key={k}>
                          <dt>{human(k)}</dt>
                          <dd>
                            {typeof v === "number"
                              ? Number(v.toFixed(2)).toLocaleString()
                              : String(v ?? "Unavailable")}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <small>
                      Configuration v{r.configuration_version} ·{" "}
                      {Object.entries(r.configuration)
                        .map(([k, v]) => `${human(k)}: ${v}`)
                        .join(" · ")}
                    </small>
                  </div>
                </details>
              ))}
            </div>
          </section>
          <InvestigationGraph id={t.id} />
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <Clock3 size={18} />
                  Activity & decisions
                </h2>
                <p>Append-only application audit history</p>
              </div>
            </div>
            <div className="timeline">
              {t.audit?.map((item) => (
                <div key={item.id}>
                  <i />
                  <div>
                    <strong>{human(item.action)}</strong>
                    <p>
                      {item.actor} · {date(item.created_at)}
                    </p>
                    {Boolean(item.new_value.reason) && (
                      <blockquote>{String(item.new_value.reason)}</blockquote>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel">
            <div className="panel-heading">
              <h2>Transaction details</h2>
            </div>
            <div className="transaction-amount">
              {money(t.amount, t.currency)}
              <small>
                {t.currency} · {t.merchant_id}
              </small>
            </div>
            <dl className="facts">
              {[
                ["Customer", t.customer_id],
                ["Device", t.device_id],
                ["IP address", t.ip_address],
                [
                  "Coordinates",
                  t.latitude === null ? null : `${t.latitude}, ${t.longitude}`,
                ],
                ["Source", t.source],
                ["Scenario", t.scenario],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value || "Not provided"}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="panel decision-panel">
            <div className="panel-heading">
              <div>
                <h2>Make a decision</h2>
                <p>
                  {final
                    ? "A final decision has been recorded."
                    : "Your reasoning becomes part of the record."}
                </p>
              </div>
            </div>
            {!final && (
              <>
                <label className="sr-only" htmlFor="reason">
                  Decision reason
                </label>
                <textarea
                  id="reason"
                  placeholder="Describe your findings (required)…"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setSuccess("");
                  }}
                  maxLength={2000}
                />
                <div className="decision-actions">
                  {[
                    ["review", "Mark reviewed"],
                    ["clear", "Clear transaction"],
                    ["escalate", "Escalate to case"],
                    ["confirm-fraud", "Confirm fraud"],
                  ].map(([name, label]) => (
                    <button
                      key={name}
                      className={
                        name === "clear"
                          ? "primary"
                          : name === "confirm-fraud"
                            ? "danger"
                            : ""
                      }
                      disabled={reason.trim().length < 3 || action.isPending}
                      onClick={() => action.mutate(name)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <ErrorBox error={action.error} />
            {success && (
              <p className="success" role="status">
                {success}
              </p>
            )}
            {t.case_id && (
              <Link to={`/cases/${t.case_id}`} className="text-link">
                Open case workspace →
              </Link>
            )}
          </section>
          <section className="panel context-panel">
            <h2>Intelligence context</h2>
            <p>Behavioral baseline</p>
            <dl className="facts">
              {Object.entries(a.behavior)
                .filter(([k]) =>
                  [
                    "history_count",
                    "median",
                    "unique_merchants",
                    "unique_devices",
                  ].includes(k),
                )
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{human(k)}</dt>
                    <dd>{v === null ? "Unavailable" : String(v)}</dd>
                  </div>
                ))}
            </dl>
            <div className="model-note" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)", borderRadius: "10px", padding: "12px", border: "1px solid #bae6fd", marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="subtle-badge" style={{ background: "#2563eb", color: "#ffffff", fontWeight: 700 }}>
                  GraphSAGE GNN Active
                </span>
                <span style={{ fontSize: "10px", color: "#0369a1", fontWeight: 700 }}>v1.2.0</span>
              </div>
              <div className="ml-score" style={{ marginTop: "8px", fontSize: "20px", color: a.scoring.ml?.signal ? "#dc2626" : "#0369a1" }}>
                {a.scoring.ml?.score !== undefined ? `${a.scoring.ml.score.toFixed(1)}%` : "Evaluated"}
                <small style={{ display: "block", fontSize: "11px", color: "#64748b" }}>GraphSAGE 2-Hop Risk Score</small>
              </div>
              <p style={{ fontSize: "11px", color: "#334155", marginTop: "6px" }}>
                GNN aggregates 2-hop neighborhood entities (Customers, Merchants, Devices, IPs) for graph fraud propagation.
              </p>
              <div style={{ fontSize: "11px", color: "#0369a1", marginTop: "4px", fontWeight: 600 }}>
                Connected Engine: Neo4j Cypher Graph DB
              </div>
              <Link className="text-link" to="/model" style={{ marginTop: "8px", display: "inline-block" }}>
                View GraphSAGE model & evaluation →
              </Link>
            </div>
            <h3>Notification</h3>
            <p>
              {t.notification
                ? `${human(t.notification.status)} · ${t.notification.provider} · ${t.notification.attempts} attempts`
                : "No high-risk notification required."}
            </p>
            {t.notification?.last_error && (
              <p className="error">{t.notification.last_error}</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
