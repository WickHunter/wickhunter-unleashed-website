# Wick Hunter Unleashed — marketing & checkout website

Static marketing site for Wick Hunter Unleashed, the self-hosted crypto
trading bot sold by Wick Hunter Software LLC. No build step — every page is
plain HTML, and `assets/site.css` / `assets/site.js` carry the shared theme
and behavior (mobile menu, FAQ accordion, exchange filter, price fill).

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

1. **The price.** It lives in exactly one place: the `data-price` attribute
   on `<body>` in `index.html` (currently empty — see "Left as placeholders"
   below). Set it to the monthly price as plain text, e.g. `data-price="49"`.
   A small inline script (`assets/site.js`) copies that value into every
   element with class `.price`. Leave it empty and the pricing card falls
   back to "Pricing shown at checkout" instead of showing a wrong or stale
   number.
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
index.html          Home page (marketing + pricing card + install flow)
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
