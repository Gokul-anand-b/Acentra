let token = sessionStorage.getItem("fraudguard-token");
export function setToken(value: string | null) {
  token = value;
  if (value) sessionStorage.setItem("fraudguard-token", value);
  else sessionStorage.removeItem("fraudguard-token");
}
export function hasToken() {
  return Boolean(token);
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (response.status === 401 && !path.includes("/auth/login")) {
    setToken(null);
    window.dispatchEvent(new Event("session-expired"));
  }
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : JSON.stringify(error.detail),
    );
  }
  return response.json();
}
export function money(value: string | number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}
export function date(value: string) {
  return new Date(
    value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : value + "Z",
  ).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function human(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
