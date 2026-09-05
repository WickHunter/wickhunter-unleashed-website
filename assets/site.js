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
