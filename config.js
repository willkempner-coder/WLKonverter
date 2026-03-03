window.XML2LIVE_API_URL = "https://xml2live-api-vercel.vercel.app/api/xml2live";
window.WLK_MONETAG = {
  enabled: true,
  serviceWorker: {
    enabled: false,
    path: "./sw.js",
  },
  scripts: {
    onClick: {
      src: "https://al5sm.com/tag.min.js",
      zone: "10676099",
    },
    inline: {
      src: "https://nap5k.com/tag.min.js",
      zone: "10676107",
    },
    sticky: "",
    overlay: {
      src: "https://gizokraijaw.net/vignette.min.js",
      zone: "10676108",
    },
  },
  slots: {
    inline: "#monetag-inline-ad",
    sticky: "#monetag-sticky-ad",
    overlay: "#monetag-overlay-ad",
  },
  overlay: {
    enabled: true,
    showAfterSuccessMs: 900,
  },
};
