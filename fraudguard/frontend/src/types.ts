export interface RuleResult {
  rule_name: string;
  triggered: boolean;
  score: number;
  severity: string;
  reason: string;
  evidence: Record<string, unknown>;
  status: string;
  configuration: Record<string, number>;
  configuration_version: number;
}
export interface Assessment {
  raw_score: number;
  normalized_score: number;
  risk_level: string;
  flagged: boolean;
  complete: boolean;
  rules: RuleResult[];
  behavior: Record<string, unknown>;
  graph: Record<string, unknown>;
  scoring: {
    ml?: {
      available: boolean;
      model?: string;
      version?: string;
      score?: number;
      signal?: boolean;
      reason?: string;
    };
    gnn_status: string;
    method: string;
    note: string;
  };
}
export interface Audit {
  id: string;
  actor: string;
  action: string;
  resource_id: string;
  old_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  created_at: string;
}
export interface Transaction {
  id: string;
  customer_id: string;
  merchant_id: string;
  amount: string;
  currency: string;
  timestamp: string;
  device_id: string | null;
  ip_address: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  scenario: string | null;
  status: string;
  version: number;
  assessment: Assessment;
  audit?: Audit[];
  notification?: {
    status: string;
    provider: string;
    attempts: number;
    last_error: string | null;
  } | null;
  case_id?: string | null;
}
export interface Page {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
}
export interface Summary {
  total: number;
  flagged: number;
  pending: number;
  high_risk: number;
  risks: Record<string, number>;
  statuses: Record<string, number>;
  sources: Record<string, number>;
  notifications: Record<string, number>;
}
export interface Rule {
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  parameters: Record<string, number>;
  version: number;
  bounds: Record<string, [number, number]>;
}
export interface Case {
  id: string;
  transaction_id: string;
  status: string;
  assigned_to: string | null;
  version: number;
  notes: { actor: string; note: string; at: string }[];
  transaction: Transaction;
}
export interface User {
  name: string;
  email: string;
  role: string;
}
