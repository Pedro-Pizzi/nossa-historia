"use client";
import { useRef, useState } from "react";

export function LoginForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const password = useRef<HTMLInputElement>(null);
  return <form className="auth-form" onSubmit={async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      if (password.current) password.current.value = "";
      if (response.ok) {
        const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nossa-historia-session") : null;
        channel?.postMessage("changed"); channel?.close(); window.location.replace("/"); return;
      }
      const result = await response.json() as { message?: string };
      setMessage(result.message || "Não foi possível entrar. Tente novamente.");
    } catch { setMessage("Não foi possível conectar. Confira sua conexão e tente novamente."); }
    finally { setPending(false); }
  }}>
    <label htmlFor="username">Usuário</label><input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={80} placeholder="Seu usuário" />
    <label htmlFor="password">Senha</label><input ref={password} id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
    <p className="auth-error" role="alert" aria-live="polite">{message}</p>
    <button type="submit" disabled={pending}>{pending ? "Entrando…" : "Entrar na nossa história"}<span aria-hidden="true"> →</span></button>
  </form>;
}
