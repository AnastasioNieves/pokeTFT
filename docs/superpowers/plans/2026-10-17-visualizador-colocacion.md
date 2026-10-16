# Visualizador de colocación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a "Mi compo" una pestaña "Tablero" con un tablero de 8×3 que propone la colocación de los Pokémon del jugador según reglas del juego, explica cada decisión y permite recolocarlos (arrastrando o con clics). Lo que cambie el jugador se guarda por compo.

**Architecture:** Las reglas y la gestión del tablero son funciones puras en `src/logic.js`, probadas con Node. El tablero interactivo va en un archivo nuevo, `src/board.js` (`PAC.board.render`). `src/ui.js` solo añade las pestañas y delega en él.

**Tech Stack:** HTML, CSS y JavaScript (ES2020) sin dependencias. Pruebas con `node:test` (Node 24).

**Spec:** `docs/superpowers/specs/2026-10-17-visualizador-colocacion-design.md`

## Global Constraints

- La app NUNCA lee la pantalla, captura imágenes, intercepta el tráfico del juego, inyecta código en la página del juego, hace clics o pulsa teclas automáticamente, ni usa la cuenta del jugador.
- Sin dependencias npm, sin compilación y sin módulos ES. Se usan `<script>` clásicos que hacen `root.PAC = root.PAC || {}` y `root.PAC.<nombre> = {...}`. `src/logic.js` exporta además con `module.exports`.
- Todo acceso a `localStorage` va dentro de `try/catch`.
- Toda la interfaz está en español.
- Tablero: 8 columnas × 3 filas. Fila 0 = delantera (la más cercana al enemigo, dibujada arriba), 1 = medio, 2 = trasera. Casilla = `fila * 8 + columna` (0–23).
- Las pruebas se ejecutan con `node --test "test/*.test.js"` desde `C:\Users\tasio\pokeTFT` (Git Bash).
- Commits: cada mensaje acaba con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- NO modifiques `test/fixtures/`.

### Datos de las fixtures que usan las pruebas (`test/fixtures/pokedex.csv`)

| Nombre | HP | Atk | Def | SpDef | Alcance | Tipos |
|---|---|---|---|---|---|---|
| RHYDON | 240 | 23 | 20 | 6 | 1 | GROUND/MONSTER/ROCK |
| LICKILICKY | 150 | 10 | 7 | 7 | 1 | WILD/NORMAL/GOURMET |
| AMBIPOM | 130 | 12 | 8 | 8 | 1 | WILD/NORMAL |
| GABITE | 160 | 12 | 10 | 10 | 1 | DRAGON/GROUND/MONSTER |
| URSARING | 280 | 24 | 12 | 10 | 1 | WILD/GROUND |
| MIGHTYENA | 190 | 19 | 8 | 8 | 1 | WILD/DARK |
| ABRA | 90 | 4 | 4 | 8 | 4 | PSYCHIC/HUMAN |
| RATTATA | 50 | 4 | 2 | 2 | 1 | WILD/NORMAL |

---

### Task 5: Reglas y tablero en `logic.js`

**Files:**
- Modify: `src/logic.js`
- Modify: `test/logic-base.test.js` (añadir estadísticas a la ficha esperada de MIGHTYENA)
- Modify: `test/logic-meta.test.js` (quitar las pruebas de `placementHint`/`placeBoard` y añadir las nuevas)

**Interfaces:**
- Consumes: `buildPokedex` (fichas `{ name, family, rarity, stage, types, range, portrait, variant }`).
- Produces (en `PAC.logic` / `module.exports`):
  - Las fichas del pokedex ganan `hp`, `attack`, `defense` y `speDef` (números).
  - `BOARD_COLS = 8`, `BOARD_ROWS = 3`, `BOARD_SIZE = 24` (exportadas).
  - `suggestBoard(units: {name, items}[], pokedex) → { cells: (string|null)[24], reasons: Record<name, string[]>, auras: Record<name, "row"|"around"> }`.
  - `mergeBoard(saved: Record<name, number>|undefined, units, pokedex) → { cells, suggested, reasons, auras }` (`suggested` = `cells` de `suggestBoard`).
  - `moveUnit(cells, from, to) → cells` (copia nueva con las dos casillas intercambiadas).
  - `boardToSaved(cells) → Record<name, number>`.
  - `auraCells(index, kind: "row"|"around") → number[]` (en orden ascendente).
  - Se eliminan `placementHint` y `placeBoard`.

- [ ] **Step 1: Actualizar la prueba del pokedex.** En `test/logic-base.test.js`, en la prueba "buildPokedex crea fichas y familias ordenadas por etapa", el objeto esperado de `pokedex.MIGHTYENA` pasa a ser:

```js
  assert.deepEqual(pokedex.MIGHTYENA, {
    name: "MIGHTYENA",
    family: "POOCHYENA",
    rarity: "RARE",
    stage: 2,
    types: ["WILD", "DARK"],
    range: 1,
    portrait: "0262",
    variant: false,
    hp: 190,
    attack: 19,
    defense: 8,
    speDef: 8,
  });
```

- [ ] **Step 2: Sustituir las pruebas del tablero viejo.** En `test/logic-meta.test.js`, borra por completo las dos pruebas `test("placementHint usa el alcance de ataque", ...)` y `test("placeBoard rellena cada fila desde el centro", ...)`. Añade al final del archivo:

```js
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
```

- [ ] **Step 3: Ejecutar y comprobar que fallan**

Run: `node --test "test/*.test.js"`
Expected: FAIL en la prueba de MIGHTYENA (faltan `hp`…) y en las 7 nuevas (`L.suggestBoard is not a function`, etc.).

- [ ] **Step 4: Estadísticas en `buildPokedex`.** En `src/logic.js`, justo después de la línea `variant: r.Variant === "true",` añade:

```js
        hp: Number(r.HP) || 0,
        attack: Number(r.Attack) || 0,
        defense: Number(r.Defense) || 0,
        speDef: Number(r["Special Defense"]) || 0,
```

- [ ] **Step 5: Sustituir el tablero viejo por el nuevo.** En `src/logic.js`, borra las funciones `placementHint` y `placeBoard` y la línea `const CENTER_OUT = [3, 4, 2, 5, 1, 6, 0, 7];` que hay entre ellas. En su lugar (justo antes de `function compTitle`) pon:

```js
  // Tablero de un jugador: 8 columnas × 3 filas. Fila 0 = delantera (junto al enemigo), 2 = trasera.
  const BOARD_COLS = 8;
  const BOARD_ROWS = 3;
  const BOARD_SIZE = BOARD_COLS * BOARD_ROWS;
  const CENTER_OUT = [3, 4, 2, 5, 1, 6, 0, 7];
  const CORNERS_IN = [0, 7, 1, 6, 2, 5, 3, 4];
  // Objetos cuyo efecto alcanza a los aliados de al lado en la misma fila, o a los de alrededor.
  const ROW_AURA_ITEMS = ["ABILITY_SHIELD", "GRACIDEA_FLOWER", "EXP_SHARE", "EFFICIENT_BANDANNA"];
  const AROUND_AURA_ITEMS = ["GREEN_ORB", "COVER_BAND"];

  function tankScore(p) {
    return p.hp + 10 * (p.defense + p.speDef);
  }

  function suggestBoard(units, pokedex) {
    const cells = new Array(BOARD_SIZE).fill(null);
    const reasons = {};
    const auras = {};
    const front = [];
    const back = [];
    const corners = [];
    units.forEach((u) => {
      const p = pokedex[u.name];
      if (!p || reasons[u.name]) return;
      const items = u.items || [];
      const rowAura = items.find((i) => ROW_AURA_ITEMS.includes(i));
      const aroundAura = items.find((i) => AROUND_AURA_ITEMS.includes(i));
      if (rowAura) auras[u.name] = "row";
      else if (aroundAura) auras[u.name] = "around";
      const entry = { name: u.name, p, rowAura, aroundAura };
      if (p.range > 1) {
        reasons[u.name] = ["ranged"];
        back.push(entry);
      } else if (p.types.includes("DARK") || items.includes("DUSK_STONE")) {
        reasons[u.name] = [p.types.includes("DARK") ? "dark" : "dark_stone"];
        corners.push(entry);
        return;
      } else {
        reasons[u.name] = ["melee"];
        front.push(entry);
      }
      if (rowAura) reasons[u.name].push("row_aura:" + rowAura);
      if (aroundAura) reasons[u.name].push("around_aura:" + aroundAura);
    });

    const flag = (v) => (v ? 1 : 0);
    const byName = (a, b) => (a.name < b.name ? -1 : 1);
    front.sort(
      (a, b) =>
        flag(b.aroundAura) - flag(a.aroundAura) ||
        flag(b.rowAura) - flag(a.rowAura) ||
        tankScore(b.p) - tankScore(a.p) ||
        byName(a, b)
    );
    back.sort((a, b) => flag(b.rowAura) - flag(a.rowAura) || b.p.attack - a.p.attack || byName(a, b));
    corners.sort((a, b) => b.p.attack - a.p.attack || byName(a, b));

    const everyCell = Array.from({ length: BOARD_SIZE }, (_, i) => i);
    const place = (entry, row, order) => {
      const tries = order
        .map((c) => row * BOARD_COLS + c)
        .concat(CENTER_OUT.map((c) => BOARD_COLS + c))
        .concat(everyCell);
      const i = tries.find((idx) => cells[idx] === null);
      if (i === undefined) return;
      cells[i] = entry.name;
      if (Math.floor(i / BOARD_COLS) !== row) reasons[entry.name].push("overflow");
    };
    front.forEach((e) => place(e, 0, CENTER_OUT));
    back.forEach((e) => place(e, 2, CENTER_OUT));
    corners.forEach((e) => place(e, 2, CORNERS_IN));
    return { cells, reasons, auras };
  }

  function nearestFree(cells, index) {
    const r = Math.floor(index / BOARD_COLS);
    const c = index % BOARD_COLS;
    let best = -1;
    let bestDistance = Infinity;
    cells.forEach((value, j) => {
      if (value !== null) return;
      const d = Math.abs(Math.floor(j / BOARD_COLS) - r) * 10 + Math.abs((j % BOARD_COLS) - c);
      if (d < bestDistance) {
        bestDistance = d;
        best = j;
      }
    });
    return best;
  }

  function mergeBoard(saved, units, pokedex) {
    const suggestion = suggestBoard(units, pokedex);
    const cells = new Array(BOARD_SIZE).fill(null);
    const present = new Set(units.filter((u) => pokedex[u.name]).map((u) => u.name));
    const placed = new Set();
    Object.keys(saved || {}).forEach((name) => {
      const i = saved[name];
      if (!present.has(name) || placed.has(name)) return;
      if (!Number.isInteger(i) || i < 0 || i >= BOARD_SIZE || cells[i] !== null) return;
      cells[i] = name;
      placed.add(name);
    });
    suggestion.cells.forEach((name, i) => {
      if (!name || placed.has(name)) return;
      const target = cells[i] === null ? i : nearestFree(cells, i);
      if (target === -1) return;
      cells[target] = name;
      placed.add(name);
    });
    return { cells, suggested: suggestion.cells, reasons: suggestion.reasons, auras: suggestion.auras };
  }

  function moveUnit(cells, from, to) {
    const next = cells.slice();
    next[to] = cells[from];
    next[from] = cells[to];
    return next;
  }

  function boardToSaved(cells) {
    const saved = {};
    cells.forEach((name, i) => {
      if (name) saved[name] = i;
    });
    return saved;
  }

  function auraCells(index, kind) {
    const r = Math.floor(index / BOARD_COLS);
    const c = index % BOARD_COLS;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (kind === "row" && dr !== 0) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= BOARD_ROWS || cc < 0 || cc >= BOARD_COLS) continue;
        out.push(rr * BOARD_COLS + cc);
      }
    }
    return out.sort((a, b) => a - b);
  }
```

- [ ] **Step 6: Actualizar `api`.** En el objeto `const api = { ... }`, sustituye las dos líneas `placementHint,` y `placeBoard,` por:

```js
    BOARD_COLS,
    BOARD_ROWS,
    BOARD_SIZE,
    suggestBoard,
    mergeBoard,
    moveUnit,
    boardToSaved,
    auraCells,
```

- [ ] **Step 7: Ejecutar y comprobar que pasan**

Run: `node --test "test/*.test.js"`
Expected: PASS, 32 pruebas y 0 fallos.

- [ ] **Step 8: Commit**

```bash
git add src/logic.js test/logic-base.test.js test/logic-meta.test.js
git commit -m "feat: add rule-based board suggestion, merge and move logic" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

> Al terminar esta tarea, `src/ui.js` todavía llama a `logic().placeBoard` en `boardSection`, así que la app web queda rota hasta la tarea 6. Las pruebas de Node no lo detectan. Es algo previsto: la tarea 6 lo sustituye.

---

### Task 6: Pestaña "Tablero" (`board.js`, `ui.js`, estilos, HTML y README)

**Files:**
- Create: `src/board.js`
- Modify: `src/ui.js`
- Modify: `styles.css`
- Modify: `index.html`
- Modify: `README.md`

**Interfaces:**
- Consumes: de `PAC.logic`, `mergeBoard`, `moveUnit`, `boardToSaved`, `auraCells` y `BOARD_COLS`. De `Dataset`, `ds.t.pkm`, `ds.t.item` y `ds.pokedex[name].range`. Y los helpers `el(tag, attrs, children)` y `portrait(name, ds, size, decorative)` que ya existen en `src/ui.js`.
- Produces:
  - `PAC.board.render(container, { compId, units: {name, items}[], ds, el, portrait })`.
  - `localStorage["pac.boards.v1"] = { [compId]: { [name]: index } }`.
  - `pac.state.v1` gana el campo `tab: "list" | "board"`.

- [ ] **Step 1: Crear `src/board.js`**

```js
/* Tablero de colocación: sugerencia por reglas + edición arrastrando o con clics. Se guarda por compo. */
(function (root) {
  "use strict";

  const BOARDS_KEY = "pac.boards.v1";
  const ROW_NAMES = ["Fila delantera", "Fila del medio", "Fila trasera"];
  const logic = () => root.PAC.logic;

  function loadBoards() {
    try {
      const b = JSON.parse(root.localStorage.getItem(BOARDS_KEY));
      return b && typeof b === "object" ? b : {};
    } catch (e) {
      return {};
    }
  }

  function saveBoards(boards) {
    try {
      root.localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
    } catch (e) {
      // Sin almacenamiento: los cambios duran hasta recargar.
    }
  }

  function reasonText(code, name, ds) {
    const [kind, item] = code.split(":");
    const p = ds.pokedex[name];
    switch (kind) {
      case "ranged":
        return "Ataca a distancia (alcance " + (p ? p.range : "?") + "): va atrás, protegido.";
      case "dark":
        return "Siniestro cuerpo a cuerpo: salta solo al enemigo más lejano, así que empieza atrás, en una esquina.";
      case "dark_stone":
        return "Con " + ds.t.item("DUSK_STONE") + " es Siniestro: salta solo al enemigo más lejano, así que empieza atrás, en una esquina.";
      case "melee":
        return "Cuerpo a cuerpo: va delante. Los más resistentes (vida + defensas) van en el centro.";
      case "row_aura":
        return "Su " + ds.t.item(item) + " ayuda a los aliados de al lado en su fila: mejor en el centro.";
      case "around_aura":
        return "Su " + ds.t.item(item) + " afecta a los aliados de alrededor: mejor rodeado.";
      case "overflow":
        return "Su fila estaba llena: va en la del medio.";
      default:
        return "";
    }
  }

  function positionText(index) {
    const cols = logic().BOARD_COLS;
    return ROW_NAMES[Math.floor(index / cols)] + ", columna " + ((index % cols) + 1);
  }

  function render(container, ctx) {
    const { compId, units, ds, el, portrait } = ctx;
    const L = logic();
    container.replaceChildren();
    if (units.length === 0) {
      container.appendChild(el("p", { class: "muted", text: "Marca Pokémon de esta compo para colocarlos en el tablero." }));
      return;
    }
    const boards = loadBoards();
    const board = L.mergeBoard(boards[compId], units, ds.pokedex);
    let cells = board.cells;
    let selected = null;

    function move(from, to) {
      if (from === to) return;
      cells = L.moveUnit(cells, from, to);
      boards[compId] = L.boardToSaved(cells);
      saveBoards(boards);
      selected = null;
      draw(to);
    }

    function onCell(i) {
      if (selected === null) {
        if (cells[i]) {
          selected = i;
          draw(i);
        }
      } else if (selected === i) {
        selected = null;
        draw(i);
      } else {
        move(selected, i);
      }
    }

    function resetToSuggestion() {
      delete boards[compId];
      saveBoards(boards);
      cells = board.suggested.slice();
      selected = null;
      draw(null);
    }

    function draw(focusIndex) {
      container.replaceChildren();
      const cols = L.BOARD_COLS;
      const highlight = new Set();
      const selectedName = selected !== null ? cells[selected] : null;
      if (selectedName && board.auras[selectedName]) {
        L.auraCells(selected, board.auras[selectedName]).forEach((i) => highlight.add(i));
      }

      const grid = el("div", { class: "bboard", role: "grid", "aria-label": "Tablero de 8 por 3. Arriba está el enemigo." }, [
        el("div", { class: "enemy", text: "▲ Enemigo" }),
      ]);
      ROW_NAMES.forEach((rowName, r) => {
        const row = el("div", { class: "brow", role: "row", "aria-label": rowName });
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const name = cells[i];
          const classes = ["bcell"];
          if (name) classes.push("filled");
          if (i === selected) classes.push("selected");
          if (highlight.has(i)) classes.push("aura");
          if (name && board.suggested[i] !== name) classes.push("moved");
          row.appendChild(
            el(
              "button",
              {
                type: "button",
                role: "gridcell",
                class: classes.join(" "),
                "data-index": String(i),
                "aria-label": rowName + ", columna " + (c + 1) + ": " + (name ? ds.t.pkm(name) : "vacía"),
                "aria-pressed": i === selected ? "true" : "false",
                draggable: name ? "true" : null,
                onclick: () => onCell(i),
                ondragstart: (e) => {
                  e.dataTransfer.setData("text/plain", String(i));
                  e.dataTransfer.effectAllowed = "move";
                },
                ondragover: (e) => e.preventDefault(),
                ondrop: (e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData("text/plain"));
                  if (Number.isInteger(from)) move(from, i);
                },
              },
              name ? [portrait(name, ds, 56)] : []
            )
          );
        }
        grid.append(el("div", { class: "brow-label", text: rowName, "aria-hidden": "true" }), row);
      });

      const hasSaved = !!boards[compId];
      const tools = el("div", { class: "btools" }, [
        el("p", {
          class: "muted small",
          text: "Arrastra un Pokémon a otra casilla, o haz clic en él y luego en la casilla de destino. Esc cancela.",
        }),
        hasSaved ? el("button", { type: "button", class: "breset", text: "Volver a la sugerencia", onclick: resetToSuggestion }) : null,
      ]);

      const placedNames = cells
        .map((name, i) => ({ name, i }))
        .filter((x) => x.name);
      const list = el(
        "ul",
        { class: "breasons" },
        placedNames.map(({ name, i }) => {
          const texts = (board.reasons[name] || []).map((code) => reasonText(code, name, ds)).filter(Boolean);
          if (board.suggested[i] !== name) texts.push("Lo has colocado tú.");
          return el("li", { class: "breason" }, [
            portrait(name, ds, 36, true),
            el("div", null, [
              el("div", null, [el("strong", { text: ds.t.pkm(name) }), el("span", { class: "muted", text: " · " + positionText(i) })]),
              el("div", { class: "small", text: texts.join(" ") }),
            ]),
          ]);
        })
      );

      container.append(
        grid,
        tools,
        list,
        el("p", {
          class: "muted small",
          text: "Sugerencia basada en cómo funcionan las sinergias y los objetos. El informe del meta no dice dónde coloca la gente a cada Pokémon.",
        })
      );

      if (focusIndex !== null && focusIndex !== undefined) {
        const target = container.querySelector('.bcell[data-index="' + focusIndex + '"]');
        if (target) target.focus();
      }
    }

    container.onkeydown = (e) => {
      if (e.key === "Escape" && selected !== null) {
        const was = selected;
        selected = null;
        draw(was);
      }
    };
    draw(null);
  }

  root.PAC = root.PAC || {};
  root.PAC.board = { render };
})(window);
```

- [ ] **Step 2: `src/ui.js`, estado con pestaña.** En `loadState`, sustituye:

```js
      if (s && Array.isArray(s.owned)) return { owned: s.owned, compId: s.compId || null };
```

por:

```js
      if (s && Array.isArray(s.owned)) {
        return { owned: s.owned, compId: s.compId || null, tab: s.tab === "board" ? "board" : "list" };
      }
```

y sustituye `return { owned: [], compId: null };` por `return { owned: [], compId: null, tab: "list" };`.

- [ ] **Step 3: `src/ui.js`, pestañas en `renderDetail`.** En `renderDetail`, sustituye el bloque que empieza en `const parts = [` y acaba en `box.append(...parts.filter(Boolean));` por:

```js
    const tab = ui.state.tab === "board" ? "board" : "list";
    const tabs = el(
      "div",
      { class: "tabs", role: "tablist", "aria-label": "Vista de la compo" },
      [
        ["list", "Lista"],
        ["board", "Tablero"],
      ].map(([id, label]) =>
        el("button", {
          type: "button",
          role: "tab",
          class: "tab",
          id: "tab-" + id,
          "aria-selected": tab === id ? "true" : "false",
          "aria-controls": "tab-panel",
          text: label,
          onclick: () => {
            ui.state.tab = id;
            saveState(ui.state);
            renderDetail(ui);
            const again = document.getElementById("tab-" + id);
            if (again) again.focus();
          },
        })
      )
    );
    const panel = el("div", { id: "tab-panel", role: "tabpanel", "aria-labelledby": "tab-" + tab });
    if (tab === "board") {
      root.PAC.board.render(panel, { compId: comp.id, units: ownedUnits, ds: ui.ds, el, portrait });
    } else {
      const listParts = [
        unitSection("Núcleo", core, ui, owned),
        flex.length ? unitSection("Relleno", flex, ui, owned) : null,
        synergySection(comp, ownedUnits, ui),
      ];
      panel.append(...listParts.filter(Boolean));
    }
    box.append(
      el("h3", { class: "comp-title", text: L.compTitle(comp, ui.ds.t) }),
      el("p", { class: "muted", text: compStats(comp, L.scoreComp(comp, owned).match, owned.size > 0) }),
      tabs,
      panel
    );
```

- [ ] **Step 4: `src/ui.js`, quitar el tablero viejo.** Borra por completo la función `boardSection(ownedUnits, ui) { ... }`. Después comprueba que `grep -n "boardSection\|placeBoard" src/ui.js` no devuelve nada.

- [ ] **Step 5: `index.html`.** Justo después de `<script src="src/data.js"></script>` añade:

```html
<script src="src/board.js"></script>
```

- [ ] **Step 6: `styles.css`.** Sustituye estas cinco líneas:

```css
.board { display: grid; gap: 4px; padding: 10px; border-radius: 8px; background: var(--bg); overflow-x: auto; }
.enemy { text-align: center; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.row { display: grid; grid-template-columns: repeat(8, minmax(36px, 1fr)); gap: 4px; }
.cell { aspect-ratio: 1; max-width: 100%; border-radius: 6px; background: var(--sunk); display: grid; place-items: center; }
.cell .portrait { width: 90%; height: 90%; }
```

por:

```css
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); }
.tab { border: 0; background: none; padding: 8px 14px; font-weight: 700; color: var(--muted); border-bottom: 3px solid transparent; margin-bottom: -1px; }
.tab[aria-selected="true"] { color: var(--fg); border-bottom-color: var(--accent); }
#tab-panel { display: grid; gap: 14px; }
.enemy { text-align: center; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.bboard { display: grid; gap: 6px; padding: 10px; border-radius: 8px; background: var(--bg); overflow-x: auto; }
.brow-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.brow { display: grid; grid-template-columns: repeat(8, minmax(40px, 1fr)); gap: 4px; }
.bcell { aspect-ratio: 1; max-width: 100%; min-width: 0; padding: 0; border: 2px dashed var(--line); border-radius: 8px; background: var(--sunk); display: grid; place-items: center; }
.bcell.filled { border-style: solid; border-color: var(--line); background: var(--surface); cursor: grab; }
.bcell.moved { border-color: var(--muted); }
.bcell.aura { border-style: solid; border-color: var(--good); background: var(--good-soft); }
.bcell.selected { border-color: var(--accent); background: var(--accent-soft); }
.bcell .portrait { width: 88%; height: 88%; }
.btools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.breset { border: 1px solid var(--line); background: var(--bg); border-radius: 8px; padding: 4px 10px; font-weight: 600; }
.breasons { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.breason { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; padding: 6px 8px; border-radius: 8px; background: var(--bg); }
```

- [ ] **Step 7: `README.md`.** En la sección "### Paso 3 · Sigue la compo (columna derecha)", sustituye la viñeta que empieza por `- **Colocación orientativa**:` por:

```markdown
- Arriba de esta columna hay dos pestañas: **Lista** (lo anterior) y **Tablero**.
```

Justo después de esa sección (antes de "### Paso 4 · Nueva partida"), añade:

```markdown
### Paso 3b · Coloca a tus Pokémon (pestaña «Tablero»)

- Pulsa la pestaña **Tablero** en la columna derecha. Verás el tablero del juego (8 × 3), con el enemigo arriba.
- La app coloca a los Pokémon que has marcado siguiendo cómo funciona el juego:
  - los de **cuerpo a cuerpo**, delante (los más resistentes, en el centro);
  - los que atacan **a distancia**, detrás;
  - los **Siniestros** cuerpo a cuerpo (o con **Piedra Noche**), atrás en las esquinas, porque saltan solos al enemigo más lejano;
  - quien lleva **Escudo Habilidad** o **Gracídea**, en el centro de su fila, porque ayudan a los de al lado.
- Debajo del tablero, cada Pokémon tiene una frase que explica **por qué** va ahí.
- **Para moverlos:** arrástralos a otra casilla, o haz clic en uno y luego en la casilla de destino. Si la casilla está ocupada, se intercambian.
- Al seleccionar a quien lleva un objeto de ese tipo, se **iluminan en verde** las casillas a las que afecta.
- Tus cambios se guardan para esa compo. **Volver a la sugerencia** los deshace.

> Es una sugerencia: el juego no publica dónde coloca la gente a cada Pokémon.
```

- [ ] **Step 8: Comprobar**

Run (Bash): `node --check src/board.js && node --check src/ui.js && node --test "test/*.test.js" && grep -n "boardSection\|placeBoard" src/ui.js; echo "grep exit: $?"`
Expected: no hay errores de sintaxis, pasan 32 pruebas y el grep no encuentra nada (`grep exit: 1`).

- [ ] **Step 9: Commit**

```bash
git add src/board.js src/ui.js styles.css index.html README.md
git commit -m "feat: add interactive placement board tab" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

El implementador NO abre el navegador. La comprobación visual la hace el arquitecto.
