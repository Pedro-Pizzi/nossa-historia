"use client";
import { useDraftGuard } from "@/lib/storage/use-draft-guard";

import { useEffect, useRef, useState } from "react";
import { isEntryMap } from "@/lib/storage/local-repository";
import { useServerRepository } from "@/lib/storage/use-server-repository";
import type { Book, Owner, OwnerIcons } from "@/features/shared/types";
import { formatDate } from "@/features/shared/format";
import { DeleteButton, Status } from "@/features/shared/components";
import { useCurrentUser } from "@/features/auth/components/user-session";

const KEY = "nossa-historia-tres-diarios-v1";
const topics = {
  day: { Ana: ["Uma coisa bonita que aconteceu hoje", "Algo que me fez sorrir", "Um detalhe que quero lembrar"], Pedro: ["Uma coisa boa do meu dia", "Algo novo que descobri", "Uma pequena alegria"], Nós: [] },
  dreams: { Ana: ["Um sonho que quero retomar", "Um lugar que desejo conhecer", "Uma coisa que quero aprender"], Pedro: ["Um sonho antigo que ainda me acompanha", "Um projeto que gostaria de realizar", "Uma aventura que quero viver"], Nós: ["Uma viagem que sonhamos fazer", "Uma tradição que podemos criar", "Uma experiência para nossa lista"] },
};
const favorites = { music: "Músicas", books: "Livros", movies: "Filmes e séries", quotes: "Frases" };
type Kind = "day" | "dreams" | "favorites";
type Favorite = keyof typeof favorites;
const favoriteDescriptions = {
  music: ["Uma música de que você gosta — não precisa ter relação com o casal.", "Músicas que lembram um ao outro, momentos ou fases da história de vocês."],
  books: ["Um livro de que você gosta, que marcou você ou que quer conhecer.", "Livros que ganharam algum significado para vocês ou que lembram um ao outro."],
  movies: ["Um filme ou série que você gosta ou quer guardar entre os seus favoritos.", "Filmes e séries que marcaram vocês ou que carregam alguma lembrança do casal."],
  quotes: ["Uma frase que combina com você ou que gostaria de guardar.", "Frases que lembram um ao outro ou dizem alguma coisa sobre a história de vocês."],
};

export function BookNotebook({ kind, icons, favoriteIcons = {} }: { kind: Kind; icons: OwnerIcons; favoriteIcons?: Record<string, string> }) {
  const user = useCurrentUser();
  const [owner, setOwner] = useState<Owner>(user.name);
  const [favorite, setFavorite] = useState<Favorite>("music");
  const book = useServerRepository<Book>(KEY, {}, isEntryMap);
  const area = kind === "favorites" ? `favorites-${favorite}` : kind;
  const entryKey = `${owner}|${area}`;
  const entries = book.value[entryKey] || [];
  const canWrite = owner === user.name || owner === "Nós";
  const label = kind === "day" ? `Diário ${owner === "Ana" ? "da Ana" : "do Pedro"}` : kind === "dreams" ? owner === "Nós" ? "Nossos sonhos" : `Sonhos ${owner === "Ana" ? "da Ana" : "do Pedro"}` : owner === "Nós" ? "Coisas que lembram nós dois" : `Gostos ${owner === "Ana" ? "da Ana" : "do Pedro"}`;
  const title = kind === "day" ? "Querido diário, hoje..." : kind === "dreams" ? owner === "Nós" ? "Os sonhos que queremos viver juntos" : label : favorites[favorite] + (owner === "Nós" ? " que lembram nós dois" : owner === "Ana" ? " da Ana" : " do Pedro");
  const description = kind === "day" ? "Como foi seu dia? Escreva o que quiser, mesmo que sejam só duas linhas." : kind === "dreams" ? owner === "Nós" ? "Os planos, experiências e futuros que queremos construir lado a lado." : "Um sonho pessoal também pode crescer com o apoio de quem ama a gente." : favoriteDescriptions[favorite][owner === "Nós" ? 1 : 0];

  return <>
    <div className="book-tabs" data-for={kind} role="group" aria-label="Caderno de quem?">{(["Ana", "Pedro", ...(kind !== "day" ? ["Nós"] : [])] as Owner[]).map((person) => <button type="button" className={person === owner ? "active" : ""} aria-pressed={person === owner} key={person} onClick={() => setOwner(person)}><span className="icon-medallion"><img alt="" src={icons[person]} /></span><span>{person}</span></button>)}</div>
    <div className="book-top"><strong className="book-owner" data-for={kind}>{label}</strong><small>Sem pressa, sem obrigação. Só o que quiser guardar. ♡</small></div>
    {kind === "favorites" ? <div className="book-nav icon-nav" id="favorite-nav" role="group" aria-label="Tipo de favorito">{Object.entries(favorites).map(([key, name]) => <button type="button" key={key} className={favorite === key ? "active" : ""} aria-pressed={favorite === key} onClick={() => setFavorite(key as Favorite)}>{favoriteIcons[key] ? <span className="icon-medallion"><img alt="" src={favoriteIcons[key]} /></span> : null}<span>{name}</span></button>)}</div> : null}
    {canWrite ? <NotebookEditor key={entryKey} draftKey={`nossa-historia-rascunho-${owner}-${area}`} kind={kind} title={title} description={description} prompts={kind === "favorites" ? [] : topics[kind][owner]} ready={book.ready && !book.error} onSave={(text) => book.update((current) => ({ ...current, [entryKey]: [...(current[entryKey] || []), { text, date: new Date().toISOString() }] }))} /> : <p className="book-help">Você pode ler este caderno com carinho. Para escrever, abra o seu próprio espaço{kind === "day" ? "." : " ou o caderno de vocês dois."}</p>}
    <Status error={book.error} />
    <h3>{kind === "day" ? "Páginas que já escrevemos" : kind === "dreams" ? "Sonhos guardados" : "O que gostamos e o que ganhou significado para nós"}</h3>
    <div id={`book-entries-${kind}`}>{entries.length ? entries.map((entry, index) => <div className="book-entry" key={`${entry.date}-${index}`}><small>{formatDate(entry.date)} · {owner}</small><div className="preserve-lines">{entry.text}</div>{canWrite && (!entry.writer || entry.writer===user.name) ? <DeleteButton onDelete={() => book.update((current) => ({ ...current, [entryKey]: current[entryKey].filter((_, i) => i !== index) }))}>Apagar página</DeleteButton> : null}</div>).reverse() : <p className="book-help">Esta página ainda está em branco. Quando quiser, a primeira lembrança pode começar aqui. ♡</p>}</div>
    {kind === "day" ? <p className="book-help">As páginas ficam guardadas para vocês dois. Cada um escreve no próprio espaço, e ambos podem ler as lembranças com carinho.</p> : null}
  </>;
}

function NotebookEditor({ kind, draftKey, title, description, prompts, ready, onSave }: { kind: Kind; draftKey: string; title: string; description: string; prompts: string[]; ready: boolean; onSave: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [draftError, setDraftError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const draft = useDraftGuard();
  useEffect(() => { try { setText(localStorage.getItem(draftKey) || ""); } catch { setDraftError("Não foi possível recuperar o rascunho."); } }, [draftKey]);
  function edit(value: string) { draft.edit(); setText(value); try { localStorage.setItem(draftKey, value); setDraftError(""); } catch { setDraftError("O rascunho ainda não foi salvo. Mantenha esta página aberta."); } }
  return <form className="book-sheet" onSubmit={async (event) => {
    event.preventDefault();
    if (!text.trim()) { setMessage("Pode escrever quando sentir vontade. ♡"); textarea.current?.focus(); return; }
    const clearDraft = draft.capture();
    if (await onSave(text.trim())) { clearDraft(() => edit("")); setMessage("Página guardada com carinho ♡"); }
  }}>
    <h3>{title}</h3><p>{description}</p>
    <div className="book-prompt">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => { edit(text + (text ? "\n\n" : "") + prompt + "\n"); textarea.current?.focus(); }}>{prompt}</button>)}</div>
    <textarea ref={textarea} id={`book-${kind}-text`} aria-label={kind === "day" ? "Escreva sobre seu dia" : kind === "dreams" ? "Escreva um sonho" : "Escreva a sua indicação"} value={text} onChange={(event) => edit(event.target.value)} placeholder={kind === "day" ? "Querido diário, hoje..." : kind === "dreams" ? "Um sonho que mora em mim é..." : "Título e por que escolheu..."} />
    <button className="book-save" disabled={!ready} type="submit">{kind === "day" ? "♡ Guardar esta página" : kind === "dreams" ? "✧ Guardar este sonho" : "♡ Guardar na estante"}</button>
    <Status error={draftError} message={message} />
  </form>;
}
