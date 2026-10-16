/* Tablero de colocación: sugerencia por reglas + edición arrastrando o con clics. Se guarda por compo. */
(function (root) {
  "use strict";

  const BOARDS_KEY = "pac.boards.v1";
  const ROW_NAMES = ["Fila delantera", "Fila del medio", "Fila trasera"];
  const DRAG_TYPE = "application/x-pac-cell";
  const logic = () => root.PAC.logic;

  function loadBoards() {
    try {
      const b = JSON.parse(root.localStorage.getItem(BOARDS_KEY));
      return b && typeof b === "object" ? b : {};
    } catch (e) {
      return {};
    }
  }

  function saveBoards(boards) {
    try {
      root.localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
    } catch (e) {
      // Sin almacenamiento: los cambios duran hasta recargar.
    }
  }

  function reasonText(code, name, ds) {
    const [kind, item] = code.split(":");
    const p = ds.pokedex[name];
    switch (kind) {
      case "ranged":
        return "Ataca a distancia (alcance " + (p ? p.range : "?") + "): va atrás, protegido.";
      case "dark":
        return "Siniestro cuerpo a cuerpo: salta solo al enemigo más lejano, así que empieza atrás, en una esquina.";
      case "dark_stone":
        return "Con " + ds.t.item("DUSK_STONE") + " es Siniestro: salta solo al enemigo más lejano, así que empieza atrás, en una esquina.";
      case "melee":
        return "Cuerpo a cuerpo: va delante. Los más resistentes (vida + defensas) van en el centro.";
      case "row_aura":
        return "Su " + ds.t.item(item) + " ayuda a los aliados de al lado en su fila: mejor en el centro.";
      case "around_aura":
        return "Su " + ds.t.item(item) + " afecta a los aliados de alrededor: mejor rodeado.";
      case "overflow":
        return "Su fila estaba llena: va en la del medio.";
      default:
        return "";
    }
  }

  function positionText(index) {
    const cols = logic().BOARD_COLS;
    return ROW_NAMES[Math.floor(index / cols)] + ", columna " + ((index % cols) + 1);
  }

  function render(container, ctx) {
    const { boardKey, units, ds, el, portrait, piece } = ctx;
    const L = logic();
    container.replaceChildren();
    if (units.length === 0) {
      container.appendChild(el("p", { class: "muted", text: "Marca Pokémon de esta compo para colocarlos en el tablero." }));
      return;
    }
    const boards = loadBoards();
    const board = L.mergeBoard(boards[boardKey], units, ds.pokedex);
    let cells = board.cells;
    let selected = null;

    function move(from, to) {
      if (from === to) return;
      const a = cells[from];
      const b = cells[to];
      cells = L.moveUnit(cells, from, to);
      const saved = Object.assign({}, boards[boardKey]);
      if (a) saved[a] = to;
      if (b) saved[b] = from;
      boards[boardKey] = saved;
      saveBoards(boards);
      selected = null;
      draw(to);
    }

    function onCell(i) {
      if (selected === null) {
        if (cells[i]) {
          selected = i;
          draw(i);
        }
      } else if (selected === i) {
        selected = null;
        draw(i);
      } else {
        move(selected, i);
      }
    }

    function resetToSuggestion() {
      delete boards[boardKey];
      saveBoards(boards);
      cells = board.suggested.slice();
      selected = null;
      const first = cells.findIndex(Boolean);
      draw(first === -1 ? null : first);
    }

    function draw(focusIndex) {
      container.replaceChildren();
      const cols = L.BOARD_COLS;
      const savedNames = new Set(Object.keys(boards[boardKey] || {}));
      const highlight = new Set();
      const selectedName = selected !== null ? cells[selected] : null;
      if (selectedName && board.auras[selectedName]) {
        L.auraCells(selected, board.auras[selectedName]).forEach((i) => highlight.add(i));
      }

      const grid = el("div", { class: "bboard", role: "group", "aria-label": "Tablero de 8 por 3. Arriba está el enemigo." }, [
        el("div", { class: "enemy", text: "▲ Enemigo" }),
      ]);
      ROW_NAMES.forEach((rowName, r) => {
        const row = el("div", { class: "brow", role: "group", "aria-label": rowName });
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const name = cells[i];
          const classes = ["bcell"];
          if (name) classes.push("filled");
          if (i === selected) classes.push("selected");
          if (highlight.has(i)) classes.push("aura");
          if (name && savedNames.has(name)) classes.push("moved");
          row.appendChild(
            el(
              "button",
              {
                type: "button",
                class: classes.join(" "),
                "data-index": String(i),
                "aria-label": rowName + ", columna " + (c + 1) + ": " + (name ? ds.t.pkm(name) : "vacía"),
                "aria-pressed": i === selected ? "true" : "false",
                title: name
                  ? (board.reasons[name] || []).map((code) => reasonText(code, name, ds)).filter(Boolean).join(" ")
                  : null,
                draggable: name ? "true" : null,
                onclick: () => onCell(i),
                ondragstart: (e) => {
                  e.dataTransfer.setData(DRAG_TYPE, String(i));
                  e.dataTransfer.effectAllowed = "move";
                },
                ondragover: (e) => e.preventDefault(),
                ondrop: (e) => {
                  e.preventDefault();
                  const raw = e.dataTransfer.getData(DRAG_TYPE);
                  const from = raw === "" ? NaN : Number(raw);
                  if (Number.isInteger(from) && from >= 0 && from < L.BOARD_SIZE && cells[from]) move(from, i);
                },
              },
              name ? [piece ? piece(name) : portrait(name, ds, 56)] : []
            )
          );
        }
        grid.append(el("div", { class: "brow-label", text: rowName, "aria-hidden": "true" }), row);
      });

      const hasSaved = !!boards[boardKey];
      const tools = el("div", { class: "btools" }, [
        el("p", {
          class: "muted small",
          text: "Arrastra un Pokémon a otra casilla, o haz clic en él y luego en la casilla de destino. Esc cancela. El punto rojo marca los que has movido tú.",
        }),
        hasSaved ? el("button", { type: "button", class: "breset", text: "Volver a la sugerencia", onclick: resetToSuggestion }) : null,
      ]);

      const placedNames = cells
        .map((name, i) => ({ name, i }))
        .filter((x) => x.name);
      const list = el(
        "ul",
        { class: "breasons" },
        placedNames.map(({ name, i }) => {
          const texts = (board.reasons[name] || []).map((code) => reasonText(code, name, ds)).filter(Boolean);
          if (savedNames.has(name)) texts.push("Lo has colocado tú.");
          return el("li", { class: "breason" }, [
            portrait(name, ds, 36, true),
            el("div", null, [
              el("div", null, [el("strong", { text: ds.t.pkm(name) }), el("span", { class: "muted", text: " · " + positionText(i) })]),
              el("div", { class: "small", text: texts.join(" ") }),
            ]),
          ]);
        })
      );

      container.append(
        grid,
        tools,
        list,
        el("p", {
          class: "muted small",
          text: "Sugerencia basada en cómo funcionan las sinergias y los objetos. El informe del meta no dice dónde coloca la gente a cada Pokémon.",
        })
      );

      if (focusIndex !== null && focusIndex !== undefined) {
        const target = container.querySelector('.bcell[data-index="' + focusIndex + '"]');
        if (target) target.focus();
      }
    }

    container.onkeydown = (e) => {
      if (e.key === "Escape" && selected !== null) {
        const was = selected;
        selected = null;
        draw(was);
      }
    };
    draw(null);
  }

  root.PAC = root.PAC || {};
  root.PAC.board = { render };
})(window);
