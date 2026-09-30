import {
  Database,
  ScanLine,
  BrainCircuit,
  Network,
  UserCheck,
  Bell,
  Check,
} from "lucide-react";
import type { Transaction } from "../types";
export default function Pipeline({
  transaction: t,
}: {
  transaction: Transaction;
}) {
  const ml = t.assessment.scoring.ml;
  const stages = [
    {
      name: "Received",
      detail: "Record persisted",
      icon: Database,
      done: true,
    },
    {
      name: "Rules evaluated",
      detail: `${t.assessment.rules.filter((r) => r.triggered).length} signals · ${t.assessment.normalized_score}/100`,
      icon: ScanLine,
      done: t.assessment.complete,
    },
    {
      name: "ML analysis",
      detail: ml?.available
        ? `${ml.score?.toFixed(1)}% · advisory`
        : ml?.reason || "Not run on this record",
      icon: BrainCircuit,
      done: !!ml?.available,
    },
    {
      name: "Relationships",
      detail: "Explore linked entities",
      icon: Network,
      done: true,
    },
    {
      name: "Human review",
      detail: t.status.replaceAll("_", " ").toLowerCase(),
      icon: UserCheck,
      done: ["REVIEWED", "CLEARED", "CONFIRMED_FRAUD"].includes(t.status),
    },
    {
      name: "Notification",
      detail:
        t.notification?.status?.replaceAll("_", " ").toLowerCase() ||
        "Threshold not reached",
      icon: Bell,
      done: ["LOCAL_LOGGED", "SENT"].includes(t.notification?.status || ""),
    },
  ];
  return (
    <section className="pipeline-strip" aria-label="Investigation pipeline">
      {stages.map((stage, index) => (
        <div
          className={`pipeline-stage ${stage.done ? "complete" : ""}`}
          key={stage.name}
        >
          <div className="stage-top">
            <span className="stage-icon">
              <stage.icon size={17} />
            </span>
            <span className="stage-index">
              {stage.done ? (
                <Check size={13} />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
          </div>
          <strong>{stage.name}</strong>
          <span title={stage.detail}>{stage.detail}</span>
        </div>
      ))}
    </section>
  );
}
