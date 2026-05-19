import { extractArticleFromHtml, extractCollectionFromHtml, isAuthorizedHtml } from "./crawler";
import {
  ALL_HELP_CENTER_ARTICLE_COUNT,
  ALL_HELP_CENTER_TARGET,
  HELP_CENTER_COLLECTION_TARGETS,
  HELP_CENTER_HOME_URL,
  VERIFIED_VOICES_COLLECTION_URL
} from "./collectionTargets";
import { createIndexZip, createMetadata, mergeWarnings } from "./zip";
import type {
  ArticleIndex,
  ArticleRecord,
  ArticleSummary,
  CollectionExtraction,
  CrawlerSettings,
  CrawlerWarning,
  LatestExportMetadata,
  PopupStatusResponse,
  ProgressMessage
} from "./types";

const STORAGE_KEY = "latestExportMetadata";
const SETTINGS_KEY = "crawlerSettings";
const MIN_EXPECTED_VERIFIED_VOICES_ARTICLES = 20;
const BACKGROUND_FETCH_CONCURRENCY = 5;
const ACCESS_ERROR = "Unable to access this content. Please sign into the authorized Numerator source and try again.";
const EMPTY_INDEX_ERROR =
  "No article content could be fetched. Confirm you are signed into the authorized Help Center, then retry.";
const DEFAULT_SETTINGS: CrawlerSettings = {
  targetUrl: ALL_HELP_CENTER_TARGET
};

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("Open a browser tab to begin.");
  return tab;
}

async function getSettings(): Promise<CrawlerSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...((stored[SETTINGS_KEY] as Partial<CrawlerSettings> | undefined) || {}) };
}

async function sendTabMessage<T>(tabId: number, message: unknown): Promise<T> {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["contentScript.js"] });
    return chrome.tabs.sendMessage(tabId, message);
  }
}

function isCollectionUrl(url: string): boolean {
  return url.startsWith("https://help.numerator.com/en/collections/");
}

function isValidTarget(targetUrl: string): boolean {
  return targetUrl === ALL_HELP_CENTER_TARGET || isCollectionUrl(targetUrl);
}

function selectedTargets(settings: CrawlerSettings) {
  if (settings.targetUrl === ALL_HELP_CENTER_TARGET) return HELP_CENTER_COLLECTION_TARGETS;
  return HELP_CENTER_COLLECTION_TARGETS.filter((target) => target.url === settings.targetUrl);
}

async function fetchCollectionInBackground(targetUrl: string): Promise<CollectionExtraction> {
  const response = await fetch(targetUrl, { credentials: "include" });
  const html = await response.text();

  if (!response.ok || !isAuthorizedHtml(html)) {
    throw new Error(ACCESS_ERROR);
  }

  return extractCollectionFromHtml(html, targetUrl);
}

async function extractCollectionFromTarget(settings: CrawlerSettings): Promise<CollectionExtraction> {
  const targetUrl = settings.targetUrl || VERIFIED_VOICES_COLLECTION_URL;
  if (!isCollectionUrl(targetUrl)) throw new Error("Select a Help Center collection target.");

  const tab = await getActiveTab().catch(() => undefined);
  if (!tab?.id || tab.url !== targetUrl) return fetchCollectionInBackground(targetUrl);

  const response = await sendTabMessage<{ ok: boolean; extraction?: CollectionExtraction; error?: string }>(tab.id!, {
    type: "EXTRACT_COLLECTION"
  });
  if (!response.ok || !response.extraction) throw new Error(response.error || "Unable to detect articles on this page.");
  return response.extraction;
}

async function extractSelectedCollections(settings: CrawlerSettings): Promise<CollectionExtraction> {
  const targets = selectedTargets(settings);
  if (targets.length === 0) throw new Error("Select a Help Center section or the entire Help Center.");

  if (targets.length === 1) {
    return extractCollectionFromTarget({ ...settings, targetUrl: targets[0].url });
  }

  const collections: CollectionExtraction[] = [];
  const warnings: CrawlerWarning[] = [];
  for (const [index, target] of targets.entries()) {
    publishProgress({
      type: "INDEX_PROGRESS",
      status: `Reading collection ${index + 1} of ${targets.length}...`,
      completedCount: index + 1
    });
    await updateOverlay(`Reading ${target.name}`, `${index + 1} of ${targets.length} sections`);
    try {
      collections.push(await fetchCollectionInBackground(target.url));
    } catch (error) {
      warnings.push({
        url: target.url,
        title: target.name,
        message: error instanceof Error ? error.message : "Unable to read collection."
      });
    }
  }

  const articlesByUrl = new Map<string, ArticleSummary>();
  for (const collection of collections) {
    collection.articles.forEach((article) => articlesByUrl.set(article.url, article));
    warnings.push(...collection.warnings);
  }

  return {
    sourceUrl: HELP_CENTER_HOME_URL,
    collectionName: "All Help Center",
    articles: [...articlesByUrl.values()],
    warnings,
    extractionMethod: "multiple-help-center-collections"
  };
}

function assertAuthorizedCollection(collection: CollectionExtraction, settings: CrawlerSettings) {
  if (collection.articles.length === 0) {
    throw new Error(ACCESS_ERROR);
  }

  if (settings.targetUrl === VERIFIED_VOICES_COLLECTION_URL && collection.articles.length < MIN_EXPECTED_VERIFIED_VOICES_ARTICLES) {
    throw new Error(ACCESS_ERROR);
  }
}

function waitForTabComplete(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out loading article tab."));
    }, 30000);

    function listener(updatedTabId: number, changeInfo: { status?: string }) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function navigateActiveTabForRun(settings: CrawlerSettings): Promise<number | undefined> {
  const tab = await getActiveTab().catch(() => undefined);
  if (!tab?.id) return undefined;
  const targetUrl = settings.targetUrl === ALL_HELP_CENTER_TARGET ? HELP_CENTER_HOME_URL : settings.targetUrl;
  if (!targetUrl.startsWith("https://help.numerator.com/")) return tab.id;
  await chrome.tabs.update(tab.id, { url: targetUrl });
  await waitForTabComplete(tab.id).catch(() => undefined);
  return tab.id;
}

async function updateOverlay(title: string, detail?: string) {
  const tab = await getActiveTab().catch(() => undefined);
  if (!tab?.id || !tab.url?.startsWith("https://help.numerator.com/")) return;
  await sendTabMessage(tab.id, {
    type: "SHOW_CRAWLER_OVERLAY",
    title,
    detail
  }).catch(() => undefined);
}

async function extractArticleFromTab(summary: ArticleSummary): Promise<ArticleRecord> {
  const tab = await chrome.tabs.create({ url: summary.url, active: false });
  if (!tab.id) throw new Error(`Unable to open ${summary.url}`);
  try {
    await waitForTabComplete(tab.id);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["contentScript.js"] });
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_ARTICLE",
      summary
    })) as { ok: boolean; article?: ArticleRecord; error?: string };
    if (!response.ok || !response.article) throw new Error(response.error || "Article tab extraction failed.");
    return response.article;
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => undefined);
  }
}

async function fetchArticleInBackground(articleUrl: string, summary: ArticleSummary): Promise<ArticleRecord> {
  const response = await fetch(articleUrl, { credentials: "include" });
  const html = await response.text();

  if (!response.ok || !isAuthorizedHtml(html)) {
    throw new Error(`Background fetch did not return authorized article content: HTTP ${response.status}`);
  }

  const article = extractArticleFromHtml(html, articleUrl, summary, "background-fetch");
  if (!article.markdown && !article.text) {
    throw new Error("Background fetch returned an article page, but no article content could be extracted.");
  }
  return article;
}

function publishProgress(message: ProgressMessage) {
  chrome.runtime.sendMessage(message).catch(() => undefined);
  if (message.status !== "Index complete") {
    void updateOverlay(message.status, message.message || (message.articleCount ? `${message.articleCount} articles` : undefined));
  }
}

function backgroundFetchWarning(summary: ArticleSummary): CrawlerWarning {
  return {
    url: summary.url,
    title: summary.title,
    message: `Background fetch and tab fallback failed for ${summary.title}. Open the article while signed in, then retry.`
  };
}

async function crawlArticlesWithConcurrency(
  summaries: ArticleSummary[],
  concurrency: number,
  settings: CrawlerSettings
): Promise<{ articles: ArticleRecord[]; warnings: CrawlerWarning[] }> {
  const results = new Array<ArticleRecord | undefined>(summaries.length);
  const warnings: CrawlerWarning[] = [];
  const tabFallbackQueue: Array<{ index: number; summary: ArticleSummary }> = [];
  let nextIndex = 0;
  let completedBackgroundFetches = 0;

  async function worker() {
    while (nextIndex < summaries.length) {
      const index = nextIndex;
      nextIndex += 1;
      const summary = summaries[index];
      try {
        const article = await fetchArticleInBackground(summary.url, summary);
        results[index] = article;
        warnings.push(...article.warnings);
      } catch {
        tabFallbackQueue.push({ index, summary });
      } finally {
        completedBackgroundFetches += 1;
        publishProgress({
          type: "INDEX_PROGRESS",
          status: `Indexing ${completedBackgroundFetches} of ${summaries.length}...`,
          articleCount: summaries.length,
          completedCount: completedBackgroundFetches
        });
      }
    }
  }

  const workerCount = Math.min(concurrency, summaries.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  for (const [fallbackIndex, item] of tabFallbackQueue.entries()) {
    publishProgress({
      type: "INDEX_PROGRESS",
      status: `Opening fallback tab ${fallbackIndex + 1} of ${tabFallbackQueue.length}...`,
      articleCount: summaries.length,
      completedCount: summaries.length - tabFallbackQueue.length + fallbackIndex
    });
    try {
      const article = await extractArticleFromTab(item.summary);
      results[item.index] = article;
      warnings.push(...article.warnings);
    } catch {
      warnings.push(backgroundFetchWarning(item.summary));
    }
  }

  return {
    articles: results.filter((article): article is ArticleRecord => Boolean(article)),
    warnings
  };
}

async function buildIndexAndDownload(settings: CrawlerSettings): Promise<LatestExportMetadata> {
  if (!isValidTarget(settings.targetUrl)) throw new Error("Select a Help Center section or the entire Help Center.");

  publishProgress({ type: "INDEX_PROGRESS", status: "Preparing crawler..." });
  await navigateActiveTabForRun(settings);
  await updateOverlay("Crawler started", "Reading selected Help Center scope");

  publishProgress({ type: "INDEX_PROGRESS", status: "Finding articles..." });
  const collection = await extractSelectedCollections(settings);
  assertAuthorizedCollection(collection, settings);

  const crawl = await crawlArticlesWithConcurrency(collection.articles, BACKGROUND_FETCH_CONCURRENCY, settings);
  const crawlWarnings = [...collection.warnings, ...crawl.warnings];
  if (crawl.articles.length === 0) {
    throw new Error(EMPTY_INDEX_ERROR);
  }

  publishProgress({ type: "INDEX_PROGRESS", status: "Packaging ZIP...", articleCount: crawl.articles.length });
  const metadata = createMetadata(collection.sourceUrl, collection.collectionName, crawl.articles.length);
  const articleIndex: ArticleIndex = {
    metadata,
    articles: crawl.articles,
    warnings: mergeWarnings(crawlWarnings)
  };
  const base64Zip = await createIndexZip(articleIndex);
  const date = metadata.indexedAt.slice(0, 10);
  await chrome.downloads.download({
    url: `data:application/zip;base64,${base64Zip}`,
    filename: `help-center-index-${date}.zip`,
    saveAs: true
  });

  const latestExport: LatestExportMetadata = {
    articleCount: crawl.articles.length,
    indexedAt: metadata.indexedAt,
    sourceUrl: metadata.sourceUrl,
    collectionName: metadata.collectionName
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: latestExport });
  await updateOverlay("Index complete", `${crawl.articles.length} articles exported`);
  publishProgress({
    type: "INDEX_PROGRESS",
    status: "Index complete",
    articleCount: crawl.articles.length,
    indexedAt: metadata.indexedAt,
    collectionName: metadata.collectionName
  });
  return latestExport;
}

async function getStatus(): Promise<PopupStatusResponse> {
  const tab = await getActiveTab().catch(() => undefined);
  const latest = await chrome.storage.local.get(STORAGE_KEY);
  const latestExport = latest[STORAGE_KEY] as LatestExportMetadata | undefined;
  const settings = await getSettings();
  const isVerifiedVoicesCollection = Boolean(settings.targetUrl && isValidTarget(settings.targetUrl));
  const target = HELP_CENTER_COLLECTION_TARGETS.find((item) => item.url === settings.targetUrl);
  const expectedArticleCount = settings.targetUrl === ALL_HELP_CENTER_TARGET ? ALL_HELP_CENTER_ARTICLE_COUNT : target?.articleCount || 0;

  if (!isVerifiedVoicesCollection || !tab?.id) {
    return {
      isVerifiedVoicesCollection,
      activeUrl: tab?.url || "",
      articleCount: expectedArticleCount,
      collectionName: settings.targetUrl === ALL_HELP_CENTER_TARGET ? "All Help Center" : "",
      latestExport,
      settings
    };
  }

  try {
    return {
      isVerifiedVoicesCollection,
      activeUrl: tab.url || "",
      articleCount: expectedArticleCount,
      collectionName: settings.targetUrl === ALL_HELP_CENTER_TARGET ? "All Help Center" : target?.name || "",
      latestExport,
      settings
    };
  } catch (error) {
    return {
      isVerifiedVoicesCollection,
      activeUrl: tab.url || "",
      articleCount: 0,
      collectionName: "",
      latestExport,
      settings,
      error: error instanceof Error ? error.message : "Unable to inspect the active page."
    };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_STATUS") {
    void getStatus().then(sendResponse).catch((error) => sendResponse({ error: error instanceof Error ? error.message : "Status check failed." }));
    return true;
  }

  if (message?.type === "INDEX_SELECTED_COLLECTION") {
    const settings = { ...DEFAULT_SETTINGS, ...((message.settings as Partial<CrawlerSettings> | undefined) || {}) };
    void chrome.storage.local
      .set({ [SETTINGS_KEY]: settings })
      .then(() => buildIndexAndDownload(settings))
      .then((latestExport) => sendResponse({ ok: true, latestExport }))
      .catch((error) => {
        void updateOverlay("Crawler failed", error instanceof Error ? error.message : ACCESS_ERROR);
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : ACCESS_ERROR
        });
      });
    return true;
  }

  if (message?.type === "SET_CRAWLER_SETTINGS") {
    const settings = { ...DEFAULT_SETTINGS, ...((message.settings as Partial<CrawlerSettings> | undefined) || {}) };
    void chrome.storage.local
      .set({ [SETTINGS_KEY]: settings })
      .then(() => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to save settings." }));
    return true;
  }

  return false;
});
