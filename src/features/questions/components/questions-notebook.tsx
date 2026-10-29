"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { Answers, Person, Question, QuestionSection } from "@/features/shared/types";
import { useServerRepository } from "@/lib/storage/use-server-repository";
import { isAnswers, mergeAnswers } from "../model";
import { formatDate } from "@/features/shared/format";
import { DeleteButton, PersonSelect, Status } from "@/features/shared/components";
import { useCurrentUser } from "@/features/auth/components/user-session";

const tabs = [["about", "Sobre mim"], ["childhood", "Infância"], ["school", "Escola"], ["memories", "Lembranças"], ["dreams", "Sonhos"], ["couple", "Sobre nós"]];
export function QuestionsNotebook({ sections, heartIntro }: { sections: QuestionSection[]; heartIntro: { title: string; description: string } }) {
  const author = useCurrentUser().name;
  const [tab, setTab] = useState("about");
  const [message, setMessage] = useState("As respostas ficam guardadas para vocês dois. Cada um escreve como si mesmo; você também pode exportar uma cópia.");
  const [importError, setImportError] = useState("");
  const answers = useServerRepository<Answers>("nossa-historia-descobertas-v1", {}, isAnswers);
  const ids = new Set(sections.flatMap((section) => section.questions.map((question) => question.id)));
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ type: "nossa-historia-descobertas", version: 1, answers: answers.value }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "nosso-diario-de-descobertas.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Escolha um arquivo de respostas de até 5 MB.");
      const imported: unknown = JSON.parse(await file.text());
      if (!imported || typeof imported !== "object" || !("type" in imported) || imported.type !== "nossa-historia-descobertas" || !("answers" in imported)) throw new Error("Escolha um arquivo exportado pelo diário de descobertas.");
      let count = 0;
      if (await answers.update((current) => { const result = mergeAnswers(current, imported.answers, ids, author); count = result.added; return result.answers; })) {
        setMessage(`${count} resposta(s) de ${author} importada(s). Agora estão guardadas para vocês dois ♡`); setImportError("");
      }
    } catch (cause) { setImportError(cause instanceof Error ? cause.message : "Não foi possível importar."); }
  }
  return <>
    <div className="love-person"><PersonSelect value={author} onChange={() => undefined} label="Quem está escrevendo esta página?" /><p className="love-small">Você está escrevendo como {author}. Cada resposta fica identificada para que vocês possam ler um ao outro com carinho.</p></div>
    <nav className="question-tabs" aria-label="Assuntos do diário">{tabs.map(([id, label]) => <button type="button" data-tab={id} key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><span>{label}</span><small>{sections.filter((section) => section.tab === id).reduce((count, section) => count + section.questions.length, 0)} páginas</small></button>)}</nav>
    <div className="love-tools"><button type="button" disabled={!answers.ready || !!answers.error} onClick={download}>↓ Guardar nossas respostas em arquivo</button><label className="love-import">↑ Trazer respostas de outro aparelho<input className="visually-hidden" type="file" accept="application/json,.json" disabled={!answers.ready || !!answers.error} onChange={(event) => { void importFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label></div>
    <Status error={answers.error || importError} message={message} />
    {sections.map((section, index) => <Fragment key={section.title}>{section.heart && !sections[index - 1]?.heart ? <div className="heart-talk" hidden={tab !== "couple"}><h3>{heartIntro.title}</h3><p>{heartIntro.description}</p></div> : null}<div className="love-category" data-question-tab={section.tab} hidden={tab !== section.tab}><h3>{section.title}</h3><p>{section.description}</p><div className="love-question-grid">{section.questions.map((question) => <QuestionCard key={`${question.id}-${author}`} question={question} author={author} entries={answers.value[question.id] || []} ready={answers.ready && !answers.error} onSave={(text) => answers.update((current) => ({ ...current, [question.id]: [...(current[question.id] || []), { author, text, date: new Date().toISOString() }] }))} onDelete={(index) => answers.update((current) => ({ ...current, [question.id]: (current[question.id] || []).filter((_, i) => i !== index) }))} />)}</div></div></Fragment>)}
    <p className="love-small">Você pode pular qualquer pergunta. Respostas antigas ficam guardadas, e você pode acrescentar outras em outro dia.</p>
  </>;
}

function QuestionCard({ question, author, entries, ready, onSave, onDelete }: { question: Question; author: Person; entries: Answers[string]; ready: boolean; onSave: (text: string) => Promise<boolean>; onDelete: (index: number) => unknown }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [draftError, setDraftError] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const key = `love-draft-${author}-${question.id}`;
  useEffect(() => { try { setText(localStorage.getItem(key) || ""); } catch { setDraftError("Não foi possível recuperar o rascunho."); } }, [key]);
  useEffect(() => { if (open) field.current?.focus(); }, [open]);
  function edit(value: string) { setText(value); try { localStorage.setItem(key, value); setDraftError(""); } catch { setDraftError("O rascunho ainda não foi salvo neste navegador."); } }
  return <div className="love-question"><button className="love-question-head" type="button" aria-expanded={open} aria-controls={`love-${question.id}`} onClick={() => setOpen(!open)}><span>♡</span> {question.text}<small>{entries.length ? `${entries.length} resposta(s) guardada(s) ♡` : "Escrever quando quiser ↗"}</small></button>
    <div className="love-answer" id={`love-${question.id}`} hidden={!open}><form onSubmit={async (event) => { event.preventDefault(); if (!text.trim()) { setMessage("Pode escrever depois, sem pressa ♡"); return; } if (await onSave(text.trim())) { edit(""); setMessage("Sua resposta foi guardada ♡"); } }}><label htmlFor={`write-${question.id}`}>{question.label}</label><textarea ref={field} id={`write-${question.id}`} placeholder={question.placeholder} value={text} onChange={(event) => edit(event.target.value)} /><button className="save" type="submit" disabled={!ready}>Guardar minha resposta ♡</button><Status error={draftError} message={message} /></form>
      <div className="love-history">{entries.map((entry, index) => <div key={`${entry.date}-${index}`}><div className="meta">{entry.author} · {formatDate(entry.date)}</div><p className="preserve-lines">{entry.text}</p>{entry.author === author ? <DeleteButton onDelete={() => onDelete(index)}>Apagar esta resposta</DeleteButton> : null}</div>)}</div>
    </div>
  </div>;
}
