const materialNames = {
  nl: { mat: 'Mat', glans: 'Glans' },
  en: { mat: 'Matte', glans: 'Glossy' },
  fr: { mat: 'Mat', glans: 'Brillant' },
  de: { mat: 'Matt', glans: 'Glänzend' },
};

const formatNames = {
  a4: 'A4', a3: 'A3', a2: 'A2', 'a2-lang': 'A2 lang', b2: 'B2',
  a1: 'A1', b1: 'B1', a0: 'A0', b0: 'B0', abri: 'Abri',
};

const formatSizes = {
  a4: '21 × 29,7 cm',
  a3: '29,7 × 42 cm',
  '40x60': '40 × 60 cm',
  a2: '42 × 59,4 cm',
  'a2-lang': '29,7 × 84 cm',
  b2: '50 × 70 cm',
  '60x80': '60 × 80 cm',
  a1: '59,4 × 84 cm',
  '60x90': '60 × 90 cm',
  b1: '70 × 100 cm',
  a0: '84 × 118,8 cm',
  b0: '100 × 140 cm',
  abri: '118,5 × 175 cm',
};

function formatLabel(format) {
  return formatNames[format] || formatSizes[format] || format;
}

function formatLabelFull(format) {
  const name = formatNames[format];
  const size = formatSizes[format] || '?';
  return name ? `${name} (${size})` : size;
}

const ORDER_EMAIL = 'info@astroraf.be';

const CART_KEY = 'astroraf-cart';

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const cart = raw ? JSON.parse(raw) : [];
    return Array.isArray(cart) ? cart : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function positionCartWidget() {
  const header = document.querySelector('.site-header');
  const widget = document.getElementById('cartWidget');
  if (!header || !widget) return;
  widget.style.top = header.offsetHeight + 'px';
}

window.addEventListener('resize', positionCartWidget);
window.addEventListener('load', positionCartWidget);

document.addEventListener('DOMContentLoaded', () => {
  positionCartWidget();

  /* ---------- Cart ---------- */
  const cartToggle = document.getElementById('cartToggle');
  const cartPanel = document.getElementById('cartPanel');
  const cartItems = document.getElementById('cartItems');
  const cartEmpty = document.getElementById('cartEmpty');
  const cartCount = document.getElementById('cartCount');
  const checkoutBtns = document.querySelectorAll('.checkout-btn');
  const checkoutModal = document.getElementById('checkoutModal');
  const checkoutSummary = document.getElementById('checkoutSummary');
  const checkoutForm = document.getElementById('checkoutForm');

  function currentLang() {
    return localStorage.getItem('astroraf-lang') || 'nl';
  }

  function t(key) {
    const dict = (typeof translations !== 'undefined' && translations[currentLang()]) || {};
    return dict[key] || '';
  }

  function materialLabel(material) {
    const dict = materialNames[currentLang()] || materialNames.nl;
    return dict[material] || material;
  }

  function cartItemLine(item, full) {
    const parts = [item.label, item.categoryLabel];
    if (item.format) parts.push(full ? formatLabelFull(item.format) : formatLabel(item.format));
    if (item.material) parts.push(materialLabel(item.material));
    return parts.filter(Boolean).join(full ? ' — ' : ' · ');
  }

  function renderCart() {
    const cart = loadCart();
    const total = cart.reduce((sum, item) => sum + item.qty, 0);

    if (cartCount) {
      cartCount.textContent = String(total);
      cartCount.hidden = total === 0;
    }

    if (!cartItems || !cartEmpty) return;

    cartItems.innerHTML = '';
    cartEmpty.hidden = cart.length > 0;
    checkoutBtns.forEach((btn) => { btn.hidden = cart.length === 0; });

    cart.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'cart-item';

      const img = document.createElement('img');
      img.src = item.image;
      img.alt = '';

      const info = document.createElement('div');

      const materialEl = document.createElement('div');
      materialEl.className = 'cart-item-material';
      materialEl.textContent = cartItemLine(item, false);

      const qtyRow = document.createElement('div');
      qtyRow.className = 'cart-item-qty';

      const decreaseBtn = document.createElement('button');
      decreaseBtn.type = 'button';
      decreaseBtn.setAttribute('aria-label', '-');
      decreaseBtn.textContent = '−';
      decreaseBtn.addEventListener('click', () => changeQty(item.id, -1));

      const qtyLabel = document.createElement('span');
      qtyLabel.textContent = String(item.qty);

      const increaseBtn = document.createElement('button');
      increaseBtn.type = 'button';
      increaseBtn.setAttribute('aria-label', '+');
      increaseBtn.textContent = '+';
      increaseBtn.addEventListener('click', () => changeQty(item.id, 1));

      qtyRow.append(decreaseBtn, qtyLabel, increaseBtn);
      info.append(materialEl, qtyRow);
      row.append(img, info);
      cartItems.appendChild(row);
    });
  }

  function addToCart(item) {
    const cart = loadCart();
    const existing = cart.find((entry) => entry.id === item.id);
    if (existing) {
      existing.qty += item.qty;
    } else {
      cart.push({ ...item });
    }
    saveCart(cart);
    renderCart();
  }

  window.astrorafCart = { add: addToCart };

  function changeQty(id, delta) {
    let cart = loadCart();
    const item = cart.find((entry) => entry.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter((entry) => entry.id !== id);
    }
    saveCart(cart);
    renderCart();
  }

  function renderCheckoutSummary() {
    if (!checkoutSummary) return;
    checkoutSummary.innerHTML = '';

    loadCart().forEach((item) => {
      const row = document.createElement('div');
      row.className = 'checkout-summary-item';

      const img = document.createElement('img');
      img.src = item.image;
      img.alt = '';

      const text = document.createElement('span');
      text.textContent = `${cartItemLine(item, true)} × ${item.qty}`;

      row.append(img, text);
      checkoutSummary.appendChild(row);
    });
  }

  function openCheckoutModal() {
    if (!checkoutModal) return;
    renderCheckoutSummary();
    checkoutModal.hidden = false;
  }

  function closeCheckoutModal() {
    if (checkoutModal) checkoutModal.hidden = true;
  }

  checkoutBtns.forEach((btn) => {
    btn.addEventListener('click', openCheckoutModal);
  });

  if (checkoutModal) {
    checkoutModal.querySelectorAll('[data-modal-close]').forEach((el) => {
      el.addEventListener('click', closeCheckoutModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !checkoutModal.hidden) closeCheckoutModal();
    });
  }

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const data = new FormData(checkoutForm);
      const name = data.get('name') || '';
      const email = data.get('email') || '';
      const address = data.get('address') || '';
      const notes = data.get('notes') || '';

      const orderLines = loadCart().map((item) => `- ${cartItemLine(item, true)} x${item.qty}`);

      const bodyLines = [
        t('order_body_title'),
        '',
        ...orderLines,
        '',
        `${t('order_name_label')}: ${name}`,
        `${t('order_email_label')}: ${email}`,
        `${t('order_address_label')}: ${address}`,
        `${t('order_notes_label')}: ${notes || '-'}`,
      ];

      const subject = encodeURIComponent(t('order_subject'));
      const body = encodeURIComponent(bodyLines.join('\n'));
      window.location.href = `mailto:${ORDER_EMAIL}?subject=${subject}&body=${body}`;

      saveCart([]);
      renderCart();
      checkoutForm.reset();
      closeCheckoutModal();
    });
  }

  if (cartToggle && cartPanel) {
    cartToggle.addEventListener('click', () => {
      const willOpen = cartPanel.hidden;
      cartPanel.hidden = !willOpen;
      cartToggle.classList.toggle('active', willOpen);
      cartToggle.setAttribute('aria-expanded', String(willOpen));
    });

    document.addEventListener('click', (e) => {
      if (cartPanel.hidden) return;
      const path = e.composedPath ? e.composedPath() : [e.target];
      const staysOpen = path.includes(cartPanel) || path.includes(cartToggle) ||
        path.some((el) => el.classList && el.classList.contains('shop-detail'));
      if (!staysOpen) {
        cartPanel.hidden = true;
        cartToggle.classList.remove('active');
        cartToggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !cartPanel.hidden) {
        cartPanel.hidden = true;
        cartToggle.classList.remove('active');
        cartToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.addEventListener('astroraf-lang-changed', renderCart);

  renderCart();
});
