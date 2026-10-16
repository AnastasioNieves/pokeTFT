# Visualizador de colocación: diseño

Fecha: 2026-10-17 · Estado: aprobado por el usuario · Amplía `2026-10-16-companero-auto-chess-design.md`

## Objetivo

Que el jugador vea **cómo colocar** a sus Pokémon de la compo elegida en un tablero grande. La app propone una colocación según reglas del juego, explica cada decisión y deja **recolocar** arrastrando o con clics. Lo que cambie el jugador se guarda por compo.

## Hechos verificados

- El lado de cada jugador es de **8 columnas × 3 filas** (`BOARD_WIDTH = 8`, `BOARD_SIDE_HEIGHT = 4`, donde la fila 0 es el banquillo, en `app/config/game/board.ts`).
- El informe público (`meta-v2`, incluido `top_teams`) **no trae posiciones**. Por eso la colocación sale de reglas y lo dice.
- Siniestro: *"Melee Dark Pokémon DASH to the farthest target reachable"*. La Piedra Noche da el tipo Siniestro.
- Objetos que afectan a los aliados "ADJACENT_IN_THE_SAME_ROW": `ABILITY_SHIELD`, `GRACIDEA_FLOWER`, `EXP_SHARE` y `EFFICIENT_BANDANNA`.
- Objetos que afectan a los aliados "ADJACENT" (alrededor): `GREEN_ORB` y `COVER_BAND`.

## Reglas de sugerencia

En el tablero, la fila 0 es la delantera (la más cercana al enemigo), la 1 es la del medio y la 2 es la trasera. Las casillas se numeran `fila * 8 + columna`.

| Rol | Condición | Fila | Orden de casillas | Orden entre unidades |
|---|---|---|---|---|
| `ranged` | `range > 1` | 2 | del centro hacia fuera `[3,4,2,5,1,6,0,7]` | primero los que tienen aura de fila; luego `attack` desc; luego nombre |
| `dark` / `dark_stone` | cuerpo a cuerpo y tipo DARK, o con `DUSK_STONE` entre sus objetos | 2 | de las esquinas hacia dentro `[0,7,1,6,2,5,3,4]` | `attack` desc; luego nombre |
| `melee` | el resto | 0 | del centro hacia fuera | primero aura alrededor; luego aura de fila; luego `tankScore` desc; luego nombre |

- `tankScore = hp + 10 * (defense + speDef)`.
- Las unidades se colocan en este orden: primero las de `melee`, luego `ranged` y luego `dark`.
- Si su fila está llena, la unidad va a la fila del medio (del centro hacia fuera) y se le añade el motivo `overflow`. Si esa también está llena, va a cualquier casilla libre.
- Los motivos de cada unidad son códigos: `ranged`, `dark`, `dark_stone`, `melee`, `row_aura:ITEM`, `around_aura:ITEM` y `overflow`.
- Los motivos de aura solo se añaden a las unidades de `melee` y `ranged`, porque las de `dark` van a las esquinas.
- Aparte se devuelve `auras: { name: "row" | "around" }` para todas las unidades con esos objetos. Sirve para iluminar casillas.

## Edición y guardado

- `localStorage["pac.boards.v1"] = { [compId]: { [name]: index } }`. Solo se escribe cuando el jugador mueve una pieza. "Volver a la sugerencia" borra la entrada de esa compo.
- **Mezcla con lo guardado.** Primero se respetan las posiciones guardadas que siguen siendo válidas: unidad presente, índice entero entre 0 y 23 y casilla libre. Después se recorre la sugerencia por índice ascendente: cada unidad sin colocar va a su casilla sugerida si está libre o, si no, a la libre más cercana. La distancia es `|Δfila| * 10 + |Δcolumna|` y, a igual distancia, gana el índice más bajo.
- **Mover** intercambia el contenido de las dos casillas, aunque la de destino esté vacía.
- **Iluminar el aura** de la pieza seleccionada:
  - `row`: las casillas de los lados en la misma fila.
  - `around`: las 8 vecinas que caen dentro del tablero de 8×3.

## Interfaz

- La columna "Mi compo" tiene dos pestañas (`role="tablist"`): **Lista** (núcleo, relleno y sinergias) y **Tablero**. La pestaña activa se guarda en `pac.state.v1.tab`, que vale `"list"` o `"board"`.
- **Tablero:**
  - "▲ Enemigo" arriba y tres filas etiquetadas "Fila delantera", "Fila del medio" y "Fila trasera".
  - Las casillas son `<button>` con `aria-label` "Fila X, columna N: Nombre" o "…: vacía".
  - Arrastrar y soltar con HTML5 DnD. Alternativa: clic en una pieza (queda seleccionada) y clic en la casilla de destino. `Escape` cancela la selección.
  - Las casillas que la pieza ha cambiado respecto a la sugerencia llevan una marca. Al mover, el foco pasa a la casilla de destino.
- **Debajo del tablero:**
  - La instrucción de uso.
  - El botón "Volver a la sugerencia", solo si hay cambios guardados.
  - Una lista con cada Pokémon: su posición y la explicación de sus motivos en español. Si lo movió el jugador, dice "Lo has colocado tú".
  - La nota: "Sugerencia basada en cómo funcionan las sinergias y los objetos. El informe del meta no dice dónde coloca la gente a cada Pokémon."
- Sin Pokémon de la compo marcados, se muestra: "Marca Pokémon de esta compo para colocarlos en el tablero."
- El tablero pequeño anterior y las funciones `placeBoard` y `placementHint` se eliminan.

## Arquitectura

- `src/logic.js` (funciones puras con pruebas):
  - `buildPokedex` añade a cada ficha `hp`, `attack`, `defense` y `speDef`.
  - Funciones nuevas: `suggestBoard(units, pokedex)`, `mergeBoard(saved, units, pokedex)`, `moveUnit(cells, from, to)`, `boardToSaved(cells)` y `auraCells(index, kind)`.
  - `units` es `[{ name, items }]`.
- `src/board.js` (nuevo) expone `PAC.board.render(container, { compId, units, ds, el, portrait })`. Gestiona su propio estado de selección y el guardado en `pac.boards.v1`.
- `src/ui.js` gestiona las pestañas y delega en `PAC.board`.
- `index.html` carga `src/board.js` después de `data.js` y antes de `ui.js`.
