type UnknownRecord = Record<string, unknown>;

type CrawlerWarning = {
  url?: string;
  title?: string;
  message: string;
};

type ArticleSummary = {
  id: string;
  title: string;
  url: string;
  summary: string;
  authorName: string;
  lastUpdated: string;
  lastUpdatedDate: string;
  collectionName: string;
  subcollectionName: string;
};

type ArticleRecord = ArticleSummary & {
  markdown: string;
  text: string;
  crawledAt: string;
  extractionMethod: string;
  warnings: CrawlerWarning[];
};

type CollectionExtraction = {
  sourceUrl: string;
  collectionName: string;
  articles: ArticleSummary[];
  warnings: CrawlerWarning[];
  extractionMethod: string;
};

(() => {
  const globalState = globalThis as typeof globalThis & { __numeratorHelpCenterCrawlerContentScriptLoaded?: boolean };
  if (globalState.__numeratorHelpCenterCrawlerContentScriptLoaded) return;
  globalState.__numeratorHelpCenterCrawlerContentScriptLoaded = true;

  const BASE_URL = "https://help.numerator.com";

  function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function getString(record: UnknownRecord | undefined, keys: string[]): string {
    if (!record) return "";
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
    return "";
  }

  function getArray(record: UnknownRecord | undefined, keys: string[]): unknown[] {
    if (!record) return [];
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  function normalizeUrl(url: string): string {
    if (!url) return "";
    const parsed = new URL(url, BASE_URL);
    if (parsed.hostname === "help.numerator.com") parsed.protocol = "https:";
    return parsed.toString();
  }

  function safeSlug(value: string): string {
    return (
      value
        .toLowerCase()
        .replace(/https?:\/\//g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 90) || "article"
    );
  }

  function stripTags(html: string): string {
    const template = document.createElement("template");
    template.innerHTML = html;
    template.content.querySelectorAll("script, style, noscript").forEach((element) => element.remove());
    return (template.content.textContent || "").replace(/\s+/g, " ").trim();
  }

  function htmlToMarkdown(html: string): string {
    const template = document.createElement("template");
    template.innerHTML = html;

    template.content.querySelectorAll("script, style, noscript").forEach((element) => element.remove());
    template.content.querySelectorAll("h1, h2, h3, p, li, br").forEach((element) => {
      if (element.tagName === "BR") element.replaceWith("\n");
    });

    const lines: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.replace(/\s+/g, " ").trim();
        if (text) lines.push(text);
        return;
      }

      if (!(node instanceof HTMLElement)) {
        node.childNodes.forEach(walk);
        return;
      }

      const tag = node.tagName.toLowerCase();
      const text = node.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!text) return;

      if (tag === "h1") lines.push(`# ${text}`);
      else if (tag === "h2") lines.push(`## ${text}`);
      else if (tag === "h3") lines.push(`### ${text}`);
      else if (tag === "li") lines.push(`- ${text}`);
      else if (tag === "a") {
        const href = node.getAttribute("href");
        lines.push(href ? `[${text}](${normalizeUrl(href)})` : text);
      } else if (["p", "div", "section", "article"].includes(tag)) {
        node.childNodes.forEach(walk);
        lines.push("");
      } else {
        node.childNodes.forEach(walk);
      }
    };

    template.content.childNodes.forEach(walk);
    return lines
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function extractNextData(): UnknownRecord | null {
    const raw = document.querySelector<HTMLScriptElement>("script#__NEXT_DATA__")?.textContent;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function pagePropsFrom(nextData: UnknownRecord | null): UnknownRecord | undefined {
    const props = isRecord(nextData?.props) ? nextData.props : undefined;
    return isRecord(props?.pageProps) ? props.pageProps : undefined;
  }

  function collectionFrom(nextData: UnknownRecord | null): UnknownRecord | undefined {
    const pageProps = pagePropsFrom(nextData);
    return isRecord(pageProps?.collection) ? pageProps.collection : undefined;
  }

  function articleFrom(nextData: UnknownRecord | null): UnknownRecord | undefined {
    const pageProps = pagePropsFrom(nextData);
    if (isRecord(pageProps?.article)) return pageProps.article;
    if (isRecord(pageProps?.articleContent)) return pageProps.articleContent;
    return undefined;
  }

  function recordToSummary(record: UnknownRecord, collectionName: string, subcollectionName = ""): ArticleSummary | null {
    const title = getString(record, ["title", "name"]);
    const url = normalizeUrl(getString(record, ["url", "href", "articleUrl", "article_url"]));
    const id = getString(record, ["id", "articleId", "article_id"]) || safeSlug(url || title);
    const author = isRecord(record.author) ? record.author : undefined;
    if (!title || !url) return null;
    return {
      id,
      title,
      url,
      summary: getString(record, ["summary", "description", "subtitle"]),
      authorName: getString(record, ["authorName", "author_name"]) || getString(author, ["name", "fullName", "full_name"]),
      lastUpdated: getString(record, ["lastUpdated", "last_updated", "updatedAt", "updated_at"]),
      lastUpdatedDate: getString(record, ["lastUpdatedDate", "last_updated_date", "updatedAtDate", "updated_at_date"]),
      collectionName,
      subcollectionName
    };
  }

  function dedupeArticles(articles: ArticleSummary[]): ArticleSummary[] {
    const byUrl = new Map<string, ArticleSummary>();
    for (const article of articles) byUrl.set(article.url, article);
    return [...byUrl.values()];
  }

  function collectStructuredArticles(collection: UnknownRecord): ArticleSummary[] {
    const collectionName = getString(collection, ["name", "title"]) || "Verified Voices (Survey)";
    const summaries: ArticleSummary[] = [];

    for (const item of getArray(collection, ["articleSummaries", "article_summaries", "articles"])) {
      if (isRecord(item)) {
        const summary = recordToSummary(item, collectionName);
        if (summary) summaries.push(summary);
      }
    }

    for (const subcollection of getArray(collection, ["subcollections", "sections"])) {
      if (!isRecord(subcollection)) continue;
      const subcollectionName = getString(subcollection, ["name", "title"]);
      for (const item of getArray(subcollection, ["articleSummaries", "article_summaries", "articles"])) {
        if (isRecord(item)) {
          const summary = recordToSummary(item, collectionName, subcollectionName);
          if (summary) summaries.push(summary);
        }
      }
    }

    return dedupeArticles(summaries);
  }

  function anchorFallback(collectionName: string): ArticleSummary[] {
    const summaries: ArticleSummary[] = [];
    document.querySelectorAll<HTMLAnchorElement>('a[data-testid="article-link"], a[href*="/en/articles/"]').forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      if (!href.includes("/en/articles/")) return;
      const url = normalizeUrl(href);
      const title = anchor.textContent?.replace(/\s+/g, " ").trim() || url.split("/").pop()?.replace(/-/g, " ") || "Untitled article";
      summaries.push({
        id: safeSlug(url),
        title,
        url,
        summary: "",
        authorName: "",
        lastUpdated: "",
        lastUpdatedDate: "",
        collectionName,
        subcollectionName: ""
      });
    });
    return dedupeArticles(summaries);
  }

  function extractCollection(): CollectionExtraction {
    const warnings: CrawlerWarning[] = [];
    const nextData = extractNextData();
    const collection = collectionFrom(nextData);

    if (collection) {
      const collectionName = getString(collection, ["name", "title"]) || "Verified Voices (Survey)";
      const articles = collectStructuredArticles(collection);
      if (articles.length > 0) {
        return { sourceUrl: window.location.href, collectionName, articles, warnings, extractionMethod: "__NEXT_DATA__" };
      }
      warnings.push({ message: "Collection metadata was found, but no article summaries were available." });
    } else {
      warnings.push({ message: "Collection metadata was not available in script#__NEXT_DATA__; used DOM link fallback." });
    }

    return {
      sourceUrl: window.location.href,
      collectionName: "Verified Voices (Survey)",
      articles: anchorFallback("Verified Voices (Survey)"),
      warnings,
      extractionMethod: "dom-link-fallback"
    };
  }

  function findHtmlBody(value: unknown, depth = 0): string {
    if (depth > 8) return "";
    if (typeof value === "string") return /<\/?[a-z][\s\S]*>/i.test(value) && value.length > 60 ? value : "";
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findHtmlBody(item, depth + 1);
        if (found) return found;
      }
      return "";
    }
    if (!isRecord(value)) return "";
    for (const key of ["body", "bodyHtml", "body_html", "content", "contentHtml", "content_html", "html", "description"]) {
      const found = findHtmlBody(value[key], depth + 1);
      if (found) return found;
    }
    for (const nestedValue of Object.values(value)) {
      const found = findHtmlBody(nestedValue, depth + 1);
      if (found) return found;
    }
    return "";
  }

  function extractVisibleHtml(): string {
    return document.querySelector("article")?.innerHTML || document.querySelector("main")?.innerHTML || document.body?.innerHTML || "";
  }

  function extractArticle(summary?: ArticleSummary): ArticleRecord {
    const url = window.location.href;
    const warnings: CrawlerWarning[] = [];
    const nextData = extractNextData();
    const articleMeta = articleFrom(nextData);
    const bodyHtml = findHtmlBody(articleMeta) || extractVisibleHtml();
    const markdown = htmlToMarkdown(bodyHtml);
    const text = stripTags(bodyHtml);

    if (!articleMeta) warnings.push({ url, message: "Article metadata was not available in script#__NEXT_DATA__; used visible page fallback." });
    if (!markdown && !text) warnings.push({ url, message: "Article body extraction returned empty content." });

    return {
      id: getString(articleMeta, ["id", "articleId", "article_id"]) || summary?.id || safeSlug(url),
      title: getString(articleMeta, ["title", "name"]) || summary?.title || document.title || "Untitled article",
      url,
      summary: getString(articleMeta, ["summary", "description", "subtitle"]) || summary?.summary || "",
      authorName: getString(articleMeta, ["authorName", "author_name"]) || summary?.authorName || "",
      lastUpdated: getString(articleMeta, ["lastUpdated", "last_updated", "updatedAt", "updated_at"]) || summary?.lastUpdated || "",
      lastUpdatedDate:
        getString(articleMeta, ["lastUpdatedDate", "last_updated_date", "updatedAtDate", "updated_at_date"]) || summary?.lastUpdatedDate || "",
      collectionName: summary?.collectionName || "Verified Voices (Survey)",
      subcollectionName: summary?.subcollectionName || "",
      markdown,
      text,
      crawledAt: new Date().toISOString(),
      extractionMethod: articleMeta ? "tab-content-script" : "tab-content-script:visible-fallback",
      warnings
    };
  }

  function showCrawlerOverlay(title: string, detail = "") {
    let overlay = document.getElementById("help-center-crawler-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "help-center-crawler-overlay";
      overlay.setAttribute("role", "status");
      overlay.innerHTML = `
        <div class="nhcc-card">
          <div class="nhcc-spinner"></div>
          <div>
            <strong class="nhcc-title"></strong>
            <span class="nhcc-detail"></span>
          </div>
        </div>
      `;
      const style = document.createElement("style");
      style.id = "help-center-crawler-overlay-style";
      style.textContent = `
        #help-center-crawler-overlay {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 2147483647;
          max-width: 360px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #173236;
        }
        #help-center-crawler-overlay .nhcc-card {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          align-items: center;
          padding: 14px 16px;
          border: 1px solid #cde2e0;
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 18px 48px rgb(0 0 0 / 18%);
        }
        #help-center-crawler-overlay .nhcc-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #d9e7e5;
          border-top-color: #004a52;
          border-radius: 999px;
          animation: nhcc-spin 850ms linear infinite;
        }
        #help-center-crawler-overlay .nhcc-title,
        #help-center-crawler-overlay .nhcc-detail {
          display: block;
          line-height: 1.35;
        }
        #help-center-crawler-overlay .nhcc-title {
          color: #004a52;
          font-size: 14px;
        }
        #help-center-crawler-overlay .nhcc-detail {
          margin-top: 3px;
          color: #526a6e;
          font-size: 12px;
        }
        @keyframes nhcc-spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.documentElement.append(style);
      document.documentElement.append(overlay);
    }
    overlay.querySelector(".nhcc-title")!.textContent = title;
    overlay.querySelector(".nhcc-detail")!.textContent = detail;
  }

  function hideCrawlerOverlay() {
    document.getElementById("help-center-crawler-overlay")?.remove();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "SHOW_CRAWLER_OVERLAY") {
      showCrawlerOverlay(String(message.title || "Crawler running"), String(message.detail || ""));
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "HIDE_CRAWLER_OVERLAY") {
      hideCrawlerOverlay();
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "EXTRACT_COLLECTION") {
      try {
        sendResponse({ ok: true, extraction: extractCollection() });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : "Collection extraction failed." });
      }
      return true;
    }

    if (message?.type === "EXTRACT_ARTICLE") {
      try {
        sendResponse({ ok: true, article: extractArticle(message.summary as ArticleSummary | undefined) });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : "Article extraction failed." });
      }
      return true;
    }

    return false;
  });
})();
