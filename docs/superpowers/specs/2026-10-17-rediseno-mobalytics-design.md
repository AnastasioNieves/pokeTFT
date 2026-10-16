# Rediseño estilo Mobalytics: diseño

Fecha: 2026-10-17 · Estado: aprobado por el usuario · Sustituye la interfaz descrita en `2026-10-16-companero-auto-chess-design.md`. Mantiene sus normas de uso, fuentes y caché.

## Objetivo

Que la app se vea y se use como las guías de TFT de Mobalytics:

- una **tier list de compos** como pantalla principal;
- una **página por compo** con tablero final, carries y objetos, cómo jugarla y equipos reales;
- las pestañas **Mi partida** y **Objetos**.

## Pantallas (pestañas arriba: Tier list · Mi partida · Objetos)

Rutas en el hash: `#tier` (por defecto), `#tier/<clave de compo>`, `#partida` y `#objetos`. Los botones atrás y adelante del navegador funcionan.

### Tier list (dos paneles)

**Panel izquierdo:**
- **Filtros:**
  - Buscador de Pokémon: muestra las compos que contienen alguna etapa de esa familia; compara sin tildes.
  - Fila de iconos de sinergia, ordenada por nº de compos. Al hacer clic se activa o desactiva; con varias activas, la compo tiene que tenerlas todas.
- **Grupos por tier** según el puesto medio: S ≤ 3,3; A ≤ 3,7; B ≤ 4,2; C el resto. Dentro de cada grupo, de mejor a peor puesto medio.
- **Cada fila** es un botón con:
  - el nombre (carry + sinergia principal, por ejemplo «Ursaring Salvaje») y debajo las sinergias en texto;
  - hasta 3 insignias de sinergia (icono + nº, con color según el nivel);
  - hasta 9 retratos (núcleo y relleno) con borde del color de su rareza y los objetos del carry encima;
  - el puesto medio y el % de top 1.
- La lista guarda su posición de desplazamiento al elegir una compo.

**Panel derecho:** la página de la compo elegida. Si no hay ninguna elegida, la primera de la lista filtrada.

### Página de compo

- **Cabecera:**
  - tier en grande, nombre e insignias de todas las sinergias;
  - cifras clave: puesto medio, % top 1 y nº de partidas;
  - botón «Seguir en Mi partida».
- **Tablero final:** el tablero editable de `board.js` con el núcleo y el relleno. Las piezas llevan sus objetos encima y, al pasar el ratón, se ve por qué va cada una en su casilla. Se guarda con la clave `final:<clave>`.
- **Carries y sus objetos:** hasta 3 unidades con `itemCount >= 1`, de más a menos objetos, con el icono y el nombre de cada objeto. Debajo, los 6 objetos más usados en la compo con su %.
- **Cómo jugarla:**
  - Inicio, Mitad y Final, con la primera etapa de cada familia según su rareza: COMMON/UNCOMMON → Inicio; RARE/EPIC/HATCH/SPECIAL → Mitad; ULTRA/UNIQUE/LEGENDARY → Final.
  - Un consejo: "Consigue N de X pronto para activarla. Objetivo: X a + Y b."
- **Equipos reales:** hasta 6 de `top_teams` con `rank === 1`, con Elo y objetos. Si no hay ninguno con `rank === 1`, se muestran los 6 primeros con el título «Equipos reales destacados».

### Mi partida

- **Izquierda:**
  - "Mis Pokémon": buscador, chips de lo marcado y una cuadrícula por familia con borde de rareza.
  - "Nueva partida": vacía lo marcado y la compo elegida.
- **Derecha:**
  - Las 5 compos que mejor encajan (`rankComps`).
  - Al elegir una se muestra:
    - "Te falta comprar": la primera etapa de cada familia que falta, marcando "Núcleo" en las del núcleo.
    - Las sinergias con lo que tienes: insignia `n/objetivo` y los niveles.
    - El tablero editable con lo que tienes. Se guarda con la clave `<clave>`, la misma que antes.
    - Un enlace "Ver guía completa".
- El estado se guarda en `pac.state.v1 = { owned, partidaKey }`.

### Objetos

Una tabla con:
- tier (S ≤ 3,5; A ≤ 3,8; B ≤ 4,1; C el resto);
- icono y nombre;
- descripción en español limpia (ver abajo);
- puesto medio, usos y hasta 3 retratos de quién lo lleva.

Solo entran los objetos con `count >= 200`, ordenados por puesto medio. Se puede buscar por nombre.

## Estilo visual

- **Oscuro por defecto**, como Mobalytics, con un tema claro para `prefers-color-scheme: light`.
- **Bordes de rareza** con los colores del juego (`app/public/src/style/colors.css`):

  | Rareza | Color |
  |---|---|
  | COMMON | #a0a0a0 |
  | UNCOMMON | #3bc95e |
  | RARE | #41bfcc |
  | EPIC | #927fff |
  | ULTRA | #e53b3b |
  | UNIQUE | #ffffff (gris en el tema claro) |
  | LEGENDARY | #e6cb49 |
  | SPECIAL | #e58ee5 |
  | HATCH | #b9915a |

- **Nivel de sinergia** (bronce, plata, oro):
  - `reached` = nº de umbrales alcanzados;
  - 0 → sin color; todos → oro (3); al menos la mitad redondeando hacia arriba → plata (2); el resto → bronce (1).
- **Imágenes**, todas cargadas con `<img>` y nunca con `fetch`:
  - retratos: PMD Sprite Collab;
  - objetos: `…/pokemonAutoChess/master/app/public/src/assets/item%7Btps%7D/<ITEM>.png`;
  - sinergias: `…/assets/types/<TYPE>.svg`, en raw.githubusercontent.com.

## Datos

- **`meta-v2`:** el recorte guarda además `mean_items` y `top_teams` (con `rank`, `elo` y `pokemons[{name, items}]`). `normalizeComp` añade:
  - `itemCount` a cada unidad (de `mean_items` de la unidad);
  - a la compo, `items: [{item, frequency}]` y `topTeams: [{rank, elo, units:[{name, items}]}]`, descartando los nombres que no están en el pokedex.
- **Fuente nueva, `items`** (`https://pokemon-auto-chess.com/meta/items`): se queda solo con el tier `LEVEL_BALL` (todos los jugadores) y con `{name, rank, count, pokemons(≤3)}`. Ocupa unos 30 KB en caché.
- **i18n:** además de `pkm`, `item` y `synergy`, guarda `item_description`, `stat`, `status`, `technical_terms` y `damage`.
- **`cleanText`:**
  - quita `{{…}}`;
  - cambia `[a,b,…]` por los números separados con `/` (`[25,LK]` → `25`);
  - traduce los tokens en MAYÚSCULAS buscándolos en `stat`, `status`, `technical_terms`, `synergy` y `damage`, en minúsculas;
  - deja como están los que no encuentra.
  - `t.itemDesc(item)` devuelve la descripción limpia.
- **Clave de compo:** `compKey` (las familias del núcleo).

## Arquitectura

- `src/logic.js`: funciones puras con pruebas.
  - Funciones nuevas: `compTier`, `compCarries`, `compName`, `synergyLevel`, `stageGroups`, `playTip`, `filterComps`, `cleanText`, `itemTierList` e `itemTier`.
  - `makeTranslator` gana `itemDesc`.
  - `normalizeComp` se amplía con los campos de la sección Datos.
- `src/data.js`: la fuente nueva y los recortes. El `Dataset` gana `itemStats`.
- Vistas, en `<script>` clásicos:
  - `src/dom.js` (`PAC.dom`): `el`, formatos, `unit`, `itemIcon`, `synergyBadge`, `compSynergyBadges` y `tierBadge`.
  - `src/app.js` (`PAC.app.mount`): pestañas, rutas y estado.
  - `src/views/tierlist.js`, `src/views/comp.js`, `src/views/partida.js` y `src/views/items.js` (`PAC.views.*`).
- `src/board.js` acepta `piece(name)` para dibujar la pieza (con objetos) y pone como `title` de cada casilla el motivo de su posición.
- `src/ui.js` se elimina. `src/main.js` llama a `PAC.app.mount`.
