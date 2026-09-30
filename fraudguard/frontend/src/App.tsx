import { useEffect, useState, lazy, Suspense, type FormEvent } from "react";
import {
  NavLink,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  LayoutDashboard,
  ScanLine,
  ArrowLeftRight,
  BriefcaseBusiness,
  SlidersHorizontal,
  History,
  Database,
  LogOut,
  ArrowRight,
  Activity,
  PlusCircle,
  BrainCircuit,
  Bell,
} from "lucide-react";
import { api, hasToken, setToken } from "./api";
import { ErrorBox, Loading } from "./components";
import type { User } from "./types";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Detail = lazy(() => import("./pages/Detail"));
const Rules = lazy(() => import("./pages/Rules"));
import {
  InputPage,
  ModelPage,
  NotificationsPage,
  CaseDetailPage,
} from "./pages/Workbench";
import { AuditPage, CasesPage, ImportPage } from "./pages/Operations";

function Login({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    try {
      const result = await api<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(data)),
      });
      setToken(result.access_token);
      onLogin();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <ShieldCheck />
          <span>
            fraudguard<span className="brand-dot">.</span>
          </span>
        </div>
        <div>
          <p className="eyebrow">RISK OPERATIONS, CONNECTED</p>
          <h1>
            See the signal.
            <br />
            Understand the story.
          </h1>
          <p>A clear path from suspicious activity to an informed decision.</p>
          <div className="login-flow">
            <span>Detect</span>
            <ArrowRight />
            <span>Explain</span>
            <ArrowRight />
            <span>Investigate</span>
          </div>
        </div>
        <p className="muted">Hybrid fraud risk & investigation platform</p>
      </section>
      <section className="login-form">
        <div>
          <p className="eyebrow">YOUR ANALYST WORKSPACE</p>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your fraud operations console.</p>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="analyst@your-team.com"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <ErrorBox error={error} />
            <button className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to workspace"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="helper">
            First time? Create an analyst account using the setup command in the
            README.
          </p>
        </div>
      </section>
    </main>
  );
}
const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/input", "New transaction", PlusCircle],
  ["/alerts", "Alert queue", ScanLine],
  ["/transactions", "Transactions", ArrowLeftRight],
  ["/cases", "Cases", BriefcaseBusiness],
  ["/rules", "Rule engine", SlidersHorizontal],
  ["/model", "Model intelligence", BrainCircuit],
  ["/notifications", "Notifications", Bell],
  ["/audit", "Audit trail", History],
  ["/import", "Data import", Database],
] as const;
export default function App() {
  const [signedIn, setSignedIn] = useState(hasToken());
  const client = useQueryClient();
  const location = useLocation();
  const {
    data: user,
    isLoading,
    error,
  } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api("/auth/me"),
    enabled: signedIn,
    retry: false,
    refetchInterval: false,
  });
  useEffect(() => {
    const expire = () => {
      setSignedIn(false);
      client.clear();
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, [client]);
  function logout() {
    setToken(null);
    setSignedIn(false);
    client.clear();
  }
  if (!signedIn)
    return (
      <Login
        onLogin={() => {
          client.clear();
          setSignedIn(true);
        }}
      />
    );
  if (isLoading) return <Loading />;
  if (!user)
    return (
      <main className="page">
        <ErrorBox error={error} />
        <button onClick={logout}>Return to sign in</button>
      </main>
    );
  const title =
    navigation.find(([path]) => path === location.pathname)?.[1] ||
    "Investigation";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <ShieldCheck size={28} />
          <span>
            fraudguard<span className="brand-dot">.</span>
          </span>
        </NavLink>
        <div className="workspace-label">
          <span className="workspace-icon">F</span>
          <div>
            Risk operations<small>Analyst workspace</small>
          </div>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {navigation.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end={path === "/"}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="system-note">
            <Activity size={17} />
            <div>
              Explainable by design<small>Evidence behind every alert</small>
            </div>
          </div>
          <div className="profile">
            <span className="avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              {user.name}
              <small>{user.role}</small>
            </div>
            <button onClick={logout} title="Sign out" aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="muted">Workspace</span>
            <span className="slash">/</span>
            {title}
          </div>
          <div className="refresh-label">
            <span className="live-dot" />
            Refreshes every 15 seconds
          </div>
        </header>
        <main className="page">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/input"
                element={<InputPage admin={user.role === "admin"} />}
              />
              <Route path="/model" element={<ModelPage />} />
              <Route
                path="/notifications"
                element={<NotificationsPage admin={user.role === "admin"} />}
              />
              <Route path="/cases/:id" element={<CaseDetailPage />} />
              <Route path="/alerts" element={<Transactions alerts />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/transactions/:id" element={<Detail />} />
              <Route
                path="/rules"
                element={<Rules admin={user.role === "admin"} />}
              />
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route
                path="/import"
                element={<ImportPage admin={user.role === "admin"} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <footer className="footer">
          FraudGuard{" "}
          <span>
            Risk scores support human judgment. They are not fraud
            probabilities.
          </span>
        </footer>
      </div>
    </div>
  );
}
