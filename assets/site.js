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
          var price = card.querySelector('.price');
          if (!price) return;
          var whole = plan.amountCents % 100 === 0;
          price.textContent = whole ? String(plan.amountCents / 100) : (plan.amountCents / 100).toFixed(2);
        });
      })
      .catch(function () {});

    // Managed hosting has its own eligibility-gated checkout. The public
    // options endpoint keeps the advertised plan and price aligned with the
    // Hub without sending visitors directly into a generic checkout route.
    fetch(hub.replace(/\/+$/, '') + '/api/hosting/options', { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || data.ok !== true) return;

        if (data.purchasable !== true || data.priceIsProposed !== false) {
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
        if (typeof data.monthlyPriceLabel === 'string' && data.monthlyPriceLabel) {
          document.querySelectorAll('[data-hosting-short-price]').forEach(function (node) {
            node.textContent = '+' + data.monthlyPriceLabel + '/month';
          });
          document.querySelectorAll('[data-hosting-price]').forEach(function (node) {
            node.textContent = data.monthlyPriceLabel;
          });
          document.querySelectorAll('[data-hosting-badge]').forEach(function (node) {
            node.lastChild.textContent = ' Hosting add-on · ' + data.monthlyPriceLabel;
          });
        }
        document.querySelectorAll('[data-hosting-cta]').forEach(function (node) {
          node.textContent = 'Open customer dashboard';
        });
      })
      .catch(function () {});
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
