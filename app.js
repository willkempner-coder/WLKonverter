(function () {
  const API_ENDPOINT = (window.XML2LIVE_API_URL || "https://xml2live-api-vercel.vercel.app/api/xml2live").trim();
  const API_TOKEN = (window.XML2LIVE_API_TOKEN || "").trim();
  const XML_MIME_PATTERN = /(text\/xml|application\/xml|\.xml$)/i;
  const monetagConfig = window.WLK_MONETAG || {};

  const state = {
    xmlFile: null,
    xmlText: "",
    xmlSummary: null,
    convertPrimedAt: 0,
    awaitingAdNavigation: false,
    projectNameTouched: false,
  };

  const els = {
    sequenceName: document.querySelector("#sequence-name"),
    sequenceYear: document.querySelector("#sequence-year"),
    sequenceMeta: document.querySelector("#sequence-meta"),
    xmlPath: document.querySelector("#xml-path"),
    dropZone: document.querySelector("#drop-zone"),
    clearXml: document.querySelector("#clear-xml"),
    xmlInput: document.querySelector("#xml-input"),
    projectName: document.querySelector("#project-name"),
    abletonVersion: document.querySelector("#ableton-version"),
    importVolumeAndCrossfades: document.querySelector("#import-volume-and-crossfades"),
    importSequenceMarkers: document.querySelector("#import-sequence-markers"),
    status: document.querySelector("#status"),
    convert: document.querySelector("#convert"),
    progressOverlay: document.querySelector("#progress-overlay"),
    progressTitle: document.querySelector("#progress-title"),
    progressMessage: document.querySelector("#progress-message"),
    toast: document.querySelector("#toast"),
    adStrip: document.querySelector("#ad-strip"),
    pageAdShell: document.querySelector("#page-ad-shell"),
    pageAdSlot: document.querySelector("#page-ad-slot"),
  };

  const monetagState = {
    loadedScripts: new Set(),
    overlayTimer: null,
    inlineTimer: null,
  };

  function basenameOf(name) {
    return String(name).split(/[\/\\]/).pop() || name;
  }

  function stemOf(name) {
    return basenameOf(name).replace(/\.[^.]+$/, "");
  }

  function setStatus(message) {
    els.status.textContent = message;
  }

  function setXmlLoadedState(isLoaded) {
    els.clearXml.hidden = !isLoaded;
  }

  function normalizeScriptSpec(spec) {
    if (!spec) return null;
    if (typeof spec === "string") return { src: spec };
    if (typeof spec === "object" && spec.src) return spec;
    return null;
  }

  function loadExternalScript(spec, target) {
    const scriptSpec = normalizeScriptSpec(spec);
    const scriptKey = scriptSpec ? `${scriptSpec.src}|${scriptSpec.zone || ""}` : "";
    if (!scriptSpec || monetagState.loadedScripts.has(scriptKey)) return;
    const parent = target || document.head || document.body;
    if (!parent) return;
    const script = document.createElement("script");
    script.src = scriptSpec.src;
    if (scriptSpec.zone) {
      script.dataset.zone = String(scriptSpec.zone);
    }
    if (scriptSpec.cfasync != null) {
      script.dataset.cfasync = String(scriptSpec.cfasync);
    }
    script.async = true;
    script.crossOrigin = "anonymous";
    parent.appendChild(script);
    monetagState.loadedScripts.add(scriptKey);
  }

  function monetagSlotElement(slotName) {
    const selector = monetagConfig.slots && monetagConfig.slots[slotName];
    return selector ? document.querySelector(selector) : null;
  }

  function slotHasLikelyVisibleAd(slot) {
    if (!slot) return false;
    if (slot.querySelector("iframe, img, video, canvas, object, embed, a[href], [onclick]")) return true;
    return slot.childNodes.length > 0 || slot.textContent.trim().length > 0;
  }

  function updateInlineAdVisibility() {
    if (!els.adStrip || !els.pageAdShell || !els.pageAdSlot) return;
    const hasFill = slotHasLikelyVisibleAd(els.pageAdSlot);
    els.pageAdShell.classList.toggle("has-fill", hasFill);
    els.adStrip.classList.toggle("has-fill", hasFill);
  }

  function watchInlineAdFill() {
    if (!els.pageAdSlot) return;
    updateInlineAdVisibility();
    const observer = new MutationObserver(() => {
      updateInlineAdVisibility();
    });
    observer.observe(els.pageAdSlot, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function registerMonetagServiceWorker() {
    const workerConfig = monetagConfig.serviceWorker || {};
    if (!monetagConfig.enabled || !workerConfig.enabled) return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register(workerConfig.path || "./sw.js").catch((error) => {
      console.warn("Monetag service worker registration failed", error);
    });
  }

  function primeMonetagPlacements() {
    if (!monetagConfig.enabled) return;
    const scripts = monetagConfig.scripts || {};
    const inlineConfig = monetagConfig.inline || {};
    ["sticky"].forEach((slotName) => {
      const slot = monetagSlotElement(slotName);
      if (!slot) return;
      loadExternalScript(scripts[slotName], slot);
    });
    if (!inlineConfig.loadAfterSuccess) {
      const inlineSlot = monetagSlotElement("inline");
      if (inlineSlot) loadExternalScript(scripts.inline, inlineSlot);
    }
  }

  function triggerMonetagOnClick() {
    if (!monetagConfig.enabled) return;
    const onClickUrl = monetagConfig.scripts && monetagConfig.scripts.onClick;
    loadExternalScript(onClickUrl, document.body);
    window.dispatchEvent(new CustomEvent("wlk:convert-click"));
  }

  function maybeShowMonetagOverlay() {
    const overlayConfig = monetagConfig.overlay || {};
    if (!monetagConfig.enabled || !overlayConfig.enabled) return;
    if (monetagState.overlayTimer) window.clearTimeout(monetagState.overlayTimer);
    monetagState.overlayTimer = window.setTimeout(() => {
      loadExternalScript(monetagConfig.scripts && monetagConfig.scripts.overlay, document.body);
    }, Number(overlayConfig.showAfterSuccessMs) || 1200);
  }

  function maybeLoadInlineAdAfterSuccess() {
    const inlineConfig = monetagConfig.inline || {};
    if (!monetagConfig.enabled || !inlineConfig.loadAfterSuccess) return;
    if (monetagState.inlineTimer) window.clearTimeout(monetagState.inlineTimer);
    monetagState.inlineTimer = window.setTimeout(() => {
      const slot = monetagSlotElement("inline");
      loadExternalScript(monetagConfig.scripts && monetagConfig.scripts.inline, slot || document.body);
      updateInlineAdVisibility();
    }, Number(inlineConfig.showAfterSuccessMs) || 1800);
  }

  function preparePageAd() {
    const inlineConfig = monetagConfig.inline || {};
    window.setTimeout(() => {
      const slot = monetagSlotElement("inline");
      loadExternalScript(monetagConfig.scripts && monetagConfig.scripts.inline, slot || document.body);
      updateInlineAdVisibility();
    }, Number(inlineConfig.showAfterSuccessMs) || 1800);
  }

  function setBusy(isBusy) {
    els.convert.disabled = isBusy;
    els.dropZone.disabled = isBusy;
    els.clearXml.disabled = isBusy;
    els.importVolumeAndCrossfades.disabled = isBusy;
    els.importSequenceMarkers.disabled = isBusy;
    els.abletonVersion.disabled = isBusy;
    els.convert.textContent = isBusy ? "PREPARING..." : "CONVERT";
  }

  function setProgress(isVisible, title, message) {
    els.progressOverlay.classList.toggle("visible", isVisible);
    els.progressOverlay.setAttribute("aria-hidden", String(!isVisible));
    if (title) els.progressTitle.textContent = title;
    if (message) els.progressMessage.textContent = message;
  }

  let toastTimer = null;

  function showToast(message) {
    if (toastTimer) window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("visible");
    els.toast.setAttribute("aria-hidden", "false");
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("visible");
      els.toast.setAttribute("aria-hidden", "true");
    }, 2600);
  }

  function armConvertAfterAd() {
    state.awaitingAdNavigation = true;
    state.convertPrimedAt = Date.now();
    showToast("Return to this tab and click CONVERT again");
  }

  function finalizeAdNavigation() {
    if (!state.awaitingAdNavigation) return;
    state.awaitingAdNavigation = false;
  }

  function canRunPrimedConvert() {
    if (!state.convertPrimedAt) return false;
    return Date.now() - state.convertPrimedAt < 120000;
  }

  function clearPrimedConvert() {
    state.convertPrimedAt = 0;
    state.awaitingAdNavigation = false;
  }

  function waitForUiPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function guessYear(texts) {
    for (const text of texts) {
      if (!text) continue;
      const match = String(text).match(/(19|20)\d{2}/);
      if (match) return match[0];
    }
    return "";
  }

  function parseTimelineSummary(xmlText, fileName) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    if (doc.querySelector("parsererror")) {
      throw new Error("That XML could not be parsed in the browser.");
    }

    const sequence = doc.querySelector("sequence");
    if (!sequence) {
      throw new Error("This does not look like a Premiere/FCP7-style XML export.");
    }

    const sequenceName = sequence.querySelector(":scope > name")?.textContent?.trim() || stemOf(fileName);
    const audioTracks = Array.from(sequence.querySelectorAll("media > audio > track"));
    const markers = Array.from(sequence.querySelectorAll(":scope > marker"));
    const clips = Array.from(sequence.querySelectorAll("media > audio > track > clipitem"));
    const year = guessYear([
      fileName,
      sequenceName,
      ...clips.slice(0, 50).map((clip) => clip.querySelector("name")?.textContent || ""),
    ]);

    return {
      sequenceName,
      audioTrackCount: audioTracks.length,
      clipCount: clips.length,
      markerCount: markers.length,
      year,
    };
  }

  function updateSequence(summary) {
    const previousSequenceName = state.xmlSummary && state.xmlSummary.sequenceName;
    const currentProjectName = els.projectName.value.trim();
    const shouldSyncProjectName =
      !state.projectNameTouched ||
      !currentProjectName ||
      currentProjectName === previousSequenceName;

    els.sequenceName.textContent = summary.sequenceName;
    els.sequenceYear.textContent = summary.year ? `(${summary.year})` : "";
    els.sequenceMeta.textContent = `${summary.audioTrackCount} audio tracks`;
    els.xmlPath.textContent = summary.sequenceName;
    setXmlLoadedState(true);
    if (shouldSyncProjectName) {
      els.projectName.value = summary.sequenceName || "XML2LIVE Set";
      state.projectNameTouched = false;
    }
  }

  function clearLoadedXml() {
    state.xmlFile = null;
    state.xmlText = "";
    state.xmlSummary = null;
    state.projectNameTouched = false;
    els.sequenceName.textContent = "No XML selected";
    els.sequenceYear.textContent = "";
    els.sequenceMeta.textContent = "Premiere, Final Cut Pro, and DaVinci Resolve XML to Ableton Live Set";
    els.xmlPath.textContent = "Drop or Upload an XML";
    els.projectName.value = "";
    els.xmlInput.value = "";
    setXmlLoadedState(false);
  }

  async function loadXmlFile(file) {
    if (!file) return;
    setBusy(true);
    try {
      const xmlText = await file.text();
      const summary = parseTimelineSummary(xmlText, file.name);
      state.xmlFile = file;
      state.xmlText = xmlText;
      state.xmlSummary = summary;
      updateSequence(summary);
      setStatus(`Parsed ${summary.clipCount} clips across ${summary.audioTrackCount} audio tracks. Ready for web conversion.`);
    } catch (error) {
      setStatus(String(error));
    } finally {
      setBusy(false);
    }
  }


  function isXmlFile(file) {
    return file && (XML_MIME_PATTERN.test(file.type) || file.name.toLowerCase().endsWith(".xml"));
  }


  function downloadBlob(filename, blob) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function postToBackend(payload) {
    const headers = { "Content-Type": "application/json" };
    if (API_TOKEN) {
      headers["X-XML2LIVE-Token"] = API_TOKEN;
    }
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/zip") || contentType.includes("application/octet-stream")) {
      const blob = await response.blob();
      downloadBlob(`${payload.projectName || "XML2LIVE Set"}.zip`, blob);
      return "zip";
    }

    const json = await response.json();
    downloadBlob(
      `${(payload.projectName || "XML2LIVE Set").replace(/[\\/:*?"<>|]/g, "_")} - response.json`,
      new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }),
    );
    return "json";
  }

  async function convert() {
    if (!state.xmlFile || !state.xmlSummary) {
      setStatus("Choose or drop an XML first.");
      return;
    }

    if (!canRunPrimedConvert()) {
      triggerMonetagOnClick();
      armConvertAfterAd();
      return;
    } else {
      clearPrimedConvert();
    }

    const projectName = els.projectName.value.trim() || state.xmlSummary.sequenceName || "XML2LIVE Set";
    const payload = {
      app: "XML2LIVE Web",
      createdAt: new Date().toISOString(),
      projectName,
      abletonVersion: els.abletonVersion.value,
      importVolumeAndCrossfades: els.importVolumeAndCrossfades.checked,
      importSequenceMarkers: els.importSequenceMarkers.checked,
      xml: {
        fileName: state.xmlFile.name,
        summary: state.xmlSummary,
        text: state.xmlText,
      },
    };

    setBusy(true);
    setProgress(true, "Preparing conversion...", "XML2LIVE is packaging the browser request.");
    await waitForUiPaint();

    try {
      try {
        const mode = await postToBackend(payload);
        setStatus(`Backend conversion finished. Downloaded ${mode === "zip" ? "zip" : "response payload"}.`);
        showToast("Conversion complete");
        preparePageAd();
        maybeShowMonetagOverlay();
      } catch (error) {
        downloadBlob(
          `${projectName.replace(/[\\/:*?"<>|]/g, "_") || "XML2LIVE Set"} - web payload.json`,
          new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
        );
        console.error("XML2LIVE web conversion failed", error);
        setStatus(`Web conversion failed: ${error.message}. Downloaded a fallback payload instead.`);
        showToast("Web payload downloaded");
      }
    } finally {
      setProgress(false);
      setBusy(false);
    }
  }

  function attachDropEvents() {
    [els.dropZone].forEach((target) => {
      ["dragenter", "dragover"].forEach((eventName) => {
        target.addEventListener(eventName, (event) => {
          event.preventDefault();
          target.classList.add("drag-over");
        });
      });
      ["dragleave", "drop"].forEach((eventName) => {
        target.addEventListener(eventName, (event) => {
          event.preventDefault();
          target.classList.remove("drag-over");
        });
      });
    });

    els.dropZone.addEventListener("drop", async (event) => {
      const file = Array.from(event.dataTransfer?.files || []).find(isXmlFile);
      if (file) await loadXmlFile(file);
    });
  }

  els.dropZone.addEventListener("click", () => els.xmlInput.click());
  els.xmlInput.addEventListener("change", async () => {
    const file = els.xmlInput.files && els.xmlInput.files[0];
    if (file) await loadXmlFile(file);
  });
  els.clearXml.addEventListener("click", clearLoadedXml);
  els.projectName.addEventListener("input", () => {
    state.projectNameTouched = true;
  });
  els.convert.addEventListener("click", convert);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      finalizeAdNavigation();
    }
  });
  watchInlineAdFill();
  registerMonetagServiceWorker();
  primeMonetagPlacements();
  attachDropEvents();
  setXmlLoadedState(false);
})();
