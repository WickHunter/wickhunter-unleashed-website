// Wick Hunter Unleashed — marketing site
// Vanilla JS only: mobile menu, FAQ accordion, exchange filter, price fill.
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

  // FAQ accordion
  document.querySelectorAll('.faq-q').forEach(function (button) {
    button.addEventListener('click', function () {
      var item = button.closest('.faq-item');
      var open = item.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    });
  });

  // Price fill — the price lives in ONE place: body[data-price].
  // Empty means "not set yet" and the price row falls back to plain text
  // so the page is never wrong.
  var price = (document.body.getAttribute('data-price') || '').trim();
  var priceRows = document.querySelectorAll('.price-row');
  if (price) {
    document.querySelectorAll('.price').forEach(function (el) {
      el.textContent = price;
    });
  } else {
    priceRows.forEach(function (row) {
      row.textContent = 'Pricing shown at checkout';
      row.classList.add('price-fallback');
    });
  }
})();
