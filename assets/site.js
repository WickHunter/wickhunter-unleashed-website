// Wick Hunter Unleashed — marketing site
// Vanilla JS only: mobile menu, FAQ accordion, exchange filter.
(function () {
  'use strict';

  // Mobile menu
  var menuBtn = document.getElementById('menuBtn');
  var mobileMenu = document.getElementById('mobileMenu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileMenu.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Exchange filter (Execution / Market data / All)
  document.querySelectorAll('[data-exchange-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      document.querySelectorAll('[data-exchange-filter]').forEach(function (item) {
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      var filter = button.dataset.exchangeFilter;
      document.querySelectorAll('[data-exchange-category]').forEach(function (card) {
        card.hidden = filter !== 'all' && card.dataset.exchangeCategory !== filter;
      });
    });
  });

  var hostingCheckboxes = Array.from(document.querySelectorAll('[data-hosting-select]'));
  var hostingMonthlyCents = 0;
  var combinedHostingEnabled = false;
  var launchHostingReady = false;
  // v2 separates new combined-hosting attempts from legacy software-first
  // attempts; older durable ids must never be reused for a changed request.
  var launchAttemptKey = 'wh.launch-checkout-attempt.v2';
  var launchAttemptMemory = {};
  var launchOffer = null;
  var launchPlans = {};
  var cryptoPlans = {};
  var checkoutMode = 'unknown';
  var hostingCheckoutEnabled = false;
  var incomingReferral = new URLSearchParams(window.location.search).get('ref');
  if (!incomingReferral || incomingReferral.length > 128) incomingReferral = null;
  function withReferral(href) {
    return incomingReferral ? href + '&ref=' + encodeURIComponent(incomingReferral) : href;
  }
  function launchActive() {
    return !!(launchOffer && Date.now() < launchOffer.redeemUntilMs);
  }
  function launchFreeCardPeriod() {
    return launchActive() && Date.now() < launchOffer.firstPaymentAtMs;
  }
  function money(cents) {
    return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  }
  function renderPlanCard(card) {
    if (!card) return;
    var plan = card.dataset.plan;
    var checkbox = card.querySelector('[data-hosting-select]');
    if (checkbox && hostingMonthlyCents > 0) checkbox.disabled = !hostingCheckoutEnabled;
    var selected = !!(checkbox && checkbox.checked);
    var baseCents = Number(card.dataset.basePriceCents);
    var price = card.querySelector('[data-plan-price]');
    var caption = card.querySelector('[data-plan-caption]');
    var link = card.querySelector('[data-software-buy]');
    var status = card.querySelector('[data-hosting-card-status]');
    if (!(baseCents >= 0) || !price || !caption || !link) return;
    var softwareCents = baseCents;
    var total = baseCents;
    if (selected && plan === 'monthly') total += hostingMonthlyCents;
    if (selected && plan === 'yearly') total += hostingMonthlyCents * 12;
    price.textContent = money(total);
    var terms = card.querySelector('[data-launch-terms]');
    if (terms) {
      terms.hidden = !launchActive() || !launchPlans[plan];
      if (!terms.hidden) {
        if (plan === 'lifetime') terms.textContent = 'One-time software payment today. Lifetime software access.';
        else terms.textContent = selected
          ? 'VPS plans bill immediately due to VPS provider fees. Software discounts apply only to software.'
          : launchFreeCardPeriod()
          ? 'Card required. $0 today; first ' + (plan === 'monthly' ? 'monthly' : 'yearly') + ' charge on Oct 15, 2026 at 12:00 a.m. ET. Confirm your price at checkout.'
          : 'First ' + (plan === 'monthly' ? 'monthly' : 'yearly') + ' charge today. Confirm your price at checkout.';
      }
    }
    var cryptoLink = card.querySelector('[data-crypto-buy]');
    if (cryptoLink) {
      cryptoLink.hidden = !(cryptoPlans[plan] && !selected);
      if (!cryptoLink.hidden) cryptoLink.textContent = 'Pay $' + money(softwareCents) + ' with crypto';
      var cryptoTerms = card.querySelector('[data-crypto-terms]');
      if (cryptoTerms) {
        cryptoTerms.hidden = cryptoLink.hidden;
        if (!cryptoTerms.hidden) cryptoTerms.textContent = plan === 'yearly'
          ? (Date.now() < (launchOffer && launchOffer.firstPaymentAtMs) && launchActive()
            ? 'Crypto is paid now for access through Oct 15, 2027. No automatic renewal.'
            : 'Crypto is paid now for one year of access. No automatic renewal.')
          : 'Crypto is paid now for Lifetime software access. No automatic renewal.';
      }
    }
    if (plan === 'monthly') caption.textContent = selected ? 'software + VPS · one monthly renewal' : 'software · renews monthly';
    if (plan === 'yearly') caption.textContent = selected ? 'software + VPS · one annual renewal' : 'software · renews annually';
    if (plan === 'lifetime') caption.textContent = selected ? 'software once · VPS billed monthly' : 'software · one payment';
    if (status && hostingMonthlyCents > 0 && link.dataset.pending !== 'true') {
      if (plan === 'monthly') status.textContent = selected
        ? 'VPS plans bill immediately due to VPS provider fees. One checkout: $' + money(total) + ' due today, then monthly. Offers apply only to software.'
        : 'Add hosting for $' + money(hostingMonthlyCents) + ' per month.';
      else if (plan === 'yearly') status.textContent = selected
        ? 'VPS plans bill immediately due to VPS provider fees. One checkout: $' + money(total) + ' due today, then annually. Offers apply only to software.'
        : 'Add hosting for $' + money(hostingMonthlyCents * 12) + ' per year.';
      if (plan === 'lifetime') status.textContent = selected
        ? 'VPS plans bill immediately due to VPS provider fees. $' + money(softwareCents) + ' software once + $' + money(hostingMonthlyCents) + ' VPS today, then monthly.'
        : '$' + money(softwareCents) + ' one-time software payment.';
    }
    link.textContent = selected ? 'Buy ' + (plan === 'monthly' ? 'Monthly' : plan === 'yearly' ? 'Yearly' : 'Lifetime') + ' + VPS'
      : 'Buy ' + plan.charAt(0).toUpperCase() + plan.slice(1);
    var standardHostingCopy = card.querySelector('[data-hosting-standard-copy]');
    var launchHostingCopy = card.querySelector('[data-hosting-launch-copy]');
    if (standardHostingCopy) standardHostingCopy.hidden = false;
    if (launchHostingCopy) launchHostingCopy.hidden = true;
    var buyHref = withReferral(link.dataset.baseHref);
    if (selected) buyHref += '&hosting=true';
    link.setAttribute('href', buyHref);
    var routeReady = checkoutMode === 'live' && (!selected || hostingCheckoutEnabled);
    link.setAttribute('aria-disabled', String(!routeReady));
    link.classList.toggle('disabled', !routeReady);
    if (!routeReady && checkoutMode !== 'live' && status && link.dataset.pending !== 'true') status.textContent = checkoutMode === 'test'
      ? 'Checkout is unavailable while billing is in test mode.'
      : checkoutMode === 'unknown' ? 'Checking checkout availability…' : 'Checkout availability could not be confirmed. Try again later.';
  }
  function renderPlanCards() {
    document.querySelectorAll('.pricing-card[data-base-price-cents]').forEach(renderPlanCard);
    var activeOffer = launchActive();
    document.querySelectorAll('[data-free-announcement]').forEach(function (node) { node.hidden = !launchFreeCardPeriod(); });
    document.querySelectorAll('[data-starter-announcement]').forEach(function (node) { node.hidden = !launchActive(); });
    document.querySelectorAll('[data-availability-announcement]').forEach(function (node) { node.hidden = launchFreeCardPeriod(); });
    var banner = document.querySelector('[data-launch-offer]');
    if (banner) {
      banner.hidden = !launchFreeCardPeriod();
      if (!banner.hidden) {
        var freeText = banner.querySelector('[data-launch-free-copy]');
        if (freeText) freeText.textContent = 'The October 15 offer is for software-only Monthly and Yearly plans. A hosted plan is charged in full today because VPS costs begin at provisioning.';
        var cryptoText = banner.querySelector('[data-launch-crypto-copy]');
        if (cryptoText) cryptoText.hidden = !Object.values(cryptoPlans).some(Boolean);
      }
    }
  }
  function refreshHostingCheckoutReadiness() {
    hostingCheckoutEnabled = launchHostingReady && combinedHostingEnabled && hostingMonthlyCents > 0;
    hostingCheckboxes.forEach(function (checkbox) {
      checkbox.disabled = !hostingCheckoutEnabled;
      if (checkbox.disabled) checkbox.checked = false;
    });
    renderPlanCards();
  }
  function launchCheckoutAttemptId(plan, payment, referral, hosting) {
    var key = plan + ':' + payment + ':' + (referral || '') + (hosting ? ':combined-hosting-v2' : ':software-v2');
    var attempts = {};
    try {
      attempts = JSON.parse(localStorage.getItem(launchAttemptKey) || '{}') || {};
    } catch (_) {}
    var prior = attempts[key] || launchAttemptMemory[key];
    if (prior && typeof prior.id === 'string' && /^[0-9a-f-]{36}$/i.test(prior.id)
      && typeof prior.at === 'number' && Date.now() - prior.at >= 0 && Date.now() - prior.at < 23 * 3600_000) return prior.id;
    var id = crypto.randomUUID();
    launchAttemptMemory[key] = { id: id, at: Date.now() };
    attempts[key] = launchAttemptMemory[key];
    try { localStorage.setItem(launchAttemptKey, JSON.stringify(attempts)); } catch (_) {}
    return id;
  }
  function safeStripeCheckoutUrl(value) {
    try {
      var parsed = new URL(value);
      return parsed.protocol === 'https:' && parsed.hostname === 'checkout.stripe.com'
        && !parsed.username && !parsed.password && !parsed.hash ? parsed.href : null;
    } catch (_) { return null; }
  }
  function navigateTo(url) {
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.rel = 'noopener';
    anchor.click();
  }
  async function fetchJsonWithDeadline(url, init, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    try {
      var response = await fetch(url, Object.assign({}, init, { signal: controller.signal }));
      return { ok: response.ok, status: response.status, retryAfterSeconds: Number(response.headers && response.headers.get('retry-after')) || 0, data: await response.json() };
    } finally {
      clearTimeout(timer);
    }
  }
  async function startLaunchCheckout(card, link, payment) {
    if (link.dataset.pending === 'true') return;
    var plan = card.dataset.plan;
    var status = card.querySelector('[data-hosting-card-status]');
    var checkbox = card.querySelector('[data-hosting-select]');
    var hosting = hostingCheckoutEnabled && !!(checkbox && !checkbox.disabled && checkbox.checked);
    var attemptId;
    try { attemptId = launchCheckoutAttemptId(plan, payment, incomingReferral, hosting); }
    catch (_) { if (status) status.textContent = 'Checkout could not be started in this browser. Refresh and try again.'; return; }
    link.dataset.pending = 'true';
    link.setAttribute('aria-disabled', 'true');
    link.classList.add('disabled');
    if (status) status.textContent = 'Opening secure checkout…';
    var retryAfterSeconds = 0;
    var configuredTimeout = Number(document.body.getAttribute('data-launch-checkout-timeout-ms'));
    var timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 10 && configuredTimeout <= 30_000
      ? configuredTimeout : 15_000;
    try {
      var result = await fetchJsonWithDeadline('/api/billing/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: plan, payment: payment, attemptId: attemptId,
          ...(hosting ? { hosting: true } : {}),
          ...(incomingReferral ? { referral: incomingReferral } : {}) })
      }, timeoutMs);
      if (result.status === 429) retryAfterSeconds = Math.max(result.retryAfterSeconds, Number(result.data && result.data.retryAfterSeconds) || 0);
      if (!result.ok && incomingReferral && result.data?.error === 'Referral discount is not active') {
        // The Hub's /buy route has this same explicit fallback. A confirmed
        // referral rejection permits a distinct no-referral checkout; an
        // uncertain network result must keep its original retry identity.
        result = await fetchJsonWithDeadline('/api/billing/checkout', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ plan: plan, payment: payment,
            ...(hosting ? { hosting: true } : {}),
            attemptId: launchCheckoutAttemptId(plan, payment, null, hosting) })
        }, timeoutMs);
        if (result.status === 429) retryAfterSeconds = Math.max(result.retryAfterSeconds, Number(result.data && result.data.retryAfterSeconds) || 0);
      }
      var checkoutUrl = result.ok && result.data && result.data.ok === true ? safeStripeCheckoutUrl(result.data.url) : null;
      if (!checkoutUrl) throw new Error('Checkout did not return a Stripe URL');
      navigateTo(checkoutUrl);
    } catch (_) {
      delete link.dataset.pending;
      link.setAttribute('aria-disabled', 'false');
      link.classList.remove('disabled');
      if (status) status.textContent = retryAfterSeconds
        ? 'Too many checkout attempts. Please wait ' + Math.ceil(retryAfterSeconds / 60) + ' minutes before trying again. No payment was submitted.'
        : 'Checkout could not be opened. Try again with the same checkout attempt.';
    }
  }
  if (hostingCheckboxes.length) {
    renderPlanCards();
    hostingCheckboxes.forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        renderPlanCards();
      });
    });
    document.querySelectorAll('[data-software-buy]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var card = link.closest('[data-plan]');
        var checkbox = card && card.querySelector('[data-hosting-select]');
        if (link.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
        var selected = !!(checkbox && !checkbox.disabled && checkbox.checked);
        if (selected || (card && launchActive() && launchPlans[card.dataset.plan])) {
          event.preventDefault();
          startLaunchCheckout(card, link, 'card');
        }
      });
    });
    document.querySelectorAll('[data-crypto-buy]').forEach(function (link) {
      link.setAttribute('href', withReferral(link.getAttribute('href')));
      link.addEventListener('click', function (event) {
        var card = link.closest('[data-plan]');
        event.preventDefault();
        if (!card || link.hidden || !cryptoPlans[card.dataset.plan] || link.getAttribute('aria-disabled') === 'true') return;
        var checkbox = card.querySelector('[data-hosting-select]');
        var selected = !!(checkbox && !checkbox.disabled && checkbox.checked);
        if (selected) return;
        startLaunchCheckout(card, link, 'crypto');
      });
    });
  }

  // Prices come from the Hub, so a price change there shows here without a
  // deploy. The numbers in the HTML are the fallback when the Hub is unreachable.
  var hub = document.body.getAttribute('data-hub');
  if (hub && window.fetch) {
    fetch(hub.replace(/\/+$/, '') + '/api/billing/plans', { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || data.ok !== true || !Array.isArray(data.plans)) { checkoutMode = 'unavailable'; renderPlanCards(); return; }
        checkoutMode = data.mode === 'live' ? 'live' : data.mode === 'test' ? 'test' : 'unavailable';
        var offer = data.launch;
        launchHostingReady = checkoutMode === 'live' && offer && offer.hostingCheckoutEnabled === true;
        refreshHostingCheckoutReadiness();
        if (checkoutMode === 'live' && offer && offer.active === true && Number.isFinite(offer.firstPaymentAtMs)
          && Number.isFinite(offer.redeemUntilMs) && offer.firstPaymentAtMs < offer.redeemUntilMs
          && Date.now() < offer.redeemUntilMs) {
          launchOffer = offer;
        }
        data.plans.forEach(function (plan) {
          var card = document.querySelector('.pricing-card[data-plan="' + plan.key + '"]');
          if (!card || typeof plan.amountCents !== 'number') return;
          card.dataset.basePriceCents = String(plan.amountCents);
          if (checkoutMode === 'live' && offer && offer.cryptoEnabled === true && plan.cryptoAvailable === true
            && (plan.key === 'yearly' || plan.key === 'lifetime')) cryptoPlans[plan.key] = true;
          if (launchOffer && /^(monthly|yearly|lifetime)$/.test(plan.key)) launchPlans[plan.key] = true;
        });
        renderPlanCards();
        if (launchOffer) {
          if (Date.now() < launchOffer.firstPaymentAtMs) setTimeout(renderPlanCards, Math.max(1, launchOffer.firstPaymentAtMs - Date.now() + 1));
          setTimeout(renderPlanCards, Math.max(1, Math.min(launchOffer.redeemUntilMs - Date.now() + 1, 2_147_483_647)));
        }
      })
      .catch(function () { checkoutMode = 'unavailable'; renderPlanCards(); });

    // The public options endpoint keeps each selection disabled until the Hub
    // confirms both the advertised plan and its atomic checkout route.
    function hostingUnavailable(message, definitive) {
      combinedHostingEnabled = false;
      hostingCheckoutEnabled = false;
      hostingMonthlyCents = 0;
      hostingCheckboxes.forEach(function (checkbox) { checkbox.disabled = true; checkbox.checked = false; });
      renderPlanCards();
      document.querySelectorAll('[data-hosting-selection-status]').forEach(function (node) { node.textContent = message; });
    }
    fetchJsonWithDeadline(hub.replace(/\/+$/, '') + '/api/hosting/options', { mode: 'cors' }, 15_000)
      .then(function (result) {
        var data = result.ok ? result.data : null;
        if (!data || data.ok !== true) {
          hostingUnavailable('Hosting availability could not be checked. You can add it from your customer dashboard later.', false);
          return;
        }

        var priceLabel = typeof data.monthlyPriceLabel === 'string' ? data.monthlyPriceLabel.trim() : '';
        var maximumAccounts = data.maximumConnectedAccounts;

        if (data.purchasable !== true || data.priceIsProposed !== false || !priceLabel || priceLabel.length > 32
          || !(Number.isInteger(maximumAccounts) && maximumAccounts > 0)) {
          hostingUnavailable('Hosting is not available for purchase yet.', true);
          document.querySelectorAll('[data-hosting-short-price]').forEach(function (node) {
            node.textContent = 'Hosting availability being confirmed';
          });
          document.querySelectorAll('[data-hosting-price]').forEach(function (node) {
            node.textContent = 'Not available for purchase yet';
          });
          document.querySelectorAll('[data-hosting-badge]').forEach(function (node) {
            node.lastChild.textContent = ' Managed hosting · coming soon';
          });
          document.querySelectorAll('[data-hosting-cta]').forEach(function (node) {
            node.textContent = 'View hosting availability';
          });
          return;
        }

        hostingMonthlyCents = Math.round(Number(priceLabel.replace(/^\$/, '')) * 100);
        if (!(hostingMonthlyCents > 0) || !Number.isFinite(hostingMonthlyCents)) {
          hostingUnavailable('Hosting is not available for purchase yet.', true);
          return;
        }
        combinedHostingEnabled = data.combinedCheckoutEnabled === true;
        // Both sources must confirm readiness: the launch endpoint owns the
        // combined Checkout contract; hosting options own the published VPS price.
        refreshHostingCheckoutReadiness();
        document.querySelectorAll('[data-hosting-selection-status]').forEach(function (node) {
          node.textContent = hostingCheckoutEnabled
              ? 'Available · VPS plans bill immediately due to VPS provider fees.'
            : 'Combined software + VPS checkout is not available yet.';
        });

        var regions = Array.isArray(data.regions)
          ? data.regions.map(function (region) { return region && region.label; }).filter(Boolean).join(' · ')
          : '';

        if (typeof data.planLabel === 'string' && data.planLabel) {
          document.querySelectorAll('[data-hosting-plan]').forEach(function (node) {
            node.textContent = data.planLabel;
          });
        }
        if (regions) {
          document.querySelectorAll('[data-hosting-regions]').forEach(function (node) {
            node.textContent = regions;
          });
        }
        if (typeof data.managedBackupsIncluded === 'boolean') {
          document.querySelectorAll('[data-hosting-backups]').forEach(function (node) {
            node.textContent = data.managedBackupsIncluded ? 'Managed backups included' : 'Backups not included';
          });
        }
        if (priceLabel) {
          document.querySelectorAll('[data-hosting-checkbox-price], [data-hosting-confirm-price]').forEach(function (node) { node.textContent = priceLabel + '/month'; });
          document.querySelectorAll('[data-hosting-monthly-price]').forEach(function (node) { node.textContent = priceLabel + '/month'; });
          document.querySelectorAll('[data-hosting-yearly-price]').forEach(function (node) { node.textContent = '$' + money(hostingMonthlyCents * 12) + '/year'; });
          document.querySelectorAll('[data-hosting-monthly-equiv]').forEach(function (node) { node.textContent = priceLabel + '/month'; });
          document.querySelectorAll('[data-hosting-short-price]').forEach(function (node) {
            node.textContent = '+' + priceLabel + '/month';
          });
          document.querySelectorAll('[data-hosting-price]').forEach(function (node) {
            node.textContent = priceLabel;
          });
          document.querySelectorAll('[data-hosting-badge]').forEach(function (node) {
            node.lastChild.textContent = ' Hosting add-on · ' + priceLabel;
          });
        }
        document.querySelectorAll('[data-hosting-cta]').forEach(function (node) {
          node.textContent = 'Open customer dashboard';
        });
      })
      .catch(function () {
        hostingUnavailable('Hosting availability could not be checked. You can add it from your customer dashboard later.', false);
      });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-q').forEach(function (button) {
    button.addEventListener('click', function () {
      var item = button.closest('.faq-item');
      var open = item.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    });
  });
})();

// Same-origin support keeps the conversation on the page and avoids third-party cookies.
(() => {
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'support-launch';
  launcher.setAttribute('aria-label', 'Chat with Wick Hunter Support');
  launcher.setAttribute('aria-controls', 'website-support');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/></svg><span>Chat with support</span>';
  const panel = document.createElement('section');
  panel.id = 'website-support';
  panel.className = 'support-window';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'website-support-title');
  panel.innerHTML = '<header class="support-window-header"><strong id="website-support-title">Wick Hunter Support</strong><button type="button" class="support-window-close" aria-label="Close support"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><p class="support-window-loading" role="status">Loading your conversation…</p><iframe title="Wick Hunter Support conversation" hidden></iframe>';
  const close = panel.querySelector('.support-window-close');
  const frame = panel.querySelector('iframe');
  const status = panel.querySelector('[role="status"]');
  let opener = launcher;
  function sizePanel() {
    const viewport = window.visualViewport;
    const height = viewport ? viewport.height : window.innerHeight;
    const keyboard = viewport ? Math.max(0, window.innerHeight - height - viewport.offsetTop) : 0;
    panel.style.setProperty('--support-height', Math.min(680, height - 32) + 'px');
    panel.style.setProperty('--support-bottom', Math.max(16, keyboard + 16) + 'px');
  }
  function hide() {
    panel.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false');
    if (opener && opener.isConnected) opener.focus();
  }
  function escape(event) { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); hide(); } }
  function show(event) {
    if (event) event.preventDefault();
    opener = event && event.currentTarget || launcher;
    panel.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    sizePanel();
    if (!frame.hasAttribute('src')) frame.src = '/support/';
    close.focus();
  }
  frame.addEventListener('load', () => {
    try {
      const doc = frame.contentDocument;
      // Appending an iframe loads about:blank before a conversation is opened.
      // That initial load is not a failed support request.
      if (!frame.hasAttribute('src') || doc?.URL === 'about:blank') return;
      if (!doc || !doc.getElementById('messages')) throw new Error('Support unavailable');
      const style = doc.createElement('style');
      style.textContent = 'body{padding:14px;gap:12px;max-width:none}body>header{display:none}';
      doc.head.appendChild(style);
      doc.addEventListener('keydown', escape);
      frame.hidden = false;
      status.hidden = true;
      status.textContent = '';
    } catch {
      status.textContent = 'Support is temporarily unavailable. ';
      const retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = 'Try again'; retry.className = 'btn';
      retry.addEventListener('click', () => { status.textContent = 'Loading your conversation…'; frame.src = '/support/'; });
      status.appendChild(retry);
    }
  });
  close.addEventListener('click', hide);
  launcher.addEventListener('click', show);
  document.querySelectorAll('a[data-open-support]').forEach(link => link.addEventListener('click', show));
  document.addEventListener('keydown', escape);
  window.addEventListener('resize', sizePanel);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', sizePanel);
  document.body.append(panel, launcher);
})();
