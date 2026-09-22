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

  // This is a remembered checkout choice, never payment authorisation. The
  // Hub still owns the Stripe price and final confirmation.
  var hostingChoiceKey = 'wh.hosting-choice.v1';
  var hostingSelected = false;
  try {
    var savedChoice = JSON.parse(localStorage.getItem(hostingChoiceKey) || 'null');
    hostingSelected = !!(savedChoice && savedChoice.selected === true &&
      typeof savedChoice.at === 'number' && Date.now() - savedChoice.at >= 0 && Date.now() - savedChoice.at < 86400000);
  } catch (_) {}
  function rememberHosting(selected, plan) {
    hostingSelected = selected;
    try {
      if (selected) localStorage.setItem(hostingChoiceKey, JSON.stringify({
        selected: true,
        plan: typeof plan === 'string' && /^(monthly|yearly|lifetime)$/.test(plan) ? plan : (savedChoice && savedChoice.plan) || null,
        at: Date.now()
      }));
      else localStorage.removeItem(hostingChoiceKey);
    } catch (_) {}
  }
  var hostingCheckboxes = Array.from(document.querySelectorAll('[data-hosting-select]'));
  var hostingMonthlyCents = 0;
  var hostingMaximumAccounts = 0;
  var bundleCheckoutEnabled = false;
  var bundleAttemptKey = 'wh.hosting-bundle-attempt.v1';
  function money(cents) {
    return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  }
  function renderPlanCard(card) {
    if (!card) return;
    var plan = card.dataset.plan;
    var checkbox = card.querySelector('[data-hosting-select]');
    var selected = !!(checkbox && checkbox.checked);
    var baseCents = Number(card.dataset.basePriceCents);
    var price = card.querySelector('[data-plan-price]');
    var caption = card.querySelector('[data-plan-caption]');
    var link = card.querySelector('[data-software-buy]');
    var status = card.querySelector('[data-hosting-card-status]');
    if (!(baseCents >= 0) || !price || !caption || !link) return;
    var total = baseCents;
    if (selected && plan === 'monthly') total += hostingMonthlyCents;
    if (selected && plan === 'yearly') total += hostingMonthlyCents * 12;
    price.textContent = money(total);
    if (plan === 'monthly') caption.textContent = selected ? 'software + VPS · one monthly renewal' : 'software · renews monthly';
    if (plan === 'yearly') caption.textContent = selected ? 'software + VPS · one annual renewal' : 'software · renews annually';
    if (plan === 'lifetime') caption.textContent = selected ? 'software once · VPS renews separately monthly' : 'software · one payment';
    if (status && hostingMonthlyCents > 0 && link.dataset.pending !== 'true') {
      if (plan === 'monthly') status.textContent = selected
        ? 'One $' + money(total) + ' monthly software + hosting renewal.'
        : 'Add hosting for $' + money(hostingMonthlyCents) + ' per month.';
      if (plan === 'yearly') status.textContent = selected
        ? 'One $' + money(total) + ' annual software + hosting renewal.'
        : 'Add hosting for $' + money(hostingMonthlyCents * 12) + ' per year.';
      if (plan === 'lifetime') status.textContent = '$' + money(baseCents)
        + ' software today; confirm the separate $' + money(hostingMonthlyCents) + ' monthly hosting subscription next.';
    }
    link.textContent = selected ? (plan === 'lifetime' ? 'Buy Lifetime, then VPS' : 'Buy ' + (plan === 'monthly' ? 'Monthly' : 'Yearly') + ' + VPS')
      : 'Buy ' + plan.charAt(0).toUpperCase() + plan.slice(1);
    link.setAttribute('href', link.dataset.baseHref);
    var routeReady = !selected || plan === 'lifetime' || bundleCheckoutEnabled;
    link.setAttribute('aria-disabled', String(!routeReady));
    link.classList.toggle('disabled', !routeReady);
  }
  function renderPlanCards() {
    document.querySelectorAll('.pricing-card[data-base-price-cents]').forEach(renderPlanCard);
  }
  function checkoutAttemptId(plan) {
    try {
      var prior = JSON.parse(localStorage.getItem(bundleAttemptKey) || 'null');
      if (prior && prior.plan === plan && typeof prior.id === 'string' && /^[0-9a-f-]{36}$/i.test(prior.id)) return prior.id;
      var id = crypto.randomUUID();
      localStorage.setItem(bundleAttemptKey, JSON.stringify({ plan: plan, id: id }));
      return id;
    } catch (_) { return ''; }
  }
  function clearCheckoutAttempt() {
    try { localStorage.removeItem(bundleAttemptKey); } catch (_) {}
  }
  function safeStripeCheckoutUrl(value) {
    try {
      var parsed = new URL(value);
      return parsed.protocol === 'https:' && parsed.hostname === 'checkout.stripe.com' ? parsed.href : null;
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
      return { ok: response.ok, data: response.ok ? await response.json() : null };
    } finally {
      clearTimeout(timer);
    }
  }
  async function startBundleCheckout(card, link) {
    var plan = card.dataset.plan;
    var attemptId = checkoutAttemptId(plan);
    var status = card.querySelector('[data-hosting-card-status]');
    if (link.dataset.pending === 'true') return;
    if (!attemptId || !hub) {
      if (status) status.textContent = 'Checkout could not be started in this browser. Refresh and try again.';
      return;
    }
    link.dataset.pending = 'true';
    link.setAttribute('aria-disabled', 'true');
    link.classList.add('disabled');
    if (status) status.textContent = 'Opening secure checkout…';
    try {
      var configuredTimeout = Number(document.body.getAttribute('data-hosting-checkout-timeout-ms'));
      var timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 10 && configuredTimeout <= 30_000
        ? configuredTimeout : 15_000;
      var result = await fetchJsonWithDeadline(hub.replace(/\/+$/, '') + '/api/hosting/bundle-checkout', {
        method: 'POST', mode: 'cors', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: plan, checkoutAttemptId: attemptId })
      }, timeoutMs);
      var data = result.ok ? result.data : null;
      var expectedAmount = Number(card.dataset.basePriceCents) + hostingMonthlyCents * (plan === 'yearly' ? 12 : 1);
      var expectedInterval = plan === 'yearly' ? 'year' : 'month';
      var expectedSoftwareDays = plan === 'yearly' ? 365 : 30;
      var checkoutUrl = data && data.ok === true ? safeStripeCheckoutUrl(data.url) : null;
      var pricing = data && data.pricing;
      if (!checkoutUrl || !pricing || pricing.amountCents !== expectedAmount || pricing.interval !== expectedInterval
        || pricing.softwareDays !== expectedSoftwareDays
        || pricing.maximumConnectedAccounts !== hostingMaximumAccounts) {
        throw new Error('checkout response did not match the selected price');
      }
      navigateTo(checkoutUrl);
    } catch (_) {
      delete link.dataset.pending;
      link.setAttribute('aria-disabled', 'false');
      link.classList.remove('disabled');
      if (status) status.textContent = 'Checkout could not be opened. Try again; you will not be charged twice.';
    }
  }
  if (hostingCheckboxes.length) {
    hostingCheckboxes.forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        if (!checkbox.checked) clearCheckoutAttempt();
        renderPlanCard(checkbox.closest('[data-plan]'));
      });
    });
    document.querySelectorAll('[data-software-buy]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var card = link.closest('[data-plan]');
        var checkbox = card && card.querySelector('[data-hosting-select]');
        if (link.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
        var selected = !!(checkbox && !checkbox.disabled && checkbox.checked);
        rememberHosting(selected, card && card.dataset.plan);
        if (selected && card && /^(monthly|yearly)$/.test(card.dataset.plan)) {
          event.preventDefault();
          startBundleCheckout(card, link);
        }
      });
    });
  }
  var hostingCombinedNext = document.querySelector('[data-hosting-combined-next]');
  var hostingSeparateNext = document.querySelector('[data-hosting-separate-next]');
  // A remembered preference cannot verify today's availability or price.
  // The thank-you prompt is revealed only after the Hub confirms both.
  if (hostingCombinedNext) hostingCombinedNext.hidden = true;
  if (hostingSeparateNext) hostingSeparateNext.hidden = true;
  document.querySelectorAll('[data-hosting-finish], [data-hosting-skip]').forEach(function (control) {
    control.addEventListener('click', function () {
      rememberHosting(false);
      if (control.hasAttribute('data-hosting-skip') && hostingSeparateNext) hostingSeparateNext.hidden = true;
    });
  });

  // Prices come from the Hub, so a price change there shows here without a
  // deploy. The numbers in the HTML are the fallback when the Hub is unreachable.
  var hub = document.body.getAttribute('data-hub');
  if (hub && window.fetch) {
    fetch(hub.replace(/\/+$/, '') + '/api/billing/plans', { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.plans)) return;
        data.plans.forEach(function (plan) {
          var card = document.querySelector('.pricing-card[data-plan="' + plan.key + '"]');
          if (!card || typeof plan.amountCents !== 'number') return;
          card.dataset.basePriceCents = String(plan.amountCents);
          renderPlanCard(card);
        });
      })
      .catch(function () {});

    // The public options endpoint keeps each selection disabled until the Hub
    // confirms both the advertised plan and its atomic checkout route.
    function hostingUnavailable(message, definitive) {
      if (definitive) rememberHosting(false);
      bundleCheckoutEnabled = false;
      hostingCheckboxes.forEach(function (checkbox) { checkbox.disabled = true; checkbox.checked = false; });
      renderPlanCards();
      if (hostingCombinedNext) hostingCombinedNext.hidden = true;
      if (hostingSeparateNext) hostingSeparateNext.hidden = true;
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
        hostingMaximumAccounts = maximumAccounts;
        bundleCheckoutEnabled = data.bundleEnabled === true;
        hostingCheckboxes.forEach(function (checkbox) {
          var plan = checkbox.closest('[data-plan]').dataset.plan;
          checkbox.disabled = plan !== 'lifetime' && !bundleCheckoutEnabled;
          if (checkbox.disabled) checkbox.checked = false;
        });
        renderPlanCards();
        if (hostingSelected && savedChoice && savedChoice.plan === 'lifetime' && hostingSeparateNext) {
          hostingSeparateNext.hidden = false;
          clearCheckoutAttempt();
        }
        if (hostingSelected && savedChoice && /^(monthly|yearly)$/.test(savedChoice.plan) && hostingCombinedNext) {
          hostingCombinedNext.hidden = false;
          clearCheckoutAttempt();
        }
        document.querySelectorAll('[data-hosting-selection-status]').forEach(function (node) {
          node.textContent = bundleCheckoutEnabled
            ? 'Available · choose the matching billing option inside any licence card'
            : 'Lifetime hosting is available separately; combined Monthly and Yearly checkout is not available yet.';
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

// Support lives on a same-origin page; credentials never enter site JavaScript.
(()=>{const a=document.createElement('a');a.href='/support/';a.className='support-launch';a.textContent='Chat with support';document.body.appendChild(a);})();
