# Wick Hunter Software — marketing & checkout website

Static marketing site for Wick Hunter Software LLC. Every page is plain HTML, and `assets/site.css` / `assets/site.js` carry the shared
theme and behavior (mobile menu, FAQ accordion, exchange filter, Hub price
feed).

The visual theme (colors, radii, cards, buttons, pills, chips) is copied
verbatim from the Unleashed app itself, so the marketing site and the product
look like one thing.

## Sales pages

- `/` uses the product-first redesign: real product screenshots, workflow and bot explainers, setup steps, hosting comparison, API-driven pricing, learning/support links, FAQ and customer dashboard access.
- `/customer` redirects to the Hub's signed-in customer dashboard for licence details, a reveal/copy license-key action, billing and hosted-instance access. License keys never appear in public website files.
- `/unleashed/` retains the detailed bot, exchange and installation information. Demo trading is not offered in the current release (owner decision 2026-10-24) for the weekend release.
- Retired October 15 promotions and signup incentives are removed from public HTML.
- `assets/redesign.css` / `assets/redesign.js` handle the homepage presentation. `assets/site.js` preserves the deployed billing, referral, hosting-availability and same-origin support integration. Product screenshots use illustrative data and make no performance claims.

## Documentation (/docs/)

`docs/` holds the customer user guide: one page per topic, with a GitBook-style sidebar, the tutorial video for each page, and `assets/docs.css` / `assets/docs.js`. The pages are **generated** from the app repository's `docs/user-guide/*.md` by `node scripts/build-user-guide.mjs --site=<this checkout>`, the same source that renders the in-app User guide; the run also refreshes the `/docs/` entries in `sitemap.xml`. Edit the Markdown there and regenerate rather than editing these HTML files. Prices are never written into the docs; they link to the plans section here.

## Deploy on Netlify

1. Connect this repository in Netlify.
2. Publish directory: `dist`.
3. Build command: `node scripts/build-site.mjs` (configured in `netlify.toml`). The build copies only public pages and assets; tests and internal repository files are excluded.
4. Point the custom domain (`wickhunterunleashed.com`) at the Netlify site.

`_redirects` sends `/buy`, `/billing`, and `/customer` to the Hub (the source
of truth for checkout, billing, and managed-hosting eligibility); `_headers`
sets security headers and long-lived caching for `/assets/*`.

## Pricing and Hub integration

1. **Software licence prices.** There are three plans — Monthly, Yearly, Lifetime — each
   its own card in the `#pricing` block in `unleashed/index.html`. Prices are
   fixed text baked directly into that markup — no body attribute, no JS
   fill (a `data-hub` fetch on page load overwrites the number with the
   Hub's live price if it's reachable; the baked-in text is the fallback).
   Changing a price is a one-line edit to the `.price` span in the relevant
   card, plus the matching change in Stripe/the Hub (the price or product
   the plan's Buy link resolves to) — otherwise the site and checkout will
   disagree. The three Buy links are:
   - Monthly → `/buy?plan=monthly`
   - Yearly → `/buy?plan=yearly`
   - Lifetime → `/buy?plan=lifetime`

   `_redirects` sends `/buy` to the Hub and passes the `?plan=` query
   through untouched, so the Hub is what maps `plan=` to the right Stripe
   price.
2. **Managed hosting.** Hosting can be bundled with Monthly or Yearly, or added
   separately to Lifetime. The site reads the current plan, regions, backup coverage, price,
   and availability from the Hub's public `/api/hosting/options` response so
   the Hub configuration remains the source of truth. The Hub also owns
   eligibility, one-instance enforcement, checkout, provisioning, and
   customer email. Each licence card has its own availability-gated hosting
   checkbox. Monthly shows one $119 monthly software + hosting renewal; Yearly
   shows one $939 annual renewal ($699 software + $240 hosting); Lifetime keeps
   its $999 one-time software price and leads to a separately confirmed $20
   monthly hosting subscription.

   Hosted choices use the current `/api/billing/checkout` combined contract for all three plans, with durable attempt IDs scoped to plan, payment rail, referral and hosting choice. The request goes directly to the HTTPS Hub over CORS. Both `/api/billing/plans` and `/api/hosting/options` must confirm live combined-hosting availability before the homepage hosting switch is enabled. Software-only card links retain the `/buy?plan=...` server route. Crypto is offered only for eligible software-only Yearly and Lifetime plans. Stripe destinations are restricted to HTTPS `checkout.stripe.com`; ambiguous failures retain the same attempt for retry.

3. **The Hub redirect targets**, if the Hub ever moves off the bare IP
   `45.76.105.174` onto its own domain — update the two lines in
   `_redirects`.

## Focused checkout verification

Run `node --test tests/*.test.mjs` with jsdom installed. The current suites cover both sales pages, software and combined-hosting paths, crypto eligibility, referrals, totals, server-provided availability, unsafe redirects, idempotent retries, timeouts, capacity/expired-session errors, removal of retired campaigns, login links and the support frame. The fixtures model the current deployed combined checkout contract rather than the retired software-first hosting flow.

## Customer policies

`terms/`, `privacy/`, and `refunds/` contain the September 30, 2026 policies for Wick Hunter Software, LLC, a Delaware LLC. They include the business address, October 15 software launch offer, seven-day first-payment refund request window, one-time crypto purchases, and automatic technical token renewal for Lifetime access. Keep checkout disclosures and these policies aligned when commercial terms change.

## Structure

```
index.html            Home page — Unleashed and Hedge Bot sales overview
unleashed/index.html  Wick Hunter Unleashed product page (features, bots,
                       exchanges, install guide, pricing, FAQ)
thanks/index.html     Stripe checkout success redirect target (noindex)
terms/index.html      Terms of Service
privacy/index.html    Privacy Policy
refunds/index.html    Refund policy
404.html              Static 404 fallback
assets/               Brand SVGs/PNGs + shared site.css / site.js
tests/                Browser-level checkout behavior verification
_headers              Security headers + caching
_redirects            /buy, /billing, and /customer → the Hub
netlify.toml          public-only build into dist/
robots.txt            Crawling rules
sitemap.xml           /, /unleashed/, /terms/, /privacy/, /refunds/
```

## Support chat

The floating support button and footer links open an on-page chat panel, with
close/Escape controls and a layout that fits mobile screens. The conversation
stays loaded when the panel closes. `/support/*` proxies the Hub on the website
origin so Secure, SameSite session cookies work without third-party cookies.
The Hub still validates the website origin and support-action header. No
credentials are stored in site JavaScript. Existing `/support/` bookmarks open
the full chat. The support button retains readable text in every link state.
