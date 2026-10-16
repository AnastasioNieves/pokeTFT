/* Página de una compo: cabecera, tablero final, carries y objetos, cómo jugarla y equipos reales. */
(function (root) {
  "use strict";

  function render(container, ctx, comp) {
    const { dom, logic: L, board } = root.PAC;
    const { el } = dom;
    const ds = ctx.ds;
    const key = L.compKey(comp);
    const { core, flex } = L.splitCoreFlex(comp);
    const units = core.concat(flex);
    const itemsByName = {};
    units.forEach((u) => {
      itemsByName[u.name] = u.items;
    });

    const panel = (title, hint) =>
      el("section", { class: "panel" }, [el("h3", { class: "sub", text: title }), hint ? el("p", { class: "muted small", text: hint }) : null]);
    const kpi = (value, label) => el("div", null, [el("dt", { text: label }), el("dd", { text: value })]);

    const head = el("header", { class: "cv-head" }, [
      dom.tierBadge(L.compTier(comp), true),
      el("div", { class: "cv-title" }, [
        el("h2", { text: ctx.nameOf(comp) }),
        el("div", { class: "cv-syns" }, dom.compSynergyBadges(comp, ds)),
      ]),
      el("dl", { class: "kpis" }, [
        kpi(dom.fmtRank(comp.meanRank), "puesto medio"),
        kpi(Math.round(comp.winrate) + " %", "top 1"),
        kpi(String(comp.count), "partidas"),
      ]),
      el("button", {
        type: "button",
        class: "btn",
        text: "Seguir en Mi partida",
        onclick: () => {
          ctx.state.partidaKey = key;
          ctx.save();
          ctx.navigate("partida");
        },
      }),
    ]);

    // 1 · Tablero final
    const boardPanel = panel("Tablero final", "Arrastra para recolocar. Pasa el ratón por un Pokémon para ver por qué va ahí.");
    const boardBox = el("div");
    board.render(boardBox, {
      boardKey: "final:" + key,
      units: units.map((u) => ({ name: u.name, items: u.items })),
      ds,
      el,
      portrait: (n, d, size, decorative) => dom.unit(n, d, { size, decorative, title: "" }),
      piece: (n) => dom.unit(n, ds, { size: 56, items: itemsByName[n] || [], title: "" }),
    });
    boardPanel.appendChild(boardBox);

    // 2 · Carries y objetos
    const carryPanel = panel("Carries y sus objetos");
    L.compCarries(comp, 3).forEach((u) => {
      carryPanel.appendChild(
        el("div", { class: "carry" }, [
          dom.unit(u.name, ds, { size: 48, decorative: true }),
          el("strong", { text: ds.t.pkm(u.name) }),
          el(
            "div",
            { class: "carry-items" },
            u.items.map((it) => el("span", { class: "carry-item" }, [dom.itemIcon(it, ds, 28), el("span", { class: "small", text: ds.t.item(it) })]))
          ),
        ])
      );
    });
    if (comp.items.length) {
      carryPanel.appendChild(el("h4", { class: "sub", text: "Objetos más usados en la compo" }));
      carryPanel.appendChild(
        el(
          "div",
          { class: "item-row" },
          comp.items.slice(0, 6).map((x) =>
            el("div", { class: "item-stat" }, [dom.itemIcon(x.item, ds, 30), el("span", { class: "small muted", text: dom.fmtPct(x.frequency) })])
          )
        )
      );
    }

    // 3 · Cómo jugarla
    const playPanel = panel("Cómo jugarla");
    const groups = L.stageGroups(comp, ds.pokedex, ds.families);
    [
      ["early", "Inicio"],
      ["mid", "Mitad"],
      ["late", "Final"],
    ].forEach(([id, label]) => {
      if (!groups[id].length) return;
      playPanel.appendChild(
        el("div", { class: "stage-row" }, [
          el("b", { text: label }),
          el("div", { class: "stage-units" }, groups[id].map((n) => dom.unit(n, ds, { size: 40 }))),
        ])
      );
    });
    const tip = L.playTip(comp, ds.triggers, ds.t);
    if (tip) playPanel.appendChild(el("p", { class: "tip", text: tip }));
    playPanel.appendChild(el("p", { class: "muted small", text: "Se muestra la primera evolución: es como salen en la tienda." }));

    // 4 · Equipos reales
    const winners = comp.topTeams.filter((team) => team.rank === 1).slice(0, 6);
    const teams = winners.length ? winners : comp.topTeams.slice(0, 6);
    const teamsPanel = panel(winners.length ? "Equipos reales que quedaron 1.º" : "Equipos reales destacados");
    if (!teams.length) {
      teamsPanel.appendChild(el("p", { class: "muted", text: "El informe no trae equipos de ejemplo para esta compo." }));
    }
    teams.forEach((team) => {
      teamsPanel.appendChild(
        el("div", { class: "team" }, [
          el("span", { class: "small muted", text: team.rank + ".º · Elo " + team.elo }),
          el("div", { class: "team-units" }, team.units.map((u) => dom.unit(u.name, ds, { size: 36, items: u.items }))),
        ])
      );
    });

    container.append(head, el("div", { class: "cv-grid" }, [boardPanel, carryPanel, playPanel, teamsPanel]));
  }

  root.PAC = root.PAC || {};
  root.PAC.views = root.PAC.views || {};
  root.PAC.views.comp = { render };
})(window);
