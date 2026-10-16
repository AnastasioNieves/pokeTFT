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
