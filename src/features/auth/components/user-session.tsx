"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Person } from "@/features/shared/types";

export interface PublicUser { id: "ana" | "pedro"; name: Person; }
const UserContext = createContext<PublicUser | null>(null);
export function useCurrentUser() { const user = useContext(UserContext); if (!user) throw new Error("Esta página exige uma sessão."); return user; }

export function UserSession({ user, children }: { user: PublicUser; children: ReactNode }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let active = true, checking = false;
    const controller = new AbortController();
    async function check() {
      if (checking || !active) return;
      checking = true;
      try {
        const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (!active) return;
        if (response.status === 401) { document.documentElement.dataset.sessionHidden = "true"; window.location.replace("/login"); return; }
        if (!response.ok) throw new Error("Sessão indisponível");
        const current = await response.json() as PublicUser;
        if (current.id !== user.id) { document.documentElement.dataset.sessionHidden = "true"; window.location.replace("/"); return; }
        delete document.documentElement.dataset.sessionHidden;
        setOffline(false);
      } catch { if (active) { document.documentElement.dataset.sessionHidden = "true"; setOffline(true); } }
      finally { checking = false; }
    }
    const hide = () => { document.documentElement.dataset.sessionHidden = "true"; };
    const show = () => { void check(); };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nossa-historia-session") : null;
    if (channel) channel.onmessage = () => { hide(); void check(); };
    void check();
    window.addEventListener("focus", show); window.addEventListener("online", show); window.addEventListener("pageshow", show); window.addEventListener("pagehide", hide);
    const timer = setInterval(show, 60_000);
    return () => { active = false; controller.abort(); clearInterval(timer); channel?.close(); window.removeEventListener("focus", show); window.removeEventListener("online", show); window.removeEventListener("pageshow", show); window.removeEventListener("pagehide", hide); delete document.documentElement.dataset.sessionHidden; };
  }, [user.id]);
  return <UserContext.Provider value={user}>{offline ? <main className="auth-unavailable"><h1>Vamos reconectar?</h1><p>Não foi possível confirmar seu acesso. Confira a conexão e tente novamente.</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></main> : null}<div className="auth-private-content" aria-hidden={offline || undefined}>{children}</div></UserContext.Provider>;
}

export function AccountMenu() {
  const user = useCurrentUser();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div className="account-menu"><span>{user.name}</span><button type="button" disabled={pending} onClick={async () => {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Logout indisponível");
      document.documentElement.dataset.sessionHidden = "true";
      const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nossa-historia-session") : null;
      channel?.postMessage("changed"); channel?.close(); window.location.replace("/login");
    } catch { setError("Não foi possível sair. Tente novamente."); setPending(false); }
  }}>{pending ? "Saindo…" : "Sair"}</button>{error ? <span role="alert" className="account-error">{error}</span> : null}</div>;
}
