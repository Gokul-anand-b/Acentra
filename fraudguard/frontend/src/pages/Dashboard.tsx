import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  ShieldAlert,
  Clock3,
  CheckCheck,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../api";
import { Table, Loading, ErrorBox } from "../components";
import type { Summary, Page } from "../types";
export default function Dashboard() {
  const summary = useQuery<Summary>({
    queryKey: ["summary"],
    queryFn: () => api("/dashboard/summary"),
  });
  const trends = useQuery<
    { day: string; transactions: number; average_risk: number }[]
  >({ queryKey: ["trends"], queryFn: () => api("/dashboard/trends") });
  const alerts = useQuery<Page>({
    queryKey: ["priority-alerts"],
    queryFn: () => api("/alerts?sort=risk&page_size=5&status=PENDING"),
  });
  if (summary.isLoading) return <Loading />;
  if (!summary.data) return <ErrorBox error={summary.error} />;
  const s = summary.data;
  const synthetic = s.sources.synthetic || 0;
  const metrics = [
    [
      "Transactions evaluated",
      s.total,
      ArrowLeftRight,
      "Across all imported records",
    ],
    [
      "High-risk transactions",
      s.high_risk,
      ShieldAlert,
      "High and critical risk",
    ],
    ["Awaiting review", s.pending, Clock3, "Pending and escalated alerts"],
    [
      "Decisions completed",
      (s.statuses.CLEARED || 0) + (s.statuses.CONFIRMED_FRAUD || 0),
      CheckCheck,
      "Cleared or confirmed fraud",
    ],
  ] as const;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE BIG PICTURE</p>
          <h1>Risk overview</h1>
          <p className="muted">
            Understand activity. Focus on what needs attention.
          </p>
        </div>
        <Link to="/input" className="primary">
          New transaction <ArrowUpRight size={17} />
        </Link>
      </div>
      {synthetic > 0 && (
        <div className="data-banner">
          <span className="tiny-dot" />
          <strong>Demo / Synthetic Data</strong>
          <span>
            {synthetic.toLocaleString()} generated records in this workspace.
            All metrics are calculated from the database.
          </span>
        </div>
      )}
      <div className="metrics">
        {metrics.map(([label, value, Icon, note], i) => (
          <section className="metric" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <h2 className={i === 1 ? "risk-number" : ""}>
              {value.toLocaleString()}
            </h2>
            <small>{note}</small>
          </section>
        ))}
      </div>
      <div className="charts-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Transaction activity</h2>
              <p>Daily transaction volume</p>
            </div>
            <span className="subtle-badge">Latest 30 active days · UTC</span>
          </div>
          <ErrorBox error={trends.error} />
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trends.data || []}
                margin={{ top: 12, right: 20, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#368b74" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#368b74" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 4"
                  vertical={false}
                  stroke="#edf0ed"
                />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => d.slice(5)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#87928c" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#87928c" }}
                />
                <Tooltip />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="transactions"
                  stroke="#28816a"
                  strokeWidth={2.5}
                  fill="url(#fill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel risk-panel">
          <div className="panel-heading">
            <div>
              <h2>Risk distribution</h2>
              <p>Every evaluated transaction</p>
            </div>
          </div>
          <div className="distribution-bar">
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
              <span
                key={r}
                className={r.toLowerCase()}
                style={{ flex: s.risks[r] || 0 }}
              />
            ))}
          </div>
          <div className="distribution-legend">
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
              <div key={r}>
                <span>
                  <i className={`legend-dot ${r.toLowerCase()}`} />
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </span>
                <b>
                  {(s.risks[r] || 0).toLocaleString()}{" "}
                  <small>
                    {s.total
                      ? Math.round(((s.risks[r] || 0) / s.total) * 100)
                      : 0}
                    %
                  </small>
                </b>
              </div>
            ))}
          </div>
          <p className="footnote">
            {s.flagged.toLocaleString()} transactions have a risk signal or
            incomplete evaluation.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Priority queue <span className="count">{s.pending}</span>
            </h2>
            <p>Your highest-risk transactions awaiting a decision</p>
          </div>
          <Link to="/alerts" className="text-link">
            View all alerts <ArrowRight size={16} />
          </Link>
        </div>
        <ErrorBox error={alerts.error} />
        {alerts.data && <Table rows={alerts.data.items} />}
      </section>
      <div className="bottom-note">
        <ShieldAlert size={18} />
        <span>
          <strong>Detection is a starting point.</strong> Open an alert to
          inspect rule evidence, connected entities, and the review history.
        </span>
      </div>
    </>
  );
}
