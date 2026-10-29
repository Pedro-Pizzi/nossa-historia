import assert from "node:assert/strict";
import { test } from "node:test";
import { dailyIndex, yearsOnThisDay } from "../src/features/recollections/model";

test("aniversários de memórias comparam dia e mês no calendário local", () => {
  const now = new Date(2026, 9, 25, 12);
  assert.equal(yearsOnThisDay("2023-10-25", now), 3);
  assert.equal(yearsOnThisDay("2026-10-25", now), null);
  assert.equal(yearsOnThisDay("2023-10-24", now), null);
  assert.equal(yearsOnThisDay("data inválida", now), null);
});
test("seleção diária é estável e lida com coleção vazia", () => {
  assert.equal(dailyIndex(0), -1);
  assert.equal(dailyIndex(7, new Date(2026, 9, 25, 0)), dailyIndex(7, new Date(2026, 9, 25, 23)));
  assert.ok(dailyIndex(7, new Date(2026, 9, 26)) !== dailyIndex(7, new Date(2026, 9, 25)));
});
