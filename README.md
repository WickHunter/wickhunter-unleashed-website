# Wick Hunter Software — marketing & checkout website

Static marketing site for Wick Hunter Software LLC. No build step — every
page is plain HTML, and `assets/site.css` / `assets/site.js` carry the shared
theme and behavior (mobile menu, FAQ accordion, exchange filter, Hub price
feed).

The visual theme (colors, radii, cards, buttons, pills, chips) is copied
verbatim from the Unleashed app itself, so the marketing site and the product
look like one thing.

## Three pages

- **`/` (`index.html`)** is the catalogue: every product and service the
  company sells, one card each (`#products`, which also serves as the
  `#services` anchor), the non-custodial money-flow explainer, and contact.
  Every "Buy Unleashed" control on this page — header, hero, product card —
  links to `/unleashed/#pricing`, never straight to checkout.
- **`/unleashed/` (`unleashed/index.html`)** is the flagship product's own
  page: the dashboard mockup, feature tiles, the five bot modules
  (`#bots`), the five exchanges (`#exchanges`), the install guide
  (`#install`), the three pricing plans (`#pricing`), a banner pointing at
  Hosting, and the Unleashed FAQ (`#faq`). Only the three plan cards inside
  `#pricing` link to Stripe checkout (`/buy?plan=...`) — every other Buy
  control on the site is a link into this page's pricing anchor, not a
  checkout link.
- **`/unleashed/hosting/` (`unleashed/hosting/index.html`)** is the
  Unleashed VPS Hosting add-on page: what it is, scope (`#scope`), region
  and key-security facts (`#access`), the single hosting price (`#pricing`),
  buy-now-or-later (`#order`), the non-payment timeline (`#billing`), and a
  hosting-specific FAQ (`#faq`). Every "Sign in to add hosting" / "Add
  hosting" control links to `/account`, never straight to Stripe — hosting
  checkout happens inside the Hub's authenticated customer session, not on
  this static site.

## Deploy on Netlify

1. Connect this repository in Netlify.
2. Publish directory: `.`
3. Build command: none (`netlify.toml` already sets `publish = "."`).
4. Point the custom domain (`wickhunterunleashed.com`) at the Netlify site.

`_redirects` sends `/buy` and `/billing` to the Hub (the source of truth for
checkout and billing-portal links) and `/account` to the Hub's authenticated
customer sign-in page (`/customer` — email magic link; billing, hosting, and
licence status all live there); `_headers` sets security headers and
long-lived caching for `/assets/*`.

## Things to edit before/at launch

1. **The software price.** There are three plans — Monthly, Yearly,
   Lifetime — each its own card in the `#pricing` block in
   `unleashed/index.html`. Prices are fixed text baked directly into that
   markup — no body attribute, no JS fill (a `data-hub` fetch on page load
   overwrites the number with the Hub's live price if it's reachable; the
   baked-in text is the fallback). Changing a price is a one-line edit to
   the `.price` span in the relevant card, plus the matching change in
   Stripe/the Hub (the price or product the plan's Buy link resolves to) —
   otherwise the site and checkout will disagree. The three Buy links are:
   - Monthly → `/buy?plan=monthly`
   - Yearly → `/buy?plan=yearly`
   - Lifetime → `/buy?plan=lifetime`

   `_redirects` sends `/buy` to the Hub and passes the `?plan=` query
   through untouched, so the Hub is what maps `plan=` to the right Stripe
   price.
2. **The hosting price — unconfirmed, unlike the software prices above.**
   Unlike the three software plans, the hosting price is **one JS constant**
   (`HOSTING_PRICE_CENTS` at the top of `assets/site.js`), not text baked
   into each page — every `[data-hosting-price]` element (home page card,
   `/unleashed/hosting/` pricing card) fills from that one number, so
   there's exactly one place to change it. It's currently **$15/month,
   proposed but not confirmed** by the operator — change
   `HOSTING_PRICE_CENTS`, set `HOSTING_PRICE_FINAL = true` in the
   same file once the number is confirmed (this hides every "introductory
   price" note automatically — see `[data-hosting-price-provisional]`
   elements), and make the matching change to the hosting Stripe
   price/product on the Hub.
3. **The Hub redirect targets**, if the Hub ever moves off the bare IP
   `45.76.105.174` onto its own domain — update the three lines in
   `_redirects` (`/buy`, `/billing`, `/account`).
4. **Hosting go-live.** `/unleashed/hosting/` and every "Sign in to add
   hosting" link on the site assume the Hub's `/customer` sign-in and
   hosting checkout are live. If the Hub hasn't shipped that yet, either
   hold this branch until it has, or ask before publishing — nothing here
   gates the page on the Hub actually answering.

## Legal pages are drafts

`terms/`, `privacy/`, and `refunds/` each start with an HTML comment —
`<!-- DRAFT: have this reviewed before launch -->` — and end with a visible
draft notice. Have them reviewed by counsel before accepting real payments.
`terms/index.html` also has a governing-law placeholder (`State of [STATE],
USA`) that needs a real jurisdiction filled in. **Not updated for hosting**:
`terms/index.html` §2 still says "We do not host your instance" — true of
the self-hosted software, no longer true once a customer is on Unleashed VPS
Hosting. Needs a sentence distinguishing the two before hosting goes live;
left to the operator along with the rest of the legal-page review.

## Structure

```
index.html                    Home page — the product/service catalogue
unleashed/index.html          Wick Hunter Unleashed product page (features,
                               bots, exchanges, install guide, pricing, FAQ)
unleashed/hosting/index.html  Unleashed VPS Hosting add-on page (scope,
                               region/security, price, non-payment timeline,
                               FAQ)
thanks/index.html             Stripe checkout success redirect target (noindex)
terms/index.html              Terms of Service (draft)
privacy/index.html            Privacy Policy (draft)
refunds/index.html            Refund policy (draft)
404.html                      Static 404 fallback
assets/                       Brand SVGs/PNGs + shared site.css / site.js
_headers                      Security headers + caching
_redirects                    /buy, /billing, /account → the Hub
netlify.toml                  publish = "."
robots.txt                    Crawling rules
sitemap.xml                   /, /unleashed/, /unleashed/hosting/, /terms/,
                               /privacy/, /refunds/
```
