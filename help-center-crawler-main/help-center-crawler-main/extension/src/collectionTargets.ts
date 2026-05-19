import type { CollectionTarget } from "./types";

export const HELP_CENTER_HOME_URL = "https://help.numerator.com/en/";
export const ALL_HELP_CENTER_TARGET = "__all_help_center__";
export const VERIFIED_VOICES_COLLECTION_URL = "https://help.numerator.com/en/collections/3625626-verified-voices-survey";

export const HELP_CENTER_COLLECTION_TARGETS: CollectionTarget[] = [
  {
    name: "Verified Voices (Survey)",
    url: VERIFIED_VOICES_COLLECTION_URL,
    articleCount: 34
  },
  {
    name: "What's New",
    url: "https://help.numerator.com/en/collections/3625469-what-s-new",
    articleCount: 5
  },
  {
    name: "Getting Started",
    url: "https://help.numerator.com/en/collections/3625475-getting-started",
    articleCount: 20
  },
  {
    name: "Education & Trainings",
    url: "https://help.numerator.com/en/collections/4367175-education-trainings",
    articleCount: 5
  },
  {
    name: "Definitions and Methodology",
    url: "https://help.numerator.com/en/collections/3625512-definitions-and-methodology",
    articleCount: 47
  },
  {
    name: "My Workspace",
    url: "https://help.numerator.com/en/collections/3625599-my-workspace",
    articleCount: 19
  },
  {
    name: "Reports: People Module",
    url: "https://help.numerator.com/en/collections/3625547-reports-people-module",
    articleCount: 6
  },
  {
    name: "Reports: Shopper Module",
    url: "https://help.numerator.com/en/collections/3625556-reports-shopper-module",
    articleCount: 10
  },
  {
    name: "Reports: Brand Module",
    url: "https://help.numerator.com/en/collections/3625573-reports-brand-module",
    articleCount: 13
  },
  {
    name: "Reports: New Item Module",
    url: "https://help.numerator.com/en/collections/3625579-reports-new-item-module",
    articleCount: 2
  },
  {
    name: "Reports: Retailer Module",
    url: "https://help.numerator.com/en/collections/3625582-reports-retailer-module",
    articleCount: 1
  },
  {
    name: "Reports: Promo Module",
    url: "https://help.numerator.com/en/collections/3625588-reports-promo-module",
    articleCount: 11
  },
  {
    name: "Reports: Portfolio Module",
    url: "https://help.numerator.com/en/collections/3625594-reports-portfolio-module",
    articleCount: 11
  },
  {
    name: "Reports: Tools Module",
    url: "https://help.numerator.com/en/collections/3625595-reports-tools-module",
    articleCount: 4
  },
  {
    name: "AskWhy",
    url: "https://help.numerator.com/en/collections/4247455-askwhy",
    articleCount: 2
  },
  {
    name: "Canada Resources",
    url: "https://help.numerator.com/en/collections/3004763-canada-resources",
    articleCount: 10
  },
  {
    name: "Retailer Reporting Resources",
    url: "https://help.numerator.com/en/collections/162664-retailer-reporting-resources",
    articleCount: 5
  },
  {
    name: "Reports: TruView",
    url: "https://help.numerator.com/en/collections/6399059-reports-truview",
    articleCount: 1
  },
  {
    name: "Narratives",
    url: "https://help.numerator.com/en/collections/15743024-narratives",
    articleCount: 7
  }
];

export const ALL_HELP_CENTER_ARTICLE_COUNT = HELP_CENTER_COLLECTION_TARGETS.reduce((sum, target) => sum + target.articleCount, 0);

export function getCollectionTarget(url: string): CollectionTarget | undefined {
  return HELP_CENTER_COLLECTION_TARGETS.find((target) => target.url === url);
}
