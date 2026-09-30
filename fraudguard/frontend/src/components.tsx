import { Link } from "react-router-dom";
import { ArrowUpRight, SearchX, LoaderCircle } from "lucide-react";
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
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Transaction / customer</th>
            <th>Amount</th>
            <th>Risk score</th>
            <th>Signals</th>
            <th>Status</th>
            <th>Occurred</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>
                <Link
                  className="table-id"
                  to={`/transactions/${encodeURIComponent(t.id)}`}
                >
                  {t.id}
                </Link>
                <small>
                  {t.customer_id}
                  {t.source === "synthetic" ? " · Synthetic" : ""}
                </small>
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
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
