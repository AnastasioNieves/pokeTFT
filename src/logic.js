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
        portrait: String(r.Index).replace(/-/g, "/"),
        variant: r.Variant === "true",
        hp: Number(r.HP) || 0,
        attack: Number(r.Attack) || 0,
        defense: Number(r.Defense) || 0,
        speDef: Number(r["Special Defense"]) || 0,
      };
    });
    const families = {};
    Object.keys(pokedex).forEach((name) => {
      const fam = pokedex[name].family;
      (families[fam] = families[fam] || []).push(name);
    });
    Object.keys(families).forEach((fam) => {
      families[fam].sort(
        (a, b) =>
          pokedex[a].stage - pokedex[b].stage ||
          pokedex[a].portrait.split("/").length - pokedex[b].portrait.split("/").length ||
          (a < b ? -1 : 1)
      );
    });
    return { pokedex, families };
  }

  function familyOf(name, pokedex) {
    return pokedex[name] ? pokedex[name].family : name;
  }

  function finalStage(names, pokedex) {
    const main = names.filter((name) => pokedex[name] && !pokedex[name].variant);
    const pool = main.length ? main : names;
    let best;
    let bestStage = -1;
    pool.forEach((name) => {
      const stage = pokedex[name] ? pokedex[name].stage : 0;
      if (stage > bestStage) {
        best = name;
        bestStage = stage;
      }
    });
    return best;
  }

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
    const byFamily = {};
    Object.keys(mons)
      .filter((name) => pokedex[name])
      .forEach((name) => {
        const unit = {
          name,
          family: pokedex[name].family,
          frequency: Number(mons[name].frequency) || 0,
          items: Array.isArray(mons[name].items) ? mons[name].items.slice() : [],
        };
        const prev = byFamily[unit.family];
        if (
          !prev ||
          unit.frequency > prev.frequency ||
          (unit.frequency === prev.frequency && pokedex[name].stage > pokedex[prev.name].stage)
        ) {
          byFamily[unit.family] = unit;
        }
      });
    const units = Object.values(byFamily).sort(
      (a, b) => b.frequency - a.frequency || (a.name < b.name ? -1 : 1)
    );
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

  function compTitle(comp, t, max) {
    return Object.keys(comp.synergies)
      .slice(0, max || 3)
      .map((type) => t.synergy(type))
      .join(" · ");
  }

  const api = {
    humanize,
    makeTranslator,
    normalizeSearch,
    parseCsv,
    buildPokedex,
    familyOf,
    finalStage,
    normalizeComp,
    normalizeComps,
    scoreComp,
    rankComps,
    splitCoreFlex,
    synergyProgress,
    BOARD_COLS,
    BOARD_ROWS,
    BOARD_SIZE,
    suggestBoard,
    mergeBoard,
    moveUnit,
    boardToSaved,
    auraCells,
    compTitle,
  };

  root.PAC = root.PAC || {};
  root.PAC.logic = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
