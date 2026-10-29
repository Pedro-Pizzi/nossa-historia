"use client";
import type { Owner, Person } from "./types";
import { useCurrentUser } from "@/features/auth/components/user-session";

export function Status({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return <p className={error ? "memory-status storage-error" : "memory-status"} role={error ? "alert" : "status"} aria-live="polite">{error || message || ""}</p>;
}
export function PersonSelect({ value, onChange, together = false, identity = true, label = "Quem está escrevendo?" }: { value: Owner; onChange: (value: Owner) => void; together?: boolean; identity?: boolean; label?: string }) {
  const user = useCurrentUser();
  const options = identity ? [user.name] : (["Ana", "Pedro", ...(together ? ["Nós"] : [])] as (Person | "Nós")[]);
  return <label>{label}<select value={identity ? user.name : value} onChange={(event) => onChange(event.target.value as Owner)}>{options.map((person) => <option key={person} value={person}>{person}</option>)}</select></label>;
}
export function DeleteButton({ onDelete, children = "Apagar" }: { onDelete: () => void; children?: React.ReactNode }) {
  return <button className="memory-delete" type="button" onClick={() => { if (window.confirm("Apagar este registro?")) onDelete(); }}>{children}</button>;
}
