# Compañero Auto Chess

Ayuda para jugar a [Pokémon Auto Chess](https://pokemon-auto-chess.com) en un segundo monitor.

## Cómo se usa

1. Abre `index.html` con doble clic (Chrome, Edge o Firefox) y arrastra la ventana al segundo monitor.
2. En **Mis Pokémon**, haz clic en los que tengas. Marcar cualquier etapa cuenta para toda la familia.
3. En **Compos sugeridas**, elige la compo que más te encaje.
4. En **Mi compo** verás qué te falta comprar, qué objetos dar y una colocación orientativa.
5. Pulsa **Nueva partida** al empezar otra.

Los datos del meta se descargan como mucho una vez al día. **Actualizar datos** fuerza la descarga.

## Normas de uso del juego

Los Términos de Servicio de Pokémon Auto Chess prohíben la automatización y las herramientas no autorizadas. Por eso esta app:

- no lee la pantalla ni el juego, no intercepta su conexión y no inyecta nada en su página;
- no hace clics ni pulsa teclas por ti;
- solo descarga, sin tu cuenta, el informe público del meta y los datos del código abierto del juego.

Todo lo que sabe de tu partida se lo dices tú con clics.

## Desarrollo

Sin dependencias. Pruebas:

```bash
node --test "test/*.test.js"
```

Fuentes: `pokemon-auto-chess.com/meta-v2`, `/meta/metadata` y `/types-trigger`; `pokemons-data.csv` y la traducción al español del repositorio keldaanCommunity/pokemonAutoChess. Retratos de PMD Sprite Collab.
