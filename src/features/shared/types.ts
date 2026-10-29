export type Person = "Ana" | "Pedro";
export type Owner = Person | "Nós";
export interface Entry { id?:string;author?:Person;writer?:Person;text: string; date: string; }
export type Book = Record<string, Entry[]>;
export type OwnerIcons = Record<Owner, string>;
export interface Question { id: string; text: string; label: string; placeholder: string; }
export interface QuestionSection { tab: string; title: string; description: string; heart: boolean; questions: Question[]; }
export interface Answer extends Entry { author: Person; }
export type Answers = Record<string, Answer[]>;
export interface Letter { id?:string;from: Person; to: Person; title: string; body: string; date: string; }
export interface Choice extends Entry { id: string; author: Person; }
export interface Milestone { id: string; author: Owner; kind: string; date: string; title: string; text: string; }
export interface Checkin { id: string; author: Owner; date: string; good: string; better: string; }
export type DateIdea = [string, string, string];
export interface SavedPhoto { id: number; blob: Blob; caption: string; date: string; created: string; }
