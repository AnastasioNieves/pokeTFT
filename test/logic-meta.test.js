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
    itemCount: 2,
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

const TEAM = [
  { name: "RHYDON", items: [] },
  { name: "LICKILICKY", items: ["ABILITY_SHIELD"] },
  { name: "AMBIPOM", items: [] },
  { name: "GABITE", items: ["GREEN_ORB"] },
  { name: "URSARING", items: ["DUSK_STONE", "FLAME_ORB"] },
  { name: "MIGHTYENA", items: [] },
  { name: "ABRA", items: [] },
  { name: "NOPE", items: [] },
];

function cellsOf(entries) {
  const cells = new Array(24).fill(null);
  Object.entries(entries).forEach(([i, name]) => {
    cells[Number(i)] = name;
  });
  return cells;
}

test("suggestBoard aplica las reglas de colocación", () => {
  const s = L.suggestBoard(TEAM, pokedex);
  assert.deepEqual(
    s.cells,
    cellsOf({ 2: "RHYDON", 3: "GABITE", 4: "LICKILICKY", 5: "AMBIPOM", 16: "URSARING", 19: "ABRA", 23: "MIGHTYENA" })
  );
  assert.deepEqual(s.reasons, {
    RHYDON: ["melee"],
    LICKILICKY: ["melee", "row_aura:ABILITY_SHIELD"],
    AMBIPOM: ["melee"],
    GABITE: ["melee", "around_aura:GREEN_ORB"],
    URSARING: ["dark_stone"],
    MIGHTYENA: ["dark"],
    ABRA: ["ranged"],
  });
  assert.deepEqual(s.auras, { LICKILICKY: "row", GABITE: "around" });
  assert.equal(L.BOARD_SIZE, 24);
});

test("suggestBoard manda a la fila del medio lo que no cabe", () => {
  const names = ["RATTATA", "RATICATE", "LICKITUNG", "RHYHORN", "RHYDON", "AIPOM", "TEDDIURSA", "URSARING", "GIBLE"];
  const s = L.suggestBoard(names.map((name) => ({ name, items: [] })), pokedex);
  assert.equal(s.cells.slice(0, 8).filter(Boolean).length, 8);
  assert.equal(s.cells[11], "RATTATA");
  assert.deepEqual(s.reasons.RATTATA, ["melee", "overflow"]);
});

test("mergeBoard respeta lo guardado válido y completa con la sugerencia", () => {
  const m = L.mergeBoard({ RHYDON: 0, ABRA: 21, NOPE: 5, MIGHTYENA: 99 }, TEAM, pokedex);
  assert.deepEqual(
    m.cells,
    cellsOf({ 0: "RHYDON", 3: "GABITE", 4: "LICKILICKY", 5: "AMBIPOM", 16: "URSARING", 21: "ABRA", 23: "MIGHTYENA" })
  );
  assert.equal(m.suggested[2], "RHYDON");
  assert.deepEqual(m.auras, { LICKILICKY: "row", GABITE: "around" });
  assert.deepEqual(L.mergeBoard(undefined, TEAM, pokedex).cells, L.suggestBoard(TEAM, pokedex).cells);
});

test("mergeBoard mueve a la casilla libre más cercana si la sugerida está ocupada", () => {
  const m = L.mergeBoard({ AMBIPOM: 3 }, TEAM, pokedex);
  assert.equal(m.cells[2], "RHYDON");
  assert.equal(m.cells[3], "AMBIPOM");
  assert.equal(m.cells[4], "GABITE");
  assert.equal(m.cells[5], "LICKILICKY");
});

test("moveUnit intercambia sin modificar el original", () => {
  const cells = cellsOf({ 0: "A", 1: "B" });
  const moved = L.moveUnit(cells, 0, 1);
  assert.equal(moved[0], "B");
  assert.equal(moved[1], "A");
  assert.equal(cells[0], "A");
  const toEmpty = L.moveUnit(cells, 0, 9);
  assert.equal(toEmpty[0], null);
  assert.equal(toEmpty[9], "A");
});

test("boardToSaved guarda la casilla de cada Pokémon", () => {
  assert.deepEqual(L.boardToSaved(cellsOf({ 3: "A", 20: "B" })), { A: 3, B: 20 });
});

test("auraCells devuelve las casillas afectadas", () => {
  assert.deepEqual(L.auraCells(4, "row"), [3, 5]);
  assert.deepEqual(L.auraCells(0, "row"), [1]);
  assert.deepEqual(L.auraCells(3, "around"), [2, 4, 10, 11, 12]);
  assert.deepEqual(L.auraCells(11, "around"), [2, 3, 4, 10, 12, 18, 19, 20]);
});

test("compKey usa las familias del núcleo", () => {
  assert.equal(L.compKey(comps[0]), "AIPOM+POOCHYENA+TEDDIURSA");
  assert.equal(L.compKey(comps[1]), "GIBLE+RHYHORN");
  assert.equal(L.compKey({ id: "x", units: [{ name: "A", family: "A", frequency: 0.1, items: [] }] }), "comp-x");
});

const { families } = L.buildPokedex(L.parseCsv(fixture("pokedex.csv")));
const tEs = L.makeTranslator({ synergy: { WILD: "Salvaje", DARK: "Siniestro", GROUND: "Tierra" } });

test("normalizeComp guarda objetos de la compo y equipos reales", () => {
  const raw = {
    cluster_id: "7",
    count: 60,
    winrate: 30,
    mean_rank: 3,
    synergies: { wild: 2 },
    mean_items: [{ item: "DUSK_STONE", frequency: 0.15 }, { frequency: 0.1 }],
    top_teams: [
      { rank: 1, elo: 1200, pokemons: [{ name: "URSARING", items: ["FLAME_ORB"] }, { name: "NOPE", items: [] }] },
      { rank: 2, elo: 900, pokemons: [{ name: "NOPE", items: [] }] },
    ],
    mean_team: { pokemons: { URSARING: { frequency: 1, mean_items: 2.5, items: ["FLAME_ORB"] } } },
  };
  const comp = L.normalizeComp(raw, pokedex);
  assert.equal(comp.units[0].itemCount, 2.5);
  assert.deepEqual(comp.items, [{ item: "DUSK_STONE", frequency: 0.15 }]);
  assert.deepEqual(comp.topTeams, [{ rank: 1, elo: 1200, units: [{ name: "URSARING", items: ["FLAME_ORB"] }] }]);
  assert.deepEqual(comps[0].items, []);
  assert.deepEqual(comps[0].topTeams, []);
});

test("compTier agrupa por puesto medio", () => {
  assert.equal(L.compTier({ meanRank: 2.2 }), "S");
  assert.equal(L.compTier({ meanRank: 3.3 }), "S");
  assert.equal(L.compTier({ meanRank: 3.5 }), "A");
  assert.equal(L.compTier({ meanRank: 4.0 }), "B");
  assert.equal(L.compTier({ meanRank: 4.5 }), "C");
});

test("compCarries y compName usan las unidades con más objetos", () => {
  const comp = {
    id: "x",
    synergies: { WILD: 9, DARK: 3 },
    units: [
      { name: "MIGHTYENA", family: "POOCHYENA", frequency: 0.8, items: [], itemCount: 1 },
      { name: "URSARING", family: "TEDDIURSA", frequency: 0.6, items: [], itemCount: 2.5 },
      { name: "AMBIPOM", family: "AIPOM", frequency: 0.5, items: [], itemCount: 0.2 },
    ],
  };
  assert.deepEqual(L.compCarries(comp).map((u) => u.name), ["URSARING", "MIGHTYENA"]);
  assert.deepEqual(L.compCarries(comp, 1).map((u) => u.name), ["URSARING"]);
  assert.equal(L.compName(comp, L.makeTranslator({ pkm: { URSARING: "Ursaring" }, synergy: { WILD: "Salvaje" } })), "Ursaring Salvaje");
  const noItems = { ...comp, units: comp.units.map((u) => ({ ...u, itemCount: 0 })) };
  assert.deepEqual(L.compCarries(noItems).map((u) => u.name), ["MIGHTYENA"]);
});

test("synergyLevel da bronce, plata u oro", () => {
  assert.equal(L.synergyLevel(1, [2, 4, 6, 9]), 0);
  assert.equal(L.synergyLevel(2, [2, 4, 6, 9]), 1);
  assert.equal(L.synergyLevel(4, [2, 4, 6, 9]), 2);
  assert.equal(L.synergyLevel(6, [2, 4, 6, 9]), 2);
  assert.equal(L.synergyLevel(9, [2, 4, 6, 9]), 3);
  assert.equal(L.synergyLevel(3, [3, 5, 7]), 1);
  assert.equal(L.synergyLevel(5, [3, 5, 7]), 2);
  assert.equal(L.synergyLevel(7, [3, 5, 7]), 3);
  assert.equal(L.synergyLevel(4, []), 0);
});

test("stageGroups reparte la primera etapa por rareza", () => {
  assert.deepEqual(L.stageGroups(comps[0], pokedex, families), {
    early: ["AIPOM", "RATTATA"],
    mid: ["POOCHYENA"],
    late: ["TEDDIURSA"],
  });
});

test("playTip explica cómo empezar y el objetivo", () => {
  assert.equal(
    L.playTip(comps[0], triggers, tEs),
    "Consigue 2 de Salvaje pronto para activarla. Objetivo: Salvaje 9 + Siniestro 3."
  );
  assert.equal(L.playTip({ synergies: {} }, triggers, tEs), "");
});

test("filterComps filtra por Pokémon y por sinergias", () => {
  const t = L.makeTranslator();
  const ids = (list) => list.map((c) => c.id);
  assert.deepEqual(ids(L.filterComps(comps, {}, families, t)), ["1", "2"]);
  assert.deepEqual(ids(L.filterComps(comps, { query: "poochy" }, families, t)), ["1"]);
  assert.deepEqual(ids(L.filterComps(comps, { query: "URSA" }, families, t)), ["1", "2"]);
  assert.deepEqual(ids(L.filterComps(comps, { synergies: new Set(["GROUND"]) }, families, t)), ["2"]);
  assert.deepEqual(ids(L.filterComps(comps, { synergies: new Set(["GROUND", "WILD"]) }, families, t)), []);
});

test("cleanText traduce los términos del juego", () => {
  const i18n = { stat: { SPEED: "Velocidad", ATK: "Ataque" }, technical_terms: { ADJACENT_IN_THE_SAME_ROW: "adyacentes en la misma fila" } };
  assert.equal(
    L.cleanText("Gana +20 SPEED y [25,LK]% de ATK con aliados ADJACENT_IN_THE_SAME_ROW. {{additionalInfo}}", i18n),
    "Gana +20 velocidad y 25% de ataque con aliados adyacentes en la misma fila."
  );
  assert.equal(L.cleanText("Dura [3,5,7,10] s y aplica KO", i18n), "Dura 3/5/7/10 s y aplica KO");
  assert.equal(L.cleanText(undefined, i18n), "");
});

test("itemTierList e itemTier ordenan los objetos", () => {
  const list = L.itemTierList([
    { name: "A", rank: 3.9, count: 500, pokemons: [] },
    { name: "B", rank: 3.4, count: 300, pokemons: ["X"] },
    { name: "C", rank: 2.0, count: 10, pokemons: [] },
  ]);
  assert.deepEqual(list.map((x) => x.name), ["B", "A"]);
  assert.equal(L.itemTierList([{ name: "C", rank: 2, count: 10, pokemons: [] }], 5).length, 1);
  assert.equal(L.itemTier(3.4), "S");
  assert.equal(L.itemTier(3.7), "A");
  assert.equal(L.itemTier(4.0), "B");
  assert.equal(L.itemTier(4.5), "C");
});

test("normalizeComps da una clave única a compos con el mismo núcleo", () => {
  const same = (id) => ({
    cluster_id: id,
    count: 60,
    winrate: 10,
    mean_rank: 4,
    synergies: { wild: 2 },
    mean_team: { pokemons: { MIGHTYENA: { frequency: 0.9, items: [] } } },
  });
  const list = L.normalizeComps([same("a"), same("b"), JSON.parse(fixture("comps.json"))[1]], pokedex);
  assert.deepEqual(list.map((c) => L.compKey(c)), ["POOCHYENA~a", "POOCHYENA~b", "GIBLE+RHYHORN"]);
});

test("compNames desambigua nombres repetidos", () => {
  const unit = { name: "URSARING", family: "TEDDIURSA", frequency: 1, items: [], itemCount: 2 };
  const mk = (id, synergies) => ({ id, synergies, units: [unit] });
  const t = L.makeTranslator();
  const names = L.compNames([mk("a", { WILD: 9, DARK: 3 }), mk("b", { WILD: 9, GROUND: 2 }), mk("c", { WILD: 6, DARK: 3 }), mk("d", { FIRE: 2 })], t);
  assert.deepEqual(names, {
    a: "Ursaring Wild · Dark (a)",
    b: "Ursaring Wild · Ground",
    c: "Ursaring Wild · Dark (c)",
    d: "Ursaring Fire",
  });
});

test("cleanText traduce climas y nombres de objeto", () => {
  const i18n = { weather: { SANDSTORM: "Tormenta de Arena" }, item: { WONDER_BOX: "Caja Maravilla" } };
  assert.equal(L.cleanText("Con SANDSTORM, da una WONDER_BOX", i18n), "Con tormenta de arena, da una Caja Maravilla");
});
