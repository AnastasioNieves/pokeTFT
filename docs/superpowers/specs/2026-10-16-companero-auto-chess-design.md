# Compañero Auto Chess — Diseño

Fecha: 2026-10-16 · Estado: aprobado por el usuario (pendiente de revisión del documento)

## Objetivo

Una página web local, abierta en una ventana del navegador en el segundo monitor (1920×1080), que ayuda a jugar a Pokémon Auto Chess:

1. El jugador marca a mano los Pokémon que tiene.
2. La app le sugiere las compos del meta que mejor encajan.
3. Para la compo elegida, le dice qué le falta comprar, qué objetos dar y una colocación orientativa.

Idioma de la interfaz: español.

## Cumplimiento de las normas de uso (requisito duro)

Los Términos de Servicio del juego (actualizados el 23-04-2026) prohíben "unauthorized automation/tools" y el acceso no autorizado a APIs. Para no incumplirlos, la app **nunca**:

- lee la pantalla, captura imágenes ni usa OCR;
- intercepta, lee o modifica el tráfico del juego (WebSocket/Colyseus);
- inyecta código, extensiones o estilos en la página del juego;
- hace clics, pulsa teclas ni automatiza ninguna acción en el juego;
- usa la cuenta del jugador ni envía cabeceras de autenticación.

Todo lo que sabe del estado de la partida lo introduce el jugador con clics. Solo hace peticiones `GET` anónimas a endpoints públicos, que el servidor sirve con `Access-Control-Allow-Origin: *` y `Cache-Control: max-age=86400`. Además las guarda en caché y no repite la descarga en menos de 24 h salvo que el usuario pulse "Actualizar datos".

En el pie de la app aparece: "Herramienta no oficial. No lee ni modifica el juego." y los créditos de las fuentes.

## Fuentes de datos

Todas aceptan peticiones CORS desde cualquier origen (verificado), incluido `file://` (origen `null`).

| Clave | URL | Uso |
|---|---|---|
| `comps` | `https://pokemon-auto-chess.com/meta-v2` | Array de ~128 compos (clusters) |
| `metadata` | `https://pokemon-auto-chess.com/meta/metadata` | Fecha del informe |
| `triggers` | `https://pokemon-auto-chess.com/types-trigger` | Umbrales de sinergia |
| `pokedex` | `https://raw.githubusercontent.com/keldaanCommunity/pokemonAutoChess/master/app/models/precomputed/pokemons-data.csv` | Familias, rareza, tipos, alcance |
| `i18n` | `https://raw.githubusercontent.com/keldaanCommunity/pokemonAutoChess/master/app/public/dist/client/locales/es/translation.json` | Nombres en español |
| retratos | `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/{ruta}/Normal.png` | Se cargan con `<img>`, sin `fetch` |

### Formatos relevantes (verificados el 2026-10-16)

**`meta-v2`**: array de objetos. Campos usados:
```json
{
  "cluster_id": "26",
  "count": 237,
  "winrate": 27.00422,
  "mean_rank": 3.80169,
  "synergies": { "ground": 6, "bug": 2, "monster": 2, "dragon": 3 },
  "mean_team": {
    "pokemons": {
      "RHYDON": { "frequency": 0.43, "mean_items": 2.55, "items": ["MUSCLE_BAND", "SHELL_BELL", "FLAME_ORB"] }
    }
  }
}
```
- `winrate` está en porcentaje (0–100) y `mean_rank` en puestos del 1 al 8.
- Las claves de `synergies` van en minúsculas; las de `pokemons`, en mayúsculas y con la etapa concreta (p. ej. `GABITE`, no `GARCHOMP`).
- `count` va de 11 a 284. Hay 119 compos con `count >= 50`.

**`metadata`**: `[{ "created_at": "2026-10-15T05:47:55.018257", "count": 100000, "time_limit": "..." }]`.

**`types-trigger`**: `{ "WILD": [2,4,6,9], "DARK": [3,5,7], ... }`, con claves en mayúsculas.

**`pokemons-data.csv`**: cabecera
`Index,Name,Category,Tier,Additional pick,Type 1,Type 2,Type 3,Type 4,HP,Attack,Speed,Defense,Special Defense,Attack Range,Max PP,Ability,Family,Family Type 1,Family Type 2,Family Type 3,Family Type 4,Duo,Regional,Nb stages,Variant`
- `Family` es el nombre de la primera etapa: MIGHTYENA → `POOCHYENA` y URSALUNA → `TEDDIURSA`.
- `Index` puede tener variante: `0020-0001` corresponde a la ruta de retrato `0020/0001`.
- `Category` es la rareza: COMMON, UNCOMMON, RARE, EPIC, ULTRA, UNIQUE, LEGENDARY, HATCH, SPECIAL…
- `Tier` es la etapa evolutiva (1, 2, 3…).
- `Attack Range` es un entero; 1 significa cuerpo a cuerpo.

**`i18n`**: objeto con las secciones `pkm` (`MIGHTYENA` → "Mightyena"), `item` (`DUSK_STONE` → "Piedra Noche") y `synergy` (`WILD` → "Salvaje"). Si falta una clave, se muestra la clave legible: `DUSK_STONE` → "Dusk Stone".

## Arquitectura

Archivos estáticos, sin compilación ni dependencias. Se abre con doble clic en `index.html`.

Restricción: los módulos ES no cargan desde `file://`, así que se usan `<script>` clásicos. Cada archivo define un único objeto global (`PAC.data`, `PAC.logic`, `PAC.ui`). `logic.js` también exporta con `module.exports` cuando existe, para poder probarlo con Node.

```
index.html          estructura de las 3 vistas y carga de scripts en orden
styles.css          tokens de color (tema claro/oscuro) y layout
src/data.js         descarga, caché y normalización → PAC.data
src/logic.js        funciones puras (sin DOM ni red) → PAC.logic
src/ui.js           render y eventos → PAC.ui
src/main.js         arranque: carga datos y monta la UI
test/logic.test.js  pruebas con node:test sobre fixtures
test/fixtures/      recortes reales de meta-v2, CSV y triggers
README.md           cómo usarla y las normas que respeta
```

### `src/data.js` — `PAC.data`

- `load({ force }) → Promise<Dataset>`: devuelve un `Dataset` normalizado.
  - Por cada fuente: si hay caché en `localStorage` con menos de 24 h y `force` es falso, la usa. Si no, hace `fetch` y, si va bien, guarda `{ savedAt, body }`.
  - Si el `fetch` falla y hay caché, usa la caché (aunque sea vieja) y marca `stale: true`.
  - Si falla y no hay caché, lanza un `DataError` con el nombre de la fuente.
  - Todas las lecturas y escrituras de `localStorage` van en `try/catch`. Si no hay espacio (el CSV ocupa ~150 KB y meta-v2 ~600 KB), sigue sin caché.
- Usa `PAC.logic.parseCsv` y `PAC.logic.buildPokedex` para normalizar.

`Dataset`:
```js
{
  reportDate: "2026-10-15",                     // de metadata
  stale: false,
  pokedex: { MIGHTYENA: { name, family, rarity, stage, types:[], range, portrait:"0262" } },
  families: { POOCHYENA: ["POOCHYENA","MIGHTYENA"] },   // ordenadas por etapa
  triggers: { WILD:[2,4,6,9] },
  comps: [Comp],                                // solo con count >= 50
  t: { pkm(k), item(k), synergy(k) }            // traducción con alternativa legible
}
```

`Comp` (normalizada por `PAC.logic.normalizeComp`):
```js
{
  id: "26", count: 237, winrate: 27.0, meanRank: 3.80,
  synergies: { GROUND: 6, DRAGON: 3 },          // claves en mayúsculas, ordenadas desc
  units: [{ name:"RHYDON", family:"RHYHORN", frequency:0.43, items:["MUSCLE_BAND"] }],
  // units: ordenadas por frequency desc; se ignoran los nombres que no están en el pokedex
}
```

### `src/logic.js` — `PAC.logic` (funciones puras)

| Función | Contrato |
|---|---|
| `parseCsv(text) → object[]` | Separador `,`. Los campos no llevan comas (verificado), así que basta con dividir por líneas y comas, quitando `\r`. |
| `buildPokedex(rows) → { pokedex, families }` | Ver `Dataset`. `portrait` = `Index` con `-` cambiado por `/`. |
| `normalizeComp(raw, pokedex) → Comp` | Ver `Comp`. |
| `familyOf(name, pokedex) → string` | Familia o el propio nombre si no está. |
| `scoreComp(comp, ownedFamilies:Set) → { match, owned, missing }` | `match` = suma de `frequency` de las unidades cuya familia está en `ownedFamilies` ÷ suma de `frequency` de todas las unidades (0..1). `owned` y `missing` son listas de unidades. |
| `rankComps(comps, ownedFamilies, { limit=5 }) → [{ comp, match, score }]` | `score = match * quality`, con `quality = (8 - meanRank) / 7` (puesto 1 → 1, puesto 8 → 0). Se ordena por `score` desc y, a igualdad, por `count` desc. Sin Pokémon marcados, `match` es 1 para todas, así que se ordenan solo por calidad. |
| `splitCoreFlex(comp) → { core, flex }` | `core`: unidades con `frequency >= 0.5`; `flex`: el resto con `frequency >= 0.15`; las demás se descartan. |
| `synergyProgress(units, pokedex, triggers) → [{ type, count, thresholds, active }]` | Cuenta **familias distintas** por tipo (dos de la misma familia cuentan una vez), usando los tipos de la unidad. `active` = mayor umbral alcanzado o 0. Orden: `count` desc. |
| `placementHint(unit, pokedex) → "front" \| "back"` | `range <= 1` → `"front"`; si no, `"back"`. |

El plan de implementación añade varias funciones auxiliares puras con sus pruebas:

- `normalizeComps` (filtra `count >= 50`);
- `makeTranslator` y `humanize` (los `t.*` del `Dataset`);
- `normalizeSearch` (para el buscador);
- `placeBoard` (reparte el tablero desde el centro);
- `compTitle` (nombre de la compo).

`synergyProgress` recibe nombres de unidades (`string[]`).

El progreso de sinergias se calcula con **las unidades de la compo que ya tienes**. La barra muestra además el objetivo de la compo (`comp.synergies[type]`).

### `src/ui.js` — `PAC.ui`

Una sola página con tres zonas visibles a la vez en 1920×1080 (sin pestañas). En pantallas de menos de 1100 px se apilan.

```
┌ Cabecera: nombre · fecha del informe · [Actualizar datos] · [Nueva partida] ┐
├──────────────── Mis Pokémon ────────┬─ Compos sugeridas ─┬──── Mi compo ────┤
│ [buscar…]                           │ 1. Salvaje·Siniestro│ Núcleo           │
│ Marcados: chips con ✕               │    72 % · 2,15 · 40%│  ✔ Mightyena  EH │
│ Cuadrícula de retratos (familias de │ 2. …                │  ✖ Ursaring COMPRAR│
│ las compos del meta, filtrable)     │ …                   │ Relleno …         │
│                                     │                     │ Sinergias (barras)│
│                                     │                     │ Colocación (8×3)  │
└─────────────────────────────────────┴─────────────────────┴──────────────────┘
Pie: "Herramienta no oficial. No lee ni modifica el juego." · fuentes
```

- **Mis Pokémon.** La cuadrícula muestra una ficha por **familia** que aparezca en alguna compo, con el retrato y el nombre de la etapa más avanzada. El buscador filtra por nombre en español de cualquier etapa (sin distinguir mayúsculas ni tildes). Clic = marcar/desmarcar. Los marcados se ven resaltados y también arriba como chips.
- **Compos sugeridas.** Muestra las 5 de `rankComps`. Cada fila incluye el nombre (las 2–3 sinergias principales traducidas, unidas con " · "), el % de coincidencia, el puesto medio con coma decimal, el % de victorias, el nº de partidas y los retratos del núcleo. Clic = elegir.
- **Mi compo.** Muestra el núcleo y el relleno. Cada unidad lleva retrato, nombre, una marca ✔ si tienes la familia o una etiqueta "Comprar" si no, la frecuencia en % y los objetos traducidos. Debajo van las barras de sinergia y un tablero de 8×3 orientativo: las unidades del núcleo y el relleno que tienes se reparten en la fila delantera si son `front` y en la trasera si son `back`, de izquierda a derecha y empezando por el centro. Si no hay compo elegida, se muestra un estado vacío: "Elige una compo de la lista".
- **Estado guardado en `localStorage`** (`pac.state.v1`): `{ owned: [family], compId }`. "Nueva partida" vacía `owned` y `compId`.
- **Retratos.** Se usa `<img loading="lazy">` con `image-rendering: pixelated`. Si la imagen falla (`onerror`), se muestra un cuadro con las iniciales.
- **Accesibilidad.** Las fichas son `<button>` con `aria-pressed`, el foco es visible y se respeta `prefers-reduced-motion`.
- **Tema claro y oscuro** según `prefers-color-scheme`, con los colores definidos como tokens en `:root`.

### `src/main.js`

1. Muestra "Cargando datos del meta…".
2. Llama a `PAC.data.load()`.
3. Cuando termina, llama a `PAC.ui.mount(dataset, savedState)`.
4. Si hay un error, muestra un mensaje según el caso:
   - Sin conexión y sin caché: "No se pudieron descargar los datos (fuente: X). Comprueba tu conexión y pulsa Reintentar."
   - Con datos viejos (`stale`): un aviso en la cabecera, "Sin conexión: usando datos del {fecha}".

## Pruebas

- `node --test test/` ejecuta las pruebas de `logic.js` con `node:assert`.
- Fixtures: 3 compos reales recortadas de `meta-v2`, unas 30 filas reales del CSV (que incluyan las familias Poochyena, Teddiursa, Alolan Rattata y Gible) y el `types-trigger` completo.
- Casos mínimos:
  - `buildPokedex`: la familia de MIGHTYENA es POOCHYENA y el retrato de ALOLAN_RATICATE es `0020/0001`.
  - `scoreComp`: con 0, algunas o todas las familias marcadas.
  - `rankComps`: el orden y el desempate por `count`.
  - `splitCoreFlex`: los umbrales 0,5 y 0,15.
  - `synergyProgress`: dos unidades de la misma familia cuentan una vez y el umbral activo se calcula bien.
  - `placementHint`.
  - `normalizeComp`: ignora los nombres que no están en el pokedex y pasa las sinergias a mayúsculas.
- La UI se comprueba a mano abriendo `index.html`. Hay una lista de comprobación en el plan.

## Fuera de alcance

- Leer la tienda o el estado del juego de forma automática (prohibido por las normas).
- Registrar la tienda de cada ronda, alertas y sonidos.
- App de escritorio y modo "siempre encima".
- Colocación basada en datos reales (el informe no la incluye).
- Guías largas por compo, como la guía Wild/Dark publicada. Se puede enlazar más adelante.
