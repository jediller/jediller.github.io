(() => {
  "use strict";

  const WEEKDAYS = ["Current", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday", "Tuesday"];
  const REPORT_BASE = "../result/";
  const HISTORY_BASE = "../history/";
  const QUERY_BASE = "../query/";
  const MANIFEST_URL = "DailyBrowserManifest.json";

  /*
   * DailyBrowser.js
   *
   * Long-report speech fix:
   * Browser speech synthesis can fail or stop early when asked to speak a large
   * report as one giant SpeechSynthesisUtterance. This version keeps the report
   * file intact and splits text dynamically at playback time.
   */
  const SPEECH_CHUNK_LIMIT = 1400;

  const els = {
    topicSelect: document.getElementById("topicSelect"),
    versionSelect: document.getElementById("versionSelect"),
    voiceSelect: document.getElementById("voiceSelect"),
    rateInput: document.getElementById("rateInput"),
    rateValue: document.getElementById("rateValue"),
    loadButton: document.getElementById("loadButton"),
    readButton: document.getElementById("readButton"),
    pauseButton: document.getElementById("pauseButton"),
    resumeButton: document.getElementById("resumeButton"),
    stopButton: document.getElementById("stopButton"),
    copyReportButton: document.getElementById("copyReportButton"),
    copyAskButton: document.getElementById("copyAskButton"),
    statusLine: document.getElementById("statusLine"),
    reportTitle: document.getElementById("reportTitle"),
    askTitle: document.getElementById("askTitle"),
    reportText: document.getElementById("reportText"),
    askText: document.getElementById("askText"),
    reportTab: document.getElementById("reportTab"),
    askTab: document.getElementById("askTab"),
    reportPanel: document.getElementById("reportPanel"),
    askPanel: document.getElementById("askPanel")
  };

  let manifest = [];
  let voices = [];
  let currentReportText = "";
  let currentAskText = "";
  let utterance = null;

  let speechChunks = [];
  let speechChunkIndex = 0;
  let speechStoppedByUser = false;

  function setStatus(message) {
    els.statusLine.textContent = message;
  }

  function fileUrlForReport(fileName, version) {
    if (version === "Current") {
      return REPORT_BASE + encodeURIComponent(fileName);
    }
    return HISTORY_BASE + encodeURIComponent(version) + "/" + encodeURIComponent(fileName);
  }

  function fileUrlForAsk(fileName) {
    return QUERY_BASE + encodeURIComponent(fileName);
  }

  async function fetchText(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load ${url} (${response.status})`);
    }
    return response.text();
  }

  async function loadManifest() {
    try {
      manifest = await fetch(MANIFEST_URL, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`Could not load ${MANIFEST_URL}`);
        return r.json();
      });
    } catch (error) {
      manifest = [
        { id: "daily-news", title: "Daily News", file: "DailyNews.txt" },
        { id: "financial-news", title: "Financial News", file: "FinancialNews.txt" },
        { id: "mass-readings", title: "Mass Readings", file: "MassReadings.txt" }
      ];
      setStatus("Using built-in topic list because DailyBrowserManifest.json was not loaded.");
    }
  }

  function populateTopics() {
    els.topicSelect.innerHTML = "";
    for (const item of manifest) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.title;
      els.topicSelect.appendChild(option);
    }
  }

  function populateVersions() {
    els.versionSelect.innerHTML = "";
    for (const day of WEEKDAYS) {
      const option = document.createElement("option");
      option.value = day;
      option.textContent = day === "Current" ? "Current result" : `History: ${day}`;
      els.versionSelect.appendChild(option);
    }
  }

  function selectedTopic() {
    return manifest.find((item) => item.id === els.topicSelect.value) || manifest[0];
  }

  async function loadSelected() {
    stopSpeech();
    const topic = selectedTopic();
    const version = els.versionSelect.value;
    if (!topic) return;

    const reportUrl = fileUrlForReport(topic.file, version);
    const askUrl = fileUrlForAsk(topic.file);

    els.reportTitle.textContent = `${topic.title} — ${version === "Current" ? "Current" : version}`;
    els.askTitle.textContent = `${topic.title} — Ask`;
    els.reportText.textContent = "Loading report...";
    els.askText.textContent = "Loading ask...";
    setStatus(`Loading ${topic.title}...`);

    try {
      const [report, ask] = await Promise.allSettled([fetchText(reportUrl), fetchText(askUrl)]);

      if (report.status === "fulfilled") {
        currentReportText = report.value.trimEnd();
        els.reportText.textContent = currentReportText || "The report file loaded, but it was empty.";
      } else {
        currentReportText = "";
        els.reportText.textContent = report.reason.message;
      }

      if (ask.status === "fulfilled") {
        currentAskText = ask.value.trimEnd();
        els.askText.textContent = currentAskText || "The ask file loaded, but it was empty.";
      } else {
        currentAskText = "";
        els.askText.textContent = ask.reason.message;
      }

      if (report.status === "fulfilled") {
        setStatus(`Loaded ${topic.title} from ${version === "Current" ? "current results" : version + " history"}.`);
      } else {
        setStatus(`Report not available: ${report.reason.message}`);
      }
    } catch (error) {
      currentReportText = "";
      currentAskText = "";
      els.reportText.textContent = error.message;
      els.askText.textContent = "Ask not loaded.";
      setStatus(error.message);
    }
  }

  function refreshVoices() {
    if (!("speechSynthesis" in window)) {
      els.voiceSelect.innerHTML = "<option>Speech not supported</option>";
      els.readButton.disabled = true;
      els.pauseButton.disabled = true;
      els.resumeButton.disabled = true;
      els.stopButton.disabled = true;
      return;
    }

    voices = window.speechSynthesis.getVoices();
    els.voiceSelect.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Default browser voice";
    els.voiceSelect.appendChild(defaultOption);

    for (const voice of voices) {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})${voice.default ? " — default" : ""}`;
      els.voiceSelect.appendChild(option);
    }
  }

  function selectedVoice() {
    const name = els.voiceSelect.value;
    return voices.find((voice) => voice.name === name) || null;
  }

  function normalizeSpeechText(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function splitOversizedChunk(text, limit) {
    const pieces = [];
    let remaining = text.trim();

    while (remaining.length > limit) {
      let cut = remaining.lastIndexOf(". ", limit);
      if (cut < Math.floor(limit * 0.45)) cut = remaining.lastIndexOf("? ", limit);
      if (cut < Math.floor(limit * 0.45)) cut = remaining.lastIndexOf("! ", limit);
      if (cut < Math.floor(limit * 0.45)) cut = remaining.lastIndexOf("; ", limit);
      if (cut < Math.floor(limit * 0.45)) cut = remaining.lastIndexOf(", ", limit);
      if (cut < Math.floor(limit * 0.45)) cut = remaining.lastIndexOf(" ", limit);
      if (cut < Math.floor(limit * 0.45)) cut = limit;

      const piece = remaining.slice(0, cut + 1).trim();
      if (piece) pieces.push(piece);
      remaining = remaining.slice(cut + 1).trim();
    }

    if (remaining) pieces.push(remaining);
    return pieces;
  }

  function splitTextForSpeech(text, limit = SPEECH_CHUNK_LIMIT) {
    const cleaned = normalizeSpeechText(text);
    if (!cleaned) return [];

    const paragraphs = cleaned.split(/\n\s*\n/);
    const chunks = [];
    let current = "";

    function pushCurrent() {
      const trimmed = current.trim();
      if (trimmed) chunks.push(trimmed);
      current = "";
    }

    for (const paragraph of paragraphs) {
      const p = paragraph.trim();
      if (!p) continue;

      if (p.length > limit) {
        pushCurrent();
        chunks.push(...splitOversizedChunk(p, limit));
        continue;
      }

      const candidate = current ? `${current}\n\n${p}` : p;
      if (candidate.length <= limit) {
        current = candidate;
      } else {
        pushCurrent();
        current = p;
      }
    }

    pushCurrent();
    return chunks;
  }

  function makeUtterance(text) {
    const u = new SpeechSynthesisUtterance(text);
    const voice = selectedVoice();
    if (voice) u.voice = voice;
    u.rate = Number(els.rateInput.value) || 1;
    return u;
  }

  function speakCurrentChunk() {
    if (speechStoppedByUser) return;

    if (speechChunkIndex >= speechChunks.length) {
      utterance = null;
      setStatus("Finished reading.");
      return;
    }

    const chunkNumber = speechChunkIndex + 1;
    const totalChunks = speechChunks.length;

    utterance = makeUtterance(speechChunks[speechChunkIndex]);

    utterance.onstart = () => {
      if (totalChunks === 1) {
        setStatus("Reading aloud...");
      } else {
        setStatus(`Reading aloud... chunk ${chunkNumber} of ${totalChunks}`);
      }
    };

    utterance.onend = () => {
      if (speechStoppedByUser) return;
      speechChunkIndex += 1;
      speakCurrentChunk();
    };

    utterance.onerror = (event) => {
      if (speechStoppedByUser) return;
      setStatus(`Speech error on chunk ${chunkNumber} of ${totalChunks}: ${event.error || "unknown error"}`);
    };

    window.speechSynthesis.speak(utterance);
  }

  function readAloud() {
    if (!("speechSynthesis" in window)) {
      setStatus("This browser does not support speech synthesis.");
      return;
    }

    const text = currentReportText || els.reportText.textContent || "";
    if (!text.trim() || text.startsWith("Could not load")) {
      setStatus("Load a report before reading aloud.");
      return;
    }

    stopSpeech();

    speechChunks = splitTextForSpeech(text);
    speechChunkIndex = 0;
    speechStoppedByUser = false;

    if (speechChunks.length === 0) {
      setStatus("No readable report text found.");
      return;
    }

    speakCurrentChunk();
  }

  function pauseSpeech() {
    if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setStatus("Paused.");
    }
  }

  function resumeSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.resume();
      setStatus("Resumed.");
    }
  }

  function stopSpeech() {
    speechStoppedByUser = true;
    speechChunks = [];
    speechChunkIndex = 0;
    utterance = null;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  async function copyText(text, label) {
    if (!text.trim()) {
      setStatus(`No ${label} text to copy.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${label} text.`);
    } catch (error) {
      setStatus("Copy failed. You can still select and copy the text manually.");
    }
  }

  function setActiveTab(which) {
    const showAsk = which === "ask";
    els.askTab.classList.toggle("active", showAsk);
    els.reportTab.classList.toggle("active", !showAsk);
    els.askPanel.classList.toggle("active", showAsk);
    els.reportPanel.classList.toggle("active", !showAsk);
    els.askTab.setAttribute("aria-selected", String(showAsk));
    els.reportTab.setAttribute("aria-selected", String(!showAsk));
  }

  function wireEvents() {
    els.loadButton.addEventListener("click", loadSelected);
    els.topicSelect.addEventListener("change", loadSelected);
    els.versionSelect.addEventListener("change", loadSelected);
    els.readButton.addEventListener("click", readAloud);
    els.pauseButton.addEventListener("click", pauseSpeech);
    els.resumeButton.addEventListener("click", resumeSpeech);
    els.stopButton.addEventListener("click", () => {
      stopSpeech();
      setStatus("Stopped.");
    });
    els.copyReportButton.addEventListener("click", () => copyText(currentReportText, "report"));
    els.copyAskButton.addEventListener("click", () => copyText(currentAskText, "ask"));
    els.reportTab.addEventListener("click", () => setActiveTab("report"));
    els.askTab.addEventListener("click", () => setActiveTab("ask"));
    els.rateInput.addEventListener("input", () => {
      els.rateValue.textContent = Number(els.rateInput.value).toFixed(1);
    });

    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
  }

  async function init() {
    await loadManifest();
    populateTopics();
    populateVersions();
    refreshVoices();
    wireEvents();
    if (manifest.length > 0) {
      await loadSelected();
    }
  }

  init();
})();
