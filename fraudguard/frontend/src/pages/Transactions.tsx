import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight, Download, Cpu } from "lucide-react";
import { api } from "../api";
import { Table, ErrorBox, Loading } from "../components";
import type { Page } from "../types";

export default function Transactions({ alerts = false }: { alerts?: boolean }) {
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("risk");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({
    q: search,
    risk,
    status,
    sort,
    page: String(page),
  });

  const result = useQuery<Page>({
    queryKey: ["transactions", alerts, params.toString()],
    queryFn: () => api(`/${alerts ? "alerts" : "transactions"}?${params}`),
  });

  const change =
    (setter: (s: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };

  const exportData = () => {
    if (!result.data?.items) return;
    const jsonStr = JSON.stringify(result.data.items, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${alerts ? "alerts" : "ledger"}.json`;
    a.click();
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {alerts ? "DETECT → INVESTIGATE" : "THE TRANSACTION LEDGER"}
          </p>
          <h1>{alerts ? "Alert queue" : "Transactions"}</h1>
          <p className="muted">
            {alerts
              ? "Every signal has a story. GraphSAGE GNN & Neo4j graph context enriched."
              : "Every record, its GraphSAGE assessment, and its review status."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={exportData}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Download size={14} /> Export JSON
          </button>
          <span className="subtle-badge">
            {result.data?.total ?? "…"} records
          </span>
        </div>
      </div>
      <section className="panel">
        <div className="filters">
          <div className="search">
            <Search size={17} />
            <input
              aria-label="Search transactions"
              placeholder="Search transaction or customer…"
              value={search}
              onChange={change(setSearch)}
            />
          </div>
          <select
            aria-label="Risk level"
            value={risk}
            onChange={change(setRisk)}
          >
            <option value="">All risk levels</option>
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            aria-label="Review status"
            value={status}
            onChange={change(setStatus)}
          >
            <option value="">All statuses</option>
            {[
              "PENDING",
              "REVIEWED",
              "CLEARED",
              "CONFIRMED_FRAUD",
              "ESCALATED",
              "NORMAL",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select aria-label="Sort" value={sort} onChange={change(setSort)}>
            <option value="risk">Highest risk</option>
            <option value="newest">Newest first</option>
            <option value="amount">Highest amount</option>
          </select>
        </div>
        <ErrorBox error={result.error} />
        {result.isLoading ? (
          <Loading />
        ) : (
          result.data && <Table rows={result.data.items} />
        )}
        <div className="pagination">
          <span>
            Page {page} of{" "}
            {Math.max(1, Math.ceil((result.data?.total || 0) / 20))}
          </span>
          <div>
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={!result.data || page * 20 >= result.data.total}
              onClick={() => setPage(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
