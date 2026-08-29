const posterNames = {
  nl: { start: 'Start', corona: 'Corona', einde: 'Einde' },
  en: { start: 'Start', corona: 'Corona', einde: 'End' },
  fr: { start: 'Début', corona: 'Corona', einde: 'Fin' },
  de: { start: 'Start', corona: 'Corona', einde: 'Ende' },
};

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

document.addEventListener('DOMContentLoaded', () => {
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

  /* ---------- Poster quantity steppers ---------- */
  document.querySelectorAll('.poster-card').forEach((card) => {
    const input = card.querySelector('.qty-input');
    const decrease = card.querySelector('[data-qty-decrease]');
    const increase = card.querySelector('[data-qty-increase]');
    if (!input) return;

    decrease.addEventListener('click', () => {
      input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
    });

    increase.addEventListener('click', () => {
      input.value = (parseInt(input.value, 10) || 1) + 1;
    });
  });

  /* ---------- Cart ---------- */
  const cartToggle = document.getElementById('cartToggle');
  const cartPanel = document.getElementById('cartPanel');
  const cartItems = document.getElementById('cartItems');
  const cartEmpty = document.getElementById('cartEmpty');
  const cartCount = document.getElementById('cartCount');

  function currentLang() {
    return localStorage.getItem('astroraf-lang') || 'nl';
  }

  function posterName(key) {
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

    cart.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <img src="${item.image}" alt="">
        <div>
          <div class="cart-item-name">${posterName(item.key)}</div>
          <div class="cart-item-qty">
            <button type="button" data-cart-decrease aria-label="-">&minus;</button>
            <span>${item.qty}</span>
            <button type="button" data-cart-increase aria-label="+">&plus;</button>
          </div>
        </div>
      `;

      row.querySelector('[data-cart-decrease]').addEventListener('click', () => {
        changeQty(item.id, -1);
      });
      row.querySelector('[data-cart-increase]').addEventListener('click', () => {
        changeQty(item.id, 1);
      });

      cartItems.appendChild(row);
    });
  }

  function addToCart(id, key, image, qty) {
    const cart = loadCart();
    const existing = cart.find((item) => item.id === id);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ id, key, image, qty });
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

  if (cartToggle && cartPanel) {
    cartToggle.addEventListener('click', () => {
      const willOpen = cartPanel.hidden;
      cartPanel.hidden = !willOpen;
      cartToggle.classList.toggle('active', willOpen);
      cartToggle.setAttribute('aria-expanded', String(willOpen));
    });

    document.addEventListener('click', (e) => {
      if (!cartPanel.hidden && !cartPanel.contains(e.target) && !cartToggle.contains(e.target)) {
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

  document.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.poster-card');
      const qtyInput = card ? card.querySelector('.qty-input') : null;
      const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
      const key = btn.getAttribute('data-poster-key');
      const image = btn.getAttribute('data-image');

      addToCart(`poster-${key}`, key, image, qty);

      if (qtyInput) qtyInput.value = 1;

      const originalText = btn.textContent;
      btn.classList.add('is-added');
      btn.textContent = '✓';
      setTimeout(() => {
        btn.classList.remove('is-added');
        btn.textContent = originalText;
      }, 1200);
    });
  });

  document.addEventListener('astroraf-lang-changed', renderCart);

  renderCart();
});
