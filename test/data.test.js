const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("./helpers.js");
require("../src/logic.js");
const D = require("../src/data.js");

const HOUR = 60 * 60 * 1000;
const rawComps = JSON.parse(fixture("comps.json")).map((c) => ({ ...c, hull: [1, 2, 3], x: 5 }));
const bodies = {
  comps: rawComps,
  metadata: [{ created_at: "2026-10-15T05:47:55.018257", count: 100000 }],
  triggers: JSON.parse(fixture("triggers.json")),
  pokedex: fixture("pokedex.csv"),
  i18n: { pkm: { MIGHTYENA: "Mightyena" }, item: { DUSK_STONE: "Piedra Noche" }, synergy: { WILD: "Salvaje" }, other: { x: 1 } },
  items: [
    {
      tier: "LEVEL_BALL",
      items: {
        DUSK_STONE: { name: "DUSK_STONE", rank: 3.4, count: 500, pokemons: ["URSARING", "A", "B", "C"], count_history: [1] },
        RARE_THING: { name: "RARE_THING", rank: 2, count: 10, pokemons: [] },
      },
    },
    { tier: "NET_BALL", items: {} },
  ],
};

function fakeFetch(opts) {
  const calls = [];
  const fn = (url) => {
    calls.push(url);
    if (opts && opts.fail) return Promise.reject(new Error("offline"));
    const src = D.SOURCES.find((s) => s.url === url);
    const body = bodies[src.key];
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(JSON.parse(JSON.stringify(body))),
      text: () => Promise.resolve(body),
    });
  };
  fn.calls = calls;
  return fn;
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    keys: () => Array.from(map.keys()).sort(),
  };
}

test("primera carga descarga las 6 fuentes y construye el Dataset", async () => {
  const fetch = fakeFetch();
  const storage = memoryStorage();
  const ds = await D.createLoader({ fetch, storage, now: () => 0 }).load();
  assert.equal(fetch.calls.length, 6);
  assert.equal(ds.reportDate, "2026-10-15");
  assert.equal(ds.stale, false);
  assert.deepEqual(ds.comps.map((c) => c.id), ["1", "2"]);
  assert.equal(ds.pokedex.MIGHTYENA.family, "POOCHYENA");
  assert.deepEqual(ds.families.POOCHYENA, ["POOCHYENA", "MIGHTYENA"]);
  assert.deepEqual(ds.triggers.WILD, [2, 4, 6, 9]);
  assert.equal(ds.t.synergy("WILD"), "Salvaje");
  assert.equal(ds.t.item("FLAME_ORB"), "Flame Orb");
  assert.deepEqual(storage.keys(), [
    "pac.cache.v2.comps",
    "pac.cache.v2.i18n",
    "pac.cache.v2.items",
    "pac.cache.v2.metadata",
    "pac.cache.v2.pokedex",
    "pac.cache.v2.triggers",
  ]);
  assert.deepEqual(ds.itemStats, [{ name: "DUSK_STONE", rank: 3.4, count: 500, pokemons: ["URSARING", "A", "B"] }]);
});

test("la caché recorta campos que no se usan", async () => {
  const storage = memoryStorage();
  await D.createLoader({ fetch: fakeFetch(), storage, now: () => 0 }).load();
  const comps = JSON.parse(storage.getItem("pac.cache.v2.comps")).body;
  assert.equal(comps[0].hull, undefined);
  assert.equal(comps[0].x, undefined);
  assert.equal(comps[0].cluster_id, "1");
  const i18n = JSON.parse(storage.getItem("pac.cache.v2.i18n")).body;
  assert.deepEqual(Object.keys(i18n).sort(), [
    "damage",
    "item",
    "item_description",
    "pkm",
    "stat",
    "status",
    "synergy",
    "technical_terms",
    "weather",
  ]);
  assert.deepEqual(comps[0].top_teams, []);
  assert.deepEqual(comps[0].mean_items, []);
});

test("antes de 24 h usa la caché sin descargar", async () => {
  const storage = memoryStorage();
  await D.createLoader({ fetch: fakeFetch(), storage, now: () => 0 }).load();
  const fetch2 = fakeFetch({ fail: true });
  const ds = await D.createLoader({ fetch: fetch2, storage, now: () => 23 * HOUR }).load();
  assert.equal(fetch2.calls.length, 0);
  assert.equal(ds.stale, false);
  assert.deepEqual(ds.comps.map((c) => c.id), ["1", "2"]);
});

test("force descarga aunque la caché sea reciente", async () => {
  const storage = memoryStorage();
  await D.createLoader({ fetch: fakeFetch(), storage, now: () => 0 }).load();
  const fetch2 = fakeFetch();
  await D.createLoader({ fetch: fetch2, storage, now: () => HOUR }).load({ force: true });
  assert.equal(fetch2.calls.length, 6);
});

test("sin conexión y con caché vieja devuelve datos marcados como stale", async () => {
  const storage = memoryStorage();
  await D.createLoader({ fetch: fakeFetch(), storage, now: () => 0 }).load();
  const ds = await D.createLoader({ fetch: fakeFetch({ fail: true }), storage, now: () => 25 * HOUR }).load();
  assert.equal(ds.stale, true);
  assert.deepEqual(ds.comps.map((c) => c.id), ["1", "2"]);
});

test("sin conexión y sin caché falla con DataError", async () => {
  await assert.rejects(
    D.createLoader({ fetch: fakeFetch({ fail: true }), storage: memoryStorage(), now: () => 0 }).load(),
    (err) => err instanceof D.DataError && err.name === "DataError" && typeof err.source === "string"
  );
});

test("una respuesta HTTP de error cuenta como fallo", async () => {
  const fetch = () => Promise.resolve({ ok: false, status: 503 });
  await assert.rejects(
    D.createLoader({ fetch, storage: memoryStorage(), now: () => 0 }).load(),
    (err) => err instanceof D.DataError
  );
});

test("funciona aunque el almacenamiento lance errores", async () => {
  const broken = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("quota");
    },
  };
  const ds = await D.createLoader({ fetch: fakeFetch(), storage: broken, now: () => 0 }).load();
  assert.deepEqual(ds.comps.map((c) => c.id), ["1", "2"]);
  const ds2 = await D.createLoader({ fetch: fakeFetch(), storage: null, now: () => 0 }).load();
  assert.equal(ds2.comps.length, 2);
});

test("un meta sin compos falla como formato inesperado", async () => {
  const fetch = (url) => {
    const src = D.SOURCES.find((s) => s.url === url);
    const body = src.key === "comps" ? { error: "x" } : bodies[src.key];
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(JSON.parse(JSON.stringify(body))),
      text: () => Promise.resolve(body),
    });
  };
  await assert.rejects(
    D.createLoader({ fetch, storage: memoryStorage(), now: () => 0 }).load(),
    (err) => err instanceof D.DataError && err.kind === "format" && err.source === "comps"
  );
});
