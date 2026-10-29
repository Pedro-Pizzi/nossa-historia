import type { Answer, Answers, Person } from "@/features/shared/types";
import { isEntry, isRecord } from "@/lib/storage/local-repository";

export function isAnswer(value: unknown): value is Answer {
  return isRecord(value) && (value.author === "Ana" || value.author === "Pedro") && isEntry(value);
}
export function isAnswers(value: unknown): value is Answers {
  return isRecord(value) && Object.values(value).every((entries) => Array.isArray(entries) && entries.every(isAnswer));
}
export function mergeAnswers(current: Answers, incoming: unknown, validIds: Set<string>, author?: Person): { answers: Answers; added: number } {
  if (!isRecord(incoming)) throw new Error("Arquivo não reconhecido.");
  const answers = structuredClone(current);
  let added = 0;
  for (const [id, entries] of Object.entries(incoming)) {
    if (!validIds.has(id) || !Array.isArray(entries)) continue;
    const result = answers[id] || [];
    for (const entry of entries) {
      if (!isAnswer(entry) || (author && entry.author !== author) || Number.isNaN(Date.parse(entry.date))) continue;
      if (!result.some((old) => old.author === entry.author && old.date === entry.date && old.text === entry.text)) {
        result.push({ author: entry.author, date: entry.date, text: entry.text }); added++;
      }
    }
    answers[id] = result;
  }
  return { answers, added };
}
