import JSZip from "jszip";
import type { ArticleIndex, CrawlerWarning, IndexMetadata } from "./types";
import { safeSlug } from "./crawler";

export async function createIndexZip(index: ArticleIndex): Promise<string> {
  const zip = new JSZip();
  zip.file("articles-index.json", JSON.stringify(index, null, 2));
  zip.file("metadata.json", JSON.stringify(index.metadata, null, 2));
  for (const article of index.articles) {
    zip.file(`articles/${safeSlug(article.id || article.title)}.json`, JSON.stringify(article, null, 2));
  }
  if (index.warnings.length > 0) {
    zip.file("warnings.json", JSON.stringify(index.warnings, null, 2));
  }
  return zip.generateAsync({ type: "base64", compression: "DEFLATE" });
}

export function createMetadata(sourceUrl: string, collectionName: string, articleCount: number): IndexMetadata {
  return {
    appName: "Help Center Crawler",
    sourceUrl,
    collectionName,
    articleCount,
    indexedAt: new Date().toISOString(),
    generatedBy: "Help Center Crawler Chrome Extension",
    version: "0.1.0"
  };
}

export function mergeWarnings(...groups: CrawlerWarning[][]): CrawlerWarning[] {
  return groups.flat().filter((warning) => warning.message.trim());
}
