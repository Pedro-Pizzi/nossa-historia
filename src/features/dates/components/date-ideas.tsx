"use client";
import { useEffect, useState } from "react";
import type { DateIdea, Entry } from "@/features/shared/types";
import { isEntry, isRecord } from "@/lib/storage/local-repository";
import { useServerRepository } from "@/lib/storage/use-server-repository";
import { useCurrentUser } from "@/features/auth/components/user-session";
import { DeleteButton, Status } from "@/features/shared/components";

const filters = { all: "Todas as ideias", home: "Em casa", care: "Carinho", talk: "Conversa", out: "Passeios", surprise: "Surpresas", games: "Jogos", food: "Comidinhas" };
function isCompleted(value: unknown): value is Record<string, boolean> { return isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean"); }
function isNotes(value: unknown): value is Entry[] { return Array.isArray(value) && value.every(isEntry); }
export function DateIdeas({ ideas }: { ideas: DateIdea[] }) {
  const user=useCurrentUser();
  const [filter, setFilter] = useState("all");
  const [drawn, setDrawn] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const completed = useServerRepository<Record<string, boolean>>("nossa-historia-desafios-v1", {}, isCompleted);
  const notes = useServerRepository<Entry[]>("nossa-historia-convites-v1", [], isNotes);
  const visible = ideas.map((idea, index) => ({ idea, index })).filter(({ idea }) => filter === "all" || idea[2] === filter);
  useEffect(() => { if (highlight === null) return; document.getElementById(`challenge-idea-${highlight}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); const timer = setTimeout(() => setHighlight(null), 1800); return () => clearTimeout(timer); }, [highlight]);
  return <>
    <div className="date-draw"><div className="date-draw-copy"><span className="date-draw-kicker">UMA IDEIA PARA HOJE</span><h3>Deixem o acaso escolher</h3><p>Quando faltar uma ideia, o site escolhe um encontro simples para vocês viverem juntos.</p><div id="challenge-draw-result" className="challenge-draw-result" role="status">{drawn !== null ? <><strong>{ideas[drawn][0]}</strong><span>{ideas[drawn][1]}</span><button className="draw-open" type="button" onClick={() => { setFilter("all"); setHighlight(drawn); }}>Ver este convite ↓</button></> : "Uma surpresa pode começar com um toque."}</div></div><button className="date-draw-button" type="button" onClick={() => setDrawn(visible[Math.floor(Math.random() * visible.length)]?.index ?? null)}>Sortear um encontro ✦</button></div>
    <div className="challenge-filters" role="group" aria-label="Categoria de encontro">{Object.entries(filters).map(([key, label]) => <button type="button" data-challenge-filter={key} aria-pressed={key === filter} key={key} onClick={() => { setFilter(key); setDrawn(null); }}>{label}</button>)}</div>
    <Status error={completed.error} />
    <div id="challenge-grid" className="challenge-grid">{visible.map(({ idea, index }) => <div id={`challenge-idea-${index}`} key={index} className={`challenge-card${completed.value[index] ? " done" : ""}${highlight === index ? " draw-highlight" : ""}`}><span className="challenge-type">♡ {filters[idea[2] as keyof typeof filters]} · {String(index + 1).padStart(2, "0")}</span><h3>{idea[0]}</h3><p>{idea[1]}</p><button type="button" aria-pressed={!!completed.value[index]} disabled={!completed.ready || !!completed.error} onClick={() => completed.update((current) => ({ ...current, [index]: !current[index] }))}>{completed.value[index] ? "♡ Já vivemos isso · desfazer" : "♡ Quero viver isso"}</button></div>)}</div>
    <form className="diary-letter" onSubmit={async (event) => { event.preventDefault(); if (!note.trim()) { setMessage("Escrevam a ideia quando quiserem ♡"); return; } if (await notes.update((current) => [...current, { text: note.trim(), date: new Date().toISOString() }])) { setNote(""); setMessage("Convite guardado ♡"); } }}><h3>Uma ideia só nossa</h3><p>Um plano simples que nasceu na cabeça de vocês e merece ficar guardado para outro dia.</p><textarea aria-label="Uma ideia só nossa" value={note} onChange={(event) => setNote(event.target.value)} /><button className="book-save" type="submit" disabled={!notes.ready || !!notes.error}>♡ Guardar nosso convite</button><Status error={notes.error} message={message} /><div>{notes.value.map((entry, index) => <div className="comfort-card" key={`${entry.date}-${index}`}><p className="preserve-lines">{entry.text}</p>{entry.author===user.name ? <DeleteButton onDelete={() => notes.update((current) => current.filter((_, i) => i !== index))}>Apagar convite</DeleteButton> : null}</div>)}</div></form>
  </>;
}
