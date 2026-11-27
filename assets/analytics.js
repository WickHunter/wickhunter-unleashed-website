// Plausible custom events. The Plausible snippet itself is injected into every
// page's <head> by scripts/build-site.mjs; this file only reports clicks.
//   "Checkout Start": any link to /buy (any plan) or to the checkout.
//   "Discord Join":   any discord.gg link.
//   "Trial Start":    any link to the Hub trial page (/trial).
(function () {
  function send(name, props) {
    if (typeof window.plausible !== 'function') return;
    if (props) window.plausible(name, { props: props }); else window.plausible(name);
  }
  function planFor(link, url) {
    var plan = url.searchParams.get('plan');
    if (!plan) { var card = link.closest('[data-plan]'); plan = card && card.getAttribute('data-plan'); }
    return plan || null;
  }
  function isCheckout(url) {
    var path = url.pathname.replace(/\/+$/, '') || '/';
    var ours = url.origin === window.location.origin || /(^|\.)wickhunterunleashed\.com$/.test(url.hostname);
    if (ours && (path === '/buy' || path === '/api/billing/checkout')) return true;
    return url.hostname === 'checkout.stripe.com';
  }
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link || link.getAttribute('aria-disabled') === 'true') return;
    var url;
    try { url = new URL(link.getAttribute('href'), window.location.href); } catch (_) { return; }
    if (url.hostname === 'discord.gg' || url.hostname === 'www.discord.gg') { send('Discord Join'); return; }
    if (/(^|\.)wickhunterunleashed\.com$/.test(url.hostname) && (url.pathname.replace(/\/+$/, '') === '/trial')) { send('Trial Start'); return; }
    if (isCheckout(url)) {
      var plan = planFor(link, url);
      send('Checkout Start', plan ? { plan: plan } : null);
    }
  }, true);
})();
