(function () {
  const monetagScripts = {
    onClick: {
      src: "https://al5sm.com/tag.min.js",
      zone: "10676099",
    },
    inline: {
      src: "https://quge5.com/88/tag.min.js",
      zone: "215987",
      cfasync: "false",
    },
    sticky: {
      src: "https://nap5k.com/tag.min.js",
      zone: "10676129",
    },
  };

  const state = {
    loaded: new Set(),
  };

  function loadScript(spec, target) {
    if (!spec) return;
    const key = `${spec.src}|${spec.zone || ""}`;
    if (state.loaded.has(key)) return;
    const script = document.createElement("script");
    script.src = spec.src;
    if (spec.zone) script.dataset.zone = String(spec.zone);
    if (spec.cfasync != null) script.dataset.cfasync = String(spec.cfasync);
    script.async = true;
    script.crossOrigin = "anonymous";
    (target || document.body || document.head).appendChild(script);
    state.loaded.add(key);
  }

  function slotHasVisibleAd(slot) {
    if (!slot) return false;
    if (slot.querySelector("iframe, img, video, canvas, object, embed")) return true;
    const visibleBlock = slot.querySelector("div, section, article, aside");
    if (!visibleBlock) return false;
    const text = slot.textContent.trim();
    return text.length > 0;
  }

  function bindPageAd() {
    const strip = document.querySelector("#ad-strip");
    const shell = document.querySelector("#page-ad-shell");
    const slot = document.querySelector("#page-ad-slot");
    if (!strip || !shell || !slot) return;

    const sync = () => {
      const hasFill = slotHasVisibleAd(slot);
      shell.classList.toggle("has-fill", hasFill);
      strip.classList.toggle("has-fill", hasFill);
    };

    const observer = new MutationObserver(sync);
    observer.observe(slot, { childList: true, subtree: true, characterData: true });
    sync();
  }

  function bindConverterLinks() {
    document.querySelectorAll("[data-converter-link]").forEach((link) => {
      link.addEventListener("click", () => {
        loadScript(monetagScripts.onClick, document.body);
      });
    });
  }

  loadScript(monetagScripts.sticky, document.querySelector("#monetag-sticky-ad"));
  loadScript(monetagScripts.inline, document.querySelector("#page-ad-slot"));
  bindPageAd();
  bindConverterLinks();
})();
