"use client";
import { useEffect, useState } from "react";
import { useServerRepository } from "@/lib/storage/use-server-repository";
import { isEntryMap } from "@/lib/storage/local-repository";
import { usePhotos } from "@/lib/storage/use-photos";
import type { Book } from "@/features/shared/types";
import { isChoices, isMilestones, memoryKeys, type MemoryRecord } from "@/features/shared/memory-model";
import { formatDate } from "@/features/shared/format";
import { Status } from "@/features/shared/components";
import { StoryPhoto } from "@/features/story/components/story-controls";
import { dailyIndex, yearsOnThisDay, type Recollection } from "../model";

export function Recollections({ onThisDay = false }: { onThisDay?: boolean }) {
  const choices = useServerRepository<MemoryRecord[]>(memoryKeys.choice, [], isChoices);
  const milestones = useServerRepository<MemoryRecord[]>(memoryKeys.milestone, [], isMilestones);
  const book = useServerRepository<Book>("nossa-historia-tres-diarios-v1", {}, isEntryMap);
  const { photos, error: photoError } = usePhotos();
  const [now, setNow] = useState<Date | null>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => { const update = () => setNow(new Date()); update(); window.addEventListener("focus", update); const timer = setInterval(update, 60_000); return () => { window.removeEventListener("focus", update); clearInterval(timer); }; }, []);
  const pool: Recollection[] = [
    ...choices.value.map((entry) => ({ text: entry.text || "", meta: `${entry.author} · Eu escolho você`, date: entry.date })),
    ...milestones.value.map((entry) => ({ text: [entry.title, entry.text].filter(Boolean).join(": "), meta: "Linha do tempo", date: entry.date })),
    ...Object.entries(book.value).filter(([key]) => key.endsWith("|day") || key.endsWith("|dreams")).flatMap(([key, entries]) => entries.map((entry) => ({ ...entry, meta: `${key.split("|")[0]} · ${key.endsWith("|day") ? "Diário" : "Sonhos"}` }))),
  ].filter((entry) => entry.text);
  const anniversaries = now ? pool.filter((entry) => !entry.meta.endsWith("Sonhos")).flatMap((entry) => { const years = entry.date ? yearsOnThisDay(entry.date, now) : null; return years === null ? [] : [{ ...entry, years }]; }) : [];
  const anniversaryPhotos = now ? photos.filter((photo) => photo.date && yearsOnThisDay(photo.date, now) !== null) : [];
  const fallbackIndex = now ? dailyIndex(pool.length, now) : -1;
  const fallback = pool.length && fallbackIndex >= 0 ? pool[(fallbackIndex + offset) % pool.length] : null;
  return <>
    <Status error={choices.error || milestones.error || book.error || photoError} />
    {onThisDay ? <>
      <div className="on-this-day">{anniversaries.length || anniversaryPhotos.length ? <>
        {anniversaries.map((entry, index) => <div className="memory-card" key={`${entry.date}-${index}`}><div className="meta">há {entry.years} {entry.years === 1 ? "ano" : "anos"} · {entry.date ? formatDate(entry.date) : ""}</div><p className="preserve-lines">{entry.text}</p><div className="sub">{entry.meta}</div></div>)}
        {anniversaryPhotos.map((photo) => <div className="memory-card memory-card-photo" key={photo.id}><div className="meta">há {yearsOnThisDay(photo.date, now!)} ano(s) · {formatDate(photo.date)}</div><StoryPhoto src={photo.url} alt={photo.caption || "Uma memória deste dia"} /><p>{photo.caption}</p></div>)}
      </> : fallback ? <div className="memory-card"><div className="meta">enquanto não chega um aniversário de memória…</div><div className="title">Uma lembrança para hoje</div><p className="preserve-lines">{fallback.text}</p><div className="sub">{fallback.meta}</div></div> : <div className="empty-memory">Ainda não há lembranças de anos anteriores para esta data. Com o tempo, esta página vai começar a surpreender vocês.</div>}</div>
      <button className="memory-action secondary" type="button" onClick={() => { setNow(new Date()); setOffset((current) => current + 1); }}>↻ Procurar outra lembrança</button>
    </> : <div className="remember-oracle"><div className="star">✦</div>{fallback ? <><p className="preserve-lines">“{fallback.text}”</p><small>{fallback.meta}</small></> : <p>Conforme vocês forem guardando memórias, algumas delas vão reaparecer aqui todos os dias.</p>}<small>um pedacinho da nossa história escolhido para hoje</small></div>}
  </>;
}
