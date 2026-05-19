# Help Center Crawler

Chrome extension MVP for exporting authorized Help Center collections into ZIP indexes.

The extension runs in the user's Chrome session. It does not collect credentials, does not ask for pasted cookies, does not store browser session data, and does not send exported help content to a backend.

## Summary

This project is a **Chrome Extension (Manifest V3)** that crawls Help Center pages you already have access to in your signed-in Chrome session and exports a local ZIP index.

## Technical Breakdown

### Architecture
- **Popup UI (`popup.html` + `popup.js`)**: Lets you choose crawl scope and start the crawl.
- **Background Service Worker (`background.js`)**: Orchestrates crawl jobs, tab/fetch behavior, and ZIP generation.
- **Content Script (`contentScript.js`)**: Reads page DOM data from matching Help Center pages when needed.
- **Manifest (`manifest.json`)**: Declares permissions, hosts, background worker, and content script wiring.

### Crawl Flow
1. User opens popup and chooses target scope.
2. Background worker discovers collection/article URLs.
3. Worker fetches article content with authenticated browser context (`credentials: include`).
4. Parser prefers structured Next.js data (`script#__NEXT_DATA__`), with DOM fallback extraction.
5. Aggregated article records are serialized and downloaded as one ZIP file.

### Output Format
- `articles-index.json`
- `metadata.json`
- `articles/*.json`
- `warnings.json` (only when warnings exist)

## What It Does

Help Center Crawler creates a downloadable ZIP index from Help Center articles that the signed-in user can already access in Chrome. The ZIP includes article metadata, source links, extracted article text, markdown, and warnings for anything that could not be indexed.

## How It Works

1. The user signs into the authorized Help Center source in Chrome.
2. The user chooses `Entire Help Center` or one Help Center section in the extension popup.
3. The extension uses the current Chrome browser session to read collection and article pages.
4. It prefers structured `script#__NEXT_DATA__` page data and falls back to visible page content when needed.
5. It packages the completed index into one local ZIP download.

## Why This Approach Is Useful

- No API service is required.
- No external crawler or hosted backend needs access to protected content.
- No database or persistent article storage is used by the app.
- No cookies, credentials, or browser session data are exported.
- Content stays local until the user chooses what to do with the downloaded ZIP.

## Quick Load Folder (No Build Required)

If you download this repository as a ZIP and want a folder that is already ready for **Load unpacked**, use:

```text
chrome-extension-unpacked
```

That folder includes `manifest.json`, `background.js`, `contentScript.js`, `popup.html`, and compiled assets in the correct Chrome extension layout.

Note: the unpacked folder intentionally excludes icon PNG binaries to keep repository diffs text-only; Chrome can still load and run the extension normally.

## Build

```bash
npm install
npm run extension:build
```

The extension build is written to `extension/dist`.

## Install And Use In Chrome

1. Build the extension from this project folder:

```bash
npm install
npm run extension:build
```

2. Open Chrome.
3. Go to:

```text
chrome://extensions
```

4. Turn on **Developer mode** in the top-right corner.
5. Click **Load unpacked**.
6. Select this folder:

```text
chrome-extension-unpacked
```

Do not select the `extension` source folder. Select `chrome-extension-unpacked` because it already contains the built extension output and `manifest.json`.

7. Confirm **Help Center Crawler** appears in the Chrome extensions list.
8. Pin the extension from the Chrome extensions menu if you want it visible in the toolbar.
9. In the same Chrome window, sign into the authorized Numerator/help source normally.
10. Open:

```text
https://help.numerator.com/en/
```

11. Click the **Help Center Crawler** extension icon.
12. Choose a scope:

- `Entire Help Center`
- Or one specific Help Center section, such as `Verified Voices (Survey)`

13. Click **Start Crawler**.
14. The current tab will move to the selected Help Center page and show crawler progress on-screen.
15. Wait for the crawl to finish.
16. Chrome will download one ZIP file:

```text
help-center-index-YYYY-MM-DD.zip
```

If Chrome says the manifest is missing, the wrong folder was selected. Load unpacked must point at `chrome-extension-unpacked`, because that folder contains `manifest.json`, `background.js`, `contentScript.js`, and `popup.html`.

## Crawler Modes

Scope can be set in the popup. Supported targets:

- Verified Voices (Survey)
- What's New
- Getting Started
- Education & Trainings
- Definitions and Methodology
- My Workspace
- Reports: People Module
- Reports: Shopper Module
- Reports: Brand Module
- Reports: New Item Module
- Reports: Retailer Module
- Reports: Promo Module
- Reports: Portfolio Module
- Reports: Tools Module
- AskWhy
- Canada Resources
- Retailer Reporting Resources
- Reports: TruView
- Narratives

The default mode is fast mode:

- Fetches article pages in the background with `credentials: "include"`.
- Crawls several articles at once.
- Does not open article tabs.
- Downloads one ZIP only after the full index is complete.
- Adds failed article fetches to `warnings.json`.

If background fetch cannot read an article, the crawler automatically falls back to one inactive tab at a time, extracts the article, closes the tab, and continues.

## ZIP Contents

- `articles-index.json`
- `metadata.json`
- `articles/{article-id-or-slug}.json`
- `warnings.json` when extraction warnings exist

## How It Works

1. You sign into the authorized Numerator/help source in Chrome.
2. You select a Help Center collection in the extension.
3. The extension reads the collection page you already have access to.
4. It prefers `script#__NEXT_DATA__` metadata and falls back to visible article links when needed.
5. It indexes each detected article with background fetch first.
6. It packages the index into a ZIP and downloads it locally once.

## Privacy

- No cookies are saved or exported.
- No credentials are requested or stored.
- Article content is not sent to an external API.
- The extension only indexes pages the user is already authorized to access in Chrome.
- Exported ZIP files are ignored by git.

## Scope

This is extension-only. There is no Express backend, no Vercel crawler, no database, and no embedded search app in this MVP.
