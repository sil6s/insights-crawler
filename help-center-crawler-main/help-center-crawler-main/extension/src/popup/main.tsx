import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CrawlerSettings, PopupStatusResponse, ProgressMessage } from "../types";
import { ALL_HELP_CENTER_ARTICLE_COUNT, ALL_HELP_CENTER_TARGET, HELP_CENTER_COLLECTION_TARGETS } from "../collectionTargets";
import "./popup.css";

const DEFAULT_SETTINGS: CrawlerSettings = {
  targetUrl: ALL_HELP_CENTER_TARGET
};

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function Icon({ name }: { name: "download" | "file" | "link" | "search" | "zap" }) {
  const paths = {
    download: "M12 3v10m0 0 4-4m-4 4-4-4M5 17v3h14v-3",
    file: "M14 3H6v18h12V7l-4-4Zm0 0v4h4",
    link: "M10 13a5 5 0 0 0 7.1 0l1.4-1.4a5 5 0 0 0-7.1-7.1L10.5 5M14 11a5 5 0 0 0-7.1 0l-1.4 1.4a5 5 0 0 0 7.1 7.1l.9-.9",
    search: "m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
    zap: "M13 2 5 14h6l-1 8 8-12h-6l1-8Z"
  };

  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none">
      <path d={paths[name]} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Popup() {
  const [status, setStatus] = useState<PopupStatusResponse | null>(null);
  const [progress, setProgress] = useState<ProgressMessage | null>(null);
  const [settings, setSettings] = useState<CrawlerSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
  const latest = status?.latestExport;
  const iconUrl = chrome.runtime.getURL("icons/48.png");

  async function refreshStatus() {
    const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    setStatus(response);
    if (response?.settings) setSettings(response.settings);
  }

  useEffect(() => {
    void refreshStatus().catch((statusError) => setError(statusError instanceof Error ? statusError.message : "Unable to inspect this tab."));
    const listener = (message: ProgressMessage) => {
      if (message?.type === "INDEX_PROGRESS") setProgress(message);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function indexSelectedCollection() {
    setError("");
    setProgress({ type: "INDEX_PROGRESS", status: "Finding articles..." });
    setIsIndexing(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: "INDEX_SELECTED_COLLECTION", settings });
      if (!response?.ok) throw new Error(response?.error || "Indexing failed.");
      await refreshStatus();
    } catch (indexError) {
      setError(indexError instanceof Error ? indexError.message : "Unable to access this content. Please sign into the authorized Numerator source and try again.");
    } finally {
      setIsIndexing(false);
    }
  }

  async function updateSettings(nextSettings: CrawlerSettings) {
    setSettings(nextSettings);
    await chrome.runtime.sendMessage({ type: "SET_CRAWLER_SETTINGS", settings: nextSettings }).catch(() => undefined);
  }

  const statusTitle = status?.isVerifiedVoicesCollection ? "Scope ready" : "Select a scope";
  const canIndex = Boolean(status?.isVerifiedVoicesCollection);
  const selectedTarget = HELP_CENTER_COLLECTION_TARGETS.find((target) => target.url === settings.targetUrl);
  const selectedLabel = settings.targetUrl === ALL_HELP_CENTER_TARGET ? "Entire Help Center" : selectedTarget?.name || "Selected section";
  const targetArticleCount = settings.targetUrl === ALL_HELP_CENTER_TARGET ? ALL_HELP_CENTER_ARTICLE_COUNT : selectedTarget?.articleCount || status?.articleCount || 0;

  return (
    <main className="popup-shell">
      <section className="hero-card">
        <div className="hero-title">
          <img className="hero-logo" src={iconUrl} alt="" />
          <h1>Help Center Crawler</h1>
        </div>
      </section>

      <section className="scope-card">
        <div className="card-heading">
          <Icon name="search" />
          <strong>Scope</strong>
        </div>
        <label htmlFor="scope">Index target</label>
        <select
          id="scope"
          value={settings.targetUrl}
          onChange={(event) => void updateSettings({ ...settings, targetUrl: event.currentTarget.value })}
          disabled={isIndexing}
        >
          <option value={ALL_HELP_CENTER_TARGET}>Entire Help Center</option>
          {HELP_CENTER_COLLECTION_TARGETS.map((target) => (
            <option key={target.url} value={target.url}>
              {target.name}
            </option>
          ))}
        </select>
      </section>

      <section className="status-card">
        <div className="card-heading">
          <Icon name="file" />
          <strong>{statusTitle}</strong>
        </div>
        <span>{selectedLabel}</span>
        <span>{targetArticleCount} target articles</span>
        {status?.error ? <small>{status.error}</small> : null}
      </section>

      {progress ? (
        <section className={progress.status === "Index complete" ? "success-card" : "progress-card"}>
          <strong>{progress.status}</strong>
          {progress.articleCount ? <span>{progress.articleCount} articles</span> : null}
        </section>
      ) : null}

      {error ? <section className="error-card">{error}</section> : null}

      {latest ? (
        <section className="success-card">
          <strong>Latest export</strong>
          <span>
            {latest.articleCount} articles • {formatDate(latest.indexedAt)}
          </span>
        </section>
      ) : null}

      <div className="actions">
        <button type="button" onClick={indexSelectedCollection} disabled={!canIndex || isIndexing}>
          <Icon name="download" />
          {isIndexing ? "Indexing..." : "Start Crawler"}
        </button>
        <button type="button" className="secondary" onClick={indexSelectedCollection} disabled={!latest || !canIndex || isIndexing}>
          <Icon name="download" />
          Download Fresh ZIP
        </button>
        <button type="button" className="ghost" onClick={() => chrome.tabs.create({ url: selectedTarget?.url || "https://help.numerator.com/en/" })}>
          <Icon name="link" />
          Open Scope
        </button>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
