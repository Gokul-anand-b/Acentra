import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Play,
  FlaskConical,
  FileJson,
  BrainCircuit,
  Bell,
  RotateCcw,
  Printer,
  Download,
  CheckCircle2,
  Info,
} from "lucide-react";
import { api, date, money, human } from "../api";
import { Badge, ErrorBox, Loading, Empty } from "../components";
import type { Transaction, Case } from "../types";
import Detail from "./Detail";
import { CaseCard } from "./Operations";

const localNow = () => {
  const d = new Date(Date.now() - 60000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const emptyInput = () => ({
  id: "TX-" + Date.now(),
  customer_id: "",
  merchant_id: "",
  amount: "",
  currency: "USD",
  timestamp: localNow(),
  device_id: "",
  ip_address: "",
  latitude: "",
  longitude: "",
});
export function InputPage({ admin }: { admin: boolean }) {
  const [form, setForm] = useState(emptyInput);
  const [synthetic, setSynthetic] = useState(false);
  const navigate = useNavigate();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api<Transaction>(`/transactions?synthetic=${synthetic}`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          timestamp: new Date(form.timestamp).toISOString(),
          latitude: form.latitude === "" ? null : Number(form.latitude),
          longitude: form.longitude === "" ? null : Number(form.longitude),
          device_id: form.device_id || null,
          ip_address: form.ip_address || null,
        }),
      }),
    onSuccess: (t) => {
      client.invalidateQueries();
      navigate(`/transactions/${t.id}`);
    },
  });
  const demo = useMutation({
    mutationFn: () => api<Transaction>("/demo/scenario", { method: "POST" }),
    onSuccess: (t) => {
      client.invalidateQueries();
      navigate(`/transactions/${t.id}`);
    },
  });
  function field(
    name: keyof typeof form,
    label: string,
    type = "text",
    required = false,
  ) {
    return (
      <label>
        {label}
        <input
          type={type}
          required={required}
          value={form[name]}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          step={type === "number" ? "any" : undefined}
        />
      </label>
    );
  }
  function loadGenuineSample() {
    setForm({
      ...emptyInput(),
      id: "3514030",
      customer_id: "C12382",
      merchant_id: "M-Apple-Store",
      amount: "77.07",
      currency: "USD",
      device_id: "Card-3514030",
      ip_address: "198.51.100.12",
      latitude: "40.7128",
      longitude: "-74.0060",
    });
    setSynthetic(true);
  }

  function loadRiskSample() {
    setForm({
      ...emptyInput(),
      id: "TXN-HHG-001",
      customer_id: "C12382",
      merchant_id: "Binance-Crypto-Exchange",
      amount: "444.00",
      currency: "USD",
      device_id: "Card-21139",
      ip_address: "198.51.100.250",
      latitude: "48.8566",
      longitude: "2.3522",
    });
    setSynthetic(true);
  }

  function sample() {
    loadRiskSample();
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">INGEST → ANALYZE → EXPLAIN</p>
          <h1>Transaction workbench</h1>
          <p className="muted">
            Start an investigation with a single transaction.
          </p>
        </div>
        <Link className="text-link" to="/import">
          Bulk upload instead <ArrowUpRight size={15} />
        </Link>
      </div>
      {!admin ? (
        <div className="info-banner">
          Transaction ingestion requires an administrator.
        </div>
      ) : (
        <>
          <div className="demo-callout">
            <div className="demo-callout-icon">
              <FlaskConical size={23} />
            </div>
            <div>
              <strong>See the entire detection pipeline in action</strong>
              <p>
                Create 5 baseline transactions and 1 suspicious event.
                Explicitly labeled synthetic data.
              </p>
            </div>
            <button
              className="primary"
              disabled={demo.isPending}
              onClick={() => demo.mutate()}
            >
              <Play size={15} />
              {demo.isPending ? "Evaluating…" : "Run flagged demo"}
            </button>
          </div>
          <ErrorBox error={demo.error} />
          <div className="workbench-grid">
            <form className="panel input-panel" onSubmit={submit}>
              <div className="panel-heading">
                <div>
                  <h2>Transaction input</h2>
                  <p>Validated and persisted before investigation</p>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button type="button" onClick={loadGenuineSample} style={{ fontSize: "11px", padding: "4px 8px" }}>
                    Genuine ($77.07)
                  </button>
                  <button type="button" onClick={loadRiskSample} style={{ fontSize: "11px", padding: "4px 8px", background: "#FEF2F2", color: "#DC2626", borderColor: "#FCA5A5" }}>
                    Risk Alert ($444.00)
                  </button>
                </div>
              </div>
              <div className="form-section">
                <h3>
                  <span>01</span>Transaction & identity
                </h3>
                <div className="form-grid">
                  {field("id", "Transaction ID", "text", true)}
                  {field("customer_id", "Customer ID", "text", true)}
                  {field("merchant_id", "Merchant ID", "text", true)}
                  {field("amount", "Amount", "number", true)}
                  <label>
                    Currency
                    <select
                      value={form.currency}
                      onChange={(e) =>
                        setForm({ ...form, currency: e.target.value })
                      }
                    >
                      <option>USD</option>
                      <option>INR</option>
                      <option>EUR</option>
                      <option>GBP</option>
                    </select>
                  </label>
                  {field(
                    "timestamp",
                    "Event time (your local timezone)",
                    "datetime-local",
                    true,
                  )}
                </div>
              </div>
              <div className="form-section">
                <h3>
                  <span>02</span>Context & location
                </h3>
                <div className="form-grid">
                  {field("device_id", "Device identifier (optional)")}
                  {field("ip_address", "IP address (optional)")}
                  {field("latitude", "Observed latitude", "number")}
                  {field("longitude", "Observed longitude", "number")}
                </div>
                <p className="helper">
                  Use transaction location, not a customer's home address. Omit
                  both coordinates if unknown.
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={synthetic}
                    onChange={(e) => setSynthetic(e.target.checked)}
                  />
                  This is synthetic / test data
                </label>
              </div>
              <div className="form-submit">
                <ErrorBox error={mutation.error} />
                <button className="primary" disabled={mutation.isPending}>
                  <Play size={16} />
                  {mutation.isPending ? "Evaluating…" : "Evaluate transaction"}
                </button>
                <span>Rules + ML → evidence → review</span>
              </div>
            </form>
            <aside>
              <section className="panel payload-preview">
                <h2>
                  <FileJson size={18} />
                  Payload preview
                </h2>
                <p>These fields become a persisted transaction record.</p>
                <pre>
                  {JSON.stringify(
                    {
                      ...form,
                      timestamp: form.timestamp
                        ? new Date(form.timestamp).toISOString()
                        : null,
                    },
                    null,
                    2,
                  )}
                </pre>
              </section>
              <section className="panel workbench-help">
                <span className="eyebrow">WHAT HAPPENS NEXT</span>
                <ol>
                  <li>
                    <b>Independent rules</b>
                    <p>Velocity, amount, travel, device sharing.</p>
                  </li>
                  <li>
                    <b>ML assessment</b>
                    <p>
                      A trained Random Forest produces an advisory output for
                      USD records.
                    </p>
                  </li>
                  <li>
                    <b>Investigation workspace</b>
                    <p>
                      Evidence, React Flow relationships, case review, and a
                      printable report.
                    </p>
                  </li>
                </ol>
                <Link to="/model" className="text-link">
                  Inspect the model <ArrowUpRight size={14} />
                </Link>
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}

interface ModelInfo {
  available: boolean;
  model?: string;
  version?: string;
  dataset?: string;
  dataset_rows?: number;
  positive_count?: number;
  trained_at?: string;
  currency?: string;
  threshold?: number;
  reason?: string;
  test?: {
    rows: number;
    positives: number;
    precision: number;
    recall: number;
    f1: number;
    pr_auc: number;
    roc_auc: number;
    confusion_matrix: number[][];
  };
  split?: Record<
    string,
    { rows: number; positives: number; from: string; to: string }
  >;
  feature_importance?: Record<string, number>;
  limitations?: string[];
}
export function ModelPage() {
  const result = useQuery<ModelInfo>({
    queryKey: ["model"],
    queryFn: () => api("/ml/status"),
  });
  const m = result.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MEASURED, NOT ASSUMED</p>
          <h1>Model intelligence</h1>
          <p className="muted">
            Training provenance, held-out evaluation, and operational
            boundaries.
          </p>
        </div>
        <button onClick={() => window.print()} className="print-button">
          <Printer size={16} />
          Print model report
        </button>
      </div>
      <ErrorBox error={result.error} />
      {result.isLoading ? (
        <Loading />
      ) : !m?.available ? (
        <section className="panel">
          <Empty
            title="Model unavailable"
            body={m?.reason || "Run the documented training command."}
          />
        </section>
      ) : (
        <>
          <div className="model-hero">
            <div className="model-hero-icon">
              <BrainCircuit size={32} />
            </div>
            <div>
              <span className="eyebrow">SUPERVISED MACHINE LEARNING</span>
              <h2>{m.model}</h2>
              <p>
                {m.dataset} · {m.currency} · trained {date(m.trained_at!)}
              </p>
            </div>
            <span className="model-mode">
              <CheckCircle2 size={15} />
              Advisory inference active
            </span>
          </div>
          <div className="info-banner">
            <Info size={17} />
            Synthetic-data baseline. ML output is uncalibrated and does not
            override the deterministic risk score. This is not a GNN.
          </div>
          <div className="metrics">
            {[
              ["Training dataset", m.dataset_rows?.toLocaleString()],
              [
                "Test precision",
                `${((m.test?.precision || 0) * 100).toFixed(1)}%`,
              ],
              ["Test recall", `${((m.test?.recall || 0) * 100).toFixed(1)}%`],
              ["Test PR-AUC", m.test?.pr_auc.toFixed(3)],
            ].map(([name, value]) => (
              <section className="metric" key={name}>
                <div>{name}</div>
                <h2>{value}</h2>
                <small>
                  {name === "Training dataset"
                    ? `${m.positive_count} labeled fraud records`
                    : "Measured on the chronological test holdout"}
                </small>
              </section>
            ))}
          </div>
          <div className="charts-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Chronological evaluation</h2>
                  <p>
                    Train first. Choose the threshold on validation. Evaluate
                    the test set once.
                  </p>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Partition</th>
                      <th>Records</th>
                      <th>Fraud labels</th>
                      <th>Time interval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(m.split || {}).map(([name, s]) => (
                      <tr key={name}>
                        <td className="event-name">{name}</td>
                        <td>{s.rows.toLocaleString()}</td>
                        <td>{s.positives}</td>
                        <td>
                          {date(s.from)} → {date(s.to)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="model-report-footer">
                Decision threshold: {((m.threshold || 0) * 100).toFixed(1)}% ·
                F1: {m.test?.f1.toFixed(3)} · ROC-AUC:{" "}
                {m.test?.roc_auc.toFixed(3)}
                <br />
                Model version: {m.version}
              </div>
            </section>
            <section className="panel feature-panel">
              <h2>Features learned</h2>
              <p className="muted">
                Training feature importance, not per-alert causality.
              </p>
              {Object.entries(m.feature_importance || {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([key, value]) => (
                  <div className="importance" key={key}>
                    <div>
                      <span>{human(key)}</span>
                      <b>{(value * 100).toFixed(1)}%</b>
                    </div>
                    <i style={{ width: `${Math.max(1, value * 100)}%` }} />
                  </div>
                ))}
            </section>
          </div>
          <section className="panel model-notes">
            <h2>Dataset & limitations</h2>
            <ul>
              {m.limitations?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a
              href="/samples/ml-holdout-sample.csv"
              download
              className="primary"
            >
              <Download size={15} />
              Download input sample
            </a>
            <Link to="/input" className="text-link">
              Try a transaction →
            </Link>
          </section>
        </>
      )}
    </>
  );
}
interface Notification {
  id: string;
  transaction_id: string;
  provider: string;
  status: string;
  attempts: number;
  last_error: string | null;
  provider_message_id: string | null;
  created_at: string;
  payload: {
    risk_level: string;
    risk_score: number;
    amount: string;
    currency: string;
    rules: string[];
  };
}
export function NotificationsPage({ admin }: { admin: boolean }) {
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  const query = useQuery<{ items: Notification[]; total: number }>({
    queryKey: ["notifications", page],
    queryFn: () => api(`/notifications?page=${page}`),
  });
  const retry = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/${id}/retry`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries(),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DELIVERY WITH A RECORD</p>
          <h1>Notification center</h1>
          <p className="muted">
            Track high-risk alerts from queue to delivery.
          </p>
        </div>
        <span className="subtle-badge">{query.data?.total || 0} events</span>
      </div>
      <div className="info-banner">
        <Bell size={17} />
        Console mode logs locally. “Local logged” does not mean an email or SMS
        was sent. AWS delivery requires configured SNS or SES.
      </div>
      <ErrorBox error={query.error || retry.error} />
      {query.isLoading ? (
        <Loading />
      ) : query.data?.items.length ? (
        <div className="notification-list">
          {query.data.items.map((n) => (
            <section className="panel notification-card" key={n.id}>
              <div className="notification-icon">
                <Bell size={21} />
              </div>
              <div className="notification-body">
                <div>
                  <Link to={`/transactions/${n.transaction_id}`}>
                    <strong>{n.transaction_id}</strong>
                    <ArrowUpRight size={14} />
                  </Link>
                  <Badge value={n.payload.risk_level} />
                </div>
                <p>
                  {money(n.payload.amount, n.payload.currency)} · Risk{" "}
                  {n.payload.risk_score}/100
                </p>
                <ul>
                  {n.payload.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <small>
                  {date(n.created_at)} · {n.provider.toUpperCase()} ·{" "}
                  {n.attempts} attempts{n.last_error && ` · ${n.last_error}`}
                </small>
                {n.provider_message_id && (
                  <small>Provider message ID: {n.provider_message_id}</small>
                )}
              </div>
              <div className="notification-state">
                <Badge value={n.status} />
                {admin && ["FAILED", "RETRY"].includes(n.status) && (
                  <button
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(n.id)}
                  >
                    <RotateCcw size={14} />
                    Retry
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title="No notifications yet"
            body="A transaction at or above the high-risk threshold queues a notification automatically."
          />
        </section>
      )}
      <div className="pagination">
        <span>Page {page}</span>
        <div>
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <button
            disabled={page * 30 >= (query.data?.total || 0)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
export function CaseDetailPage() {
  const { id } = useParams();
  const query = useQuery<Case>({
    queryKey: ["case", id],
    queryFn: () => api(`/cases/${id}`),
  });
  const users = useQuery<{ id: string; name: string }[]>({
    queryKey: ["users"],
    queryFn: () => api("/users"),
  });
  if (query.isLoading) return <Loading />;
  if (!query.data) return <ErrorBox error={query.error} />;
  return (
    <>
      <div className="case-context">
        <Link to="/cases">← All cases</Link>
        <strong>Case {query.data.id.slice(0, 8)}</strong>
        <Badge value={query.data.status} />
      </div>
      <CaseCard
        key={`${id}-${query.data.version}`}
        item={query.data}
        users={users.data || []}
      />
      <div className="case-investigation">
        <Detail transactionId={query.data.transaction_id} />
      </div>
    </>
  );
}
