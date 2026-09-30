import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal, Check } from "lucide-react";
import { api, human } from "../api";
import { ErrorBox, Loading } from "../components";
import type { Rule } from "../types";
function RuleCard({ rule, admin }: { rule: Rule; admin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [parameters, setParameters] = useState(rule.parameters);
  const [enabled, setEnabled] = useState(rule.enabled);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api(`/rules/${rule.name}`, {
        method: "PUT",
        body: JSON.stringify({ version: rule.version, parameters, enabled }),
      }),
    onSuccess: () => {
      setEditing(false);
      client.invalidateQueries({ queryKey: ["rules"] });
    },
  });
  return (
    <section className="panel rule-card">
      <div className="rule-card-top">
        <span className="rule-icon">
          <SlidersHorizontal size={20} />
        </span>
        <span className={`badge ${rule.enabled ? "low" : "normal"}`}>
          {rule.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
      <h2>{rule.title}</h2>
      <p className="muted">{rule.description}</p>
      <div className="rule-parameters">
        {Object.entries(editing ? parameters : rule.parameters).map(
          ([key, value]) => (
            <label key={key}>
              <span>{human(key)}</span>
              {editing ? (
                <input
                  type="number"
                  step="any"
                  aria-label={`${rule.title} ${key}`}
                  min={rule.bounds[key][0]}
                  max={rule.bounds[key][1]}
                  value={value}
                  onChange={(e) =>
                    setParameters({
                      ...parameters,
                      [key]: Number(e.target.value),
                    })
                  }
                />
              ) : (
                <b>
                  {value}
                  {key === "score" ? " pts" : ""}
                </b>
              )}
            </label>
          ),
        )}
      </div>
      {editing && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enable this rule
        </label>
      )}
      <ErrorBox error={mutation.error} />
      <div className="rule-footer">
        <span>Configuration v{rule.version}</span>
        {admin &&
          (editing ? (
            <div className="button-row">
              <button onClick={() => setEditing(false)}>Cancel</button>
              <button
                className="primary"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                <Check size={14} />
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setParameters(rule.parameters);
                setEnabled(rule.enabled);
                setEditing(true);
              }}
            >
              Configure
            </button>
          ))}
      </div>
    </section>
  );
}
export default function Rules({ admin }: { admin: boolean }) {
  const query = useQuery<Rule[]>({
    queryKey: ["rules"],
    queryFn: () => api("/rules"),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CONFIGURABLE. INDEPENDENT. EXPLAINABLE.</p>
          <h1>Rule engine</h1>
          <p className="muted">
            Tune the signals that drive your review queue.
          </p>
        </div>
        <span className="subtle-badge">
          {query.data?.filter((r) => r.enabled).length || 0} active plugins
        </span>
      </div>
      <div className="info-banner">
        Configuration changes apply to future evaluations. Existing assessments
        preserve the exact rule settings used at ingestion.
      </div>
      <ErrorBox error={query.error} />
      {query.isLoading ? (
        <Loading />
      ) : (
        <div className="rules-grid">
          {query.data?.map((r) => (
            <RuleCard key={r.name} rule={r} admin={admin} />
          ))}
        </div>
      )}
      <div className="panel architecture-note">
        <SlidersHorizontal size={24} />
        <div>
          <h2>Built to extend</h2>
          <p>
            New rules implement the FraudRule interface and register as trusted
            Python plugins. The engine runs each enabled rule without changing
            its evaluation logic.
          </p>
        </div>
      </div>
    </>
  );
}
