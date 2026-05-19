export type CrawlerWarning = {
  url?: string;
  title?: string;
  message: string;
};

export type ArticleRecord = {
  id: string;
  title: string;
  url: string;
  summary: string;
  authorName: string;
  lastUpdated: string;
  lastUpdatedDate: string;
  collectionName: string;
  subcollectionName: string;
  markdown: string;
  text: string;
  crawledAt: string;
  extractionMethod: string;
  warnings: CrawlerWarning[];
};

export type IndexMetadata = {
  appName: "Help Center Crawler";
  sourceUrl: string;
  collectionName: string;
  articleCount: number;
  indexedAt: string;
  generatedBy: "Help Center Crawler Chrome Extension";
  version: string;
};

export type ArticleIndex = {
  metadata: IndexMetadata;
  articles: ArticleRecord[];
  warnings: CrawlerWarning[];
};

export type ArticleSummary = {
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

export type CollectionExtraction = {
  sourceUrl: string;
  collectionName: string;
  articles: ArticleSummary[];
  warnings: CrawlerWarning[];
  extractionMethod: string;
};

export type LatestExportMetadata = {
  articleCount: number;
  indexedAt: string;
  sourceUrl: string;
  collectionName: string;
};

export type CrawlerSettings = {
  targetUrl: string;
};

export type CollectionTarget = {
  name: string;
  url: string;
  articleCount: number;
};

export type ProgressMessage = {
  type: "INDEX_PROGRESS";
  status:
    | "Preparing crawler..."
    | "Finding articles..."
    | `Reading collection ${number} of ${number}...`
    | `Indexing ${number} of ${number}...`
    | `Opening fallback tab ${number} of ${number}...`
    | "Packaging ZIP..."
    | "Index complete";
  articleCount?: number;
  completedCount?: number;
  indexedAt?: string;
  collectionName?: string;
  message?: string;
};

export type PopupStatusResponse = {
  isVerifiedVoicesCollection: boolean;
  activeUrl: string;
  articleCount: number;
  collectionName: string;
  latestExport?: LatestExportMetadata;
  settings: CrawlerSettings;
  error?: string;
};
