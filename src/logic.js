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
