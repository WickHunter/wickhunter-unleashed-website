# Wick Hunter Unleashed — marketing & checkout website

Static marketing site for Wick Hunter Unleashed, the self-hosted crypto
trading bot sold by Wick Hunter Software LLC. No build step — every page is
plain HTML, and `assets/site.css` / `assets/site.js` carry the shared theme
and behavior (mobile menu, FAQ accordion, exchange filter).

The visual theme (colors, radii, cards, buttons, pills, chips) is copied
verbatim from the Unleashed app itself, so the marketing site and the product
look like one thing.

## Deploy on Netlify

1. Connect this repository in Netlify.
2. Publish directory: `.`
3. Build command: none (`netlify.toml` already sets `publish = "."`).
4. Point the custom domain (`wickhunterunleashed.com`) at the Netlify site.

`_redirects` sends `/buy` and `/billing` to the Hub (the source of truth for
checkout and billing-portal links); `_headers` sets security headers and
long-lived caching for `/assets/*`.

## Two things to edit before/at launch

1. **The price.** There are three plans — Monthly, Yearly, Lifetime — each
   its own card in the `#pricing` block in `index.html`. Prices are fixed
   text baked directly into that markup — no body attribute, no JS fill.
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
2. **The Hub redirect targets**, if the Hub ever moves off the bare IP
   `45.76.105.174` onto its own domain — update the two lines in
   `_redirects`.

## Legal pages are drafts

`terms/`, `privacy/`, and `refunds/` each start with an HTML comment —
`<!-- DRAFT: have this reviewed before launch -->` — and end with a visible
draft notice. Have them reviewed by counsel before accepting real payments.
`terms/index.html` also has a governing-law placeholder (`State of [STATE],
USA`) that needs a real jurisdiction filled in.

## Structure

```
index.html          Home page (marketing + pricing plans + install flow)
thanks/index.html   Stripe checkout success redirect target (noindex)
terms/index.html    Terms of Service (draft)
privacy/index.html  Privacy Policy (draft)
refunds/index.html  Refund policy (draft)
404.html            Static 404 fallback
assets/             Brand SVGs/PNGs + shared site.css / site.js
_headers            Security headers + caching
_redirects          /buy and /billing → the Hub
netlify.toml        publish = "."
robots.txt          Crawling rules
sitemap.xml         /, /terms/, /privacy/, /refunds/
```
