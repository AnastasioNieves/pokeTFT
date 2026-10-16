/* Interfaz de Compañero Auto Chess: pinta las tres zonas y responde a los clics del jugador. */
(function (root) {
  "use strict";

  const STATE_KEY = "pac.state.v1";
  const PORTRAIT_BASE = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/";
  const logic = () => root.PAC.logic;
  const $ = (sel) => document.querySelector(sel);

  function loadState() {
    try {
      const s = JSON.parse(root.localStorage.getItem(STATE_KEY));
      if (s && Array.isArray(s.owned)) {
        return { owned: s.owned, compId: s.compId || null, tab: s.tab === "board" ? "board" : "list" };
      }
    } catch (e) {
      // Sin almacenamiento: empezamos vacíos.
    }
    return { owned: [], compId: null, tab: "list" };
  }

  function saveState(state) {
    try {
      root.localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignorar: la app sigue funcionando sin guardar.
    }
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : String(v));
    });
    (children || []).forEach((c) => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  const fmtRank = (n) => n.toFixed(2).replace(".", ",");
  const fmtPct = (ratio) => Math.round(ratio * 100) + " %";
  const fmtDate = (iso) => {
    if (!iso) return "?";
    const [y, m, d] = iso.split("-");
    return d + "/" + m + "/" + y;
  };
  const initials = (s) =>
    s.split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase();

  function portrait(name, ds, size, decorative) {
    const px = size || 40;
    const label = ds.t.pkm(name);
    const p = ds.pokedex[name];
    const box = el("span", { class: "portrait", style: "--size:" + px + "px" });
    const fallback = () => {
      box.replaceChildren(initials(label));
      box.classList.add("fallback");
    };
    if (!p) {
      fallback();
      return box;
    }
    const img = el("img", {
      src: PORTRAIT_BASE + p.portrait + "/Normal.png",
      alt: decorative ? "" : label,
      loading: "lazy",
      width: px,
      height: px,
    });
    img.addEventListener("error", fallback);
    box.appendChild(img);
    return box;
  }

  function familyEntries(ds) {
    const fams = new Set();
    ds.comps.forEach((c) => c.units.forEach((u) => fams.add(u.family)));
    return Array.from(fams)
      .map((family) => {
        const names = ds.families[family] || [family];
        const display = logic().finalStage(names, ds.pokedex);
        return {
          family,
          names,
          display,
          label: ds.t.pkm(display),
          search: logic().normalizeSearch(names.map((n) => ds.t.pkm(n)).join(" ")),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }

  function compStats(comp, match, showMatch) {
    const parts = [];
    if (showMatch) parts.push("Coincide " + fmtPct(match));
    parts.push("Puesto " + fmtRank(comp.meanRank), "Gana " + Math.round(comp.winrate) + " %", comp.count + " partidas");
    return parts.join(" · ");
  }

  function mount(ds, opts) {
    const state = loadState();
    const entries = familyEntries(ds);
    const ui = { ds, state, entries, query: "" };

    $("#report").textContent =
      (ds.reportDate ? "Informe del " + fmtDate(ds.reportDate) + " · " : "") + ds.comps.length + " compos";
    const notice = $("#notice");
    notice.hidden = !ds.stale;
    notice.textContent = ds.stale ? "Sin conexión: usando datos del " + fmtDate(ds.reportDate) : "";

    const search = $("#search");
    search.value = "";
    search.oninput = () => {
      ui.query = logic().normalizeSearch(search.value);
      renderGrid(ui);
    };
    $("#btn-reset").onclick = () => {
      state.owned = [];
      state.compId = null;
      saveState(state);
      search.value = "";
      ui.query = "";
      renderAll(ui);
    };
    $("#btn-refresh").onclick = () => opts.onRefresh();
    renderAll(ui);
  }

  function renderAll(ui) {
    renderChips(ui);
    renderGrid(ui);
    renderSuggestions(ui);
    renderDetail(ui);
  }

  function toggle(ui, family) {
    const owned = ui.state.owned;
    const i = owned.indexOf(family);
    if (i >= 0) owned.splice(i, 1);
    else owned.push(family);
    saveState(ui.state);
    renderAll(ui);
    const again = document.querySelector('.fam[data-family="' + CSS.escape(family) + '"]');
    if (again) again.focus();
  }

  function renderChips(ui) {
    const box = $("#owned-chips");
    box.replaceChildren();
    if (ui.state.owned.length === 0) {
      box.appendChild(el("p", { class: "muted", text: "Haz clic en los Pokémon que tengas." }));
      return;
    }
    ui.state.owned.forEach((family) => {
      const entry = ui.entries.find((e) => e.family === family);
      if (!entry) return;
      const label = entry.label;
      box.appendChild(
        el("button", { type: "button", class: "chip", "aria-label": "Quitar " + label, onclick: () => toggle(ui, family) }, [
          label,
          el("span", { "aria-hidden": "true", text: " ✕" }),
        ])
      );
    });
  }

  function renderGrid(ui) {
    const grid = $("#family-grid");
    grid.replaceChildren();
    const owned = new Set(ui.state.owned);
    const list = ui.entries.filter((e) => !ui.query || e.search.includes(ui.query));
    if (list.length === 0) {
      grid.appendChild(el("p", { class: "muted", text: "Ningún Pokémon coincide con la búsqueda." }));
      return;
    }
    list.forEach((e) => {
      grid.appendChild(
        el(
          "button",
          {
            type: "button",
            class: "fam",
            "data-family": e.family,
            "aria-pressed": owned.has(e.family) ? "true" : "false",
            title: e.names.map((n) => ui.ds.t.pkm(n)).join(" → "),
            onclick: () => toggle(ui, e.family),
          },
          [portrait(e.display, ui.ds, 48, true), el("span", { class: "fam-name", text: e.label })]
        )
      );
    });
  }

  function renderSuggestions(ui) {
    const L = logic();
    const list = $("#suggestions");
    list.replaceChildren();
    const owned = new Set(ui.state.owned);
    $("#suggest-hint").hidden = owned.size !== 0;
    L.rankComps(ui.ds.comps, owned, { limit: 5 }).forEach(({ comp, match }) => {
      const core = L.splitCoreFlex(comp).core.slice(0, 6);
      list.appendChild(
        el("li", null, [
          el(
            "button",
            {
              type: "button",
              class: "sugg",
              "aria-pressed": ui.state.compId === comp.id ? "true" : "false",
              onclick: () => {
                ui.state.compId = comp.id;
                saveState(ui.state);
                renderSuggestions(ui);
                renderDetail(ui);
              },
            },
            [
              el("span", { class: "sugg-title", text: L.compTitle(comp, ui.ds.t) }),
              el("span", { class: "sugg-stats", text: compStats(comp, match, owned.size > 0) }),
              el("span", { class: "sugg-team" }, core.map((u) => portrait(u.name, ui.ds, 32))),
            ]
          ),
        ])
      );
    });
  }

  function renderDetail(ui) {
    const L = logic();
    const box = $("#comp-detail");
    box.replaceChildren();
    const comp = ui.ds.comps.find((c) => c.id === ui.state.compId);
    if (!comp) {
      box.appendChild(
        el("div", { class: "empty" }, [
          el("p", { class: "empty-title", text: "Elige una compo de la lista" }),
          el("p", { class: "muted", text: "Verás qué te falta comprar, qué objetos dar y dónde colocar a cada Pokémon." }),
        ])
      );
      return;
    }
    const owned = new Set(ui.state.owned);
    const { core, flex } = L.splitCoreFlex(comp);
    const ownedUnits = core.concat(flex).filter((u) => owned.has(u.family));
    const tab = ui.state.tab === "board" ? "board" : "list";
    const selectTab = (id) => {
      ui.state.tab = id;
      saveState(ui.state);
      renderDetail(ui);
      const again = document.getElementById("tab-" + id);
      if (again) again.focus();
    };
    const tabs = el(
      "div",
      { class: "tabs", role: "tablist", "aria-label": "Vista de la compo" },
      [
        ["list", "Lista"],
        ["board", "Tablero"],
      ].map(([id, label]) =>
        el("button", {
          type: "button",
          role: "tab",
          class: "tab",
          id: "tab-" + id,
          tabindex: tab === id ? "0" : "-1",
          "aria-selected": tab === id ? "true" : "false",
          "aria-controls": "tab-panel",
          text: label,
          onclick: () => selectTab(id),
          onkeydown: (e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            selectTab(id === "list" ? "board" : "list");
          },
        })
      )
    );
    const panel = el("div", { id: "tab-panel", role: "tabpanel", "aria-labelledby": "tab-" + tab });
    if (tab === "board") {
      root.PAC.board.render(panel, { boardKey: L.compKey(comp), units: ownedUnits, ds: ui.ds, el, portrait });
    } else {
      const listParts = [
        unitSection("Núcleo", core, ui, owned),
        flex.length ? unitSection("Relleno", flex, ui, owned) : null,
        synergySection(comp, ownedUnits, ui),
      ];
      panel.append(...listParts.filter(Boolean));
    }
    box.append(
      el("h3", { class: "comp-title", text: L.compTitle(comp, ui.ds.t) }),
      el("p", { class: "muted", text: compStats(comp, L.scoreComp(comp, owned).match, owned.size > 0) }),
      tabs,
      panel
    );
  }

  function unitSection(title, units, ui, owned) {
    const ds = ui.ds;
    return el("section", { class: "block" }, [
      el("h4", { text: title }),
      el(
        "ul",
        { class: "units" },
        units.map((u) => {
          const have = owned.has(u.family);
          const base = (ds.families[u.family] || [u.name])[0];
          const status = have
            ? el("span", { class: "status have", text: "✔ La tienes" })
            : el("span", { class: "status buy" }, [
                "Comprar",
                base !== u.name ? el("small", { text: " (sale como " + ds.t.pkm(base) + ")" }) : null,
              ]);
          return el("li", { class: "unit" + (have ? " is-owned" : "") }, [
            portrait(u.name, ds, 44, true),
            el("div", { class: "unit-body" }, [
              el("div", { class: "unit-head" }, [el("strong", { text: ds.t.pkm(u.name) }), status]),
              el("div", { class: "unit-meta muted", text: "En el " + fmtPct(u.frequency) + " de los equipos" }),
              u.items.length
                ? el("div", { class: "items" }, u.items.map((it) => el("span", { class: "item", text: ds.t.item(it) })))
                : null,
            ]),
          ]);
        })
      ),
    ]);
  }

  function synergySection(comp, ownedUnits, ui) {
    const ds = ui.ds;
    const progress = logic().synergyProgress(ownedUnits.map((u) => u.name), ds.pokedex, ds.triggers);
    const counts = {};
    progress.forEach((p) => {
      counts[p.type] = p.count;
    });
    const rows = Object.keys(comp.synergies).map((type) => {
      const target = comp.synergies[type];
      const count = counts[type] || 0;
      const thresholds = ds.triggers[type] || [];
      const reachable = thresholds.filter((x) => x <= target);
      const goal = reachable.length ? reachable[reachable.length - 1] : null;
      return el("li", { class: "syn" }, [
        el("span", { class: "syn-name", text: ds.t.synergy(type) }),
        el("span", { class: "syn-count", text: count + " / " + target }),
        el(
          "span",
          { class: "pips" },
          thresholds.map((x) =>
            el("span", {
              class: "pip" + (count >= x ? " on" : "") + (x === goal ? " goal" : ""),
              text: String(x),
              title: count >= x ? "Activa" : "Faltan " + (x - count),
            })
          )
        ),
      ]);
    });
    return el("section", { class: "block" }, [
      el("h4", { text: "Sinergias con lo que tienes" }),
      el("ul", { class: "syns" }, rows),
    ]);
  }

  root.PAC = root.PAC || {};
  root.PAC.ui = { mount };
})(window);
