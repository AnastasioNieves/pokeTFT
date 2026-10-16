# Rediseño estilo Mobalytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer la interfaz al estilo de las guías de TFT de Mobalytics: tier list de compos (S/A/B/C) con filtros, página de compo (tablero final, carries y objetos, cómo jugarla, equipos reales) y las pestañas "Mi partida" y "Objetos".

**Architecture:** La lógica nueva son funciones puras en `src/logic.js` y `src/data.js`, probadas con Node. La interfaz se divide en `src/dom.js` (piezas visuales), `src/app.js` (pestañas y rutas por hash) y una vista por pestaña en `src/views/`. `src/board.js` se reutiliza. `src/ui.js` se elimina.

**Tech Stack:** HTML, CSS y JavaScript (ES2020) sin dependencias. Pruebas con `node:test` (Node 24).

**Spec:** `docs/superpowers/specs/2026-10-17-rediseno-mobalytics-design.md`

## Global Constraints

- La app NUNCA lee la pantalla, captura imágenes, intercepta el tráfico del juego, inyecta código en la página del juego, hace clics o pulsa teclas automáticamente, ni usa la cuenta del jugador. Solo hace `GET` anónimos a las fuentes de `src/data.js`. Las imágenes se cargan con `<img>`, nunca con `fetch`.
- Sin dependencias npm, sin compilación y sin módulos ES. Se usan `<script>` clásicos que hacen `root.PAC = root.PAC || {}` y `root.PAC.<nombre> = {...}`. `src/logic.js` y `src/data.js` exportan además con `module.exports`.
- Todo acceso a `localStorage` va dentro de `try/catch`.
- Toda la interfaz está en español. Los decimales llevan coma (`2,15`) y los porcentajes, espacio (`40 %`).
- El pie de página dice literalmente: "Herramienta no oficial. No lee ni modifica el juego."
- Las pruebas se ejecutan con `node --test "test/*.test.js"` desde `C:\Users\tasio\pokeTFT` (Git Bash).
- Commits: cada mensaje acaba con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- NO modifiques `test/fixtures/`.

---

### Task 7: Lógica nueva en `logic.js`

**Files:**
- Modify: `src/logic.js`
- Modify: `test/logic-meta.test.js`
- Modify: `test/logic-base.test.js`

**Interfaces:**
- Consumes: lo que ya existe (`normalizeComp`, `splitCoreFlex`, `normalizeSearch`, `compTitle`, `makeTranslator`).
- Produces (en `PAC.logic` / `module.exports`):
  - Las unidades de `Comp` ganan `itemCount: number`. `Comp` gana `items: {item, frequency}[]` y `topTeams: {rank, elo, units: {name, items}[]}[]`.
  - `compTier(comp) → "S"|"A"|"B"|"C"`
  - `compCarries(comp, max = 2) → unit[]`
  - `compName(comp, t) → string`
  - `synergyLevel(count, thresholds) → 0|1|2|3`
  - `stageGroups(comp, pokedex, families) → { early: string[], mid: string[], late: string[] }`
  - `playTip(comp, triggers, t) → string`
  - `filterComps(comps, { query?, synergies?: Set }, families, t) → Comp[]`
  - `cleanText(text, i18n) → string`
  - `itemTierList(items: {name, rank, count, pokemons}[], minCount = 200) → mismos objetos, filtrados y ordenados`
  - `itemTier(rank) → "S"|"A"|"B"|"C"`
  - `makeTranslator(i18n)` gana `itemDesc(key) → string`

- [ ] **Step 1: Actualizar la prueba de `normalizeComps`.** En `test/logic-meta.test.js`, el objeto esperado de `c1.units[1]` pasa a ser:

```js
  assert.deepEqual(c1.units[1], {
    name: "URSARING",
    family: "TEDDIURSA",
    frequency: 0.6,
    items: ["DUSK_STONE", "FLAME_ORB"],
    itemCount: 2,
  });
```

- [ ] **Step 2: Añadir las pruebas nuevas al final de `test/logic-meta.test.js`**

```js
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
```

- [ ] **Step 3: Añadir la prueba de `itemDesc` al final de `test/logic-base.test.js`**

```js
test("makeTranslator.itemDesc devuelve la descripción limpia", () => {
  const t = L.makeTranslator({
    item_description: { GRACIDEA_FLOWER: "El portador gana +20 SPEED." },
    stat: { SPEED: "Velocidad" },
  });
  assert.equal(t.itemDesc("GRACIDEA_FLOWER"), "El portador gana +20 velocidad.");
  assert.equal(t.itemDesc("NOPE"), "");
  assert.equal(L.makeTranslator().itemDesc("NOPE"), "");
});
```

- [ ] **Step 4: Ejecutar y comprobar que fallan**

Run: `node --test "test/*.test.js"`
Expected: FAIL en la prueba de `normalizeComps` (falta `itemCount`) y en las 10 nuevas.

- [ ] **Step 5: `cleanText` e `itemDesc`.** En `src/logic.js`, justo antes de `function makeTranslator`, añade:

```js
  // Secciones del diccionario del juego donde buscar los términos en MAYÚSCULAS de las descripciones.
  const TOKEN_SECTIONS = ["stat", "status", "technical_terms", "synergy", "damage"];

  function cleanText(text, i18n) {
    const src = i18n || {};
    return String(text || "")
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/\[([^\]]*)\]/g, (match, inner) =>
        inner
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^-?\d+(\.\d+)?$/.test(s))
          .join("/")
      )
      .replace(/\b[A-Z][A-Z_]+\b/g, (token) => {
        for (const section of TOKEN_SECTIONS) {
          const table = src[section];
          if (table && typeof table[token] === "string") return table[token].trim().toLowerCase();
        }
        return token;
      })
      .replace(/\s{2,}/g, " ")
      .trim();
  }
```

En `makeTranslator`, sustituye `return { pkm: section("pkm"), item: section("item"), synergy: section("synergy") };` por:

```js
    const itemDesc = (key) => {
      const table = src.item_description;
      const value = table && table[key];
      return typeof value === "string" ? cleanText(value, src) : "";
    };
    return { pkm: section("pkm"), item: section("item"), synergy: section("synergy"), itemDesc };
```

- [ ] **Step 6: Ampliar `normalizeComp`.** En `src/logic.js` → `normalizeComp`, dentro del objeto `const unit = { ... }`, añade después de la línea `items: Array.isArray(mons[name].items) ? mons[name].items.slice() : [],`:

```js
          itemCount: Number(mons[name].mean_items) || 0,
```

En el `return { ... }` final de `normalizeComp`, sustituye la línea `units,` por:

```js
      units,
      items: (Array.isArray(raw.mean_items) ? raw.mean_items : [])
        .filter((x) => x && x.item)
        .map((x) => ({ item: x.item, frequency: Number(x.frequency) || 0 })),
      topTeams: (Array.isArray(raw.top_teams) ? raw.top_teams : [])
        .map((team) => ({
          rank: Number(team.rank) || 0,
          elo: Number(team.elo) || 0,
          units: (Array.isArray(team.pokemons) ? team.pokemons : [])
            .filter((p) => p && pokedex[p.name])
            .map((p) => ({ name: p.name, items: Array.isArray(p.items) ? p.items.slice() : [] })),
        }))
        .filter((team) => team.units.length > 0),
```

- [ ] **Step 7: Funciones de la tier list.** En `src/logic.js`, justo antes de `function compTitle`, añade:

```js
  function compTier(comp) {
    if (comp.meanRank <= 3.3) return "S";
    if (comp.meanRank <= 3.7) return "A";
    if (comp.meanRank <= 4.2) return "B";
    return "C";
  }

  function compCarries(comp, max) {
    const limit = max || 2;
    const withItems = comp.units
      .filter((u) => u.itemCount >= 1)
      .sort((a, b) => b.itemCount - a.itemCount || b.frequency - a.frequency);
    return (withItems.length ? withItems : comp.units.slice(0, 1)).slice(0, limit);
  }

  function compName(comp, t) {
    const carry = compCarries(comp, 1)[0];
    if (!carry) return compTitle(comp, t, 2);
    const first = Object.keys(comp.synergies)[0];
    return first ? t.pkm(carry.name) + " " + t.synergy(first) : t.pkm(carry.name);
  }

  function synergyLevel(count, thresholds) {
    const list = thresholds || [];
    const reached = list.filter((x) => count >= x).length;
    if (reached === 0) return 0;
    if (reached === list.length) return 3;
    return reached >= Math.ceil(list.length / 2) ? 2 : 1;
  }

  const STAGE_OF_RARITY = {
    COMMON: "early",
    UNCOMMON: "early",
    RARE: "mid",
    EPIC: "mid",
    HATCH: "mid",
    SPECIAL: "mid",
    ULTRA: "late",
    UNIQUE: "late",
    LEGENDARY: "late",
  };

  function stageGroups(comp, pokedex, families) {
    const groups = { early: [], mid: [], late: [] };
    const { core, flex } = splitCoreFlex(comp);
    core.concat(flex).forEach((u) => {
      const base = (families[u.family] || [u.name])[0];
      const p = pokedex[u.name];
      const stage = STAGE_OF_RARITY[p ? p.rarity : ""] || "mid";
      if (!groups[stage].includes(base)) groups[stage].push(base);
    });
    return groups;
  }

  function playTip(comp, triggers, t) {
    const types = Object.keys(comp.synergies || {});
    if (types.length === 0) return "";
    const first = types[0];
    const firstThreshold = ((triggers && triggers[first]) || [])[0];
    const goal = types
      .slice(0, 2)
      .map((type) => t.synergy(type) + " " + comp.synergies[type])
      .join(" + ");
    const start = firstThreshold ? "Consigue " + firstThreshold + " de " + t.synergy(first) + " pronto para activarla. " : "";
    return start + "Objetivo: " + goal + ".";
  }

  function filterComps(comps, filters, families, t) {
    const query = normalizeSearch((filters && filters.query) || "");
    const wanted = Array.from((filters && filters.synergies) || []);
    return comps.filter((comp) => {
      if (!wanted.every((type) => comp.synergies[type] > 0)) return false;
      if (!query) return true;
      return comp.units.some((u) =>
        (families[u.family] || [u.name]).some((name) => normalizeSearch(t.pkm(name)).includes(query))
      );
    });
  }

  function itemTierList(items, minCount) {
    const min = minCount != null ? minCount : 200;
    return (items || [])
      .filter((x) => x && x.count >= min)
      .slice()
      .sort((a, b) => a.rank - b.rank || b.count - a.count);
  }

  function itemTier(rank) {
    if (rank <= 3.5) return "S";
    if (rank <= 3.8) return "A";
    if (rank <= 4.1) return "B";
    return "C";
  }
```

- [ ] **Step 8: Exportar.** En el objeto `const api = { ... }`, añade justo antes de `compTitle,`:

```js
    compTier,
    compCarries,
    compName,
    synergyLevel,
    stageGroups,
    playTip,
    filterComps,
    cleanText,
    itemTierList,
    itemTier,
```

- [ ] **Step 9: Ejecutar y comprobar que pasan**

Run: `node --test "test/*.test.js"`
Expected: PASS, 43 pruebas y 0 fallos.

- [ ] **Step 10: Commit**

```bash
git add src/logic.js test/logic-meta.test.js test/logic-base.test.js
git commit -m "feat: add tier list, carries, stage groups, filters and item text logic" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Datos nuevos en `data.js`

**Files:**
- Modify: `src/data.js`
- Modify: `test/data.test.js`

**Interfaces:**
- Consumes: `L.itemTierList` (tarea 7).
- Produces:
  - `SOURCES` gana la fuente `items`.
  - El recorte de `comps` guarda `mean_items` y `top_teams`.
  - El recorte de `i18n` guarda 8 secciones.
  - `Dataset` gana `itemStats: {name, rank, count, pokemons}[]`.

- [ ] **Step 1: Actualizar las pruebas.** En `test/data.test.js`:

1. En el objeto `bodies`, añade justo después de la línea `i18n: { ... },`:

```js
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
```

2. En la prueba "primera carga descarga las 5 fuentes y construye el Dataset":
   - cambia el título por `"primera carga descarga las 6 fuentes y construye el Dataset"`;
   - cambia `assert.equal(fetch.calls.length, 5);` por `assert.equal(fetch.calls.length, 6);`;
   - sustituye la lista de `storage.keys()` esperada por:

```js
  assert.deepEqual(storage.keys(), [
    "pac.cache.v1.comps",
    "pac.cache.v1.i18n",
    "pac.cache.v1.items",
    "pac.cache.v1.metadata",
    "pac.cache.v1.pokedex",
    "pac.cache.v1.triggers",
  ]);
  assert.deepEqual(ds.itemStats, [{ name: "DUSK_STONE", rank: 3.4, count: 500, pokemons: ["URSARING", "A", "B"] }]);
```

3. En la prueba "la caché recorta campos que no se usan", sustituye la línea `assert.deepEqual(Object.keys(i18n).sort(), ["item", "pkm", "synergy"]);` por:

```js
  assert.deepEqual(Object.keys(i18n).sort(), [
    "damage",
    "item",
    "item_description",
    "pkm",
    "stat",
    "status",
    "synergy",
    "technical_terms",
  ]);
  assert.deepEqual(comps[0].top_teams, []);
  assert.deepEqual(comps[0].mean_items, []);
```

4. En la prueba "force descarga aunque la caché sea reciente", cambia `assert.equal(fetch2.calls.length, 5);` por `assert.equal(fetch2.calls.length, 6);`.

- [ ] **Step 2: Ejecutar y comprobar que fallan**

Run: `node --test "test/*.test.js"`
Expected: FAIL en las tres pruebas modificadas.

- [ ] **Step 3: Recorte de `comps`.** En `src/data.js`, dentro del `trim` de la fuente `comps`, sustituye la línea `mean_team: { pokemons: (c.mean_team && c.mean_team.pokemons) || {} },` por:

```js
          mean_team: { pokemons: (c.mean_team && c.mean_team.pokemons) || {} },
          mean_items: Array.isArray(c.mean_items) ? c.mean_items : [],
          top_teams: (Array.isArray(c.top_teams) ? c.top_teams : []).map((tt) => ({
            rank: tt.rank,
            elo: tt.elo,
            pokemons: (Array.isArray(tt.pokemons) ? tt.pokemons : []).map((p) => ({ name: p.name, items: p.items || [] })),
          })),
```

- [ ] **Step 4: Recorte de `i18n`.** Sustituye el `trim` de la fuente `i18n` por:

```js
      trim: (o) => {
        const keep = ["pkm", "item", "synergy", "item_description", "stat", "status", "technical_terms", "damage"];
        const out = {};
        keep.forEach((k) => {
          out[k] = (o && o[k]) || {};
        });
        return out;
      },
```

- [ ] **Step 5: Fuente `items`.** En el array `SOURCES`, añade al final (después del objeto `i18n`):

```js
    {
      key: "items",
      url: GAME + "/meta/items",
      kind: "json",
      // El informe trae un bloque por rango de Elo; LEVEL_BALL incluye a todos los jugadores.
      trim: (tiers) => {
        const all = (Array.isArray(tiers) ? tiers : []).find((t) => t && t.tier === "LEVEL_BALL");
        const items = (all && all.items) || {};
        return Object.keys(items).map((k) => ({
          name: items[k].name || k,
          rank: Number(items[k].rank) || 0,
          count: Number(items[k].count) || 0,
          pokemons: Array.isArray(items[k].pokemons) ? items[k].pokemons.slice(0, 3) : [],
        }));
      },
    },
```

- [ ] **Step 6: `itemStats` en el Dataset.** En `buildDataset`, dentro del objeto `dataset = { ... }`, añade después de la línea `t: L.makeTranslator(by.i18n.body),`:

```js
        itemStats: L.itemTierList(by.items.body, 200),
```

- [ ] **Step 7: Ejecutar y comprobar que pasan**

Run: `node --test "test/*.test.js"`
Expected: PASS, 43 pruebas y 0 fallos.

- [ ] **Step 8: Commit**

```bash
git add src/data.js test/data.test.js
git commit -m "feat: load item report, comp items and top teams" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Nueva base visual, tier list y página de compo

**Files:**
- Create: `src/dom.js`, `src/app.js`, `src/views/tierlist.js`, `src/views/comp.js`
- Modify: `src/board.js`, `src/main.js`
- Replace: `index.html`, `styles.css`
- Delete: `src/ui.js`

**Interfaces:**
- Consumes:
  - De `PAC.logic`: `compKey`, `compTier`, `compName`, `compTitle`, `compCarries`, `splitCoreFlex`, `synergyLevel`, `stageGroups`, `playTip`, `filterComps`.
  - De `PAC.board.render(container, { boardKey, units, ds, el, portrait, piece? })`.
  - El `Dataset`, que tiene `comps`, `pokedex`, `families`, `triggers`, `t` e `itemStats`.
- Produces:
  - `PAC.dom`: `{ el, fmtRank, fmtPct, fmtDate, unit, itemIcon, synergyBadge, compSynergyBadges, tierBadge, synergyIconUrl, itemIconUrl }`.
  - `PAC.app.mount(ds, { onRefresh })`.
  - `ctx = { ds, state: { owned, partidaKey }, save(), navigate(view, arg?), byKey(key), filters?, tierScroll? }`.
  - `PAC.views.tierlist.render(container, ctx, selectedKey)` y `PAC.views.comp.render(container, ctx, comp)`.
  - `index.html` ya carga `src/views/partida.js` y `src/views/items.js`, que se crean en la tarea 10. Hasta entonces esas dos pestañas dan error en consola. Es algo previsto.

- [ ] **Step 1: Crear `src/dom.js`**

```js
/* Piezas visuales reutilizables: retratos con rareza y objetos, iconos de objeto, insignias de sinergia y de tier. */
(function (root) {
  "use strict";

  const PORTRAIT_BASE = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/";
  const ASSETS = "https://raw.githubusercontent.com/keldaanCommunity/pokemonAutoChess/master/app/public/src/assets/";

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
      if (c === null || c === undefined || c === false) return;
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

  const itemIconUrl = (item) => ASSETS + "item%7Btps%7D/" + item + ".png";
  const synergyIconUrl = (type) => ASSETS + "types/" + type + ".svg";

  // Retrato con borde de rareza; opcionalmente con objetos encima y una etiqueta.
  function unit(name, ds, opts) {
    const o = opts || {};
    const size = o.size || 44;
    const p = ds.pokedex[name];
    const label = ds.t.pkm(name);
    const box = el("span", {
      class: "unit rar-" + (p ? p.rarity : "NONE"),
      style: "--size:" + size + "px",
      title: o.title !== undefined ? o.title : label,
    });
    const fallback = () => {
      box.querySelectorAll(".unit-img").forEach((n) => n.remove());
      box.prepend(el("span", { class: "unit-fallback", text: initials(label) }));
    };
    if (p) {
      const img = el("img", {
        class: "unit-img",
        src: PORTRAIT_BASE + p.portrait + "/Normal.png",
        alt: o.decorative ? "" : label,
        loading: "lazy",
        width: size,
        height: size,
      });
      img.addEventListener("error", fallback, { once: true });
      box.appendChild(img);
    } else {
      fallback();
    }
    const items = (o.items || []).slice(0, 3);
    if (items.length) {
      box.appendChild(
        el(
          "span",
          { class: "unit-items" },
          items.map((it) => el("img", { src: itemIconUrl(it), alt: ds.t.item(it), title: ds.t.item(it), loading: "lazy" }))
        )
      );
    }
    if (o.tag) box.appendChild(el("span", { class: "unit-tag", text: o.tag }));
    return box;
  }

  function itemIcon(item, ds, size) {
    const name = ds.t.item(item);
    const desc = ds.t.itemDesc ? ds.t.itemDesc(item) : "";
    return el("img", {
      class: "item-icon",
      src: itemIconUrl(item),
      alt: name,
      title: desc ? name + ": " + desc : name,
      width: size || 24,
      height: size || 24,
      loading: "lazy",
    });
  }

  // Insignia de sinergia: icono + número (o "n/objetivo"), coloreada por nivel (1 bronce, 2 plata, 3 oro).
  function synergyBadge(type, ds, opts) {
    const o = opts || {};
    const name = ds.t.synergy(type);
    const text = o.target !== undefined ? o.count + "/" + o.target : String(o.count);
    return el("span", { class: "syn-badge lv" + (o.level || 0), title: name }, [
      el("img", { src: synergyIconUrl(type), alt: name, width: 18, height: 18 }),
      el("b", { text }),
    ]);
  }

  function compSynergyBadges(comp, ds, max) {
    const L = root.PAC.logic;
    return Object.keys(comp.synergies)
      .slice(0, max || 99)
      .map((type) =>
        synergyBadge(type, ds, {
          count: comp.synergies[type],
          level: L.synergyLevel(comp.synergies[type], ds.triggers[type] || []),
        })
      );
  }

  function tierBadge(tier, big) {
    return el("span", { class: "tier t-" + tier + (big ? " big" : ""), title: "Tier " + tier, text: tier });
  }

  root.PAC = root.PAC || {};
  root.PAC.dom = {
    el,
    fmtRank,
    fmtPct,
    fmtDate,
    unit,
    itemIcon,
    synergyBadge,
    compSynergyBadges,
    tierBadge,
    synergyIconUrl,
    itemIconUrl,
  };
})(window);
```

- [ ] **Step 2: Crear `src/app.js`**

```js
/* Interfaz: pestañas, rutas por hash (#tier, #tier/<clave>, #partida, #objetos) y estado guardado. */
(function (root) {
  "use strict";

  const STATE_KEY = "pac.state.v1";
  const TABS = [
    ["tier", "Tier list"],
    ["partida", "Mi partida"],
    ["objetos", "Objetos"],
  ];
  const $ = (sel) => document.querySelector(sel);
  let current = null;

  function loadState() {
    try {
      const s = JSON.parse(root.localStorage.getItem(STATE_KEY));
      if (s && Array.isArray(s.owned)) {
        return { owned: s.owned, partidaKey: typeof s.partidaKey === "string" ? s.partidaKey : null };
      }
    } catch (e) {
      // Sin almacenamiento: empezamos vacíos.
    }
    return { owned: [], partidaKey: null };
  }

  function saveState(state) {
    try {
      root.localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignorar: la app sigue funcionando sin guardar.
    }
  }

  function parseRoute() {
    const raw = (root.location.hash || "").replace(/^#/, "");
    const slash = raw.indexOf("/");
    const view = slash === -1 ? raw : raw.slice(0, slash);
    const arg = slash === -1 ? null : decodeURIComponent(raw.slice(slash + 1)) || null;
    const known = TABS.map((t) => t[0]);
    return { view: known.includes(view) ? view : "tier", arg };
  }

  function renderTabs(active) {
    const { el } = root.PAC.dom;
    $("#tabs").replaceChildren(
      ...TABS.map(([id, label]) =>
        el("a", { href: "#" + id, class: "tab", "aria-current": active === id ? "page" : null, text: label })
      )
    );
  }

  function render() {
    if (!current) return;
    const route = parseRoute();
    renderTabs(route.view);
    const view = $("#view");
    view.replaceChildren();
    const views = root.PAC.views;
    if (route.view === "partida") views.partida.render(view, current);
    else if (route.view === "objetos") views.items.render(view, current);
    else views.tierlist.render(view, current, route.arg);
  }

  function mount(ds, opts) {
    const { dom, logic } = root.PAC;
    const state = loadState();
    current = {
      ds,
      state,
      save: () => saveState(state),
      navigate: (view, arg) => {
        const hash = "#" + view + (arg ? "/" + encodeURIComponent(arg) : "");
        if (root.location.hash === hash) render();
        else root.location.hash = hash;
      },
      byKey: (key) => ds.comps.find((c) => logic.compKey(c) === key) || null,
    };
    $("#report").textContent =
      (ds.reportDate ? "Informe del " + dom.fmtDate(ds.reportDate) + " · " : "") + ds.comps.length + " compos";
    const notice = $("#notice");
    notice.hidden = !ds.stale;
    notice.textContent = ds.stale ? "Sin conexión: usando datos del " + dom.fmtDate(ds.reportDate) : "";
    $("#btn-refresh").onclick = () => opts.onRefresh();
    root.onhashchange = render;
    render();
  }

  root.PAC = root.PAC || {};
  root.PAC.app = { mount };
})(window);
```

- [ ] **Step 3: Crear `src/views/tierlist.js`**

```js
/* Vista Tier list: compos agrupadas por tier, con buscador y filtro de sinergias; a la derecha, la compo elegida. */
(function (root) {
  "use strict";

  const TIERS = ["S", "A", "B", "C"];

  function synergiesByUse(comps) {
    const count = {};
    comps.forEach((c) =>
      Object.keys(c.synergies).forEach((type) => {
        count[type] = (count[type] || 0) + 1;
      })
    );
    return Object.keys(count).sort((a, b) => count[b] - count[a] || (a < b ? -1 : 1));
  }

  function render(container, ctx, selectedKey) {
    const { dom, logic: L, views } = root.PAC;
    const { el } = dom;
    const ds = ctx.ds;
    ctx.filters = ctx.filters || { query: "", synergies: new Set() };
    const f = ctx.filters;

    const search = el("input", {
      id: "tl-search",
      type: "search",
      class: "search",
      placeholder: "Buscar Pokémon…",
      "aria-label": "Buscar compos por Pokémon",
      autocomplete: "off",
    });
    search.value = f.query;
    const synBar = el("div", { class: "syn-filter", role: "group", "aria-label": "Filtrar por sinergia" });
    const list = el("div", { class: "tl-list" });
    const detail = el("div", { class: "tl-detail" });
    const synTypes = synergiesByUse(ds.comps);

    const visible = () =>
      L.filterComps(ds.comps, f, ds.families, ds.t)
        .slice()
        .sort((a, b) => a.meanRank - b.meanRank);
    const firstVisible = visible()[0];
    const selected = (selectedKey && ctx.byKey(selectedKey)) || firstVisible || null;
    const activeKey = selected ? L.compKey(selected) : null;

    function drawSynBar() {
      synBar.replaceChildren(
        ...synTypes.map((type) =>
          el(
            "button",
            {
              type: "button",
              class: "syn-toggle",
              "aria-pressed": f.synergies.has(type) ? "true" : "false",
              title: ds.t.synergy(type),
              onclick: () => {
                if (f.synergies.has(type)) f.synergies.delete(type);
                else f.synergies.add(type);
                drawSynBar();
                drawList();
              },
            },
            [el("img", { src: dom.synergyIconUrl(type), alt: ds.t.synergy(type), width: 22, height: 22 })]
          )
        )
      );
    }

    function row(comp) {
      const key = L.compKey(comp);
      const { core, flex } = L.splitCoreFlex(comp);
      const name = L.compName(comp, ds.t);
      const tier = L.compTier(comp);
      return el(
        "button",
        {
          type: "button",
          class: "tl-row",
          "aria-current": key === activeKey ? "true" : null,
          "aria-label": name + ", tier " + tier + ", puesto medio " + dom.fmtRank(comp.meanRank),
          onclick: () => ctx.navigate("tier", key),
        },
        [
          el("span", { class: "tl-name" }, [
            el("strong", { text: name }),
            el("span", { class: "muted small", text: L.compTitle(comp, ds.t) }),
          ]),
          el("span", { class: "tl-syns" }, dom.compSynergyBadges(comp, ds, 3)),
          el(
            "span",
            { class: "tl-units" },
            core
              .concat(flex)
              .slice(0, 9)
              .map((u) => dom.unit(u.name, ds, { size: 40, items: u.itemCount >= 1 ? u.items : [], decorative: true }))
          ),
          el("span", { class: "tl-stats" }, [
            el("b", { text: dom.fmtRank(comp.meanRank) }),
            el("span", { class: "muted small", text: Math.round(comp.winrate) + " % top 1" }),
          ]),
        ]
      );
    }

    function drawList() {
      const comps = visible();
      list.replaceChildren();
      if (!comps.length) {
        list.appendChild(el("p", { class: "muted empty", text: "Ninguna compo coincide con los filtros." }));
        return;
      }
      TIERS.forEach((tier) => {
        const group = comps.filter((c) => L.compTier(c) === tier);
        if (!group.length) return;
        list.appendChild(
          el("section", { class: "tier-group", "aria-label": "Tier " + tier }, [
            el("div", { class: "tier-head" }, [
              dom.tierBadge(tier),
              el("span", { class: "muted small", text: group.length + (group.length === 1 ? " compo" : " compos") }),
            ]),
            ...group.map(row),
          ])
        );
      });
    }

    search.oninput = () => {
      f.query = search.value;
      drawList();
    };
    list.addEventListener("scroll", () => {
      ctx.tierScroll = list.scrollTop;
    });

    container.append(
      el("div", { class: "tl-layout" }, [
        el("div", { class: "tl-left" }, [el("div", { class: "tl-filters" }, [search, synBar]), list]),
        detail,
      ])
    );
    drawSynBar();
    drawList();
    list.scrollTop = ctx.tierScroll || 0;

    if (selected) views.comp.render(detail, ctx, selected);
    else detail.appendChild(el("p", { class: "muted empty", text: "Elige una compo de la lista." }));
  }

  root.PAC = root.PAC || {};
  root.PAC.views = root.PAC.views || {};
  root.PAC.views.tierlist = { render };
})(window);
```

- [ ] **Step 4: Crear `src/views/comp.js`**

```js
/* Página de una compo: cabecera, tablero final, carries y objetos, cómo jugarla y equipos reales. */
(function (root) {
  "use strict";

  function render(container, ctx, comp) {
    const { dom, logic: L, board } = root.PAC;
    const { el } = dom;
    const ds = ctx.ds;
    const key = L.compKey(comp);
    const { core, flex } = L.splitCoreFlex(comp);
    const units = core.concat(flex);
    const itemsByName = {};
    units.forEach((u) => {
      itemsByName[u.name] = u.items;
    });

    const panel = (title, hint) =>
      el("section", { class: "panel" }, [el("h3", { class: "sub", text: title }), hint ? el("p", { class: "muted small", text: hint }) : null]);
    const kpi = (value, label) => el("div", null, [el("dt", { text: label }), el("dd", { text: value })]);

    const head = el("header", { class: "cv-head" }, [
      dom.tierBadge(L.compTier(comp), true),
      el("div", { class: "cv-title" }, [
        el("h2", { text: L.compName(comp, ds.t) }),
        el("div", { class: "cv-syns" }, dom.compSynergyBadges(comp, ds)),
      ]),
      el("dl", { class: "kpis" }, [
        kpi(dom.fmtRank(comp.meanRank), "puesto medio"),
        kpi(Math.round(comp.winrate) + " %", "top 1"),
        kpi(String(comp.count), "partidas"),
      ]),
      el("button", {
        type: "button",
        class: "btn",
        text: "Seguir en Mi partida",
        onclick: () => {
          ctx.state.partidaKey = key;
          ctx.save();
          ctx.navigate("partida");
        },
      }),
    ]);

    // 1 · Tablero final
    const boardPanel = panel("Tablero final", "Arrastra para recolocar. Pasa el ratón por un Pokémon para ver por qué va ahí.");
    const boardBox = el("div");
    board.render(boardBox, {
      boardKey: "final:" + key,
      units: units.map((u) => ({ name: u.name, items: u.items })),
      ds,
      el,
      portrait: (n, d, size, decorative) => dom.unit(n, d, { size, decorative, title: "" }),
      piece: (n) => dom.unit(n, ds, { size: 56, items: itemsByName[n] || [], title: "" }),
    });
    boardPanel.appendChild(boardBox);

    // 2 · Carries y objetos
    const carryPanel = panel("Carries y sus objetos");
    L.compCarries(comp, 3).forEach((u) => {
      carryPanel.appendChild(
        el("div", { class: "carry" }, [
          dom.unit(u.name, ds, { size: 48, decorative: true }),
          el("strong", { text: ds.t.pkm(u.name) }),
          el(
            "div",
            { class: "carry-items" },
            u.items.map((it) => el("span", { class: "carry-item" }, [dom.itemIcon(it, ds, 28), el("span", { class: "small", text: ds.t.item(it) })]))
          ),
        ])
      );
    });
    if (comp.items.length) {
      carryPanel.appendChild(el("h4", { class: "sub", text: "Objetos más usados en la compo" }));
      carryPanel.appendChild(
        el(
          "div",
          { class: "item-row" },
          comp.items.slice(0, 6).map((x) =>
            el("div", { class: "item-stat" }, [dom.itemIcon(x.item, ds, 30), el("span", { class: "small muted", text: dom.fmtPct(x.frequency) })])
          )
        )
      );
    }

    // 3 · Cómo jugarla
    const playPanel = panel("Cómo jugarla");
    const groups = L.stageGroups(comp, ds.pokedex, ds.families);
    [
      ["early", "Inicio"],
      ["mid", "Mitad"],
      ["late", "Final"],
    ].forEach(([id, label]) => {
      if (!groups[id].length) return;
      playPanel.appendChild(
        el("div", { class: "stage-row" }, [
          el("b", { text: label }),
          el("div", { class: "stage-units" }, groups[id].map((n) => dom.unit(n, ds, { size: 40 }))),
        ])
      );
    });
    const tip = L.playTip(comp, ds.triggers, ds.t);
    if (tip) playPanel.appendChild(el("p", { class: "tip", text: tip }));
    playPanel.appendChild(el("p", { class: "muted small", text: "Se muestra la primera evolución: es como salen en la tienda." }));

    // 4 · Equipos reales
    const winners = comp.topTeams.filter((team) => team.rank === 1).slice(0, 6);
    const teams = winners.length ? winners : comp.topTeams.slice(0, 6);
    const teamsPanel = panel(winners.length ? "Equipos reales que quedaron 1.º" : "Equipos reales destacados");
    if (!teams.length) {
      teamsPanel.appendChild(el("p", { class: "muted", text: "El informe no trae equipos de ejemplo para esta compo." }));
    }
    teams.forEach((team) => {
      teamsPanel.appendChild(
        el("div", { class: "team" }, [
          el("span", { class: "small muted", text: team.rank + ".º · Elo " + team.elo }),
          el("div", { class: "team-units" }, team.units.map((u) => dom.unit(u.name, ds, { size: 36, items: u.items }))),
        ])
      );
    });

    container.append(head, el("div", { class: "cv-grid" }, [boardPanel, carryPanel, playPanel, teamsPanel]));
  }

  root.PAC = root.PAC || {};
  root.PAC.views = root.PAC.views || {};
  root.PAC.views.comp = { render };
})(window);
```

- [ ] **Step 5: `src/board.js`, pieza personalizada y motivo al pasar el ratón.**
  1. Cambia `const { boardKey, units, ds, el, portrait } = ctx;` por `const { boardKey, units, ds, el, portrait, piece } = ctx;`.
  2. En los atributos del `button` de cada casilla, añade justo después de la línea `"aria-pressed": i === selected ? "true" : "false",`:

```js
                title: name
                  ? (board.reasons[name] || []).map((code) => reasonText(code, name, ds)).filter(Boolean).join(" ")
                  : null,
```

  3. Sustituye `name ? [portrait(name, ds, 56)] : []` por `name ? [piece ? piece(name) : portrait(name, ds, 56)] : []`.

- [ ] **Step 6: `src/main.js`.** Cambia `root.PAC.ui.mount(ds, { onRefresh: () => start(true) });` por `root.PAC.app.mount(ds, { onRefresh: () => start(true) });`.

- [ ] **Step 7: Borrar `src/ui.js`**

Run: `git rm src/ui.js`

- [ ] **Step 8: Sustituir `index.html` por completo**

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
    <span id="report" class="muted small"></span>
  </div>
  <nav id="tabs" class="tabs" aria-label="Secciones"></nav>
  <p id="notice" class="notice" hidden></p>
  <button id="btn-refresh" type="button" class="btn">Actualizar datos</button>
</header>

<main id="view" class="view"></main>

<div id="loading" class="overlay-msg" role="status">Cargando datos del meta…</div>
<div id="error" class="overlay-msg" role="alert" hidden>
  <p id="error-text"></p>
  <button id="btn-retry" type="button" class="btn">Reintentar</button>
</div>

<footer class="foot">
  Herramienta no oficial. No lee ni modifica el juego. ·
  Datos: informe público del meta de pokemon-auto-chess.com y el código abierto del juego · Imágenes: repositorio del juego y PMD Sprite Collab
</footer>

<script src="src/logic.js"></script>
<script src="src/data.js"></script>
<script src="src/dom.js"></script>
<script src="src/board.js"></script>
<script src="src/views/comp.js"></script>
<script src="src/views/tierlist.js"></script>
<script src="src/views/partida.js"></script>
<script src="src/views/items.js"></script>
<script src="src/app.js"></script>
<script src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 9: Sustituir `styles.css` por completo**

```css
/* Tier list a la izquierda y detalle a la derecha (1920×1080). Oscuro por defecto, como las guías de autobattlers; claro si el sistema lo pide. */
:root {
  --bg: #12141a;
  --surface: #1b1e27;
  --raised: #232734;
  --line: #2e3342;
  --fg: #ecebef;
  --muted: #9aa0ad;
  --accent: #ff6b4a;
  --accent-soft: #3a211c;
  --good: #4ade80;
  --good-soft: #17301f;
  --on-accent: #12141a;
  --on-good: #0f1a12;
  --tier-S: #ff6b4a;
  --tier-A: #f5b942;
  --tier-B: #6fcf7f;
  --tier-C: #7aa7e0;
  --lv1: #8a5a3c;
  --lv2: #5f6675;
  --lv3: #a8822a;
  --rar-COMMON: #a0a0a0;
  --rar-UNCOMMON: #3bc95e;
  --rar-RARE: #41bfcc;
  --rar-EPIC: #927fff;
  --rar-ULTRA: #e53b3b;
  --rar-UNIQUE: #ffffff;
  --rar-LEGENDARY: #e6cb49;
  --rar-SPECIAL: #e58ee5;
  --rar-HATCH: #b9915a;
  --rar-NONE: #555b6b;
  --radius: 10px;
  --font: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #f3f2f5;
    --surface: #ffffff;
    --raised: #eceaf0;
    --line: #d9d6df;
    --fg: #1b1a20;
    --muted: #625e6b;
    --accent: #d9472b;
    --accent-soft: #fbe3dc;
    --good: #1f8a4c;
    --good-soft: #dcf1e4;
    --on-accent: #ffffff;
    --on-good: #ffffff;
    --tier-S: #e8553a;
    --tier-A: #e0a52a;
    --tier-B: #4fae60;
    --tier-C: #5b8cd0;
    --lv1: #b97a52;
    --lv2: #7d8592;
    --lv3: #b8901f;
    --rar-UNIQUE: #6b6b6b;
    color-scheme: light;
  }
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 14px/1.45 var(--font);
  display: grid;
  grid-template-rows: auto 1fr auto;
}
h1, h2, h3, h4 { margin: 0; line-height: 1.15; }
p { margin: 0; }
.muted { color: var(--muted); }
.small { font-size: 0.82rem; }
button { font: inherit; color: inherit; cursor: pointer; }
a { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.btn { border: 1px solid var(--line); background: var(--raised); border-radius: 8px; padding: 6px 12px; font-weight: 600; }
.btn.danger { border-color: var(--accent); color: var(--accent); }
.search { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--raised); color: var(--fg); font: inherit; }
.empty { text-align: center; padding: 24px 8px; }
.empty-title { font-weight: 700; font-size: 1.05rem; }

/* Cabecera y pestañas */
.top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 24px; padding: 10px 20px; background: var(--surface); border-bottom: 1px solid var(--line); }
.brand { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.brand h1 { font-size: 1.15rem; letter-spacing: 0.02em; }
.tabs { display: flex; gap: 4px; }
.tab { padding: 8px 14px; border-radius: 8px; color: var(--muted); font-weight: 700; text-decoration: none; }
.tab:hover { color: var(--fg); background: var(--raised); }
.tab[aria-current="page"] { color: var(--fg); background: var(--raised); box-shadow: inset 0 -3px 0 var(--accent); }
.notice { padding: 4px 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 600; font-size: 0.85rem; }
#btn-refresh { margin-left: auto; }
.view { min-height: 0; overflow: hidden; padding: 14px 20px; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px; display: grid; gap: 10px; align-content: start; min-width: 0; }
.panel h2 { font-size: 1.05rem; }
.sub { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; }

/* Retratos, objetos, insignias */
.unit { position: relative; width: var(--size); height: var(--size); flex: none; display: inline-grid; place-items: center; border-radius: 8px; border: 2px solid var(--rar-NONE); background: var(--raised); overflow: hidden; }
.unit-img { width: 100%; height: 100%; image-rendering: pixelated; }
.unit-fallback { font-weight: 800; font-size: 0.8rem; color: var(--muted); }
.unit-items { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; gap: 1px; }
.unit-items img { width: calc(var(--size) * 0.32); height: calc(var(--size) * 0.32); background: rgba(0, 0, 0, 0.55); border-radius: 3px; }
.unit-tag { position: absolute; top: 0; right: 0; background: var(--accent); color: var(--on-accent); font-size: 0.6rem; font-weight: 800; padding: 0 4px; border-bottom-left-radius: 5px; }
.rar-COMMON { border-color: var(--rar-COMMON); }
.rar-UNCOMMON { border-color: var(--rar-UNCOMMON); }
.rar-RARE { border-color: var(--rar-RARE); }
.rar-EPIC { border-color: var(--rar-EPIC); }
.rar-ULTRA { border-color: var(--rar-ULTRA); }
.rar-UNIQUE { border-color: var(--rar-UNIQUE); }
.rar-LEGENDARY { border-color: var(--rar-LEGENDARY); }
.rar-SPECIAL { border-color: var(--rar-SPECIAL); }
.rar-HATCH { border-color: var(--rar-HATCH); }
.item-icon { border-radius: 5px; background: var(--raised); flex: none; }
.tier { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 7px; font-weight: 900; color: #111; flex: none; }
.tier.big { width: 46px; height: 46px; font-size: 1.4rem; }
.t-S { background: var(--tier-S); }
.t-A { background: var(--tier-A); }
.t-B { background: var(--tier-B); }
.t-C { background: var(--tier-C); }
.syn-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px 2px 4px; border-radius: 7px; background: var(--raised); border: 1px solid var(--line); font-size: 0.8rem; }
.syn-badge img { width: 18px; height: 18px; }
.syn-badge.lv1 { background: var(--lv1); border-color: transparent; color: #fff; }
.syn-badge.lv2 { background: var(--lv2); border-color: transparent; color: #fff; }
.syn-badge.lv3 { background: var(--lv3); border-color: transparent; color: #fff; }

/* Tier list */
.tl-layout { display: grid; grid-template-columns: minmax(560px, 1fr) minmax(560px, 1.1fr); gap: 16px; height: 100%; min-height: 0; }
.tl-left { display: grid; grid-template-rows: auto 1fr; gap: 10px; min-height: 0; min-width: 0; }
.tl-filters { display: grid; gap: 8px; }
.syn-filter { display: flex; flex-wrap: wrap; gap: 4px; }
.syn-toggle { padding: 3px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); line-height: 0; }
.syn-toggle[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
.tl-list { overflow: auto; min-height: 0; display: grid; gap: 14px; align-content: start; padding-right: 4px; }
.tier-group { display: grid; gap: 6px; }
.tier-head { display: flex; align-items: center; gap: 10px; }
.tl-row { display: grid; grid-template-columns: 170px auto 1fr auto; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
.tl-row:hover { border-color: var(--muted); }
.tl-row[aria-current="true"] { border-color: var(--accent); background: var(--accent-soft); }
.tl-name { display: grid; gap: 2px; min-width: 0; }
.tl-syns { display: flex; flex-wrap: wrap; gap: 4px; }
.tl-units { display: flex; flex-wrap: wrap; gap: 4px; }
.tl-stats { display: grid; justify-items: end; font-variant-numeric: tabular-nums; }
.tl-stats b { font-size: 1.05rem; }
.tl-detail { overflow: auto; min-height: 0; min-width: 0; display: grid; gap: 14px; align-content: start; }

/* Página de compo */
.cv-head { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.cv-title { display: grid; gap: 6px; }
.cv-title h2 { font-size: 1.4rem; }
.cv-syns { display: flex; flex-wrap: wrap; gap: 4px; }
.kpis { display: flex; gap: 18px; margin: 0 0 0 auto; }
.kpis div { display: flex; flex-direction: column-reverse; align-items: flex-end; }
.kpis dt { font-size: 0.75rem; color: var(--muted); }
.kpis dd { margin: 0; font-size: 1.2rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.cv-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.carry { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.carry-items { display: flex; flex-wrap: wrap; gap: 8px; }
.carry-item { display: inline-flex; align-items: center; gap: 4px; }
.item-row { display: flex; flex-wrap: wrap; gap: 12px; }
.item-stat { display: grid; justify-items: center; gap: 2px; }
.stage-row { display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: center; }
.stage-units { display: flex; flex-wrap: wrap; gap: 4px; }
.tip { padding: 8px 10px; border-radius: 8px; background: var(--raised); }
.team { display: grid; gap: 4px; }
.team-units { display: flex; flex-wrap: wrap; gap: 3px; }

/* Tablero */
.enemy { text-align: center; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.bboard { display: grid; gap: 6px; padding: 10px; border-radius: 8px; background: var(--bg); overflow-x: auto; }
.brow-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.brow { display: grid; grid-template-columns: repeat(8, minmax(40px, 1fr)); gap: 4px; }
.bcell { position: relative; aspect-ratio: 1; max-width: 100%; min-width: 0; padding: 0; border: 2px dashed var(--line); border-radius: 8px; background: var(--raised); display: grid; place-items: center; }
.bcell.filled { border-style: solid; border-color: var(--line); background: var(--surface); cursor: grab; }
.bcell.moved::after { content: ""; position: absolute; top: 4px; right: 4px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.bcell.aura { border-style: solid; border-color: var(--good); background: var(--good-soft); }
.bcell.selected { border-color: var(--accent); background: var(--accent-soft); }
.bcell .unit { width: 88%; height: 88%; }
.btools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.breset { border: 1px solid var(--line); background: var(--raised); border-radius: 8px; padding: 4px 10px; font-weight: 600; }
.breasons { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.breason { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; padding: 6px 8px; border-radius: 8px; background: var(--raised); }

/* Mi partida */
.pt-layout { display: grid; grid-template-columns: minmax(420px, 0.9fr) minmax(560px, 1.3fr); gap: 16px; height: 100%; min-height: 0; }
.pt-left { overflow: auto; min-height: 0; }
.pt-left-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pt-right { overflow: auto; min-height: 0; min-width: 0; display: grid; gap: 14px; align-content: start; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { border: 1px solid var(--accent); background: var(--accent-soft); color: var(--accent); border-radius: 999px; padding: 2px 10px; font-size: 0.85rem; font-weight: 600; }
.fam-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; }
.fam { display: grid; justify-items: center; gap: 4px; padding: 6px 4px; border: 2px solid transparent; border-radius: 8px; background: var(--raised); }
.fam[aria-pressed="true"] { border-color: var(--good); background: var(--good-soft); }
.fam-name { font-size: 0.75rem; text-align: center; line-height: 1.15; overflow-wrap: anywhere; }
.pt-sugg { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.pt-sugg-row { width: 100%; text-align: left; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--raised); }
.pt-sugg-row[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
.pt-detail-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pt-detail-head a { margin-left: auto; }
.buy-list { display: flex; flex-wrap: wrap; gap: 10px; }
.buy { display: grid; justify-items: center; gap: 2px; width: 84px; text-align: center; }
.syn-progress { display: grid; gap: 6px; }
.syn-line { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pips { display: flex; gap: 4px; }
.pip { min-width: 26px; text-align: center; border-radius: 6px; padding: 1px 4px; font-size: 0.8rem; font-weight: 700; background: var(--raised); color: var(--muted); }
.pip.on { background: var(--good); color: var(--on-good); }

/* Objetos */
.items-view { height: 100%; grid-template-rows: auto 1fr; min-height: 0; }
.items-head { display: grid; gap: 6px; max-width: 560px; }
.table-wrap { overflow: auto; min-height: 0; border: 1px solid var(--line); border-radius: 8px; }
.items-table { width: 100%; border-collapse: collapse; min-width: 760px; }
.items-table th, .items-table td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; }
.items-table th { position: sticky; top: 0; z-index: 1; background: var(--raised); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.items-table td.num { font-variant-numeric: tabular-nums; text-align: right; }
.item-cell { display: inline-flex; align-items: center; gap: 8px; }
.holders { display: flex; gap: 3px; }

/* Carga, error y pie */
.overlay-msg { position: fixed; inset: 0; display: grid; place-content: center; justify-items: center; gap: 12px; background: var(--bg); font-size: 1.1rem; text-align: center; padding: 20px; }
.overlay-msg p { max-width: 50ch; }
.foot { padding: 8px 20px; font-size: 0.78rem; color: var(--muted); border-top: 1px solid var(--line); }

@media (max-width: 1100px) {
  body { height: auto; display: block; }
  .view { overflow: visible; }
  .tl-layout, .pt-layout { grid-template-columns: 1fr; height: auto; }
  .tl-list, .tl-detail, .pt-left, .pt-right { overflow: visible; }
  .cv-grid { grid-template-columns: 1fr; }
  .tl-row { grid-template-columns: 1fr auto; }
  .tl-syns, .tl-units { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

- [ ] **Step 10: Comprobar**

Run (Bash): `for f in src/dom.js src/app.js src/views/tierlist.js src/views/comp.js src/board.js src/main.js; do node --check $f || echo "FAIL $f"; done; node --test "test/*.test.js"; grep -rn "PAC.ui" src index.html; echo "grep exit: $?"`
Expected: ningún "FAIL", pasan 43 pruebas y `grep exit: 1`.

- [ ] **Step 11: Commit**

```bash
git add -A src index.html styles.css
git commit -m "feat: add Mobalytics-style tier list and comp page" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

El implementador NO abre el navegador. La comprobación visual la hace el arquitecto.

---

### Task 10: Vistas "Mi partida" y "Objetos", y README

**Files:**
- Create: `src/views/partida.js`, `src/views/items.js`
- Replace: `README.md`

**Interfaces:**
- Consumes:
  - `ctx` y `PAC.dom` de la tarea 9.
  - De `PAC.logic`: `normalizeSearch`, `finalStage`, `rankComps`, `compKey`, `compTier`, `compName`, `splitCoreFlex`, `synergyProgress`, `synergyLevel`, `itemTier`.
  - `PAC.board.render`.
  - `ds.itemStats` y `ds.t.itemDesc`.
- Produces: `PAC.views.partida.render(container, ctx)` y `PAC.views.items.render(container, ctx)`.

- [ ] **Step 1: Crear `src/views/partida.js`**

```js
/* Vista Mi partida: marcas lo que tienes y te dice qué compo seguir, qué comprar y cómo colocar. */
(function (root) {
  "use strict";

  function familyEntries(ds) {
    const L = root.PAC.logic;
    const fams = new Set();
    ds.comps.forEach((c) => c.units.forEach((u) => fams.add(u.family)));
    return Array.from(fams)
      .map((family) => {
        const names = ds.families[family] || [family];
        const display = L.finalStage(names, ds.pokedex);
        return {
          family,
          names,
          display,
          label: ds.t.pkm(display),
          search: L.normalizeSearch(names.map((n) => ds.t.pkm(n)).join(" ")),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }

  function render(container, ctx) {
    const { dom, logic: L, board } = root.PAC;
    const { el } = dom;
    const ds = ctx.ds;
    const state = ctx.state;
    ctx.partidaEntries = ctx.partidaEntries || familyEntries(ds);
    const entries = ctx.partidaEntries;
    let query = "";

    const search = el("input", { type: "search", class: "search", placeholder: "Buscar Pokémon…", "aria-label": "Buscar Pokémon", autocomplete: "off" });
    const chips = el("div", { class: "chips", "aria-live": "polite" });
    const grid = el("div", { class: "fam-grid" });
    const right = el("div", { class: "pt-right" });
    const reset = el("button", {
      type: "button",
      class: "btn danger",
      text: "Nueva partida",
      onclick: () => {
        state.owned = [];
        state.partidaKey = null;
        ctx.save();
        search.value = "";
        query = "";
        drawAll();
      },
    });

    container.append(
      el("div", { class: "pt-layout" }, [
        el("section", { class: "panel pt-left", "aria-label": "Mis Pokémon" }, [
          el("div", { class: "pt-left-head" }, [el("h2", { text: "Mis Pokémon" }), reset]),
          search,
          chips,
          grid,
        ]),
        right,
      ])
    );

    search.oninput = () => {
      query = L.normalizeSearch(search.value);
      drawGrid();
    };

    function toggle(family) {
      const i = state.owned.indexOf(family);
      if (i >= 0) state.owned.splice(i, 1);
      else state.owned.push(family);
      ctx.save();
      drawAll();
      const again = container.querySelector('.fam[data-family="' + CSS.escape(family) + '"]');
      if (again) again.focus();
    }

    function drawAll() {
      drawChips();
      drawGrid();
      drawRight();
    }

    function drawChips() {
      chips.replaceChildren();
      if (state.owned.length === 0) {
        chips.appendChild(el("p", { class: "muted small", text: "Haz clic en los Pokémon que tengas." }));
        return;
      }
      state.owned.forEach((family) => {
        const entry = entries.find((e) => e.family === family);
        if (!entry) return;
        chips.appendChild(
          el("button", { type: "button", class: "chip", "aria-label": "Quitar " + entry.label, onclick: () => toggle(family) }, [
            entry.label,
            el("span", { "aria-hidden": "true", text: " ✕" }),
          ])
        );
      });
    }

    function drawGrid() {
      grid.replaceChildren();
      const owned = new Set(state.owned);
      const list = entries.filter((e) => !query || e.search.includes(query));
      if (!list.length) {
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
              title: e.names.map((n) => ds.t.pkm(n)).join(" → "),
              onclick: () => toggle(e.family),
            },
            [dom.unit(e.display, ds, { size: 48, decorative: true, title: "" }), el("span", { class: "fam-name", text: e.label })]
          )
        );
      });
    }

    function drawRight() {
      right.replaceChildren();
      const owned = new Set(state.owned);
      const ranked = L.rankComps(ds.comps, owned, { limit: 5 });
      right.appendChild(
        el("section", { class: "panel" }, [
          el("h2", { text: "Compos que te encajan" }),
          owned.size === 0 ? el("p", { class: "muted small", text: "Las mejores del meta. Marca tus Pokémon para ver cuál te encaja más." }) : null,
          el(
            "ol",
            { class: "pt-sugg" },
            ranked.map(({ comp, match }) => {
              const key = L.compKey(comp);
              return el("li", null, [
                el(
                  "button",
                  {
                    type: "button",
                    class: "pt-sugg-row",
                    "aria-pressed": state.partidaKey === key ? "true" : "false",
                    onclick: () => {
                      state.partidaKey = key;
                      ctx.save();
                      drawRight();
                    },
                  },
                  [
                    dom.tierBadge(L.compTier(comp)),
                    el("span", { class: "tl-name" }, [
                      el("strong", { text: L.compName(comp, ds.t) }),
                      el("span", {
                        class: "muted small",
                        text: (owned.size ? "Coincide " + dom.fmtPct(match) + " · " : "") + "Puesto " + dom.fmtRank(comp.meanRank),
                      }),
                    ]),
                    el("span", { class: "tl-syns" }, dom.compSynergyBadges(comp, ds, 3)),
                  ]
                ),
              ]);
            })
          ),
        ])
      );
      const comp = state.partidaKey ? ctx.byKey(state.partidaKey) : null;
      if (!comp) {
        right.appendChild(
          el("section", { class: "panel empty" }, [
            el("p", { class: "empty-title", text: "Elige una compo" }),
            el("p", { class: "muted", text: "Verás qué te falta comprar, tus sinergias y cómo colocar a tus Pokémon." }),
          ])
        );
        return;
      }
      right.appendChild(detail(comp, owned));
    }

    function detail(comp, owned) {
      const key = L.compKey(comp);
      const { core, flex } = L.splitCoreFlex(comp);
      const units = core.concat(flex);
      const have = units.filter((u) => owned.has(u.family));
      const missing = units.filter((u) => !owned.has(u.family));
      const itemsByName = {};
      units.forEach((u) => {
        itemsByName[u.name] = u.items;
      });

      const sec = el("section", { class: "panel" }, [
        el("div", { class: "pt-detail-head" }, [
          dom.tierBadge(L.compTier(comp)),
          el("h2", { text: L.compName(comp, ds.t) }),
          el("a", { href: "#tier/" + encodeURIComponent(key), class: "small", text: "Ver guía completa" }),
        ]),
        el("h3", { class: "sub", text: missing.length ? "Te falta comprar" : "¡Ya tienes toda la compo!" }),
      ]);
      if (missing.length) {
        sec.appendChild(
          el(
            "div",
            { class: "buy-list" },
            missing.map((u) => {
              const base = (ds.families[u.family] || [u.name])[0];
              return el("div", { class: "buy" }, [
                dom.unit(base, ds, { size: 48, decorative: true, tag: core.includes(u) ? "Núcleo" : null }),
                el("span", { class: "small", text: ds.t.pkm(base) }),
                base !== u.name ? el("span", { class: "muted small", text: "→ " + ds.t.pkm(u.name) }) : null,
              ]);
            })
          )
        );
      }

      const progress = L.synergyProgress(have.map((u) => u.name), ds.pokedex, ds.triggers);
      const counts = {};
      progress.forEach((p) => {
        counts[p.type] = p.count;
      });
      sec.appendChild(el("h3", { class: "sub", text: "Tus sinergias para esta compo" }));
      sec.appendChild(
        el(
          "div",
          { class: "syn-progress" },
          Object.keys(comp.synergies).map((type) => {
            const thresholds = ds.triggers[type] || [];
            const count = counts[type] || 0;
            return el("div", { class: "syn-line" }, [
              dom.synergyBadge(type, ds, { count, target: comp.synergies[type], level: L.synergyLevel(count, thresholds) }),
              el("span", { class: "pips" }, thresholds.map((x) => el("span", { class: "pip" + (count >= x ? " on" : ""), text: String(x) }))),
            ]);
          })
        )
      );

      sec.appendChild(el("h3", { class: "sub", text: "Coloca lo que tienes" }));
      const boardBox = el("div");
      board.render(boardBox, {
        boardKey: key,
        units: have.map((u) => ({ name: u.name, items: u.items })),
        ds,
        el,
        portrait: (n, d, size, decorative) => dom.unit(n, d, { size, decorative, title: "" }),
        piece: (n) => dom.unit(n, ds, { size: 56, items: itemsByName[n] || [], title: "" }),
      });
      sec.appendChild(boardBox);
      return sec;
    }

    drawAll();
  }

  root.PAC = root.PAC || {};
  root.PAC.views = root.PAC.views || {};
  root.PAC.views.partida = { render };
})(window);
```

- [ ] **Step 2: Crear `src/views/items.js`**

```js
/* Vista Objetos: tier list de objetos del informe oficial, con descripción y en quién se usan. */
(function (root) {
  "use strict";

  function render(container, ctx) {
    const { dom, logic: L } = root.PAC;
    const { el } = dom;
    const ds = ctx.ds;
    let query = "";

    const search = el("input", { type: "search", class: "search", placeholder: "Buscar objeto…", "aria-label": "Buscar objeto", autocomplete: "off" });
    const body = el("tbody");
    container.append(
      el("section", { class: "panel items-view" }, [
        el("div", { class: "items-head" }, [
          el("h2", { text: "Objetos" }),
          el("p", {
            class: "muted small",
            text: "Puesto medio de los equipos que llevan cada objeto (más bajo = mejor). Solo objetos con 200 usos o más.",
          }),
          search,
        ]),
        el("div", { class: "table-wrap" }, [
          el("table", { class: "items-table" }, [
            el("thead", null, [
              el("tr", null, ["Tier", "Objeto", "Qué hace", "Puesto medio", "Usos", "Lo llevan"].map((h) => el("th", { scope: "col", text: h }))),
            ]),
            body,
          ]),
        ]),
      ])
    );

    function draw() {
      const rows = ds.itemStats.filter((x) => !query || L.normalizeSearch(ds.t.item(x.name)).includes(query));
      body.replaceChildren(
        ...rows.map((x) =>
          el("tr", null, [
            el("td", null, [dom.tierBadge(L.itemTier(x.rank))]),
            el("td", null, [el("span", { class: "item-cell" }, [dom.itemIcon(x.name, ds, 32), el("strong", { text: ds.t.item(x.name) })])]),
            el("td", { class: "small", text: ds.t.itemDesc(x.name) }),
            el("td", { class: "num", text: dom.fmtRank(x.rank) }),
            el("td", { class: "num", text: x.count.toLocaleString("es-ES") }),
            el("td", null, [el("span", { class: "holders" }, x.pokemons.filter((n) => ds.pokedex[n]).map((n) => dom.unit(n, ds, { size: 32 })))]),
          ])
        )
      );
      if (!rows.length) {
        body.appendChild(el("tr", null, [el("td", { colspan: "6", class: "muted", text: "Ningún objeto coincide con la búsqueda." })]));
      }
    }

    search.oninput = () => {
      query = L.normalizeSearch(search.value);
      draw();
    };
    draw();
  }

  root.PAC = root.PAC || {};
  root.PAC.views = root.PAC.views || {};
  root.PAC.views.items = { render };
})(window);
```

- [ ] **Step 3: Sustituir `README.md` por completo**

````markdown
# Compañero Auto Chess

Una guía al estilo de las webs de TFT (como Mobalytics) para [Pokémon Auto Chess](https://pokemon-auto-chess.com). La abres en una ventana aparte (lo ideal es un segundo monitor) y te muestra:

- la **tier list de compos** del meta actual (S, A, B y C);
- la **página de cada compo**: tablero final, carries y sus objetos, cómo jugarla y equipos reales que quedaron 1.º;
- **Mi partida**: marcas lo que tienes y te dice qué compo seguir, qué comprar y cómo colocar;
- la **tier list de objetos**, con lo que hace cada uno.

No hay que instalar nada. Es una página web que se abre con doble clic.

> **¿Me pueden banear por usarla?** Está pensada para no incumplir las normas del juego: no lee la pantalla, no toca el juego, no hace clics por ti y no usa tu cuenta. Funciona como una guía en papel: todo lo que sabe de tu partida se lo dices tú. Más detalles en [Normas de uso](#normas-de-uso-del-juego).

---

## 1. Descargarla (solo la primera vez)

**Opción fácil, sin programas:**

1. En esta página de GitHub, pulsa el botón verde **Code** y luego **Download ZIP**.
2. Descomprime el ZIP en una carpeta que vayas a recordar, por ejemplo `Documentos\pokeTFT`.

**Si usas git:**

```bash
git clone https://github.com/AnastasioNieves/pokeTFT.git
```

## 2. Abrirla

1. Entra en la carpeta y haz **doble clic en `index.html`**. Se abrirá en tu navegador (Chrome, Edge o Firefox).
2. Espera unos segundos mientras sale *"Cargando datos del meta…"*. La primera vez necesita **internet**.
3. Arrastra la ventana a tu **segundo monitor**, o ponla al lado del juego.

> Consejo: guarda `index.html` en los marcadores del navegador para abrirla en un clic.

## 3. Cómo se usa

Arriba hay tres pestañas: **Tier list**, **Mi partida** y **Objetos**.

### Tier list: elige qué jugar

- A la izquierda están todas las compos, agrupadas en **S** (las mejores), **A**, **B** y **C** según el puesto medio en que acaban. Cada fila muestra:
  - el **nombre** de la compo: su carry y su sinergia principal, por ejemplo *Ursaring Salvaje*;
  - las **sinergias** con su icono y el número que lleva. El color indica el nivel que alcanza: bronce, plata u oro;
  - sus **Pokémon**: el color del borde es su rareza (gris común, verde poco común, azul raro, morado épico, rojo ultra, dorado legendario…). Encima de los carries salen sus objetos;
  - el **puesto medio** (de 8; cuanto más bajo, mejor) y el **% de veces que queda 1.º**.
- **Buscar Pokémon:** escribe un nombre (por ejemplo `pooch`) para ver solo las compos que lo usan.
- **Filtrar por sinergia:** haz clic en los iconos de sinergia de arriba. Si activas varios, solo quedan las compos que las tienen todas.
- Haz clic en una compo para abrir su guía a la derecha.

### La guía de una compo

- **Tablero final:** dónde va cada Pokémon, con sus objetos encima. Pasa el ratón por uno para ver por qué va ahí. Puedes **recolocarlos** arrastrando, o con un clic en el Pokémon y otro en la casilla. Tus cambios se guardan y **Volver a la sugerencia** los deshace.
- **Carries y sus objetos:** los Pokémon que más objetos llevan y cuáles. Pasa el ratón por un objeto para leer qué hace.
- **Cómo jugarla:** qué Pokémon buscar al **inicio**, a **mitad** y al **final** de la partida (con el nombre con el que salen en la tienda), y un consejo para empezar.
- **Equipos reales:** equipos de jugadores que ganaron con esta compo, con su Elo y sus objetos.
- **Seguir en Mi partida:** te lleva a Mi partida con esta compo elegida.

### Mi partida: sigue tu compo mientras juegas

1. A la izquierda, haz **clic en los Pokémon que tengas** (se ponen en verde). Usa el buscador para ir rápido. Si tienes un Poochyena, marca Mightyena: cada ficha cuenta para toda la familia.
2. A la derecha verás las **5 compos que mejor te encajan**, con el % que ya tienes. Elige una.
3. Debajo te dice:
   - **Te falta comprar:** con el nombre con el que salen en la tienda. Las del **Núcleo** son las imprescindibles.
   - **Tus sinergias:** cuántas llevas de cada una y qué niveles tienes activos (en verde).
   - **Coloca lo que tienes:** el tablero con tus Pokémon, editable igual que el de la guía.
4. Al empezar otra partida, pulsa **Nueva partida**.

### Objetos

La tier list de objetos: qué hace cada uno, el puesto medio de quien lo lleva, cuántas veces se usa y en qué Pokémon. Puedes buscar por nombre.

---

## Preguntas frecuentes

**¿De dónde salen los datos? ¿Están actualizados?**
Del informe público del meta que publica el propio juego cada día. La fecha aparece arriba. La app los descarga como mucho **una vez al día**; **Actualizar datos** fuerza la descarga.

**Sale "No se pudieron descargar los datos".**
Comprueba tu conexión a internet y pulsa **Reintentar**.

**Sale "Sin conexión: usando datos del …".**
No hay internet, pero la app usa la última copia que descargó.

**Sale "formato inesperado".**
El juego probablemente ha cambiado cómo publica sus datos. Prueba más tarde y, si sigue, [abre un aviso (issue)](https://github.com/AnastasioNieves/pokeTFT/issues).

**Un Pokémon u objeto sale sin imagen.**
No se encontró su imagen. Es solo estético.

**¿La colocación del tablero es la que usa la gente?**
No: el informe no dice dónde coloca la gente a cada Pokémon. Es una sugerencia basada en cómo funcionan las sinergias y los objetos, y puedes cambiarla.

---

## Normas de uso del juego

Los [Términos de Servicio de Pokémon Auto Chess](https://pokemon-auto-chess.com/terms-of-service) prohíben usar automatización o herramientas no autorizadas y acceder sin permiso a sus APIs. Por eso esta app:

- **no** lee la pantalla ni hace capturas;
- **no** lee ni modifica la conexión del juego;
- **no** mete nada en la página del juego (no es una extensión);
- **no** hace clics ni pulsa teclas por ti;
- **no** usa tu cuenta ni tu sesión;
- **solo** descarga datos públicos sin identificarse: el informe del meta que el propio juego publica para cualquiera y los datos e imágenes de su código abierto.

Es una herramienta no oficial hecha por fans, sin relación con los creadores del juego. Pokémon y sus personajes pertenecen a sus respectivos dueños.

---

## Para desarrolladores

HTML, CSS y JavaScript sin dependencias ni compilación. Los scripts son clásicos (no módulos) para que funcionen al abrir el archivo directamente.

| Archivo | Qué hace |
|---|---|
| `index.html`, `styles.css` | Estructura y estilos (oscuro por defecto, claro si el sistema lo pide) |
| `src/logic.js` | Funciones puras: compos, tiers, sinergias, tablero, textos |
| `src/data.js` | Descarga, caché de 24 h y modo sin conexión |
| `src/dom.js` | Piezas visuales: retratos, objetos, insignias |
| `src/app.js`, `src/main.js` | Pestañas, rutas y arranque |
| `src/views/` | Tier list, página de compo, Mi partida y Objetos |
| `src/board.js` | Tablero editable |
| `test/` | Pruebas con `node:test` |
| `guides/` | Guía visual de la compo Salvaje/Siniestro |
| `docs/` | Diseños y planes |

Para ejecutar las pruebas (Node 22 o superior):

```bash
node --test "test/*.test.js"
```

**Fuentes de datos:**
- De pokemon-auto-chess.com: `/meta-v2`, `/meta/items`, `/meta/metadata` y `/types-trigger`.
- Del repositorio [keldaanCommunity/pokemonAutoChess](https://github.com/keldaanCommunity/pokemonAutoChess): `pokemons-data.csv`, la traducción al español y los iconos de objetos y sinergias.
- Retratos de [PMD Sprite Collab](https://sprites.pmdcollab.org/).
````

- [ ] **Step 4: Comprobar**

Run (Bash): `node --check src/views/partida.js && node --check src/views/items.js && node --test "test/*.test.js"`
Expected: no hay errores de sintaxis y pasan 43 pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/views/partida.js src/views/items.js README.md
git commit -m "feat: add Mi partida and Objetos views; rewrite README guide" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

El implementador NO abre el navegador. La comprobación visual la hace el arquitecto.
