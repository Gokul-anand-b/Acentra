import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, ArrowUpRight } from "lucide-react";
import { api, date, human } from "../api";
import { Badge, Empty, ErrorBox, Loading } from "../components";
import type { Audit, Case } from "../types";
export function AuditPage() {
  const [page, setPage] = useState(1);
  const query = useQuery<Audit[]>({
    queryKey: ["audit", page],
    queryFn: () => api(`/audit?page=${page}`),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE ACCOUNTABILITY LAYER</p>
          <h1>Audit trail</h1>
          <p className="muted">
            A persistent record of ingestion, configuration, and human
            decisions.
          </p>
        </div>
      </div>
      <section className="panel">
        <ErrorBox error={query.error} />
        {query.isLoading ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Resource</th>
                  <th>Actor</th>
                  <th>Details</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="event-name">{human(a.action)}</span>
                    </td>
                    <td className="mono">{a.resource_id}</td>
                    <td>{a.actor}</td>
                    <td>
                      <details>
                        <summary>View change</summary>
                        <pre>
                          {JSON.stringify(
                            { before: a.old_value, after: a.new_value },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </td>
                    <td className="nowrap">{date(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>Page {page}</span>
          <div>
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button
              disabled={(query.data?.length || 0) < 50}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
export function CaseCard({
  item,
  users,
}: {
  item: Case;
  users: { id: string; name: string }[];
}) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(item.status);
  const [assignee, setAssignee] = useState(item.assigned_to || "");
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (nextStatus: string) =>
      api(`/cases/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: item.version,
          status: nextStatus,
          assigned_to: assignee || null,
          note,
        }),
      }),
    onSuccess: () => {
      setNote("");
      client.invalidateQueries();
    },
  });
  const terminal = ["CLOSED", "CLEARED", "CONFIRMED_FRAUD"].includes(
    item.status,
  );
  return (
    <section className="panel case-card">
      <div className="panel-heading">
        <div>
          <h2>
            <Link to={`/cases/${item.id}`}>
              Case {item.id.slice(0, 8)} <ArrowUpRight size={14} />
            </Link>
          </h2>
          <Link
            to={`/transactions/${item.transaction_id}`}
            className="text-link"
          >
            {item.transaction_id}
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <Badge value={item.status} />
      </div>
      <div className="case-body">
        <p>
          {item.transaction.customer_id} · Risk{" "}
          {item.transaction.assessment.normalized_score}/100
        </p>
        {item.notes.map((n, i) => (
          <blockquote key={i}>
            {n.note}
            <small>
              {n.actor} · {date(n.at)}
            </small>
          </blockquote>
        ))}
        {!terminal && (
          <>
            <div className="button-row">
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {["OPEN", "INVESTIGATING", "PENDING_REVIEW"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Assigned reviewer
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option value={u.id} key={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Investigation note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                placeholder="Add supporting findings…"
              />
            </label>
            <button
              className="primary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(status)}
            >
              Save case update
            </button>
          </>
        )}
        {terminal && item.status !== "CLOSED" && (
          <button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("CLOSED")}
          >
            Close resolved case
          </button>
        )}
        <ErrorBox error={mutation.error} />
      </div>
    </section>
  );
}
export function CasesPage() {
  const [page, setPage] = useState(1);
  const query = useQuery<Case[]>({
    queryKey: ["cases", page],
    queryFn: () => api(`/cases?page=${page}`),
  });
  const users = useQuery<{ id: string; name: string }[]>({
    queryKey: ["users"],
    queryFn: () => api("/users"),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FROM ALERT TO RESOLUTION</p>
          <h1>Investigation cases</h1>
          <p className="muted">
            Assign ownership, collect evidence, and document the decision.
          </p>
        </div>
        <Link to="/alerts" className="primary">
          Open alert queue
        </Link>
      </div>
      <ErrorBox error={query.error} />
      {query.isLoading ? (
        <Loading />
      ) : query.data?.length ? (
        <div className="cases-grid">
          {query.data.map((c) => (
            <CaseCard
              key={`${c.id}-${c.version}`}
              item={c}
              users={users.data || []}
            />
          ))}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title="No cases yet"
            body="Escalate a transaction from its investigation page to open a case."
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
            disabled={(query.data?.length || 0) < 50}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
interface ImportReport {
  rows_received: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  processed: number;
  errors: { row: number; error: string }[];
}
export function ImportPage({ admin }: { admin: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState("{}");
  const [synthetic, setSynthetic] = useState(false);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a CSV or JSON file");
      if (file.name.toLowerCase().endsWith(".json")) {
        const rows = JSON.parse(await file.text());
        return api<ImportReport>(`/transactions/bulk?synthetic=${synthetic}`, {
          method: "POST",
          body: JSON.stringify(rows),
        });
      }
      const form = new FormData();
      form.append("file", file);
      form.append("mapping", mapping);
      form.append("synthetic", String(synthetic));
      return api<ImportReport>("/import/csv", { method: "POST", body: form });
    },
    onSuccess: () => client.invalidateQueries(),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">START WITH YOUR DATA</p>
          <h1>Import transactions</h1>
          <p className="muted">
            Validate, evaluate, and persist your transaction records.
          </p>
        </div>
      </div>
      {!admin ? (
        <div className="info-banner">
          Imports require an administrator account.
        </div>
      ) : (
        <div className="import-grid">
          <form className="panel import-form" onSubmit={submit}>
            <div className="panel-heading">
              <h2>
                <Upload size={18} />
                Upload a dataset
              </h2>
            </div>
            <label className="file-drop">
              <FileText size={32} />
              <strong>{file?.name || "Choose a CSV or JSON file"}</strong>
              <span>Up to 2,500 rows · CSV up to 5 MB</span>
              <input
                type="file"
                accept=".csv,.json"
                aria-label="Transaction file"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  mutation.reset();
                }}
                required
              />
            </label>
            <label>
              CSV column mapping <span className="muted">(optional)</span>
              <textarea
                className="mono"
                value={mapping}
                onChange={(e) => setMapping(e.target.value)}
                spellCheck={false}
              />
            </label>
            <p className="helper">
              Map canonical field names to your CSV headers. Leave {"{}"} when
              the headers already match.
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={synthetic}
                onChange={(e) => setSynthetic(e.target.checked)}
              />
              Synthetic / test data
            </label>
            <ErrorBox error={mutation.error} />
            <button className="primary" disabled={!file || mutation.isPending}>
              {mutation.isPending
                ? "Validating & evaluating…"
                : "Import and evaluate"}
              <ArrowUpRight size={16} />
            </button>
          </form>
          <section className="panel import-help">
            <h2>Start with a sample</h2>
            <p className="helper">
              Download a labeled synthetic example, select it on the left, leave
              mapping as {}, and check Synthetic / test data.
            </p>
            <div className="sample-downloads">
              <a href="/samples/transactions.csv" download>
                ↓ Rule demo CSV
              </a>
              <a href="/samples/transactions.json" download>
                ↓ Rule demo JSON
              </a>
              <a href="/samples/ml-holdout-sample.csv" download>
                ↓ ML holdout CSV
              </a>
            </div>
            <h3>A predictable import</h3>
            <ol>
              <li>
                <b>Validate every row</b>
                <p>
                  Amounts, timestamps, coordinates, and required identifiers.
                </p>
              </li>
              <li>
                <b>Preserve event order</b>
                <p>
                  Valid rows are evaluated chronologically within the batch.
                </p>
              </li>
              <li>
                <b>Keep the evidence</b>
                <p>Every assessment is persisted with its rule explanations.</p>
              </li>
            </ol>
            <h3>Required columns</h3>
            <code>id, customer_id, merchant_id, amount, timestamp</code>
            <p className="helper">
              Timestamps must include a timezone. Provide actual transaction
              latitude and longitude for travel checks. Cardholder home
              coordinates cannot establish travel.
            </p>
            <h3>Mapping example</h3>
            <pre>
              {JSON.stringify(
                {
                  id: "trans_num",
                  customer_id: "customer",
                  merchant_id: "merchant",
                  amount: "amt",
                  timestamp: "event_time",
                },
                null,
                2,
              )}
            </pre>
          </section>
        </div>
      )}
      {mutation.data && (
        <section className="panel import-result">
          <h2>Import report</h2>
          <div className="report-stats">
            {["rows_received", "inserted", "duplicates", "invalid"].map((k) => (
              <div key={k}>
                <strong>
                  {mutation.data![k as keyof ImportReport] as number}
                </strong>
                <span>{human(k)}</span>
              </div>
            ))}
          </div>
          {mutation.data.errors.map((e) => (
            <div className="error" key={e.row}>
              Row {e.row}: {e.error}
            </div>
          ))}
          <Link className="text-link" to="/transactions">
            Inspect imported transactions →
          </Link>
        </section>
      )}
    </>
  );
}
