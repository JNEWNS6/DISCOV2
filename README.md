# Disco – AI Promo Finder

Disco is a Chrome extension that watches checkout pages for promo code boxes, collects potential coupon codes, and tries them for you. It blends adapters for 100+ UK retailers with AI ranking so the highest-probability codes are attempted first.

## Install the extension (developer build)

1. Clone or download this repository.
2. In Chrome, open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the project folder.
4. Pin the Disco icon so it is easy to reach from the toolbar.

> _The packaged build only uses the permissions listed in `manifest.json` (storage, activeTab, scripting)._

## How Disco behaves on checkout pages

Disco automatically injects its helper UI whenever a supported checkout flow is detected:

1. When a page URL or hash contains checkout keywords (e.g., `checkout`, `payment`, `basket`), the content script checks retailer-specific selectors to confirm a coupon input is present. 【F:content.js†L55-L109】【F:content.js†L316-L338】
2. As soon as a field is found, Disco shows a floating pill in the bottom-right corner. The badge count reflects how many codes it has assembled from your saved list, on-page scraping, and backend suggestions. 【F:content.js†L185-L220】【F:content.js†L244-L290】
3. Click the pill to open the full modal. You can:
   - Press **Apply best** to let Disco try codes in ranked order until one works.
   - Select specific chips and press **Apply selected** to run only those choices.
   - Watch the status line for outcomes and see your lifetime savings total update in real time. 【F:content.js†L206-L305】
4. Every successful application triggers storage of the amount saved so the lifetime tally persists between sessions and appears in both the modal and popup. 【F:content.js†L6-L52】【F:popup.js†L1-L31】

Because the script self-starts when the page matches checkout heuristics, you do **not** need to press the toolbar icon for Disco to begin working. If you land on a checkout where the pill does not appear, refresh the page; the MutationObserver re-runs the scan whenever the DOM changes. 【F:content.js†L330-L337】

## Using the toolbar popup

Clicking the Disco icon opens `popup.html`, which lets you tailor the experience without leaving Chrome:

- Review your lifetime **Total saved with Disco** tally.
- Override the backend URL or supply an API key if you are testing against a staging environment.
- Store personal coupon codes; they sync locally and will be merged with scraped/AI suggestions next time you open the modal. 【F:popup.html†L1-L68】【F:popup.js†L1-L52】

The popup is optional for day-to-day use, but it is the easiest place to manage settings and custom codes.

## Tips for best results

- Keep the Disco pill visible while testing codes; closing it stops new attempts until you reopen the widget.
- If you manually type a code that works, add it via the popup so Disco remembers it for future visits to that retailer.
- You can clear stored settings and codes from the popup at any time; doing so resets to the baked-in backend and clears personal coupons.

## Privacy

Disco looks only for coupon elements on pages where you explicitly allow it to run and stores savings totals/codes using Chrome's local extension storage. No browsing data is uploaded beyond the anonymized events sent to the backend endpoint specified in the settings. 【F:content.js†L257-L288】【F:ai.js†L1-L231】

