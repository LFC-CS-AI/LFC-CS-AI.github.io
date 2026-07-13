(function () {
  "use strict";

  var script = document.currentScript;
  var host = script && script.closest(".visitor-map-embed");

  if (!host) {
    return;
  }

  var width = Math.min(800, Math.max(1, Math.floor(host.clientWidth || 320)));
  var height = Math.round(width / 2);
  var loadingMessage = host.querySelector(".visitor-map-loading");
  var loadingTimer = window.setTimeout(function () {
    if (loadingMessage) {
      loadingMessage.textContent = "The live map is temporarily unavailable. Use the country-level statistics link below.";
    }
  }, 12000);

  window._wau = window._wau || [];
  window._wau.push([
    "map",
    "lfcowcvt9czb",
    "visitorMap",
    String(width),
    String(height),
    "night",
    "cross-pink"
  ]);

  var observer = new MutationObserver(function () {
    var map = host.querySelector(":scope > span");

    if (map) {
      window.clearTimeout(loadingTimer);
      host.classList.add("visitor-map-loaded");
      observer.disconnect();
    }
  });

  observer.observe(host, { childList: true });
}());
