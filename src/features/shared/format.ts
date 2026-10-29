export function formatDate(value: string) {
  const date = new Date(value.length === 10 ? value + "T12:00:00" : value);
  return Number.isNaN(date.getTime()) ? "Data não informada" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
export function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
export function id() { return crypto.randomUUID(); }
