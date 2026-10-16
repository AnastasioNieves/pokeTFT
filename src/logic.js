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
    placementHint,
    placeBoard,
    compTitle,
  };

  root.PAC = root.PAC || {};
  root.PAC.logic = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
