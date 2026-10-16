/* Arranque: carga los datos y monta la interfaz. */
(function (root) {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function start(force) {
    $("#loading").hidden = false;
    $("#error").hidden = true;
    root.PAC.data
      .load({ force })
      .then((ds) => {
        $("#loading").hidden = true;
        root.PAC.ui.mount(ds, { onRefresh: () => start(true) });
      })
      .catch((err) => {
        $("#loading").hidden = true;
        const source = err && err.source ? err.source : "desconocida";
        $("#error-text").textContent =
          "No se pudieron descargar los datos (fuente: " + source + "). Comprueba tu conexión y pulsa Reintentar.";
        $("#error").hidden = false;
        if (!(err && err.source)) console.error(err);
      });
  }

  $("#btn-retry").addEventListener("click", () => start(false));
  start(false);
})(window);
