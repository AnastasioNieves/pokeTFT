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

test("buildPokedex pone la forma base antes que la alternativa y finalStage la elige", () => {
  const header =
    "Index,Name,Category,Tier,Additional pick,Type 1,Type 2,Type 3,Type 4,HP,Attack,Speed,Defense,Special Defense,Attack Range,Max PP,Ability,Family,Family Type 1,Family Type 2,Family Type 3,Family Type 4,Duo,Regional,Nb stages,Variant";
  const row = (index, name, tier) =>
    [index, name, "ULTRA", tier, "false", "WILD", "GROUND", "", "", 1, 1, 1, 1, 1, 1, 100, "X", "TEDDIURSA", "", "", "", "", "false", "false", 3, "false"].join(",");
  const csv = [
    header,
    row("0901-0001", "URSALUNA_BLOODMOON", 3),
    row("0901", "URSALUNA", 3),
    row("0217", "URSARING", 2),
    row("0216", "TEDDIURSA", 1),
  ].join("\n");
  const { pokedex, families } = L.buildPokedex(L.parseCsv(csv));
  assert.deepEqual(families.TEDDIURSA, ["TEDDIURSA", "URSARING", "URSALUNA", "URSALUNA_BLOODMOON"]);
  assert.equal(L.finalStage(families.TEDDIURSA, pokedex), "URSALUNA");
  assert.equal(L.finalStage(["NOPE", "TEDDIURSA"], pokedex), "TEDDIURSA");
  assert.equal(L.finalStage([], pokedex), undefined);
});
