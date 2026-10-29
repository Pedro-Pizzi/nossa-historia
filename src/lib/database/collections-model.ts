import { createHash } from "node:crypto";
import { z } from "zod";
import type { AccountId } from "../auth/config";

export const collectionKinds = {
  "nossa-historia-tres-diarios-v1": "book", "nossa-historia-descobertas-v1": "answers", "nossa-historia-cartinhas-v1": "letters",
  "nossa-historia-desafios-v1": "flags", "nossa-historia-convites-v1": "notes", "nh-v3-choice": "choice", "nh-v3-milestone": "milestone", "nh-v3-checkin": "checkin",
} as const;
export type CollectionKey = keyof typeof collectionKinds;
export function isCollectionKey(key: string): key is CollectionKey { return Object.hasOwn(collectionKinds,key); }
export class DataError extends Error { constructor(public status: number, message: string) { super(message); } }
const text = z.string().max(20000).refine((value) => value.trim().length > 0);
const date = z.string().max(40).refine((value) => !Number.isNaN(Date.parse(value.length === 10 ? value + "T12:00:00" : value)));
const optionalDate = z.union([z.literal(""),date]);
const schemas = {
  book: z.object({ text, date }), answers: z.object({ text, date }), notes: z.object({ text, date }), choice: z.object({ text, date }),
  letters: z.object({ to: z.enum(["Ana","Pedro"]), title: text.pipe(z.string().max(120)), body: text, date }),
  milestone: z.object({ kind: text.pipe(z.string().max(120)), title: text.pipe(z.string().max(200)), text, date: optionalDate }),
  checkin: z.object({ good: z.string().max(20000), better: z.string().max(20000), date }).refine((entry) => !!(entry.good.trim() || entry.better.trim())),
};
export interface Candidate { id?: string; group: string; data: Record<string,unknown>; declaredAuthor?: string; }
export interface EntryRow { id: string; collection: CollectionKey; group_key: string; author_id: AccountId; data: Record<string,unknown>; original_author: string | null; }
export const personName = (id: AccountId) => id === "ana" ? "Ana" : "Pedro";
export function candidates(key: CollectionKey, value: unknown): Candidate[] {
  const kind = collectionKinds[key];
  if (kind === "flags") return [];
  const grouped = kind === "book" || kind === "answers";
  const groups = grouped ? Object.entries(z.record(z.string(),z.array(z.unknown()).max(5000)).parse(value)) : [["",z.array(z.unknown()).max(5000).parse(value)]] as [string,unknown[]][];
  if (groups.length > 200) throw new DataError(400,"Há grupos demais neste conjunto de registros.");
  const result: Candidate[] = [];
  for (const [group, entries] of groups) {
    if (kind === "book" && (!/^(Ana|Pedro|Nós)\|(day|dreams|favorites-(music|books|movies|quotes))$/.test(group) || group === "Nós|day")) throw new DataError(400,"Caderno não reconhecido.");
    if (kind === "answers" && !/^(d([1-9]|[1-7][0-9]|8[0-4])|c([1-9]|1[0-9]|2[0-2]))$/.test(group)) throw new DataError(400,"Pergunta não reconhecida.");
    for (const entry of entries) {
      const raw = z.record(z.string(),z.unknown()).parse(entry);
      const author = kind === "letters" ? raw.from : raw.author;
      if (author !== undefined && !["Ana","Pedro","Nós"].includes(String(author))) throw new DataError(400,"Autoria inválida.");
      const id = raw.id;
      if (id !== undefined && (typeof id !== "string" || id.length > 100)) throw new DataError(400,"Identificador inválido.");
      result.push({ id: id as string | undefined, group, data: schemas[kind].parse(raw), declaredAuthor: author as string | undefined });
    }
  }
  if (result.length > 5000) throw new DataError(400,"Há registros demais neste conjunto.");
  return result;
}
export function parseFlags(value: unknown) { return z.record(z.string().regex(/^([0-9]|[1-5][0-9])$/),z.boolean()).parse(value); }
export function canWriteGroup(actor: AccountId, key: CollectionKey, group: string) {
  return collectionKinds[key] !== "book" || group.startsWith(personName(actor)+"|") || group.startsWith("Nós|");
}
export function projectedEntry(row: EntryRow) {
  const author = row.original_author || personName(row.author_id);
  return { ...row.data, id: row.id, writer:personName(row.author_id), [collectionKinds[row.collection] === "letters" ? "from" : "author"]: author };
}
export function fingerprint(group: string, data: Record<string,unknown>) {
  const sorted = Object.fromEntries(Object.keys(data).sort().map((key) => [key,data[key]]));
  return createHash("sha256").update(JSON.stringify({ group, data: sorted })).digest("hex");
}
