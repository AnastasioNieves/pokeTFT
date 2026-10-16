# Compañero Auto Chess

Una ayuda para jugar a [Pokémon Auto Chess](https://pokemon-auto-chess.com). La abres en una ventana aparte (lo ideal es un segundo monitor), marcas los Pokémon que tienes y te dice:

- **qué equipo (compo) te conviene** según el meta actual;
- **qué Pokémon te faltan por comprar**;
- **qué objetos darle a cada uno**;
- **cuánto te falta para activar cada sinergia**;
- **dónde colocarlos** en el tablero (de forma orientativa).

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
2. Espera unos segundos mientras sale *"Cargando datos del meta…"*. La primera vez necesita **internet** para descargar las estadísticas.
3. Arrastra la ventana a tu **segundo monitor**, o ponla al lado del juego.

> Consejo: guarda `index.html` en los marcadores del navegador para abrirla en un clic.

## 3. Usarla durante la partida

La pantalla tiene tres columnas. Se usan de izquierda a derecha:

```
┌──────────────┬──────────────────┬────────────────────┐
│ MIS POKÉMON  │ COMPOS SUGERIDAS │ MI COMPO           │
│ marca lo que │ elige el equipo  │ qué comprar, qué   │
│ tienes       │ que más te encaja│ objetos y dónde    │
└──────────────┴──────────────────┴────────────────────┘
```

### Paso 1 · Marca tus Pokémon (columna izquierda)

- Haz **clic** en cada Pokémon que tengas en el banquillo o en el tablero. Se pone **en verde**.
- Usa el **buscador** de arriba para encontrarlos rápido. Puedes escribir sin tildes, y valen trozos del nombre: con `mighty` aparece Mightyena.
- Da igual la evolución: si tienes un **Poochyena**, marca la ficha de **Mightyena**. Cada ficha cuenta para toda la familia.
- Para **desmarcar** uno, vuelve a hacer clic en su ficha o pulsa la **✕** de su etiqueta, arriba.

### Paso 2 · Elige una compo (columna central)

- Aparecen las **5 compos** que mejor encajan con lo que has marcado.
- Si aún no has marcado nada, verás las 5 mejores del meta.
- Cada compo muestra:
  - **Coincide 43 %**: cuánto de esa compo ya tienes.
  - **Puesto 2,20**: puesto medio en que acaba (de 8). Cuanto más bajo, mejor.
  - **Gana 38 %**: cuántas partidas gana.
  - **104 partidas**: cuántas partidas hay detrás del dato.
- Haz **clic** en la que quieras seguir. Puedes cambiar de compo cuando quieras.

### Paso 3 · Sigue la compo (columna derecha)

- **Núcleo**: los Pokémon imprescindibles. **Relleno**: los que completan el equipo.
- **✔ La tienes**: ya lo tienes.
- **Comprar (sale como …)**: te falta. Entre paréntesis, el nombre con el que sale en la tienda. Por ejemplo, Mightyena sale como **Poochyena**.
- Debajo de cada Pokémon salen los **objetos** que más usan los jugadores con él.
- **Sinergias con lo que tienes**: por ejemplo *Salvaje 3 / 9*. Los números en verde son los niveles que ya tienes activos, y el que tiene borde rojo es el objetivo de la compo.
- **Colocación orientativa**: un tablero con tus Pokémon. Los de cuerpo a cuerpo van delante y los de ataque a distancia, detrás. Es una sugerencia, porque las estadísticas no dicen dónde los coloca la gente.

### Paso 4 · Nueva partida

Al empezar otra partida, pulsa **Nueva partida** (arriba a la derecha). Se borra todo lo marcado.

> Lo que marques se guarda en tu navegador. Si cierras la ventana a mitad de partida y la vuelves a abrir, sigue ahí.

---

## Preguntas frecuentes

**¿De dónde salen los datos? ¿Están actualizados?**
Del informe público del meta que publica el propio juego, que se renueva cada día. La fecha aparece arriba (*"Informe del 15/10/2026"*). La app los descarga como mucho **una vez al día**. Si quieres los más recientes ya, pulsa **Actualizar datos**.

**Sale "No se pudieron descargar los datos".**
Comprueba tu conexión a internet y pulsa **Reintentar**. Solo hace falta conexión la primera vez y una vez al día.

**Sale "Sin conexión: usando datos del …".**
No hay internet, pero la app usa la última copia que descargó. Funciona igual, con datos algo más viejos.

**Sale "formato inesperado".**
El juego probablemente ha cambiado cómo publica sus datos. Prueba más tarde con **Reintentar** y, si sigue, [abre un aviso (issue)](https://github.com/AnastasioNieves/pokeTFT/issues).

**Un Pokémon sale con letras en vez de imagen.**
No se ha encontrado su retrato. Es solo estético y no afecta a nada.

**No encuentro un Pokémon en la lista.**
Solo aparecen los Pokémon que salen en alguna compo del meta. Si no está, ninguna compo fuerte lo usa ahora mismo.

**¿Funciona en el móvil?**
Sí: en pantallas estrechas las tres columnas se ponen una debajo de otra. Pero está pensada para un monitor de ordenador.

---

## Normas de uso del juego

Los [Términos de Servicio de Pokémon Auto Chess](https://pokemon-auto-chess.com/terms-of-service) prohíben usar automatización o herramientas no autorizadas y acceder sin permiso a sus APIs. Por eso esta app:

- **no** lee la pantalla ni hace capturas;
- **no** lee ni modifica la conexión del juego;
- **no** mete nada en la página del juego (no es una extensión);
- **no** hace clics ni pulsa teclas por ti;
- **no** usa tu cuenta ni tu sesión;
- **solo** descarga datos públicos sin identificarse: el informe del meta que el propio juego publica para cualquiera y los datos de su código abierto.

Es una herramienta no oficial hecha por fans, sin relación con los creadores del juego. Pokémon y sus personajes pertenecen a sus respectivos dueños.

---

## Para desarrolladores

HTML, CSS y JavaScript sin dependencias ni compilación. Los scripts son clásicos (no módulos) para que funcionen al abrir el archivo directamente.

| Archivo | Qué hace |
|---|---|
| `index.html`, `styles.css` | Estructura y estilos (tema claro y oscuro) |
| `src/logic.js` | Funciones puras: compos, puntuación, sinergias, tablero |
| `src/data.js` | Descarga, caché de 24 h y modo sin conexión |
| `src/ui.js`, `src/main.js` | Interfaz y arranque |
| `test/` | Pruebas con `node:test` |
| `guides/` | Guía visual de la compo Salvaje/Siniestro |
| `docs/` | Diseño y plan de implementación |

Para ejecutar las pruebas (Node 22 o superior):

```bash
node --test "test/*.test.js"
```

**Fuentes de datos:**
- De pokemon-auto-chess.com: `/meta-v2`, `/meta/metadata` y `/types-trigger`.
- Del repositorio [keldaanCommunity/pokemonAutoChess](https://github.com/keldaanCommunity/pokemonAutoChess): `pokemons-data.csv` y la traducción al español.
- Retratos de [PMD Sprite Collab](https://sprites.pmdcollab.org/).
