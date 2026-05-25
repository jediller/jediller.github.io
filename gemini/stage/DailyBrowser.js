  async function loadManifest() {
    try {
      manifest = await fetch(MANIFEST_URL, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`Could not load ${MANIFEST_URL}`);
        return r.json();
      });
    } catch (error) {
      manifest = [
        { id: "financial-news", title: "Financial News", file: "FinancialNews.txt" },
        { id: "mass-readings", title: "Mass Readings", file: "MassReadings.txt" },
        { id: "daily-news", title: "Daily News", file: "DailyNews.txt" },
        { id: "geography-lesson", title: "Geography Lesson", file: "GeoLesson.txt" },
        { id: "movers-shakers", title: "Movers and Shakers", file: "MoversShakers.txt" }
      ];
      setStatus("Using built-in topic list because DailyBrowserManifest.json was not loaded.");
    }
  }
