const materialNames = {
  nl: { mat: 'Mat', glans: 'Glans' },
  en: { mat: 'Matte', glans: 'Glossy' },
  fr: { mat: 'Mat', glans: 'Brillant' },
  de: { mat: 'Matt', glans: 'Glänzend' },
};

// formatSizes blijft (nog gebruikt door shop.js om de postervoorbeeld-doos
// op maat van het gekozen formaat te schalen) -- formatNames/formatLabel(Full)
// zijn weg, weergave gebeurt nu via het veld-label dat de editor zelf kiest.
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

function formatEuro(cents) {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

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
  const checkoutMethods = document.getElementById('checkoutMethods');
  const checkoutSubmitBtn = document.getElementById('checkoutSubmitBtn');
  const checkoutStatusMessage = document.getElementById('checkoutStatusMessage');
  const shopOrderStatus = document.getElementById('shopOrderStatus');

  let selectedMethod = null;

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

  function cartItemLine(item, separator) {
    const parts = [item.label, item.categoryLabel];
    if (item.fieldLabel) parts.push(item.fieldLabel);
    if (item.material) parts.push(materialLabel(item.material));
    return parts.filter(Boolean).join(separator);
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
      materialEl.textContent = cartItemLine(item, ' · ');

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

  // Verplichte algemene kosten komen altijd bij. Optionele kosten (bv.
  // Verzendkosten als afhaling ook kan) tellen enkel mee als minstens één
  // item van die rubriek in het winkelmandje ze aanvaard heeft op de
  // productpagina.
  function categorySurchargeCentsFor(categoryId, cart) {
    const fields = window.astrorafShopPricing?.categoryFields?.[categoryId] || [];
    const itemsInCategory = cart.filter((item) => item.categoryId === categoryId);
    return fields.filter((f) => f.field_type === 'surcharge').reduce((sum, f) => {
      const accepted = f.mandatory || itemsInCategory.some((item) =>
        (item.acceptedSurchargeFieldIds || []).includes(f.id));
      return sum + (accepted ? (f.price_cents || 0) : 0);
    }, 0);
  }

  // Weergave-only: dezelfde "één keer per aanwezige rubriek"-logica als
  // api/checkout/create-payment.js server-side toepast. De server herberekent
  // dit gezaghebbend uit de database en vertrouwt dit cliëntgetal nooit.
  function totalSurchargeCents(cart) {
    const categoryIds = [...new Set(cart.map((item) => item.categoryId).filter(Boolean))];
    return categoryIds.reduce((sum, id) => sum + categorySurchargeCentsFor(id, cart), 0);
  }

  function totalsRow(label, cents, strong) {
    const row = document.createElement('div');
    row.className = 'checkout-summary-item';
    const text = document.createElement('span');
    text.innerHTML = strong ? `<strong>${label}: ${formatEuro(cents)}</strong>` : `${label}: ${formatEuro(cents)}`;
    row.appendChild(text);
    return row;
  }

  function renderCheckoutSummary() {
    if (!checkoutSummary) return;
    checkoutSummary.innerHTML = '';

    const cart = loadCart();
    cart.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'checkout-summary-item';

      const img = document.createElement('img');
      img.src = item.image;
      img.alt = '';

      const text = document.createElement('span');
      const lineTotal = (item.unitPriceCents || 0) * item.qty;
      text.textContent = `${cartItemLine(item, ' — ')} × ${item.qty} — ${formatEuro(lineTotal)}`;

      row.append(img, text);
      checkoutSummary.appendChild(row);
    });

    const subtotal = cart.reduce((sum, item) => sum + (item.unitPriceCents || 0) * item.qty, 0);
    const surcharge = totalSurchargeCents(cart);
    checkoutSummary.appendChild(totalsRow(t('checkout_summary_subtotal'), subtotal, false));
    checkoutSummary.appendChild(totalsRow(t('checkout_summary_shipping'), surcharge, false));
    checkoutSummary.appendChild(totalsRow(t('checkout_summary_total'), subtotal + surcharge, true));
  }

  async function loadCheckoutMethods() {
    if (!checkoutMethods) return;
    selectedMethod = null;
    if (checkoutSubmitBtn) checkoutSubmitBtn.disabled = true;
    checkoutMethods.innerHTML = `<span class="admin-status">...</span>`;

    try {
      const res = await fetch(`/api/checkout/methods?lang=${currentLang()}`);
      const body = await res.json();
      checkoutMethods.innerHTML = '';
      (body.methods || []).forEach((method) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'material-btn checkout-method-btn';
        btn.textContent = method.label;
        btn.addEventListener('click', () => {
          checkoutMethods.querySelectorAll('.checkout-method-btn').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          selectedMethod = method.id;
          if (checkoutSubmitBtn) checkoutSubmitBtn.disabled = false;
        });
        checkoutMethods.appendChild(btn);
      });
      if (!body.methods?.length) {
        checkoutMethods.innerHTML = `<span class="admin-status">${t('checkout_order_failed')}</span>`;
      }
    } catch (e) {
      console.error('AstroRaf: betaalmethodes laden mislukt', e);
      checkoutMethods.innerHTML = `<span class="admin-status">${t('checkout_order_failed')}</span>`;
    }
  }

  function showCheckoutStatus(message) {
    if (!checkoutStatusMessage) return;
    checkoutStatusMessage.hidden = !message;
    checkoutStatusMessage.textContent = message || '';
  }

  function openCheckoutModal() {
    if (!checkoutModal) return;
    renderCheckoutSummary();
    showCheckoutStatus('');
    loadCheckoutMethods();
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
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedMethod) return;

      const data = new FormData(checkoutForm);
      const customer = {
        name: data.get('name') || '',
        email: data.get('email') || '',
        address: data.get('address') || '',
        notes: data.get('notes') || '',
      };
      const items = loadCart().map(({ productId, fieldId, material, qty, acceptedSurchargeFieldIds }) => ({
        productId, fieldId, material, qty, acceptedSurchargeFieldIds: acceptedSurchargeFieldIds || [],
      }));

      checkoutSubmitBtn.disabled = true;
      showCheckoutStatus('');

      try {
        const res = await fetch('/api/checkout/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer, method: selectedMethod, lang: currentLang(), items }),
        });
        const body = await res.json();
        if (!res.ok || !body.checkoutUrl) throw new Error(body.error || 'onbekende fout');
        window.location.href = body.checkoutUrl;
      } catch (err) {
        console.error('AstroRaf: betaling starten mislukt', err);
        showCheckoutStatus(t('checkout_order_failed'));
        checkoutSubmitBtn.disabled = false;
      }
    });
  }

  async function handleOrderReturn() {
    const orderId = new URLSearchParams(window.location.search).get('order');
    if (!orderId || !shopOrderStatus) return;

    shopOrderStatus.hidden = false;
    shopOrderStatus.textContent = t('checkout_order_confirming');

    const deadline = Date.now() + 15000;
    for (;;) {
      let status;
      try {
        const res = await fetch(`/api/checkout/order-status?order=${encodeURIComponent(orderId)}`);
        const body = await res.json();
        status = body.status;
      } catch (e) {
        console.error('AstroRaf: bestelstatus opvragen mislukt', e);
        break;
      }

      if (status === 'paid') {
        saveCart([]);
        renderCart();
        shopOrderStatus.textContent = t('checkout_order_success');
        history.replaceState(null, '', window.location.pathname);
        return;
      }
      if (status === 'failed' || status === 'canceled' || status === 'expired') {
        shopOrderStatus.hidden = true;
        history.replaceState(null, '', window.location.pathname);
        openCheckoutModal();
        showCheckoutStatus(t('checkout_order_failed'));
        return;
      }
      if (Date.now() > deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    shopOrderStatus.textContent = t('checkout_order_confirming');
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
  handleOrderReturn();
});
