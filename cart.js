const materialNames = {
  nl: { mat: 'Mat', glans: 'Glans' },
  en: { mat: 'Matte', glans: 'Glossy' },
  fr: { mat: 'Mat', glans: 'Brillant' },
  de: { mat: 'Matt', glans: 'Glänzend' },
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
  const posterPreviewImg = document.getElementById('posterPreviewImg');
  const materialBtns = document.querySelectorAll('.material-btn');
  const posterQtyInput = document.getElementById('posterQtyInput');
  const posterQtyDecrease = document.getElementById('posterQtyDecrease');
  const posterQtyIncrease = document.getElementById('posterQtyIncrease');
  const posterAddToCart = document.getElementById('posterAddToCart');

  let selectedKey = 'corona';
  let selectedImage = "foto's/Eclips_Corona.jpg";
  let selectedMaterial = 'mat';

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
  const checkoutNotes = document.querySelectorAll('.checkout-note');

  function currentLang() {
    return localStorage.getItem('astroraf-lang') || 'nl';
  }

  function materialLabel(material) {
    const dict = materialNames[currentLang()] || materialNames.nl;
    return dict[material] || material;
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
    checkoutNotes.forEach((note) => { note.hidden = true; });

    cart.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <img src="${item.image}" alt="">
        <div>
          <div class="cart-item-material">${materialLabel(item.material)}</div>
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

  function addToCart(id, key, material, image, qty) {
    const cart = loadCart();
    const existing = cart.find((item) => item.id === id);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ id, key, material, image, qty });
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

      addToCart(`poster-${selectedKey}-${selectedMaterial}`, selectedKey, selectedMaterial, selectedImage, qty);

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

  checkoutBtns.forEach((btn) => {
    const note = btn.nextElementSibling;
    if (!note || !note.classList.contains('checkout-note')) return;
    btn.addEventListener('click', () => {
      note.hidden = false;
    });
  });

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
