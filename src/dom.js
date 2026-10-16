/* Piezas visuales reutilizables: retratos con rareza y objetos, iconos de objeto, insignias de sinergia y de tier. */
(function (root) {
  "use strict";

  const PORTRAIT_BASE = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/";
  const ASSETS = "https://raw.githubusercontent.com/keldaanCommunity/pokemonAutoChess/master/app/public/src/assets/";

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
      if (c === null || c === undefined || c === false) return;
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

  const itemIconUrl = (item) => ASSETS + "item%7Btps%7D/" + item + ".png";
  const synergyIconUrl = (type) => ASSETS + "types/" + type + ".svg";

  // Retrato con borde de rareza; opcionalmente con objetos encima y una etiqueta.
  function unit(name, ds, opts) {
    const o = opts || {};
    const size = o.size || 44;
    const p = ds.pokedex[name];
    const label = ds.t.pkm(name);
    const box = el("span", {
      class: "unit rar-" + (p ? p.rarity : "NONE"),
      style: "--size:" + size + "px",
      title: o.title !== undefined ? o.title : label,
    });
    const fallback = () => {
      box.querySelectorAll(".unit-img").forEach((n) => n.remove());
      box.prepend(el("span", { class: "unit-fallback", text: initials(label) }));
    };
    if (p) {
      const img = el("img", {
        class: "unit-img",
        src: PORTRAIT_BASE + p.portrait + "/Normal.png",
        alt: o.decorative ? "" : label,
        loading: "lazy",
        width: size,
        height: size,
      });
      img.addEventListener("error", fallback, { once: true });
      box.appendChild(img);
    } else {
      fallback();
    }
    const items = (o.items || []).slice(0, 3);
    if (items.length) {
      box.appendChild(
        el(
          "span",
          { class: "unit-items" },
          items.map((it) => el("img", { src: itemIconUrl(it), alt: ds.t.item(it), title: ds.t.item(it), loading: "lazy" }))
        )
      );
    }
    if (o.tag) box.appendChild(el("span", { class: "unit-tag", text: o.tag }));
    return box;
  }

  function itemIcon(item, ds, size) {
    const name = ds.t.item(item);
    const desc = ds.t.itemDesc ? ds.t.itemDesc(item) : "";
    return el("img", {
      class: "item-icon",
      src: itemIconUrl(item),
      alt: name,
      title: desc ? name + ": " + desc : name,
      width: size || 24,
      height: size || 24,
      loading: "lazy",
    });
  }

  // Insignia de sinergia: icono + número (o "n/objetivo"), coloreada por nivel (1 bronce, 2 plata, 3 oro).
  function synergyBadge(type, ds, opts) {
    const o = opts || {};
    const name = ds.t.synergy(type);
    const text = o.target !== undefined ? o.count + "/" + o.target : String(o.count);
    return el("span", { class: "syn-badge lv" + (o.level || 0), title: name }, [
      el("img", { src: synergyIconUrl(type), alt: name, width: 18, height: 18 }),
      el("b", { text }),
    ]);
  }

  function compSynergyBadges(comp, ds, max) {
    const L = root.PAC.logic;
    return Object.keys(comp.synergies)
      .slice(0, max || 99)
      .map((type) =>
        synergyBadge(type, ds, {
          count: comp.synergies[type],
          level: L.synergyLevel(comp.synergies[type], ds.triggers[type] || []),
        })
      );
  }

  function tierBadge(tier, big) {
    return el("span", { class: "tier t-" + tier + (big ? " big" : ""), title: "Tier " + tier, text: tier });
  }

  root.PAC = root.PAC || {};
  root.PAC.dom = {
    el,
    fmtRank,
    fmtPct,
    fmtDate,
    unit,
    itemIcon,
    synergyBadge,
    compSynergyBadges,
    tierBadge,
    synergyIconUrl,
    itemIconUrl,
  };
})(window);
