const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("./helpers.js");
const L = require("../src/logic.js");

const { pokedex } = L.buildPokedex(L.parseCsv(fixture("pokedex.csv")));
const triggers = JSON.parse(fixture("triggers.json"));
const rawComps = JSON.parse(fixture("comps.json"));
const comps = L.normalizeComps(rawComps, pokedex);
const near = (a, b) => Math.abs(a - b) < 1e-4;

test("normalizeComps filtra por count y normaliza", () => {
  assert.deepEqual(comps.map((c) => c.id), ["1", "2"]);
  const c1 = comps[0];
  assert.equal(c1.count, 100);
  assert.equal(c1.winrate, 40);
  assert.equal(c1.meanRank, 2.2);
  assert.deepEqual(Object.keys(c1.synergies), ["WILD", "DARK"]);
  assert.deepEqual(Object.keys(comps[1].synergies), ["GROUND", "DRAGON"]);
  assert.deepEqual(
    c1.units.map((u) => u.name),
    ["MIGHTYENA", "URSARING", "AMBIPOM", "RATICATE", "ALOLAN_RATICATE"]
  );
  assert.deepEqual(c1.units[1], {
    name: "URSARING",
    family: "TEDDIURSA",
    frequency: 0.6,
    items: ["DUSK_STONE", "FLAME_ORB"],
  });
  assert.equal(L.normalizeComps(rawComps, pokedex, { minCount: 0 }).length, 3);
});

test("scoreComp mide la coincidencia ponderada por frecuencia", () => {
  const c1 = comps[0];
  const some = L.scoreComp(c1, new Set(["POOCHYENA"]));
  assert.ok(near(some.match, 0.8 / 2.2));
  assert.deepEqual(some.owned.map((u) => u.name), ["MIGHTYENA"]);
  assert.equal(some.missing.length, 4);
  assert.equal(L.scoreComp(c1, new Set()).match, 0);
  const all = new Set(["POOCHYENA", "TEDDIURSA", "AIPOM", "RATTATA", "ALOLAN_RATTATA"]);
  assert.ok(near(L.scoreComp(c1, all).match, 1));
});

test("rankComps ordena por coincidencia × calidad", () => {
  const ranked = L.rankComps(comps, new Set(["TEDDIURSA"]));
  assert.deepEqual(ranked.map((r) => r.comp.id), ["1", "2"]);
  assert.ok(near(ranked[0].score, (0.6 / 2.2) * (5.8 / 7)));
  assert.ok(near(ranked[1].score, (0.3 / 1.9) * (5 / 7)));

  const none = L.rankComps(comps, new Set());
  assert.equal(none[0].match, 1);
  assert.ok(near(none[0].score, 5.8 / 7));
  assert.equal(L.rankComps(comps, new Set(), { limit: 1 }).length, 1);
});

test("rankComps desempata por número de partidas", () => {
  const base = { winrate: 10, meanRank: 4, synergies: {}, units: [{ name: "X", family: "X", frequency: 1, items: [] }] };
  const a = { ...base, id: "a", count: 10 };
  const b = { ...base, id: "b", count: 20 };
  assert.deepEqual(L.rankComps([a, b], new Set()).map((r) => r.comp.id), ["b", "a"]);
});

test("splitCoreFlex separa por frecuencia", () => {
  const { core, flex } = L.splitCoreFlex(comps[0]);
  assert.deepEqual(core.map((u) => u.name), ["MIGHTYENA", "URSARING", "AMBIPOM"]);
  assert.deepEqual(flex.map((u) => u.name), ["RATICATE"]);
});

test("synergyProgress cuenta familias distintas y el umbral activo", () => {
  const progress = L.synergyProgress(["MIGHTYENA", "POOCHYENA", "URSARING"], pokedex, triggers);
  assert.deepEqual(progress, [
    { type: "WILD", count: 2, thresholds: [2, 4, 6, 9], active: 2 },
    { type: "DARK", count: 1, thresholds: [3, 5, 7], active: 0 },
    { type: "GROUND", count: 1, thresholds: [2, 4, 6, 8], active: 0 },
  ]);
  assert.deepEqual(L.synergyProgress([], pokedex, triggers), []);
});

test("placementHint usa el alcance de ataque", () => {
  assert.equal(L.placementHint("ABRA", pokedex), "back");
  assert.equal(L.placementHint("MIGHTYENA", pokedex), "front");
  assert.equal(L.placementHint("NOPE", pokedex), "front");
});

test("placeBoard rellena cada fila desde el centro", () => {
  const board = L.placeBoard(["MIGHTYENA", "URSARING", "ABRA", "AMBIPOM"], pokedex);
  assert.deepEqual(board.front, [null, null, "AMBIPOM", "MIGHTYENA", "URSARING", null, null, null]);
  assert.deepEqual(board.back, [null, null, null, "ABRA", null, null, null, null]);
});

test("compTitle une las sinergias principales traducidas", () => {
  const t = L.makeTranslator({ synergy: { WILD: "Salvaje", DARK: "Siniestro" } });
  assert.equal(L.compTitle(comps[0], t), "Salvaje · Siniestro");
  assert.equal(L.compTitle(comps[0], t, 1), "Salvaje");
});

test("normalizeComp deja una unidad por familia", () => {
  const raw = {
    cluster_id: "9",
    count: 60,
    winrate: 10,
    mean_rank: 4,
    synergies: { dragon: 3 },
    mean_team: {
      pokemons: {
        GIBLE: { frequency: 0.3, items: [] },
        GABITE: { frequency: 0.7, items: ["WONDER_BOX"] },
        GARCHOMP: { frequency: 0.7, items: ["SOUL_DEW"] },
        RHYDON: { frequency: 0.5, items: [] },
      },
    },
  };
  const comp = L.normalizeComp(raw, pokedex);
  assert.deepEqual(
    comp.units.map((u) => [u.name, u.frequency]),
    [["GARCHOMP", 0.7], ["RHYDON", 0.5]]
  );
  assert.deepEqual(comp.units[0].items, ["SOUL_DEW"]);
});
