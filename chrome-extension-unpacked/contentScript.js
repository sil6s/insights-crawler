(()=>{let e=globalThis;if(e.__numeratorHelpCenterCrawlerContentScriptLoaded)return;e.__numeratorHelpCenterCrawlerContentScriptLoaded=!0;function t(e){return typeof e==`object`&&!!e&&!Array.isArray(e)}function n(e,t){if(!e)return``;for(let n of t){let t=e[n];if(typeof t==`string`&&t.trim())return t.trim();if(typeof t==`number`)return String(t)}return``}function r(e,t){if(!e)return[];for(let n of t){let t=e[n];if(Array.isArray(t))return t}return[]}function i(e){if(!e)return``;let t=new URL(e,`https://help.numerator.com`);return t.hostname===`help.numerator.com`&&(t.protocol=`https:`),t.toString()}function a(e){return e.toLowerCase().replace(/https?:\/\//g,``).replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``).slice(0,90)||`article`}function o(e){let t=document.createElement(`template`);return t.innerHTML=e,t.content.querySelectorAll(`script, style, noscript`).forEach(e=>e.remove()),(t.content.textContent||``).replace(/\s+/g,` `).trim()}function s(e){let t=document.createElement(`template`);t.innerHTML=e,t.content.querySelectorAll(`script, style, noscript`).forEach(e=>e.remove()),t.content.querySelectorAll(`h1, h2, h3, p, li, br`).forEach(e=>{e.tagName===`BR`&&e.replaceWith(`
`)});let n=[],r=e=>{if(e.nodeType===Node.TEXT_NODE){let t=e.textContent?.replace(/\s+/g,` `).trim();t&&n.push(t);return}if(!(e instanceof HTMLElement)){e.childNodes.forEach(r);return}let t=e.tagName.toLowerCase(),a=e.textContent?.replace(/\s+/g,` `).trim()||``;if(a)if(t===`h1`)n.push(`# ${a}`);else if(t===`h2`)n.push(`## ${a}`);else if(t===`h3`)n.push(`### ${a}`);else if(t===`li`)n.push(`- ${a}`);else if(t===`a`){let t=e.getAttribute(`href`);n.push(t?`[${a}](${i(t)})`:a)}else [`p`,`div`,`section`,`article`].includes(t)?(e.childNodes.forEach(r),n.push(``)):e.childNodes.forEach(r)};return t.content.childNodes.forEach(r),n.map(e=>e.trim()).filter(Boolean).join(`
`).replace(/\n{3,}/g,`

`).trim()}function c(){let e=document.querySelector(`script#__NEXT_DATA__`)?.textContent;if(!e)return null;try{let n=JSON.parse(e);return t(n)?n:null}catch{return null}}function l(e){let n=t(e?.props)?e.props:void 0;return t(n?.pageProps)?n.pageProps:void 0}function u(e){let n=l(e);return t(n?.collection)?n.collection:void 0}function d(e){let n=l(e);if(t(n?.article))return n.article;if(t(n?.articleContent))return n.articleContent}function f(e,r,o=``){let s=n(e,[`title`,`name`]),c=i(n(e,[`url`,`href`,`articleUrl`,`article_url`])),l=n(e,[`id`,`articleId`,`article_id`])||a(c||s),u=t(e.author)?e.author:void 0;return!s||!c?null:{id:l,title:s,url:c,summary:n(e,[`summary`,`description`,`subtitle`]),authorName:n(e,[`authorName`,`author_name`])||n(u,[`name`,`fullName`,`full_name`]),lastUpdated:n(e,[`lastUpdated`,`last_updated`,`updatedAt`,`updated_at`]),lastUpdatedDate:n(e,[`lastUpdatedDate`,`last_updated_date`,`updatedAtDate`,`updated_at_date`]),collectionName:r,subcollectionName:o}}function p(e){let t=new Map;for(let n of e)t.set(n.url,n);return[...t.values()]}function m(e){let i=n(e,[`name`,`title`])||`Verified Voices (Survey)`,a=[];for(let n of r(e,[`articleSummaries`,`article_summaries`,`articles`]))if(t(n)){let e=f(n,i);e&&a.push(e)}for(let o of r(e,[`subcollections`,`sections`])){if(!t(o))continue;let e=n(o,[`name`,`title`]);for(let n of r(o,[`articleSummaries`,`article_summaries`,`articles`]))if(t(n)){let t=f(n,i,e);t&&a.push(t)}}return p(a)}function h(e){let t=[];return document.querySelectorAll(`a[data-testid="article-link"], a[href*="/en/articles/"]`).forEach(n=>{let r=n.getAttribute(`href`)||``;if(!r.includes(`/en/articles/`))return;let o=i(r),s=n.textContent?.replace(/\s+/g,` `).trim()||o.split(`/`).pop()?.replace(/-/g,` `)||`Untitled article`;t.push({id:a(o),title:s,url:o,summary:``,authorName:``,lastUpdated:``,lastUpdatedDate:``,collectionName:e,subcollectionName:``})}),p(t)}function g(){let e=[],t=u(c());if(t){let r=n(t,[`name`,`title`])||`Verified Voices (Survey)`,i=m(t);if(i.length>0)return{sourceUrl:window.location.href,collectionName:r,articles:i,warnings:e,extractionMethod:`__NEXT_DATA__`};e.push({message:`Collection metadata was found, but no article summaries were available.`})}else e.push({message:`Collection metadata was not available in script#__NEXT_DATA__; used DOM link fallback.`});return{sourceUrl:window.location.href,collectionName:`Verified Voices (Survey)`,articles:h(`Verified Voices (Survey)`),warnings:e,extractionMethod:`dom-link-fallback`}}function _(e,n=0){if(n>8)return``;if(typeof e==`string`)return/<\/?[a-z][\s\S]*>/i.test(e)&&e.length>60?e:``;if(Array.isArray(e)){for(let t of e){let e=_(t,n+1);if(e)return e}return``}if(!t(e))return``;for(let t of[`body`,`bodyHtml`,`body_html`,`content`,`contentHtml`,`content_html`,`html`,`description`]){let r=_(e[t],n+1);if(r)return r}for(let t of Object.values(e)){let e=_(t,n+1);if(e)return e}return``}function v(){return document.querySelector(`article`)?.innerHTML||document.querySelector(`main`)?.innerHTML||document.body?.innerHTML||``}function y(e){let t=window.location.href,r=[],i=d(c()),l=_(i)||v(),u=s(l),f=o(l);return i||r.push({url:t,message:`Article metadata was not available in script#__NEXT_DATA__; used visible page fallback.`}),!u&&!f&&r.push({url:t,message:`Article body extraction returned empty content.`}),{id:n(i,[`id`,`articleId`,`article_id`])||e?.id||a(t),title:n(i,[`title`,`name`])||e?.title||document.title||`Untitled article`,url:t,summary:n(i,[`summary`,`description`,`subtitle`])||e?.summary||``,authorName:n(i,[`authorName`,`author_name`])||e?.authorName||``,lastUpdated:n(i,[`lastUpdated`,`last_updated`,`updatedAt`,`updated_at`])||e?.lastUpdated||``,lastUpdatedDate:n(i,[`lastUpdatedDate`,`last_updated_date`,`updatedAtDate`,`updated_at_date`])||e?.lastUpdatedDate||``,collectionName:e?.collectionName||`Verified Voices (Survey)`,subcollectionName:e?.subcollectionName||``,markdown:u,text:f,crawledAt:new Date().toISOString(),extractionMethod:i?`tab-content-script`:`tab-content-script:visible-fallback`,warnings:r}}function b(e,t=``){let n=document.getElementById(`help-center-crawler-overlay`);if(!n){n=document.createElement(`div`),n.id=`help-center-crawler-overlay`,n.setAttribute(`role`,`status`),n.innerHTML=`
        <div class="nhcc-card">
          <div class="nhcc-spinner"></div>
          <div>
            <strong class="nhcc-title"></strong>
            <span class="nhcc-detail"></span>
          </div>
        </div>
      `;let e=document.createElement(`style`);e.id=`help-center-crawler-overlay-style`,e.textContent=`
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
      `,document.documentElement.append(e),document.documentElement.append(n)}n.querySelector(`.nhcc-title`).textContent=e,n.querySelector(`.nhcc-detail`).textContent=t}function x(){document.getElementById(`help-center-crawler-overlay`)?.remove()}chrome.runtime.onMessage.addListener((e,t,n)=>{if(e?.type===`SHOW_CRAWLER_OVERLAY`)return b(String(e.title||`Crawler running`),String(e.detail||``)),n({ok:!0}),!0;if(e?.type===`HIDE_CRAWLER_OVERLAY`)return x(),n({ok:!0}),!0;if(e?.type===`EXTRACT_COLLECTION`){try{n({ok:!0,extraction:g()})}catch(e){n({ok:!1,error:e instanceof Error?e.message:`Collection extraction failed.`})}return!0}if(e?.type===`EXTRACT_ARTICLE`){try{n({ok:!0,article:y(e.summary)})}catch(e){n({ok:!1,error:e instanceof Error?e.message:`Article extraction failed.`})}return!0}return!1})})();