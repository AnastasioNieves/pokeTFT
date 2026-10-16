# Compañero Auto Chess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una página web local (sin instalación) que, a partir de los Pokémon que el jugador marca a mano, le sugiere compos del meta de Pokémon Auto Chess y le dice qué comprar, qué objetos dar y dónde colocar.

**Architecture:** Archivos estáticos que se abren con doble clic en `index.html`. Hay tres `<script>` clásicos con un objeto global cada uno: `PAC.logic` (funciones puras, probadas con Node), `PAC.data` (descarga y caché, probada con `fetch`/`storage` falsos) y `PAC.ui` (DOM). Un cuarto, `main.js`, arranca la app. Los datos vienen de endpoints públicos con CORS abierto y se guardan 24 h en `localStorage`.

**Tech Stack:** HTML, CSS y JavaScript (ES2020) sin dependencias ni compilación. Pruebas con `node:test` (Node 24, ya instalado).

**Spec:** `docs/superpowers/specs/2026-10-16-companero-auto-chess-design.md`

## Global Constraints

- La app NUNCA lee la pantalla, captura imágenes, intercepta el tráfico del juego, inyecta código en la página del juego, hace clics o pulsa teclas automáticamente, ni usa la cuenta del jugador. Solo hace `GET` anónimos a las URLs de la tabla de fuentes.
- No repite una descarga en menos de 24 h salvo con "Actualizar datos" (`force: true`).
- Sin dependencias npm, sin compilación y sin módulos ES (`import`/`export`), porque desde `file://` no cargan. Se usan `<script>` clásicos que hacen `root.PAC = root.PAC || {}` y `root.PAC.<nombre> = {...}`.
- `src/logic.js` y `src/data.js` funcionan también en Node: al final hacen `if (typeof module !== "undefined" && module.exports) module.exports = api;`, y el IIFE recibe `typeof window !== "undefined" ? window : globalThis`.
- Todo acceso a `localStorage` va dentro de `try/catch`.
- Toda la interfaz está en español. Los decimales llevan coma (`2,15`) y los porcentajes, espacio (`40 %`).
- El pie de página dice literalmente: "Herramienta no oficial. No lee ni modifica el juego."
- Solo se usan compos con `count >= 50`.
- Las pruebas se ejecutan con `node --test "test/*.test.js"` desde la raíz `C:\Users\tasio\pokeTFT`.
- Commits: autor por defecto del repositorio. Cada mensaje acaba con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Las fixtures de `test/fixtures/` ya existen y son datos reales recortados. NO las modifiques.

### Fixtures existentes (ya en el repositorio)

- `test/fixtures/pokedex.csv`: cabecera real y 23 filas. Familias incluidas: RATTATA (RATTATA, RATICATE), ALOLAN_RATTATA (ALOLAN_RATTATA, ALOLAN_RATICATE), ABRA (ABRA, KADABRA, ALAKAZAM; alcance 4), LICKITUNG, RHYHORN (RHYHORN, RHYDON, RHYPERIOR), AIPOM, TEDDIURSA (TEDDIURSA, URSARING, URSALUNA), POOCHYENA (POOCHYENA, MIGHTYENA), ABSOL y GIBLE (GIBLE, GABITE, GARCHOMP). MIGHTYENA: `0262,MIGHTYENA,RARE,2,...,WILD,DARK,...,Attack Range=1,...,Family=POOCHYENA`. ALOLAN_RATICATE tiene Index `0020-0001`.
- `test/fixtures/triggers.json`: el `types-trigger` real completo, p. ej. `"WILD": [2,4,6,9]`, `"DARK": [3,5,7]`, `"GROUND": [2,4,6,8]`.
- `test/fixtures/comps.json`: 3 compos en el formato crudo de `meta-v2`:
  - `"1"`: count 100, winrate 40, mean_rank 2.2, synergies `{wild:9, dark:3}`. Pokémon: MIGHTYENA 0.8 `[ABILITY_SHIELD]`, MEWTWO_FAKE 0.9 (no está en el pokedex), URSARING 0.6 `[DUSK_STONE, FLAME_ORB]`, AMBIPOM 0.5, RATICATE 0.2 y ALOLAN_RATICATE 0.1.
  - `"2"`: count 80, winrate 25, mean_rank 3.0, synergies `{dragon:3, ground:6}`. Pokémon: GABITE 0.9, RHYDON 0.7 y URSARING 0.3.
  - `"3"`: count 30 (por debajo de 50), mean_rank 1.5, synergies `{psychic:5}`. Pokémon: ALAKAZAM 1.0.

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `package.json` | Solo el script `test`, sin dependencias | 1 |
| `src/logic.js` | Funciones puras → `PAC.logic` | 1 y 2 |
| `test/helpers.js` | Carga de fixtures común a las pruebas | 1 |
| `test/logic-base.test.js` | Pruebas de traducción, búsqueda, CSV y pokedex | 1 |
| `test/logic-meta.test.js` | Pruebas de compos, puntuación, sinergias y tablero | 2 |
| `src/data.js` | Descarga, caché y construcción del `Dataset` → `PAC.data` | 3 |
| `test/data.test.js` | Pruebas de `data.js` con `fetch`/`storage` falsos | 3 |
| `index.html`, `styles.css`, `src/ui.js`, `src/main.js`, `README.md` | Interfaz y arranque | 4 |

---

### Task 1: Base de `logic.js` (traducción, búsqueda, CSV y pokedex)

**Files:**
- Create: `package.json`
- Create: `src/logic.js`
- Create: `test/helpers.js`
- Test: `test/logic-base.test.js`

**Interfaces:**
- Consumes: fixtures `test/fixtures/pokedex.csv`.
- Produces (en `PAC.logic` / `module.exports`):
  - `humanize(key: string) → string`: `"DUSK_STONE"` → `"Dusk Stone"`.
  - `makeTranslator(i18n?: {pkm?, item?, synergy?}) → { pkm(k), item(k), synergy(k) }`: cada función devuelve la traducción o `humanize(k)`.
  - `normalizeSearch(text) → string`: minúsculas, sin tildes y sin espacios en los extremos.
  - `parseCsv(text) → Array<Record<string,string>>`.
  - `buildPokedex(rows) → { pokedex: Record<name, {name, family, rarity, stage:number, types:string[], range:number, portrait:string}>, families: Record<family, string[]> }`, con `families` ordenadas por `stage` ascendente.
  - `familyOf(name, pokedex) → string`.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "companero-auto-chess",
  "private": true,
  "description": "Ayuda manual para Pokémon Auto Chess. No lee ni modifica el juego.",
  "scripts": {
    "test": "node --test \"test/*.test.js\""
  }
}
```

- [ ] **Step 2: Crear `test/helpers.js`**

```js
const fs = require("node:fs");
const path = require("node:path");

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

module.exports = { fixture };
```

- [ ] **Step 3: Escribir las pruebas que fallan, en `test/logic-base.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("./helpers.js");
const L = require("../src/logic.js");

test("humanize convierte claves en texto legible", () => {
  assert.equal(L.humanize("DUSK_STONE"), "Dusk Stone");
  assert.equal(L.humanize("ALOLAN_RATICATE"), "Alolan Raticate");
  assert.equal(L.humanize("WILD"), "Wild");
});

test("makeTranslator usa la traducción o la clave legible", () => {
  const t = L.makeTranslator({ pkm: { MIGHTYENA: "Mightyena" }, item: { DUSK_STONE: "Piedra Noche" } });
  assert.equal(t.pkm("MIGHTYENA"), "Mightyena");
  assert.equal(t.item("DUSK_STONE"), "Piedra Noche");
  assert.equal(t.item("FLAME_ORB"), "Flame Orb");
  assert.equal(t.synergy("WILD"), "Wild");
  assert.equal(L.makeTranslator(undefined).pkm("ALOLAN_RATICATE"), "Alolan Raticate");
});

test("normalizeSearch quita tildes, mayúsculas y espacios", () => {
  assert.equal(L.normalizeSearch("  Gracídea "), "gracidea");
  assert.equal(L.normalizeSearch("Ñandú"), "nandu");
});

test("parseCsv lee cabecera y filas, también con CRLF", () => {
  assert.deepEqual(L.parseCsv("a,b\r\n1,2\r\n"), [{ a: "1", b: "2" }]);
  assert.deepEqual(L.parseCsv(""), []);
  const rows = L.parseCsv(fixture("pokedex.csv"));
  assert.equal(rows.length, 23);
  assert.equal(rows[0].Name, "RATTATA");
  assert.equal(rows[0]["Attack Range"], "1");
});

test("buildPokedex crea fichas y familias ordenadas por etapa", () => {
  const { pokedex, families } = L.buildPokedex(L.parseCsv(fixture("pokedex.csv")));
  assert.deepEqual(pokedex.MIGHTYENA, {
    name: "MIGHTYENA",
    family: "POOCHYENA",
    rarity: "RARE",
    stage: 2,
    types: ["WILD", "DARK"],
    range: 1,
    portrait: "0262",
  });
  assert.equal(pokedex.ALOLAN_RATICATE.portrait, "0020/0001");
  assert.equal(pokedex.ABRA.range, 4);
  assert.deepEqual(pokedex.LICKITUNG.types, ["WILD", "NORMAL", "GOURMET"]);
  assert.deepEqual(families.TEDDIURSA, ["TEDDIURSA", "URSARING", "URSALUNA"]);
  assert.deepEqual(families.RATTATA, ["RATTATA", "RATICATE"]);
  assert.deepEqual(families.ALOLAN_RATTATA, ["ALOLAN_RATTATA", "ALOLAN_RATICATE"]);
});

test("familyOf devuelve la familia o el propio nombre", () => {
  const { pokedex } = L.buildPokedex(L.parseCsv(fixture("pokedex.csv")));
  assert.equal(L.familyOf("URSALUNA", pokedex), "TEDDIURSA");
  assert.equal(L.familyOf("NOPE", pokedex), "NOPE");
});
```

- [ ] **Step 4: Ejecutar y comprobar que fallan**

Run: `node --test "test/*.test.js"`
Expected: FAIL con `Cannot find module '../src/logic.js'`.

- [ ] **Step 5: Implementar `src/logic.js`**

```js
/* Funciones puras de Compañero Auto Chess: sin DOM ni red. */
(function (root) {
  "use strict";

  function humanize(key) {
    return String(key)
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function makeTranslator(i18n) {
    const src = i18n || {};
    const section = (name) => (key) => {
      const table = src[name];
      const value = table && table[key];
      return typeof value === "string" && value ? value : humanize(key);
    };
    return { pkm: section("pkm"), item: section("item"), synergy: section("synergy") };
  }

  function normalizeSearch(text) {
    return String(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  // El CSV del juego no tiene comas ni comillas dentro de los campos (verificado).
  function parseCsv(text) {
    const lines = String(text).replace(/\r/g, "").split("\n").filter((l) => l.length > 0);
    if (lines.length === 0) return [];
    const header = lines[0].split(",");
    return lines.slice(1).map((line) => {
      const cells = line.split(",");
      const row = {};
      header.forEach((h, i) => {
        row[h] = cells[i] === undefined ? "" : cells[i];
      });
      return row;
    });
  }

  function buildPokedex(rows) {
    const pokedex = {};
    rows.forEach((r) => {
      pokedex[r.Name] = {
        name: r.Name,
        family: r.Family || r.Name,
        rarity: r.Category,
        stage: Number(r.Tier) || 1,
        types: [r["Type 1"], r["Type 2"], r["Type 3"], r["Type 4"]].filter(Boolean),
        range: Number(r["Attack Range"]) || 1,
        portrait: String(r.Index).replace("-", "/"),
      };
    });
    const families = {};
    Object.keys(pokedex).forEach((name) => {
      const fam = pokedex[name].family;
      (families[fam] = families[fam] || []).push(name);
    });
    Object.keys(families).forEach((fam) => {
      families[fam].sort((a, b) => pokedex[a].stage - pokedex[b].stage || (a < b ? -1 : 1));
    });
    return { pokedex, families };
  }

  function familyOf(name, pokedex) {
    return pokedex[name] ? pokedex[name].family : name;
  }

  const api = { humanize, makeTranslator, normalizeSearch, parseCsv, buildPokedex, familyOf };

  root.PAC = root.PAC || {};
  root.PAC.logic = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 6: Ejecutar y comprobar que pasan**

Run: `node --test "test/*.test.js"`
Expected: PASS, 6 pruebas y 0 fallos.

- [ ] **Step 7: Commit**

```bash
git add package.json src/logic.js test/helpers.js test/logic-base.test.js
git commit -m "feat: add logic base (translation, search, CSV, pokedex)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Compos, puntuación, sinergias y tablero en `logic.js`

**Files:**
- Modify: `src/logic.js` (añadir funciones y ampliar `api`)
- Test: `test/logic-meta.test.js`

**Interfaces:**
- Consumes: `parseCsv` y `buildPokedex` de la tarea 1; fixtures `comps.json`, `pokedex.csv` y `triggers.json`.
- Produces (añadidas a `PAC.logic`):
  - `Comp = { id:string, count:number, winrate:number, meanRank:number, synergies: Record<TYPE,number> /* mayúsculas, orden desc */, units: Array<{name, family, frequency:number, items:string[]}> /* orden por frequency desc */ }`
  - `normalizeComp(raw, pokedex) → Comp` (descarta los nombres que no están en el pokedex).
  - `normalizeComps(rawList, pokedex, { minCount = 50 }?) → Comp[]` (filtra por `count` y descarta compos sin unidades).
  - `scoreComp(comp, owned:Set<family>) → { match:number /*0..1*/, owned: unit[], missing: unit[] }`.
  - `rankComps(comps, owned:Set<family>, { limit = 5 }?) → Array<{ comp, match, score }>`.
  - `splitCoreFlex(comp) → { core: unit[] /*freq>=0.5*/, flex: unit[] /*0.15<=freq<0.5*/ }`.
  - `synergyProgress(names:string[], pokedex, triggers) → Array<{ type, count, thresholds:number[], active:number }>`.
  - `placementHint(name, pokedex) → "front" | "back"`.
  - `placeBoard(names:string[], pokedex) → { front: (string|null)[8], back: (string|null)[8] }`.
  - `compTitle(comp, t, max = 3) → string` (sinergias principales traducidas, unidas con `" · "`).

- [ ] **Step 1: Escribir las pruebas que fallan, en `test/logic-meta.test.js`**

```js
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
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `node --test "test/*.test.js"`
Expected: FAIL en `logic-meta.test.js` con `L.normalizeComps is not a function`. Las 6 pruebas de la tarea 1 siguen pasando.

- [ ] **Step 3: Implementar. En `src/logic.js`, añadir este bloque justo antes de la línea `const api = {...}`**

```js
  function normalizeComp(raw, pokedex) {
    const syn = {};
    Object.keys(raw.synergies || {}).forEach((k) => {
      syn[k.toUpperCase()] = Number(raw.synergies[k]) || 0;
    });
    const synergies = {};
    Object.keys(syn)
      .sort((a, b) => syn[b] - syn[a] || (a < b ? -1 : 1))
      .forEach((k) => {
        synergies[k] = syn[k];
      });
    const mons = (raw.mean_team && raw.mean_team.pokemons) || {};
    const units = Object.keys(mons)
      .filter((name) => pokedex[name])
      .map((name) => ({
        name,
        family: pokedex[name].family,
        frequency: Number(mons[name].frequency) || 0,
        items: Array.isArray(mons[name].items) ? mons[name].items.slice() : [],
      }))
      .sort((a, b) => b.frequency - a.frequency || (a.name < b.name ? -1 : 1));
    return {
      id: String(raw.cluster_id),
      count: Number(raw.count) || 0,
      winrate: Number(raw.winrate) || 0,
      meanRank: Number(raw.mean_rank) || 8,
      synergies,
      units,
    };
  }

  function normalizeComps(rawList, pokedex, opts) {
    const minCount = opts && opts.minCount != null ? opts.minCount : 50;
    return (rawList || [])
      .filter((r) => Number(r.count) >= minCount)
      .map((r) => normalizeComp(r, pokedex))
      .filter((c) => c.units.length > 0);
  }

  function scoreComp(comp, owned) {
    let total = 0;
    let have = 0;
    const ownedUnits = [];
    const missing = [];
    comp.units.forEach((u) => {
      total += u.frequency;
      if (owned.has(u.family)) {
        have += u.frequency;
        ownedUnits.push(u);
      } else {
        missing.push(u);
      }
    });
    return { match: total > 0 ? have / total : 0, owned: ownedUnits, missing };
  }

  // Puesto 1 → 1, puesto 8 → 0.
  function quality(comp) {
    return Math.max(0, Math.min(1, (8 - comp.meanRank) / 7));
  }

  function rankComps(comps, owned, opts) {
    const limit = opts && opts.limit != null ? opts.limit : 5;
    return comps
      .map((comp) => {
        const match = owned.size === 0 ? 1 : scoreComp(comp, owned).match;
        return { comp, match, score: match * quality(comp) };
      })
      .sort((a, b) => b.score - a.score || b.comp.count - a.comp.count)
      .slice(0, limit);
  }

  function splitCoreFlex(comp) {
    return {
      core: comp.units.filter((u) => u.frequency >= 0.5),
      flex: comp.units.filter((u) => u.frequency >= 0.15 && u.frequency < 0.5),
    };
  }

  function synergyProgress(names, pokedex, triggers) {
    const seen = new Set();
    const counts = {};
    names.forEach((name) => {
      const p = pokedex[name];
      if (!p || seen.has(p.family)) return;
      seen.add(p.family);
      p.types.forEach((type) => {
        counts[type] = (counts[type] || 0) + 1;
      });
    });
    return Object.keys(counts)
      .map((type) => {
        const thresholds = ((triggers && triggers[type]) || []).slice();
        let active = 0;
        thresholds.forEach((x) => {
          if (counts[type] >= x) active = x;
        });
        return { type, count: counts[type], thresholds, active };
      })
      .sort((a, b) => b.count - a.count || (a.type < b.type ? -1 : 1));
  }

  function placementHint(name, pokedex) {
    const p = pokedex[name];
    return p && p.range > 1 ? "back" : "front";
  }

  const CENTER_OUT = [3, 4, 2, 5, 1, 6, 0, 7];

  function placeBoard(names, pokedex) {
    const rows = { front: new Array(8).fill(null), back: new Array(8).fill(null) };
    const used = { front: 0, back: 0 };
    names.forEach((name) => {
      let row = placementHint(name, pokedex);
      if (used[row] >= 8) row = row === "front" ? "back" : "front";
      if (used[row] >= 8) return;
      rows[row][CENTER_OUT[used[row]]] = name;
      used[row] += 1;
    });
    return rows;
  }

  function compTitle(comp, t, max) {
    return Object.keys(comp.synergies)
      .slice(0, max || 3)
      .map((type) => t.synergy(type))
      .join(" · ");
  }
```

Después, sustituir la línea `const api = {...}` por:

```js
  const api = {
    humanize,
    makeTranslator,
    normalizeSearch,
    parseCsv,
    buildPokedex,
    familyOf,
    normalizeComp,
    normalizeComps,
    scoreComp,
    rankComps,
    splitCoreFlex,
    synergyProgress,
    placementHint,
    placeBoard,
    compTitle,
  };
```

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `node --test "test/*.test.js"`
Expected: PASS, 15 pruebas y 0 fallos.

- [ ] **Step 5: Commit**

```bash
git add src/logic.js test/logic-meta.test.js
git commit -m "feat: add comp scoring, synergy progress and board placement" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `data.js` (descarga, caché de 24 h y `Dataset`)

**Files:**
- Create: `src/data.js`
- Test: `test/data.test.js`

**Interfaces:**
- Consumes: de `PAC.logic`, las funciones `parseCsv`, `buildPokedex`, `normalizeComps` y `makeTranslator`. Las lee de forma perezosa (`root.PAC.logic`) cuando se llaman, no al cargar el archivo.
- Produces (`PAC.data` / `module.exports`):
  - `SOURCES: Array<{ key, url, kind: "json"|"text", trim?: (body) => body }>` con las claves `comps`, `metadata`, `triggers`, `pokedex` e `i18n`.
  - `DataError` (subclase de `Error`), con `name = "DataError"` y `source` = clave de la fuente.
  - `createLoader({ fetch, storage, now?, timeoutMs? }) → { load({ force? }?) → Promise<Dataset> }`.
  - `buildDataset(bySource) → Dataset`.
  - `load(opts?) → Promise<Dataset>`, que usa `fetch` y `localStorage` reales del navegador.
  - `Dataset = { reportDate: "YYYY-MM-DD"|null, stale:boolean, pokedex, families, triggers, comps: Comp[], t }`.
  - Claves de caché: `"pac.cache.v1." + key`, con valor `JSON.stringify({ savedAt:number, body })`.

- [ ] **Step 1: Escribir las pruebas que fallan, en `test/data.test.js`**

```js
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

test("primera carga descarga las 5 fuentes y construye el Dataset", async () => {
  const fetch = fakeFetch();
  const storage = memoryStorage();
  const ds = await D.createLoader({ fetch, storage, now: () => 0 }).load();
  assert.equal(fetch.calls.length, 5);
  assert.equal(ds.reportDate, "2026-10-15");
  assert.equal(ds.stale, false);
  assert.deepEqual(ds.comps.map((c) => c.id), ["1", "2"]);
  assert.equal(ds.pokedex.MIGHTYENA.family, "POOCHYENA");
  assert.deepEqual(ds.families.POOCHYENA, ["POOCHYENA", "MIGHTYENA"]);
  assert.deepEqual(ds.triggers.WILD, [2, 4, 6, 9]);
  assert.equal(ds.t.synergy("WILD"), "Salvaje");
  assert.equal(ds.t.item("FLAME_ORB"), "Flame Orb");
  assert.deepEqual(storage.keys(), [
    "pac.cache.v1.comps",
    "pac.cache.v1.i18n",
    "pac.cache.v1.metadata",
    "pac.cache.v1.pokedex",
    "pac.cache.v1.triggers",
  ]);
});

test("la caché recorta campos que no se usan", async () => {
  const storage = memoryStorage();
  await D.createLoader({ fetch: fakeFetch(), storage, now: () => 0 }).load();
  const comps = JSON.parse(storage.getItem("pac.cache.v1.comps")).body;
  assert.equal(comps[0].hull, undefined);
  assert.equal(comps[0].x, undefined);
  assert.equal(comps[0].cluster_id, "1");
  const i18n = JSON.parse(storage.getItem("pac.cache.v1.i18n")).body;
  assert.deepEqual(Object.keys(i18n).sort(), ["item", "pkm", "synergy"]);
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
  assert.equal(fetch2.calls.length, 5);
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
```

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `node --test "test/*.test.js"`
Expected: FAIL en `data.test.js` con `Cannot find module '../src/data.js'`. Las 15 pruebas de `logic` siguen pasando.

- [ ] **Step 3: Implementar `src/data.js`**

```js
/* Descarga y caché de los datos públicos del meta. Solo GET anónimos, como mucho 1 vez cada 24 h. */
(function (root) {
  "use strict";

  const DAY = 24 * 60 * 60 * 1000;
  const CACHE_PREFIX = "pac.cache.v1.";
  const GAME = "https://pokemon-auto-chess.com";
  const REPO = "https://raw.githubusercontent.com/keldaanCommunity/pokemonAutoChess/master";

  const SOURCES = [
    {
      key: "comps",
      url: GAME + "/meta-v2",
      kind: "json",
      trim: (list) =>
        (Array.isArray(list) ? list : []).map((c) => ({
          cluster_id: c.cluster_id,
          count: c.count,
          winrate: c.winrate,
          mean_rank: c.mean_rank,
          synergies: c.synergies,
          mean_team: { pokemons: (c.mean_team && c.mean_team.pokemons) || {} },
        })),
    },
    { key: "metadata", url: GAME + "/meta/metadata", kind: "json" },
    { key: "triggers", url: GAME + "/types-trigger", kind: "json" },
    { key: "pokedex", url: REPO + "/app/models/precomputed/pokemons-data.csv", kind: "text" },
    {
      key: "i18n",
      url: REPO + "/app/public/dist/client/locales/es/translation.json",
      kind: "json",
      trim: (o) => ({ pkm: (o && o.pkm) || {}, item: (o && o.item) || {}, synergy: (o && o.synergy) || {} }),
    },
  ];

  class DataError extends Error {
    constructor(source, cause) {
      super("No se pudo descargar: " + source);
      this.name = "DataError";
      this.source = source;
      this.cause = cause;
    }
  }

  const logic = () => root.PAC.logic;

  function buildDataset(by) {
    const L = logic();
    const built = L.buildPokedex(L.parseCsv(by.pokedex.body));
    const meta = by.metadata.body;
    const created = Array.isArray(meta) && meta[0] && meta[0].created_at;
    return {
      reportDate: created ? String(created).slice(0, 10) : null,
      stale: Object.keys(by).some((k) => by[k].stale),
      pokedex: built.pokedex,
      families: built.families,
      triggers: by.triggers.body || {},
      comps: L.normalizeComps(by.comps.body, built.pokedex, { minCount: 50 }),
      t: L.makeTranslator(by.i18n.body),
    };
  }

  function createLoader(deps) {
    const fetchFn = deps.fetch;
    const storage = deps.storage;
    const now = deps.now || Date.now;
    const timeoutMs = deps.timeoutMs || 15000;

    function readCache(key) {
      try {
        const raw = storage && storage.getItem(CACHE_PREFIX + key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function writeCache(key, body) {
      try {
        if (storage) storage.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt: now(), body }));
      } catch (e) {
        // Sin espacio o sin permiso: seguimos sin caché.
      }
    }

    function download(src) {
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
      return Promise.resolve()
        .then(() => fetchFn(src.url, ctrl ? { signal: ctrl.signal } : {}))
        .then((res) => {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return src.kind === "text" ? res.text() : res.json();
        })
        .then((body) => (src.trim ? src.trim(body) : body))
        .finally(() => {
          if (timer) clearTimeout(timer);
        });
    }

    function getSource(src, force) {
      const cached = readCache(src.key);
      if (cached && !force && now() - cached.savedAt < DAY) {
        return Promise.resolve({ body: cached.body, stale: false });
      }
      return download(src).then(
        (body) => {
          writeCache(src.key, body);
          return { body, stale: false };
        },
        (err) => {
          if (cached) return { body: cached.body, stale: true };
          throw new DataError(src.key, err);
        }
      );
    }

    function load(opts) {
      const force = !!(opts && opts.force);
      return Promise.all(SOURCES.map((s) => getSource(s, force))).then((results) => {
        const by = {};
        SOURCES.forEach((s, i) => {
          by[s.key] = results[i];
        });
        return buildDataset(by);
      });
    }

    return { load };
  }

  function browserStorage() {
    try {
      return root.localStorage;
    } catch (e) {
      return null;
    }
  }

  function load(opts) {
    return createLoader({ fetch: root.fetch.bind(root), storage: browserStorage() }).load(opts);
  }

  const api = { SOURCES, DataError, createLoader, buildDataset, load };

  root.PAC = root.PAC || {};
  root.PAC.data = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `node --test "test/*.test.js"`
Expected: PASS, 23 pruebas y 0 fallos.

- [ ] **Step 5: Commit**

```bash
git add src/data.js test/data.test.js
git commit -m "feat: add data loader with 24h cache and offline fallback" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Interfaz (`index.html`, `styles.css`, `ui.js`, `main.js`) y README

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `src/ui.js`
- Create: `src/main.js`
- Create: `README.md`

**Interfaces:**
- Consumes:
  - `PAC.data.load({ force? }) → Promise<Dataset>` y `DataError.source`.
  - De `PAC.logic`: `normalizeSearch`, `rankComps`, `splitCoreFlex`, `scoreComp`, `synergyProgress`, `placeBoard` y `compTitle`.
  - `Dataset.t.pkm/item/synergy`.
- Produces:
  - `PAC.ui.mount(dataset, { onRefresh: () => void })`, que se puede llamar varias veces (al refrescar) sin duplicar listeners.
  - Estado en `localStorage["pac.state.v1"] = { owned: string[] /*familias*/, compId: string|null }`.

- [ ] **Step 1: Crear `index.html`**

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Compañero Auto Chess</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header class="top">
  <div class="brand">
    <h1>Compañero Auto Chess</h1>
    <span id="report" class="muted"></span>
  </div>
  <p id="notice" class="notice" hidden></p>
  <div class="actions">
    <button id="btn-refresh" type="button">Actualizar datos</button>
    <button id="btn-reset" type="button" class="danger">Nueva partida</button>
  </div>
</header>

<main class="cols">
  <section class="panel" aria-labelledby="h-owned">
    <h2 id="h-owned">Mis Pokémon</h2>
    <input id="search" type="search" placeholder="Buscar Pokémon…" autocomplete="off" aria-label="Buscar Pokémon">
    <div id="owned-chips" class="chips" aria-live="polite"></div>
    <div id="family-grid" class="fam-grid"></div>
  </section>
  <section class="panel" aria-labelledby="h-suggest">
    <h2 id="h-suggest">Compos sugeridas</h2>
    <ol id="suggestions" class="suggestions"></ol>
  </section>
  <section class="panel" aria-labelledby="h-comp">
    <h2 id="h-comp">Mi compo</h2>
    <div id="comp-detail"></div>
  </section>
</main>

<div id="loading" class="overlay-msg">Cargando datos del meta…</div>
<div id="error" class="overlay-msg" hidden>
  <p id="error-text"></p>
  <button id="btn-retry" type="button">Reintentar</button>
</div>

<footer class="foot">
  Herramienta no oficial. No lee ni modifica el juego. ·
  Datos: informe público del meta de pokemon-auto-chess.com y el código abierto del juego · Retratos: PMD Sprite Collab
</footer>

<script src="src/logic.js"></script>
<script src="src/data.js"></script>
<script src="src/ui.js"></script>
<script src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear `styles.css`**

```css
/* Tres columnas a pantalla completa (1920×1080); se apilan por debajo de 1100 px. Rojo como acento, neutros cálidos. */
:root {
  --bg: #f4f2f1;
  --surface: #ffffff;
  --sunk: #e9e5e4;
  --fg: #1d191a;
  --muted: #6a6264;
  --line: #d9d2d2;
  --accent: #b22334;
  --accent-soft: #f6dde0;
  --good: #2e7a4d;
  --good-soft: #dcefe3;
  --radius: 10px;
  --font: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #141112;
    --surface: #1e1a1b;
    --sunk: #2a2526;
    --fg: #f1ecec;
    --muted: #a69ea0;
    --line: #3a3334;
    --accent: #e5525f;
    --accent-soft: #3d1c21;
    --good: #6cc391;
    --good-soft: #1d3326;
    color-scheme: dark;
  }
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 15px/1.45 var(--font);
  display: grid;
  grid-template-rows: auto 1fr auto;
}
h1, h2, h3, h4 { margin: 0; line-height: 1.15; }
.muted { color: var(--muted); }
.small { font-size: 0.82rem; }
button { font: inherit; color: inherit; cursor: pointer; }
button:focus-visible, input:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

.top {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px;
  padding: 12px 20px; border-bottom: 1px solid var(--line); background: var(--surface);
}
.brand { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.brand h1 { font-size: 1.25rem; }
.notice { margin: 0; padding: 4px 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 600; font-size: 0.85rem; }
.actions { margin-left: auto; display: flex; gap: 8px; }
.actions button, #btn-retry {
  border: 1px solid var(--line); background: var(--bg); border-radius: 8px; padding: 6px 12px; font-weight: 600;
}
.actions button.danger { border-color: var(--accent); color: var(--accent); }

.cols {
  display: grid;
  grid-template-columns: minmax(300px, 1.05fr) minmax(280px, 0.85fr) minmax(340px, 1.25fr);
  gap: 16px; padding: 16px 20px; min-height: 0;
}
.panel {
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 14px; display: flex; flex-direction: column; gap: 10px; min-height: 0; min-width: 0; overflow: auto;
}
.panel h2 { font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.06em; }

#search { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--fg); font: inherit; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips p { margin: 0; }
.chip { border: 1px solid var(--accent); background: var(--accent-soft); color: var(--accent); border-radius: 999px; padding: 2px 10px; font-size: 0.85rem; font-weight: 600; }

.fam-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 6px; }
.fam {
  display: grid; justify-items: center; gap: 4px; padding: 6px 4px;
  border: 2px solid transparent; border-radius: 8px; background: var(--sunk);
}
.fam[aria-pressed="true"] { border-color: var(--good); background: var(--good-soft); }
.fam-name { font-size: 0.75rem; text-align: center; line-height: 1.15; overflow-wrap: anywhere; }

.portrait {
  width: var(--size, 40px); height: var(--size, 40px); flex: none;
  display: inline-grid; place-items: center; border-radius: 6px; overflow: hidden; background: var(--sunk);
}
.portrait img { width: 100%; height: 100%; image-rendering: pixelated; }
.portrait.fallback { font-weight: 700; font-size: 0.8rem; color: var(--muted); }

.suggestions { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.suggestions .hint { font-size: 0.88rem; }
.sugg {
  width: 100%; text-align: left; display: grid; gap: 4px; padding: 10px 12px;
  border: 1px solid var(--line); border-radius: 8px; background: var(--bg);
}
.sugg[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
.sugg-title { font-weight: 700; font-size: 1rem; }
.sugg-stats { font-size: 0.82rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.sugg-team { display: flex; gap: 4px; flex-wrap: wrap; }

.empty { padding: 24px 8px; text-align: center; }
.empty-title { font-weight: 700; font-size: 1.05rem; margin: 0 0 4px; }
.comp-title { font-size: 1.3rem; }
#comp-detail { display: grid; gap: 14px; }
#comp-detail > p { margin: 0; }
.block { display: grid; gap: 8px; }
.block h4 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.block p { margin: 0; }

.units { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.unit { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; padding: 8px; border-radius: 8px; background: var(--bg); }
.unit.is-owned { background: var(--good-soft); }
.unit-body { display: grid; gap: 4px; min-width: 0; }
.unit-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
.unit-meta { font-size: 0.8rem; }
.status { font-size: 0.78rem; font-weight: 700; border-radius: 6px; padding: 1px 7px; }
.status.have { color: var(--good); }
.status.buy { background: var(--accent); color: #fff; }
.status.buy small { font-weight: 600; }
.items { display: flex; flex-wrap: wrap; gap: 4px; }
.item { font-size: 0.78rem; border: 1px solid var(--line); border-radius: 6px; padding: 1px 7px; background: var(--surface); }

.syns { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.syn { display: grid; grid-template-columns: 7.5em 3.5em 1fr; gap: 8px; align-items: center; }
.syn-name { font-weight: 700; }
.syn-count { font-variant-numeric: tabular-nums; color: var(--muted); }
.pips { display: flex; gap: 4px; flex-wrap: wrap; }
.pip { min-width: 26px; text-align: center; border-radius: 6px; padding: 1px 4px; font-size: 0.8rem; font-weight: 700; background: var(--sunk); color: var(--muted); }
.pip.on { background: var(--good); color: #fff; }
.pip.goal { box-shadow: inset 0 0 0 2px var(--accent); }

.board { display: grid; gap: 4px; padding: 10px; border-radius: 8px; background: var(--bg); overflow-x: auto; }
.enemy { text-align: center; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.row { display: grid; grid-template-columns: repeat(8, minmax(36px, 1fr)); gap: 4px; }
.cell { aspect-ratio: 1; max-width: 100%; border-radius: 6px; background: var(--sunk); display: grid; place-items: center; }
.cell .portrait { width: 90%; height: 90%; }

.overlay-msg {
  position: fixed; inset: 0; display: grid; place-content: center; justify-items: center; gap: 12px;
  background: var(--bg); font-size: 1.1rem; text-align: center; padding: 20px;
}
.overlay-msg p { margin: 0; max-width: 50ch; }
.foot { padding: 8px 20px; font-size: 0.78rem; color: var(--muted); border-top: 1px solid var(--line); }

@media (max-width: 1100px) {
  body { height: auto; display: block; }
  .cols { grid-template-columns: 1fr; }
  .panel { overflow: visible; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

- [ ] **Step 3: Crear `src/ui.js`**

```js
/* Interfaz de Compañero Auto Chess: pinta las tres zonas y responde a los clics del jugador. */
(function (root) {
  "use strict";

  const STATE_KEY = "pac.state.v1";
  const PORTRAIT_BASE = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/";
  const logic = () => root.PAC.logic;
  const $ = (sel) => document.querySelector(sel);

  function loadState() {
    try {
      const s = JSON.parse(root.localStorage.getItem(STATE_KEY));
      if (s && Array.isArray(s.owned)) return { owned: s.owned, compId: s.compId || null };
    } catch (e) {
      // Sin almacenamiento: empezamos vacíos.
    }
    return { owned: [], compId: null };
  }

  function saveState(state) {
    try {
      root.localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignorar: la app sigue funcionando sin guardar.
    }
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : String(v));
    });
    (children || []).forEach((c) => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  const fmtRank = (n) => n.toFixed(2).replace(".", ",");
  const fmtPct = (ratio) => Math.round(ratio * 100) + " %";
  const fmtDate = (iso) => {
    if (!iso) return "?";
    const [y, m, d] = iso.split("-");
    return d + "/" + m + "/" + y;
  };
  const initials = (s) =>
    s.split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase();

  function portrait(name, ds, size) {
    const px = size || 40;
    const label = ds.t.pkm(name);
    const p = ds.pokedex[name];
    const box = el("span", { class: "portrait", style: "--size:" + px + "px" });
    const fallback = () => {
      box.replaceChildren(initials(label));
      box.classList.add("fallback");
    };
    if (!p) {
      fallback();
      return box;
    }
    const img = el("img", {
      src: PORTRAIT_BASE + p.portrait + "/Normal.png",
      alt: label,
      loading: "lazy",
      width: px,
      height: px,
    });
    img.addEventListener("error", fallback);
    box.appendChild(img);
    return box;
  }

  function familyEntries(ds) {
    const fams = new Set();
    ds.comps.forEach((c) => c.units.forEach((u) => fams.add(u.family)));
    return Array.from(fams)
      .map((family) => {
        const names = ds.families[family] || [family];
        const display = names[names.length - 1];
        return {
          family,
          names,
          display,
          label: ds.t.pkm(display),
          search: logic().normalizeSearch(names.map((n) => ds.t.pkm(n)).join(" ")),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }

  function compStats(comp, match, showMatch) {
    const parts = [];
    if (showMatch) parts.push("Coincide " + fmtPct(match));
    parts.push("Puesto " + fmtRank(comp.meanRank), "Gana " + Math.round(comp.winrate) + " %", comp.count + " partidas");
    return parts.join(" · ");
  }

  function mount(ds, opts) {
    const state = loadState();
    const entries = familyEntries(ds);
    const known = new Set(entries.map((e) => e.family));
    state.owned = state.owned.filter((f) => known.has(f));
    if (state.compId && !ds.comps.some((c) => c.id === state.compId)) state.compId = null;
    saveState(state);
    const ui = { ds, state, entries, query: "" };

    $("#report").textContent =
      (ds.reportDate ? "Informe del " + fmtDate(ds.reportDate) + " · " : "") + ds.comps.length + " compos";
    const notice = $("#notice");
    notice.hidden = !ds.stale;
    notice.textContent = ds.stale ? "Sin conexión: usando datos del " + fmtDate(ds.reportDate) : "";

    const search = $("#search");
    search.value = "";
    search.oninput = () => {
      ui.query = logic().normalizeSearch(search.value);
      renderGrid(ui);
    };
    $("#btn-reset").onclick = () => {
      state.owned = [];
      state.compId = null;
      saveState(state);
      search.value = "";
      ui.query = "";
      renderAll(ui);
    };
    $("#btn-refresh").onclick = () => opts.onRefresh();
    renderAll(ui);
  }

  function renderAll(ui) {
    renderChips(ui);
    renderGrid(ui);
    renderSuggestions(ui);
    renderDetail(ui);
  }

  function toggle(ui, family) {
    const owned = ui.state.owned;
    const i = owned.indexOf(family);
    if (i >= 0) owned.splice(i, 1);
    else owned.push(family);
    saveState(ui.state);
    renderAll(ui);
    const again = document.querySelector('.fam[data-family="' + CSS.escape(family) + '"]');
    if (again) again.focus();
  }

  function renderChips(ui) {
    const box = $("#owned-chips");
    box.replaceChildren();
    if (ui.state.owned.length === 0) {
      box.appendChild(el("p", { class: "muted", text: "Haz clic en los Pokémon que tengas." }));
      return;
    }
    ui.state.owned.forEach((family) => {
      const entry = ui.entries.find((e) => e.family === family);
      const label = entry ? entry.label : family;
      box.appendChild(
        el("button", { type: "button", class: "chip", "aria-label": "Quitar " + label, onclick: () => toggle(ui, family) }, [
          label,
          el("span", { "aria-hidden": "true", text: " ✕" }),
        ])
      );
    });
  }

  function renderGrid(ui) {
    const grid = $("#family-grid");
    grid.replaceChildren();
    const owned = new Set(ui.state.owned);
    const list = ui.entries.filter((e) => !ui.query || e.search.includes(ui.query));
    if (list.length === 0) {
      grid.appendChild(el("p", { class: "muted", text: "Ningún Pokémon coincide con la búsqueda." }));
      return;
    }
    list.forEach((e) => {
      grid.appendChild(
        el(
          "button",
          {
            type: "button",
            class: "fam",
            "data-family": e.family,
            "aria-pressed": owned.has(e.family) ? "true" : "false",
            title: e.names.map((n) => ui.ds.t.pkm(n)).join(" → "),
            onclick: () => toggle(ui, e.family),
          },
          [portrait(e.display, ui.ds, 48), el("span", { class: "fam-name", text: e.label })]
        )
      );
    });
  }

  function renderSuggestions(ui) {
    const L = logic();
    const list = $("#suggestions");
    list.replaceChildren();
    const owned = new Set(ui.state.owned);
    if (owned.size === 0) {
      list.appendChild(
        el("li", { class: "hint muted", text: "Las mejores del meta. Marca tus Pokémon para ver cuál te encaja más." })
      );
    }
    L.rankComps(ui.ds.comps, owned, { limit: 5 }).forEach(({ comp, match }) => {
      const core = L.splitCoreFlex(comp).core.slice(0, 6);
      list.appendChild(
        el("li", null, [
          el(
            "button",
            {
              type: "button",
              class: "sugg",
              "aria-pressed": ui.state.compId === comp.id ? "true" : "false",
              onclick: () => {
                ui.state.compId = comp.id;
                saveState(ui.state);
                renderSuggestions(ui);
                renderDetail(ui);
              },
            },
            [
              el("span", { class: "sugg-title", text: L.compTitle(comp, ui.ds.t) }),
              el("span", { class: "sugg-stats", text: compStats(comp, match, owned.size > 0) }),
              el("span", { class: "sugg-team" }, core.map((u) => portrait(u.name, ui.ds, 32))),
            ]
          ),
        ])
      );
    });
  }

  function renderDetail(ui) {
    const L = logic();
    const box = $("#comp-detail");
    box.replaceChildren();
    const comp = ui.ds.comps.find((c) => c.id === ui.state.compId);
    if (!comp) {
      box.appendChild(
        el("div", { class: "empty" }, [
          el("p", { class: "empty-title", text: "Elige una compo de la lista" }),
          el("p", { class: "muted", text: "Verás qué te falta comprar, qué objetos dar y dónde colocar a cada Pokémon." }),
        ])
      );
      return;
    }
    const owned = new Set(ui.state.owned);
    const { core, flex } = L.splitCoreFlex(comp);
    const ownedUnits = core.concat(flex).filter((u) => owned.has(u.family));
    const parts = [
      el("h3", { class: "comp-title", text: L.compTitle(comp, ui.ds.t) }),
      el("p", { class: "muted", text: compStats(comp, L.scoreComp(comp, owned).match, owned.size > 0) }),
      unitSection("Núcleo", core, ui, owned),
      flex.length ? unitSection("Relleno", flex, ui, owned) : null,
      synergySection(comp, ownedUnits, ui),
      boardSection(ownedUnits, ui),
    ];
    box.append(...parts.filter(Boolean));
  }

  function unitSection(title, units, ui, owned) {
    const ds = ui.ds;
    return el("section", { class: "block" }, [
      el("h4", { text: title }),
      el(
        "ul",
        { class: "units" },
        units.map((u) => {
          const have = owned.has(u.family);
          const base = (ds.families[u.family] || [u.name])[0];
          const status = have
            ? el("span", { class: "status have", text: "✔ La tienes" })
            : el("span", { class: "status buy" }, [
                "Comprar",
                base !== u.name ? el("small", { text: " (sale como " + ds.t.pkm(base) + ")" }) : null,
              ]);
          return el("li", { class: "unit" + (have ? " is-owned" : "") }, [
            portrait(u.name, ds, 44),
            el("div", { class: "unit-body" }, [
              el("div", { class: "unit-head" }, [el("strong", { text: ds.t.pkm(u.name) }), status]),
              el("div", { class: "unit-meta muted", text: "En el " + fmtPct(u.frequency) + " de los equipos" }),
              u.items.length
                ? el("div", { class: "items" }, u.items.map((it) => el("span", { class: "item", text: ds.t.item(it) })))
                : null,
            ]),
          ]);
        })
      ),
    ]);
  }

  function synergySection(comp, ownedUnits, ui) {
    const ds = ui.ds;
    const progress = logic().synergyProgress(ownedUnits.map((u) => u.name), ds.pokedex, ds.triggers);
    const counts = {};
    progress.forEach((p) => {
      counts[p.type] = p.count;
    });
    const rows = Object.keys(comp.synergies).map((type) => {
      const target = comp.synergies[type];
      const count = counts[type] || 0;
      const thresholds = ds.triggers[type] || [];
      const reachable = thresholds.filter((x) => x <= target);
      const goal = reachable.length ? reachable[reachable.length - 1] : null;
      return el("li", { class: "syn" }, [
        el("span", { class: "syn-name", text: ds.t.synergy(type) }),
        el("span", { class: "syn-count", text: count + " / " + target }),
        el(
          "span",
          { class: "pips" },
          thresholds.map((x) =>
            el("span", {
              class: "pip" + (count >= x ? " on" : "") + (x === goal ? " goal" : ""),
              text: String(x),
              title: count >= x ? "Activa" : "Faltan " + (x - count),
            })
          )
        ),
      ]);
    });
    return el("section", { class: "block" }, [
      el("h4", { text: "Sinergias con lo que tienes" }),
      el("ul", { class: "syns" }, rows),
    ]);
  }

  function boardSection(ownedUnits, ui) {
    const ds = ui.ds;
    if (ownedUnits.length === 0) {
      return el("section", { class: "block" }, [
        el("h4", { text: "Colocación orientativa" }),
        el("p", { class: "muted", text: "Marca Pokémon de esta compo para ver una colocación." }),
      ]);
    }
    const board = logic().placeBoard(ownedUnits.map((u) => u.name), ds.pokedex);
    const cell = (name) => el("div", { class: "cell" }, name ? [portrait(name, ds, 36)] : []);
    return el("section", { class: "block" }, [
      el("h4", { text: "Colocación orientativa" }),
      el("div", { class: "board", role: "img", "aria-label": "Tablero con " + ownedUnits.length + " Pokémon colocados" }, [
        el("div", { class: "enemy", text: "▲ Enemigo" }),
        el("div", { class: "row" }, board.front.map(cell)),
        el("div", { class: "row" }, new Array(8).fill(null).map(cell)),
        el("div", { class: "row" }, board.back.map(cell)),
      ]),
      el("p", {
        class: "muted small",
        text: "Cuerpo a cuerpo delante y a distancia detrás. El informe no dice dónde los coloca la gente.",
      }),
    ]);
  }

  root.PAC = root.PAC || {};
  root.PAC.ui = { mount };
})(window);
```

- [ ] **Step 4: Crear `src/main.js`**

```js
/* Arranque: carga los datos y monta la interfaz. */
(function (root) {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function start(force) {
    $("#loading").hidden = false;
    $("#error").hidden = true;
    root.PAC.data
      .load({ force })
      .then((ds) => {
        $("#loading").hidden = true;
        root.PAC.ui.mount(ds, { onRefresh: () => start(true) });
      })
      .catch((err) => {
        $("#loading").hidden = true;
        const source = err && err.source ? err.source : "desconocida";
        $("#error-text").textContent =
          "No se pudieron descargar los datos (fuente: " + source + "). Comprueba tu conexión y pulsa Reintentar.";
        $("#error").hidden = false;
        if (!(err && err.source)) console.error(err);
      });
  }

  $("#btn-retry").addEventListener("click", () => start(false));
  start(false);
})(window);
```

- [ ] **Step 5: Crear `README.md`**

````markdown
# Compañero Auto Chess

Ayuda para jugar a [Pokémon Auto Chess](https://pokemon-auto-chess.com) en un segundo monitor.

## Cómo se usa

1. Abre `index.html` con doble clic (Chrome, Edge o Firefox) y arrastra la ventana al segundo monitor.
2. En **Mis Pokémon**, haz clic en los que tengas. Marcar cualquier etapa cuenta para toda la familia.
3. En **Compos sugeridas**, elige la compo que más te encaje.
4. En **Mi compo** verás qué te falta comprar, qué objetos dar y una colocación orientativa.
5. Pulsa **Nueva partida** al empezar otra.

Los datos del meta se descargan como mucho una vez al día. **Actualizar datos** fuerza la descarga.

## Normas de uso del juego

Los Términos de Servicio de Pokémon Auto Chess prohíben la automatización y las herramientas no autorizadas. Por eso esta app:

- no lee la pantalla ni el juego, no intercepta su conexión y no inyecta nada en su página;
- no hace clics ni pulsa teclas por ti;
- solo descarga, sin tu cuenta, el informe público del meta y los datos del código abierto del juego.

Todo lo que sabe de tu partida se lo dices tú con clics.

## Desarrollo

Sin dependencias. Pruebas:

```bash
node --test "test/*.test.js"
```

Fuentes: `pokemon-auto-chess.com/meta-v2`, `/meta/metadata` y `/types-trigger`; `pokemons-data.csv` y la traducción al español del repositorio keldaanCommunity/pokemonAutoChess. Retratos de PMD Sprite Collab.
````

- [ ] **Step 6: Comprobar la sintaxis y que las pruebas siguen pasando**

Run (con la herramienta Bash, no con PowerShell 5.1, que no admite `&&`): `node --check src/ui.js && node --check src/main.js && node --test "test/*.test.js"`
Expected: no hay errores de sintaxis y pasan 23 pruebas con 0 fallos.

- [ ] **Step 7: Comprobación manual en el navegador (la hace el arquitecto, no el implementador)**

El implementador NO abre el navegador. Termina en el Step 8 e indica en su informe que la comprobación visual está pendiente. Después, el arquitecto sirve la carpeta en local y comprueba en el navegador integrado:
1. Aparece "Cargando datos del meta…" y después las tres columnas. La cabecera muestra "Informe del DD/MM/AAAA · N compos".
2. Con nada marcado, Compos sugeridas muestra la pista y 5 compos con puesto y % de victorias.
3. Buscar "mighty" deja solo Mightyena. Al hacer clic se marca en verde y aparece el chip "Mightyena ✕".
4. Elegir una compo muestra el núcleo, el relleno, "Comprar (sale como …)", los objetos en español, las barras de sinergia y el tablero.
5. Al recargar la página se mantienen los marcados y la compo elegida. "Nueva partida" lo vacía todo.
6. La consola del navegador (F12) no muestra errores.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css src/ui.js src/main.js README.md
git commit -m "feat: add companion UI, app bootstrap and README" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
