import { isRecord } from "@/lib/storage/local-repository";
import type { Owner } from "./types";

export type MemoryKind = "choice" | "milestone" | "checkin";
export interface MemoryRecord { id: string; author: Owner;writer?:Owner; date: string; text?: string; title?: string; kind?: string; good?: string; better?: string; }
const base = (value: unknown): value is Record<string, unknown> => isRecord(value) && typeof value.id === "string" && ["Ana", "Pedro", "Nós"].includes(value.author as string) && typeof value.date === "string";
export function isChoices(value: unknown): value is MemoryRecord[] { return Array.isArray(value) && value.every((entry) => base(entry) && ["Ana", "Pedro"].includes(entry.author as string) && typeof entry.text === "string"); }
export function isMilestones(value: unknown): value is MemoryRecord[] { return Array.isArray(value) && value.every((entry) => base(entry) && [entry.title, entry.kind, entry.text].every((field) => typeof field === "string")); }
export function isCheckins(value: unknown): value is MemoryRecord[] { return Array.isArray(value) && value.every((entry) => base(entry) && typeof entry.good === "string" && typeof entry.better === "string"); }
export const memoryKeys = { choice: "nh-v3-choice", milestone: "nh-v3-milestone", checkin: "nh-v3-checkin" };
export const memoryValidators = { choice: isChoices, milestone: isMilestones, checkin: isCheckins };
