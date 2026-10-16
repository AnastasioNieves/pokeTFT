/* Descarga y caché de los datos públicos del meta. Solo GET anónimos, como mucho 1 vez cada 24 h. */
(function (root) {
  "use strict";

  const DAY = 24 * 60 * 60 * 1000;
  const CACHE_PREFIX = "pac.cache.v2.";
  const OLD_PREFIXES = ["pac.cache.v1."];
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
          mean_items: Array.isArray(c.mean_items) ? c.mean_items : [],
          top_teams: (Array.isArray(c.top_teams) ? c.top_teams : []).map((tt) => ({
            rank: tt.rank,
            elo: tt.elo,
            pokemons: (Array.isArray(tt.pokemons) ? tt.pokemons : []).map((p) => ({ name: p.name, items: p.items || [] })),
          })),
        })),
    },
    { key: "metadata", url: GAME + "/meta/metadata", kind: "json" },
    { key: "triggers", url: GAME + "/types-trigger", kind: "json" },
    { key: "pokedex", url: REPO + "/app/models/precomputed/pokemons-data.csv", kind: "text" },
    {
      key: "i18n",
      url: REPO + "/app/public/dist/client/locales/es/translation.json",
      kind: "json",
      trim: (o) => {
        const keep = ["pkm", "item", "synergy", "item_description", "stat", "status", "technical_terms", "damage", "weather"];
        const out = {};
        keep.forEach((k) => {
          out[k] = (o && o[k]) || {};
        });
        return out;
      },
    },
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
  ];

  class DataError extends Error {
    constructor(source, cause, kind) {
      super((kind === "format" ? "Formato inesperado: " : "No se pudo descargar: ") + source);
      this.name = "DataError";
      this.source = source;
      this.cause = cause;
      this.kind = kind || "network";
    }
  }

  const logic = () => root.PAC.logic;

  function buildDataset(by) {
    let dataset;
    try {
      const L = logic();
      const built = L.buildPokedex(L.parseCsv(by.pokedex.body));
      const meta = by.metadata.body;
      const created = Array.isArray(meta) && meta[0] && meta[0].created_at;
      dataset = {
        reportDate: created ? String(created).slice(0, 10) : null,
        stale: Object.keys(by).some((k) => by[k].stale),
        pokedex: built.pokedex,
        families: built.families,
        triggers: by.triggers.body || {},
        comps: L.normalizeComps(by.comps.body, built.pokedex, { minCount: 50 }),
        t: L.makeTranslator(by.i18n.body),
        itemStats: L.itemTierList(by.items.body, 200),
      };
    } catch (err) {
      throw new DataError("datos", err, "format");
    }
    if (dataset.comps.length === 0) throw new DataError("comps", null, "format");
    return dataset;
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

  function dropOldCache(storage) {
    try {
      for (let i = storage.length - 1; i >= 0; i--) {
        const k = storage.key(i);
        if (k && OLD_PREFIXES.some((p) => k.startsWith(p))) storage.removeItem(k);
      }
    } catch (e) {
      // Sin permiso: no pasa nada.
    }
  }

  function load(opts) {
    const storage = browserStorage();
    if (storage) dropOldCache(storage);
    return createLoader({ fetch: root.fetch.bind(root), storage }).load(opts);
  }

  const api = { SOURCES, DataError, createLoader, buildDataset, load };

  root.PAC = root.PAC || {};
  root.PAC.data = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
