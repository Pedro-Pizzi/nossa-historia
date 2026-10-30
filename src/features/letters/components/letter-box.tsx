"use client";
import { useDraftGuard } from "@/lib/storage/use-draft-guard";
import { useState } from "react";
import { useServerRepository } from "@/lib/storage/use-server-repository";
import { isRecord } from "@/lib/storage/local-repository";
import type { Letter, Person } from "@/features/shared/types";
import { DeleteButton, PersonSelect, Status } from "@/features/shared/components";
import { useCurrentUser } from "@/features/auth/components/user-session";

function isLetters(value: unknown): value is Letter[] {
  return Array.isArray(value) && value.every((entry) => isRecord(entry) && [entry.from, entry.to].every((person) => person === "Ana" || person === "Pedro") && [entry.title, entry.body, entry.date].every((field) => typeof field === "string"));
}
export function LetterBox() {
  const letters = useServerRepository<Letter[]>("nossa-historia-cartinhas-v1", [], isLetters);
  const from = useCurrentUser().name;
  const [to, setTo] = useState<Person>(from === "Ana" ? "Pedro" : "Ana");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const draft = useDraftGuard();
  const [opened, setOpened] = useState<Set<number>>(new Set());
  return <>
    <form className="diary-letter" onChangeCapture={draft.edit} onSubmit={async (event) => { event.preventDefault(); if (!body.trim()) { setMessage("Escreva algumas palavras antes de guardar ♡"); return; } const clearDraft = draft.capture(); if (await letters.update((current) => [...current, { from, to, title: title.trim() || "Um abraço só para você", body: body.trim(), date: new Date().toISOString() }])) { clearDraft(() => { setTitle(""); setBody(""); }); setMessage("Sua cartinha está guardada ♡"); } }}>
      <h3>Uma cartinha guardada especialmente para você</h3><p>Escreva para que o outro encontre estas palavras quando precisar. Pode ser uma declaração, uma lembrança engraçada, um elogio ou um abraço por escrito.</p>
      <div className="letter-fields"><PersonSelect label="Quem escreve?" value={from} onChange={() => undefined} /><PersonSelect identity={false} label="Para quem?" value={to} onChange={(person) => setTo(person as Person)} /></div>
      <label htmlFor="comfort-title">Título da cartinha</label><input id="comfort-title" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Para quando você precisar de um abraço..." />
      <label htmlFor="comfort-text">Suas palavras</label><textarea id="comfort-text" rows={6} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Meu amor, quero te lembrar de uma coisa..." />
      <button className="book-save" type="submit" disabled={!letters.ready || !!letters.error}>♡ Guardar cartinha</button><Status error={letters.error} message={message} />
    </form>
    <h3>Nossas cartas guardadas</h3><p className="book-help">Toque no envelope para abrir quando quiser. As cartas ficam neste navegador e podem ser revisitadas com carinho.</p>
    <div className="comfort-grid">{letters.value.length ? letters.value.map((letter, index) => <div className="comfort-card" key={`${letter.date}-${index}`}><button className="letter-envelope" type="button" aria-expanded={opened.has(index)} aria-controls={`letter-${index}`} onClick={() => setOpened((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })}>{letter.title}<small>De {letter.from} para {letter.to} · toque para abrir ♡</small></button><div id={`letter-${index}`} hidden={!opened.has(index)}><p className="letter-content preserve-lines">{letter.body}</p>{letter.from===from ? <DeleteButton onDelete={async () => { if (await letters.update((current) => current.filter((_, i) => i !== index))) setOpened(new Set()); }}>Apagar cartinha</DeleteButton> : null}</div></div>) : <p className="book-help">Ainda há envelopes em branco esperando as primeiras palavras. ♡</p>}</div>
  </>;
}
