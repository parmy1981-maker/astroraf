const materialNames = {
  nl: { mat: 'Mat', glans: 'Glans' },
  en: { mat: 'Matte', glans: 'Glossy' },
  fr: { mat: 'Mat', glans: 'Brillant' },
  de: { mat: 'Matt', glans: 'Glänzend' },
};

const posterNames = {
  nl: { start: 'Start', corona: 'Corona', einde: 'Einde' },
  en: { start: 'Start', corona: 'Corona', einde: 'End' },
  fr: { start: 'Début', corona: 'Corona', einde: 'Fin' },
  de: { start: 'Start', corona: 'Corona', einde: 'Ende' },
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

const formatDimensions = {
  a4: [21, 29.7],
  a3: [29.7, 42],
  '40x60': [40, 60],
  a2: [42, 59.4],
  'a2-lang': [29.7, 84],
  b2: [50, 70],
  '60x80': [60, 80],
  a1: [59.4, 84],
  '60x90': [60, 90],
  b1: [70, 100],
  a0: [84, 118.8],
  b0: [100, 140],
  abri: [118.5, 175],
};

const PREVIEW_MAX_WIDTH = 340;
const PREVIEW_MIN_WIDTH = 150;
const PREVIEW_MIN_LONG_SIDE = 260;
const PREVIEW_MAX_LONG_SIDE = 440;

const PREVIEW_CM_MIN = Math.sqrt(Math.min(...Object.values(formatDimensions).map((d) => Math.max(d[0], d[1]))));
const PREVIEW_CM_MAX = Math.sqrt(Math.max(...Object.values(formatDimensions).map((d) => Math.max(d[0], d[1]))));

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

  /* ---------- Shop menu (Posters) ---------- */
  const shopMenu = document.getElementById('shopMenu');
  const shopDetails = document.querySelectorAll('[data-shop-detail]');

  if (shopMenu) {
    document.querySelectorAll('[data-open-shop]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-open-shop');
        shopMenu.hidden = true;
        shopDetails.forEach((section) => {
          section.hidden = section.getAttribute('data-shop-detail') !== id;
        });
      });
    });

    document.querySelectorAll('[data-close-shop]').forEach((btn) => {
      btn.addEventListener('click', () => {
        shopDetails.forEach((section) => { section.hidden = true; });
        shopMenu.hidden = false;
      });
    });
  }

  /* ---------- Poster configurator ---------- */
  const posterThumbs = document.querySelectorAll('.poster-thumb');
  const posterPreview = document.getElementById('posterPreview');
  const posterPreviewImg = document.getElementById('posterPreviewImg');
  const materialBtns = document.querySelectorAll('.material-btn');
  const posterFormat = document.getElementById('posterFormat');
  const posterQtyInput = document.getElementById('posterQtyInput');
  const posterQtyDecrease = document.getElementById('posterQtyDecrease');
  const posterQtyIncrease = document.getElementById('posterQtyIncrease');
  const posterAddToCart = document.getElementById('posterAddToCart');
  const posterFormatDims = document.getElementById('posterFormatDims');

  let selectedKey = 'corona';
  let selectedImage = "foto's/Eclips_Corona.jpg";
  let selectedMaterial = 'mat';
  let selectedFormat = posterFormat ? posterFormat.value : 'a3';

  function applyPreviewFormat(format) {
    if (posterFormatDims) posterFormatDims.textContent = formatSizes[format] || '';
    if (posterPreview) {
      const dims = formatDimensions[format];
      if (dims) {
        // Long side scales gently (square root) between the smallest and
        // largest format, so bigger posters look bigger without the
        // smallest ones shrinking to near-invisible.
        const long = Math.max(dims[0], dims[1]);
        const norm = (Math.sqrt(long) - PREVIEW_CM_MIN) / (PREVIEW_CM_MAX - PREVIEW_CM_MIN);
        const targetLong = PREVIEW_MIN_LONG_SIDE + norm * (PREVIEW_MAX_LONG_SIDE - PREVIEW_MIN_LONG_SIDE);
        const scale = targetLong / long;

        const w = Math.min(PREVIEW_MAX_WIDTH, Math.max(PREVIEW_MIN_WIDTH, Math.round(dims[0] * scale)));
        const h = Math.min(PREVIEW_MAX_LONG_SIDE, Math.round(dims[1] * scale));
        posterPreview.style.width = w + 'px';
        posterPreview.style.height = h + 'px';
      }
    }
  }

  applyPreviewFormat(selectedFormat);

  if (posterFormat) {
    posterFormat.addEventListener('change', () => {
      selectedFormat = posterFormat.value;
      applyPreviewFormat(selectedFormat);
    });
  }

  posterThumbs.forEach((thumb) => {
    thumb.addEventListener('click', () => {
      posterThumbs.forEach((t) => t.classList.remove('is-active'));
      thumb.classList.add('is-active');
      selectedKey = thumb.getAttribute('data-poster-key');
      selectedImage = thumb.getAttribute('data-image');

      if (posterPreviewImg) {
        const thumbImg = thumb.querySelector('img');
        posterPreviewImg.src = selectedImage;
        posterPreviewImg.alt = thumbImg ? thumbImg.alt : '';
      }
    });
  });

  materialBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      materialBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedMaterial = btn.getAttribute('data-material');
    });
  });

  if (posterQtyDecrease && posterQtyInput) {
    posterQtyDecrease.addEventListener('click', () => {
      posterQtyInput.value = Math.max(1, (parseInt(posterQtyInput.value, 10) || 1) - 1);
    });
  }

  if (posterQtyIncrease && posterQtyInput) {
    posterQtyIncrease.addEventListener('click', () => {
      posterQtyInput.value = (parseInt(posterQtyInput.value, 10) || 1) + 1;
    });
  }

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

  function materialLabel(material) {
    const dict = materialNames[currentLang()] || materialNames.nl;
    return dict[material] || material;
  }

  function posterLabel(key) {
    const dict = posterNames[currentLang()] || posterNames.nl;
    return dict[key] || key;
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
      materialEl.textContent = `${formatLabel(item.format)} · ${materialLabel(item.material)}`;

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

  function addToCart(id, key, material, format, image, qty) {
    const cart = loadCart();
    const existing = cart.find((item) => item.id === id);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ id, key, material, format, image, qty });
    }
    saveCart(cart);
    renderCart();
  }

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

  if (posterAddToCart) {
    posterAddToCart.addEventListener('click', () => {
      const qty = posterQtyInput ? Math.max(1, parseInt(posterQtyInput.value, 10) || 1) : 1;

      addToCart(
        `poster-${selectedKey}-${selectedMaterial}-${selectedFormat}`,
        selectedKey, selectedMaterial, selectedFormat, selectedImage, qty
      );

      if (posterQtyInput) posterQtyInput.value = 1;

      const originalText = posterAddToCart.textContent;
      posterAddToCart.classList.add('is-added');
      posterAddToCart.textContent = '✓';
      setTimeout(() => {
        posterAddToCart.classList.remove('is-added');
        posterAddToCart.textContent = originalText;
      }, 1200);
    });
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
      text.textContent = `${posterLabel(item.key)} — ${formatLabelFull(item.format)} — ${materialLabel(item.material)} × ${item.qty}`;

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

      const orderLines = loadCart().map(
        (item) => `- ${posterLabel(item.key)}, ${formatLabelFull(item.format)}, ${materialLabel(item.material)} x${item.qty}`
      );

      const bodyLines = [
        'Nieuwe bestelling via AstroRaf.be',
        '',
        ...orderLines,
        '',
        `Naam: ${name}`,
        `E-mail: ${email}`,
        `Adres: ${address}`,
        `Opmerkingen: ${notes || '-'}`,
      ];

      const subject = encodeURIComponent('Nieuwe bestelling - AstroRaf.be');
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
