import type { ArticleRecord, ArticleSummary, CollectionExtraction, CrawlerWarning } from "./types";
import { VERIFIED_VOICES_COLLECTION_URL } from "./collectionTargets";

const BASE_URL = "https://help.numerator.com";

type UnknownRecord = Record<string, unknown>;

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

export function normalizeUrl(url: string): string {
  if (!url) return "";
  const parsed = new URL(url, BASE_URL);
  if (parsed.hostname === "help.numerator.com") parsed.protocol = "https:";
  return parsed.toString();
}

export function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "article";
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .split("\n")
    .map((line) => stripTags(line).trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractNextDataFromHtml(html: string): UnknownRecord | null {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]);
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

function anchorFallback(html: string, collectionName: string): ArticleSummary[] {
  const summaries: ArticleSummary[] = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']*\/en\/articles\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html))) {
    const url = normalizeUrl(match[1]);
    const title = stripTags(match[2]) || url.split("/").pop()?.replace(/-/g, " ") || "Untitled article";
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
  }
  return dedupeArticles(summaries);
}

function dedupeArticles(articles: ArticleSummary[]): ArticleSummary[] {
  const byUrl = new Map<string, ArticleSummary>();
  for (const article of articles) byUrl.set(article.url, article);
  return [...byUrl.values()];
}

export function extractCollectionFromHtml(html: string, pageUrl: string): CollectionExtraction {
  const warnings: CrawlerWarning[] = [];
  const nextData = extractNextDataFromHtml(html);
  const collection = collectionFrom(nextData);

  if (collection) {
    const collectionName = getString(collection, ["name", "title"]) || "Verified Voices (Survey)";
    const articles = collectStructuredArticles(collection);
    if (articles.length > 0) {
      return { sourceUrl: pageUrl, collectionName, articles, warnings, extractionMethod: "__NEXT_DATA__" };
    }
    warnings.push({ message: "Collection metadata was found, but no article summaries were available." });
  } else {
    warnings.push({ message: "Collection metadata was not available in script#__NEXT_DATA__; used DOM link fallback." });
  }

  const fallbackArticles = anchorFallback(html, "Verified Voices (Survey)");
  return {
    sourceUrl: pageUrl,
    collectionName: "Verified Voices (Survey)",
    articles: fallbackArticles,
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

function extractMainHtml(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(html, "text/html");
    return document.querySelector("article")?.innerHTML || document.querySelector("main")?.innerHTML || document.body?.innerHTML || html;
  }

  return (
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
    html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ||
    html
  );
}

export function extractArticleFromHtml(html: string, url: string, summary?: ArticleSummary, method = "background-fetch"): ArticleRecord {
  const warnings: CrawlerWarning[] = [];
  const nextData = extractNextDataFromHtml(html);
  const article = articleFrom(nextData);
  const articleMeta = isRecord(article) ? article : undefined;
  const bodyHtml = findHtmlBody(articleMeta) || extractMainHtml(html);
  const markdown = htmlToMarkdown(bodyHtml);
  const text = stripTags(bodyHtml);

  if (!articleMeta) warnings.push({ url, message: "Article metadata was not available in script#__NEXT_DATA__; used visible page fallback." });
  if (!markdown && !text) warnings.push({ url, message: "Article body extraction returned empty content." });

  return {
    id: getString(articleMeta, ["id", "articleId", "article_id"]) || summary?.id || safeSlug(url),
    title: getString(articleMeta, ["title", "name"]) || summary?.title || "Untitled article",
    url,
    summary: getString(articleMeta, ["summary", "description", "subtitle"]) || summary?.summary || "",
    authorName: getString(articleMeta, ["authorName", "author_name"]) || summary?.authorName || "",
    lastUpdated: getString(articleMeta, ["lastUpdated", "last_updated", "updatedAt", "updated_at"]) || summary?.lastUpdated || "",
    lastUpdatedDate: getString(articleMeta, ["lastUpdatedDate", "last_updated_date", "updatedAtDate", "updated_at_date"]) || summary?.lastUpdatedDate || "",
    collectionName: summary?.collectionName || "Verified Voices (Survey)",
    subcollectionName: summary?.subcollectionName || "",
    markdown,
    text,
    crawledAt: new Date().toISOString(),
    extractionMethod: articleMeta ? method : `${method}:visible-fallback`,
    warnings
  };
}

export function isAuthorizedHtml(html: string): boolean {
  const text = stripTags(html).toLowerCase();
  return !/not authorized|sign in|log in|login|access denied|permission/.test(text);
}
