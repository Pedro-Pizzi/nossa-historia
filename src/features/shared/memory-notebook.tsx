"use client";
import { useEffect, useState } from "react";
import { useServerRepository } from "@/lib/storage/use-server-repository";
import { memoryKeys, memoryValidators, type MemoryKind, type MemoryRecord } from "./memory-model";
import { formatDate, id, today } from "./format";
import { DeleteButton, PersonSelect, Status } from "./components";
import { useCurrentUser } from "@/features/auth/components/user-session";

export function MemoryNotebook({ kind }: { kind: MemoryKind }) {
  const records = useServerRepository<MemoryRecord[]>(memoryKeys[kind], [], memoryValidators[kind]);
  const author = useCurrentUser().name;
  const [text, setText] = useState("");
  const [better, setBetter] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("Uma primeira vez");
  const [message, setMessage] = useState("");
  useEffect(() => setDate(today()), []);
  const ordered = records.value.map((entry, index) => ({ entry, index })).sort((a, b) => kind === "milestone" ? b.entry.date.localeCompare(a.entry.date) : b.index - a.index);
  return <>
    {kind === "choice" ? <div id="choice-random">{records.value.length ? `“${records.value[0].text}”` : "O primeiro motivo que vocês guardarem pode morar aqui. ♡"}</div> : null}
    <form className="memory-form" onSubmit={async (event) => {
      event.preventDefault();
      if (kind === "choice" && !text.trim()) { setMessage("Escreva um motivo, mesmo que seja bem pequeno. ♡"); return; }
      if (kind === "milestone" && (!title.trim() || !text.trim())) { setMessage("Conte qual foi o marco e por que ele importa."); return; }
      if (kind === "checkin" && !text.trim() && !better.trim()) { setMessage("Escreva como vocês estão ou o que gostariam de tentar diferente."); return; }
      const entry: MemoryRecord = { id: id(), author, date: kind === "milestone" ? date : new Date().toISOString(), ...(kind === "checkin" ? { good: text.trim(), better: better.trim() } : { text: text.trim() }), ...(kind === "milestone" ? { title: title.trim(), kind: type } : {}) };
      if (await records.update((current) => [...current, entry])) { setText(""); setBetter(""); setTitle(""); setMessage(kind === "choice" ? "Mais um motivo ficou guardado. ♡" : kind === "milestone" ? "Capítulo guardado. ♡" : "Este recomeço ficou guardado. ♡"); }
    }}>
      <h3>{kind === "choice" ? "Quero guardar mais um motivo…" : kind === "milestone" ? "Acrescentar um momento à nossa linha do tempo" : "Como estamos hoje?"}</h3>
      {kind === "milestone" ? <div className="memory-grid-3"><label>Tipo<select value={type} onChange={(event) => setType(event.target.value)}>{["Uma primeira vez", "Um marco nosso", "Uma conquista", "Algo que superamos", "Uma nova fase"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><PersonSelect value={author} onChange={() => undefined} label="Quem escreve?" /></div> : <PersonSelect value={author} onChange={() => undefined} />}
      {kind === "milestone" ? <label>Qual foi esse momento?<input value={title} onChange={(event) => setTitle(event.target.value)} /></label> : null}
      <div className={kind === "checkin" ? "check-question" : undefined}><label>{kind === "choice" ? "Uma coisa que eu amo, admiro ou que me faz escolher você" : kind === "milestone" ? "Por que isso importa para nós?" : "Como estamos hoje?"}<textarea value={text} onChange={(event) => setText(event.target.value)} /></label></div>
      {kind === "checkin" ? <div className="check-question"><label>Como podemos melhorar e recomeçar?<textarea value={better} onChange={(event) => setBetter(event.target.value)} /></label></div> : null}
      <button className="memory-action" type="submit" disabled={!records.ready || !!records.error}>{kind === "choice" ? "♡ Guardar este motivo" : kind === "milestone" ? "♡ Guardar este marco" : "♡ Guardar este recomeço"}</button><Status error={records.error} message={message} />
    </form>
    {kind === "choice" ? <h3>Motivos que fazem a gente se escolher</h3> : null}
    <div className={kind === "milestone" ? "milestone-grid" : "memory-list"}>{ordered.length ? ordered.map(({ entry, index }) => <div className={kind === "milestone" ? "milestone-card" : "memory-card"} key={`${entry.id}-${index}`}><div className="meta">{kind === "milestone" ? entry.kind : entry.author}{entry.date ? ` · ${formatDate(entry.date)}` : ""}</div>{entry.title ? <div className="title">{entry.title}</div> : null}{entry.text ? <p className="preserve-lines">{entry.text}</p> : null}{entry.good ? <p className="preserve-lines"><strong>Como estávamos:</strong><br />{entry.good}</p> : null}{entry.better ? <p className="preserve-lines"><strong>Como escolhemos recomeçar:</strong><br />{entry.better}</p> : null}{kind === "milestone" ? <div className="sub">guardado por {entry.author}</div> : null}{(!entry.writer || entry.writer===author) ? <DeleteButton onDelete={() => records.update((current) => current.filter((_, i) => i !== index))} /> : null}</div>) : <div className="empty-memory">{kind === "choice" ? "O primeiro motivo pode ser uma qualidade, um gesto, uma mania ou qualquer coisinha que faça você pensar: é você." : kind === "milestone" ? "A história já tem marcos. Agora falta dar nome a eles." : "Quando alguma coisa pesar, este espaço pode ser só uma pausa para entender o que aconteceu e tentar de novo com carinho."}</div>}</div>
  </>;
}
