/* Interfaz: pestañas, rutas por hash (#tier, #tier/<clave>, #partida, #objetos) y estado guardado. */
(function (root) {
  "use strict";

  const STATE_KEY = "pac.state.v1";
  const TABS = [
    ["tier", "Tier list"],
    ["partida", "Mi partida"],
    ["objetos", "Objetos"],
  ];
  const $ = (sel) => document.querySelector(sel);
  let current = null;

  function loadState() {
    try {
      const s = JSON.parse(root.localStorage.getItem(STATE_KEY));
      if (s && Array.isArray(s.owned)) {
        return { owned: s.owned, partidaKey: typeof s.partidaKey === "string" ? s.partidaKey : null };
      }
    } catch (e) {
      // Sin almacenamiento: empezamos vacíos.
    }
    return { owned: [], partidaKey: null };
  }

  function saveState(state) {
    try {
      root.localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignorar: la app sigue funcionando sin guardar.
    }
  }

  function parseRoute() {
    const raw = (root.location.hash || "").replace(/^#/, "");
    const slash = raw.indexOf("/");
    const view = slash === -1 ? raw : raw.slice(0, slash);
    const arg = slash === -1 ? null : decodeURIComponent(raw.slice(slash + 1)) || null;
    const known = TABS.map((t) => t[0]);
    return { view: known.includes(view) ? view : "tier", arg };
  }

  function renderTabs(active) {
    const { el } = root.PAC.dom;
    $("#tabs").replaceChildren(
      ...TABS.map(([id, label]) =>
        el("a", { href: "#" + id, class: "tab", "aria-current": active === id ? "page" : null, text: label })
      )
    );
  }

  function render() {
    if (!current) return;
    const route = parseRoute();
    renderTabs(route.view);
    const view = $("#view");
    view.replaceChildren();
    const views = root.PAC.views;
    if (route.view === "partida") views.partida.render(view, current);
    else if (route.view === "objetos") views.items.render(view, current);
    else views.tierlist.render(view, current, route.arg);
  }

  function mount(ds, opts) {
    const { dom, logic } = root.PAC;
    const state = loadState();
    current = {
      ds,
      state,
      save: () => saveState(state),
      navigate: (view, arg) => {
        const hash = "#" + view + (arg ? "/" + encodeURIComponent(arg) : "");
        if (root.location.hash === hash) render();
        else root.location.hash = hash;
      },
      byKey: (key) => ds.comps.find((c) => logic.compKey(c) === key) || null,
    };
    $("#report").textContent =
      (ds.reportDate ? "Informe del " + dom.fmtDate(ds.reportDate) + " · " : "") + ds.comps.length + " compos";
    const notice = $("#notice");
    notice.hidden = !ds.stale;
    notice.textContent = ds.stale ? "Sin conexión: usando datos del " + dom.fmtDate(ds.reportDate) : "";
    $("#btn-refresh").onclick = () => opts.onRefresh();
    root.onhashchange = render;
    render();
  }

  root.PAC = root.PAC || {};
  root.PAC.app = { mount };
})(window);
