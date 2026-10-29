export interface Recollection { text: string; meta: string; date?: string; years?: number; }
export function yearsOnThisDay(value: string, now = new Date()): number | null {
  const date = new Date(value.length === 10 ? value + "T12:00:00" : value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() >= now.getFullYear() || date.getMonth() !== now.getMonth() || date.getDate() !== now.getDate()) return null;
  return now.getFullYear() - date.getFullYear();
}
export function dailyIndex(length: number, date = new Date()) {
  if (length <= 0) return -1;
  return Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`) % length;
}
