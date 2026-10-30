import assert from "node:assert/strict";
import test from "node:test";
import { periods } from "../src/lib/integrations";
import { isOpportunity, potentialClicksFor } from "../src/lib/opportunities";
import { pageKey } from "../src/lib/urls";

test("periods respeta comparación contra período anterior y contra año anterior", () => {
  const previous = periods(28, "previous");
  assert.equal(previous.compare, "previous");
  const start = new Date(`${previous.start}T00:00:00Z`);
  const compareEnd = new Date(`${previous.compareEnd}T00:00:00Z`);
  assert.equal(compareEnd.getTime(), start.getTime() - 86_400_000);

  const year = periods(28, "year");
  assert.equal(year.compare, "year");
  assert.equal(new Date(`${year.compareStart}T00:00:00Z`).getUTCFullYear(), new Date(`${year.start}T00:00:00Z`).getUTCFullYear() - 1);
  assert.equal(new Date(`${year.compareEnd}T00:00:00Z`).getUTCFullYear(), new Date(`${year.end}T00:00:00Z`).getUTCFullYear() - 1);
});

test("pageKey normaliza protocolo, www, slash final y query para cruzar GSC con GA4", () => {
  assert.equal(pageKey("https://www.whalemate.com/en/blog/?utm_source=x"), "/en/blog");
  assert.equal(pageKey("https://whalemate.com/en/blog"), "/en/blog");
  assert.equal(pageKey("/en/blog/"), "/en/blog");
  assert.equal(pageKey("https://whalemate.com"), "/");
  assert.equal(pageKey(""), "");
});

test("la regla de oportunidad es única y descarta posiciones o volumen insuficiente", () => {
  assert.equal(isOpportunity({ impressions: 1_000, ctr: 0.01, position: 5 }), true);
  assert.equal(isOpportunity({ impressions: 10, ctr: 0.01, position: 5 }), false);
  assert.equal(isOpportunity({ impressions: 1_000, ctr: 0.01, position: 1 }), false);
  assert.equal(isOpportunity({ impressions: 1_000, ctr: 0.01, position: 40 }), false);
  assert.ok((potentialClicksFor({ impressions: 1_000, ctr: 0.01, position: 5 }) ?? 0) > 0);
});
