// shop.html laadt, anders dan fotos.html (likes.js), geen enkel script dat
// een globale supabaseClient aanmaakt -- dus hier zelf aanmaken.
const supabaseClient = supabase.createClient(
  'https://fqjlfonsdazjwgwchvko.supabase.co',
  'sb_publishable_wBNO6y-u6E3ZV3_UOb1LMg_KnPPTdax'
);

window.astrorafShopReady = (async () => {
  const shopSections = document.getElementById('shopSections');
  const shopEmpty = document.getElementById('shopEmpty');
  const shopDetail = document.getElementById('shopDetail');
  if (!shopSections || !shopDetail) return;

  const STORAGE_BUCKET = 'album-photos';
  // Een rubriek met minder dan dit aantal producten krijgt geen eigen
  // sectie, maar wordt samen met andere "eenzame" producten getoond in de
  // gedeelde Specials-sectie (zie PENDING_CHANGES.md voor de achtergrond).
  const MIN_PRODUCTS_FOR_OWN_SECTION = 2;

  // Enkel gebruikt om de live postervoorbeeld-doos te schalen per formaat
  // (formatSizes/formatLabel zelf komen uit cart.js, geladen vóór dit bestand).
  const formatDimensions = {
    a4: [21, 29.7], a3: [29.7, 42], '40x60': [40, 60], a2: [42, 59.4],
    'a2-lang': [29.7, 84], b2: [50, 70], '60x80': [60, 80], a1: [59.4, 84],
    '60x90': [60, 90], b1: [70, 100], a0: [84, 118.8], b0: [100, 140], abri: [118.5, 175],
  };
  const PREVIEW_MAX_WIDTH = 370;
  const PREVIEW_MIN_WIDTH = 165;
  const PREVIEW_MIN_LONG_SIDE = 285;
  const PREVIEW_MAX_LONG_SIDE = 480;
  const PREVIEW_CM_MIN = Math.sqrt(Math.min(...Object.values(formatDimensions).map((d) => Math.max(d[0], d[1]))));
  const PREVIEW_CM_MAX = Math.sqrt(Math.max(...Object.values(formatDimensions).map((d) => Math.max(d[0], d[1]))));

  let categories = [];
  let productsByCategory = {};
  let currentProduct = null;
  let currentCategory = null;
  let currentImages = [];
  let currentImageIndex = 0;
  const langRefs = [];

  function currentLang() {
    return localStorage.getItem('astroraf-lang') || 'nl';
  }

  function t(key) {
    const dict = (typeof translations !== 'undefined' && translations[currentLang()]) || {};
    return dict[key] || '';
  }

  function categoryName(category) {
    return category['name_' + currentLang()] || category.name_nl;
  }

  function productTitle(product, category) {
    return product['title_' + currentLang()] || product.title_nl || categoryName(category);
  }

  function productDescription(product) {
    return product['description_' + currentLang()] || product.description_nl || '';
  }

  function mockupUrl(storagePath) {
    const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  function productImageUrls(product) {
    return (product.shop_product_images || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => mockupUrl(img.storage_path));
  }

  function registerLangRef(el, attr, compute) {
    langRefs.push({ el, attr, compute });
    el[attr === 'text' ? 'textContent' : attr] = compute();
  }

  function applyLanguage() {
    langRefs.forEach((ref) => {
      const value = ref.compute();
      if (ref.attr === 'text') ref.el.textContent = value;
      else ref.el[ref.attr] = value;
    });
    refreshDetailLanguage();
  }

  async function loadData() {
    const { data: catRows, error: catError } = await supabaseClient
      .from('shop_categories')
      .select('id,slug,name_nl,name_en,name_fr,name_de,sort_order')
      .order('sort_order', { ascending: true });
    if (catError) throw catError;
    categories = catRows || [];

    productsByCategory = {};
    if (!categories.length) return;

    const { data: prodRows, error: prodError } = await supabaseClient
      .from('shop_products')
      .select('id,category_id,album_photo_id,sort_order,title_nl,title_en,title_fr,title_de,description_nl,description_en,description_fr,description_de,shop_product_images(storage_path,sort_order)')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (prodError) throw prodError;

    (prodRows || []).forEach((product) => {
      if (!productsByCategory[product.category_id]) productsByCategory[product.category_id] = [];
      productsByCategory[product.category_id].push(product);
    });
  }

  function buildProductTile(product, category, categoryTag) {
    const images = productImageUrls(product);
    if (!images.length) return null;

    const item = document.createElement('div');
    item.className = 'photo-grid-item';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shop-product-cover photo-open';

    const img = document.createElement('img');
    img.src = images[0];
    registerLangRef(img, 'alt', () => productTitle(product, category));
    btn.appendChild(img);

    if (images.length > 1) {
      btn.addEventListener('mouseenter', () => { img.src = images[1]; });
      btn.addEventListener('mouseleave', () => { img.src = images[0]; });
    }
    btn.addEventListener('click', () => openProductDetail(product, category, images));

    const label = document.createElement('span');
    label.className = 'shop-product-label';
    registerLangRef(label, 'text', () => productTitle(product, category));

    item.appendChild(btn);
    item.appendChild(label);

    if (categoryTag) {
      const tag = document.createElement('span');
      tag.className = 'shop-product-category-tag';
      registerLangRef(tag, 'text', () => categoryName(category));
      item.appendChild(tag);
    }

    return item;
  }

  function buildSection(titleCompute, products, categoryTag) {
    const section = document.createElement('div');
    section.className = 'shop-section';

    const title = document.createElement('h2');
    title.className = 'section-title';
    registerLangRef(title, 'text', titleCompute);
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'shop-grid';
    products.forEach(({ product, category }) => {
      const tile = buildProductTile(product, category, categoryTag);
      if (tile) grid.appendChild(tile);
    });
    section.appendChild(grid);

    shopSections.appendChild(section);
  }

  function buildAll() {
    shopSections.innerHTML = '';
    const specials = [];
    let anyProducts = false;

    categories.forEach((category) => {
      const products = productsByCategory[category.id] || [];
      if (!products.length) return;
      anyProducts = true;

      if (products.length >= MIN_PRODUCTS_FOR_OWN_SECTION) {
        buildSection(() => categoryName(category), products.map((product) => ({ product, category })), false);
      } else {
        products.forEach((product) => specials.push({ product, category }));
      }
    });

    if (specials.length) {
      buildSection(() => t('shop_specials_title'), specials, true);
    }

    if (shopEmpty) shopEmpty.hidden = anyProducts;
  }

  // ---------- Product detail ----------

  const shopDetailTitle = document.getElementById('shopDetailTitle');
  const shopDetailImg = document.getElementById('shopDetailImg');
  const shopPreviewBox = document.getElementById('shopPreviewBox');
  const shopFormatGroup = document.getElementById('shopFormatGroup');
  const shopMaterialGroup = document.getElementById('shopMaterialGroup');
  const shopNotesGroup = document.getElementById('shopNotesGroup');
  const shopFormatSelect = document.getElementById('shopFormatSelect');
  const shopFormatDims = document.getElementById('shopFormatDims');
  const shopMaterialBtns = document.querySelectorAll('.shop-material-btn');
  const shopQtyInput = document.getElementById('shopQtyInput');
  const shopQtyDecrease = document.getElementById('shopQtyDecrease');
  const shopQtyIncrease = document.getElementById('shopQtyIncrease');
  const shopAddToCart = document.getElementById('shopAddToCart');
  const shopProductDescription = document.getElementById('shopProductDescription');
  const shopProductDescriptionText = document.getElementById('shopProductDescriptionText');
  const shopDetailBack = document.getElementById('shopDetailBack');
  const shopDetailPrev = document.getElementById('shopDetailPrev');
  const shopDetailNext = document.getElementById('shopDetailNext');

  let selectedFormat = shopFormatSelect ? shopFormatSelect.value : 'a3';
  let selectedMaterial = 'mat';

  function isPostersCategory(category) {
    return Boolean(category) && category.slug === 'posters';
  }

  function applyPreviewFormat(format) {
    if (shopFormatDims) shopFormatDims.textContent = formatSizes[format] || '';
    if (!shopPreviewBox) return;
    const dims = formatDimensions[format];
    if (!dims) return;
    // Lange zijde schaalt zacht (vierkantswortel) tussen het kleinste en
    // grootste formaat, zodat grotere posters groter aanvoelen zonder dat
    // de kleinste bijna onzichtbaar worden.
    const long = Math.max(dims[0], dims[1]);
    const norm = (Math.sqrt(long) - PREVIEW_CM_MIN) / (PREVIEW_CM_MAX - PREVIEW_CM_MIN);
    const targetLong = PREVIEW_MIN_LONG_SIDE + norm * (PREVIEW_MAX_LONG_SIDE - PREVIEW_MIN_LONG_SIDE);
    const scale = targetLong / long;
    const w = Math.min(PREVIEW_MAX_WIDTH, Math.max(PREVIEW_MIN_WIDTH, Math.round(dims[0] * scale)));
    const h = Math.min(PREVIEW_MAX_LONG_SIDE, Math.round(dims[1] * scale));
    shopPreviewBox.style.width = w + 'px';
    shopPreviewBox.style.height = h + 'px';
  }

  function refreshDetailLanguage() {
    if (!currentProduct || !currentCategory) return;
    const label = productTitle(currentProduct, currentCategory);
    if (shopDetailTitle) shopDetailTitle.textContent = label;
    if (shopDetailImg) shopDetailImg.alt = label;
    const description = productDescription(currentProduct);
    if (shopProductDescription) shopProductDescription.hidden = !description;
    if (shopProductDescriptionText) shopProductDescriptionText.textContent = description;
  }

  // Past de voorbeeld-doos aan op de natuurlijke afmetingen van de huidige
  // foto, zodat een liggende of staande mockup-foto ook zo getoond wordt
  // (enkel voor niet-posters -- posters blijven schalen op het gekozen
  // formaat, zie applyPreviewFormat).
  function sizePreviewToImage() {
    if (!shopPreviewBox || !shopDetailImg) return;
    const apply = () => {
      const nw = shopDetailImg.naturalWidth || 1;
      const nh = shopDetailImg.naturalHeight || 1;
      const scale = Math.min(PREVIEW_MAX_WIDTH / nw, PREVIEW_MAX_LONG_SIDE / nh);
      shopPreviewBox.style.width = Math.round(nw * scale) + 'px';
      shopPreviewBox.style.height = Math.round(nh * scale) + 'px';
    };
    if (shopDetailImg.complete && shopDetailImg.naturalWidth) apply();
    else shopDetailImg.addEventListener('load', apply, { once: true });
  }

  function renderCurrentImage() {
    if (!currentImages.length || !shopDetailImg) return;
    shopDetailImg.src = currentImages[currentImageIndex];

    const showNav = currentImages.length > 1;
    if (shopDetailPrev) shopDetailPrev.hidden = !showNav;
    if (shopDetailNext) shopDetailNext.hidden = !showNav;

    if (!isPostersCategory(currentCategory)) sizePreviewToImage();
  }

  function showImageAtIndex(index) {
    if (!currentImages.length) return;
    currentImageIndex = (index + currentImages.length) % currentImages.length;
    renderCurrentImage();
  }

  function openProductDetail(product, category, images) {
    currentProduct = product;
    currentCategory = category;
    currentImages = images;
    currentImageIndex = 0;

    refreshDetailLanguage();
    renderCurrentImage();

    const isPosters = isPostersCategory(category);
    if (shopFormatGroup) shopFormatGroup.hidden = !isPosters;
    if (shopMaterialGroup) shopMaterialGroup.hidden = !isPosters;
    if (shopNotesGroup) shopNotesGroup.hidden = !isPosters;
    if (isPosters) applyPreviewFormat(selectedFormat);

    shopSections.hidden = true;
    if (shopEmpty) shopEmpty.hidden = true;
    shopDetail.hidden = false;
  }

  function closeProductDetail() {
    currentProduct = null;
    currentCategory = null;
    currentImages = [];
    currentImageIndex = 0;
    shopDetail.hidden = true;
    shopSections.hidden = false;
    if (shopEmpty) shopEmpty.hidden = shopSections.children.length > 0;
  }

  if (shopDetailBack) shopDetailBack.addEventListener('click', closeProductDetail);
  if (shopDetailPrev) shopDetailPrev.addEventListener('click', () => showImageAtIndex(currentImageIndex - 1));
  if (shopDetailNext) shopDetailNext.addEventListener('click', () => showImageAtIndex(currentImageIndex + 1));

  document.addEventListener('keydown', (e) => {
    if (shopDetail.hidden) return;
    if (e.key === 'ArrowRight') showImageAtIndex(currentImageIndex + 1);
    if (e.key === 'ArrowLeft') showImageAtIndex(currentImageIndex - 1);
  });

  if (shopFormatSelect) {
    shopFormatSelect.addEventListener('change', () => {
      selectedFormat = shopFormatSelect.value;
      applyPreviewFormat(selectedFormat);
    });
  }

  shopMaterialBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      shopMaterialBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedMaterial = btn.getAttribute('data-material');
    });
  });

  if (shopQtyDecrease && shopQtyInput) {
    shopQtyDecrease.addEventListener('click', () => {
      shopQtyInput.value = Math.max(1, (parseInt(shopQtyInput.value, 10) || 1) - 1);
    });
  }
  if (shopQtyIncrease && shopQtyInput) {
    shopQtyIncrease.addEventListener('click', () => {
      shopQtyInput.value = (parseInt(shopQtyInput.value, 10) || 1) + 1;
    });
  }

  if (shopAddToCart) {
    shopAddToCart.addEventListener('click', () => {
      if (!currentProduct || !currentCategory || !window.astrorafCart) return;
      const qty = shopQtyInput ? Math.max(1, parseInt(shopQtyInput.value, 10) || 1) : 1;
      const isPosters = currentCategory.slug === 'posters';
      const format = isPosters ? selectedFormat : null;
      const material = isPosters ? selectedMaterial : null;

      window.astrorafCart.add({
        id: ['product', currentProduct.id, format, material].filter(Boolean).join('-'),
        label: productTitle(currentProduct, currentCategory),
        categoryLabel: categoryName(currentCategory),
        image: currentImages[0] || '',
        format,
        material,
        qty,
      });

      if (shopQtyInput) shopQtyInput.value = 1;

      const originalText = shopAddToCart.textContent;
      shopAddToCart.classList.add('is-added');
      shopAddToCart.textContent = '✓';
      setTimeout(() => {
        shopAddToCart.classList.remove('is-added');
        shopAddToCart.textContent = originalText;
      }, 1200);
    });
  }

  try {
    await loadData();
    buildAll();
  } catch (e) {
    console.error('AstroRaf: failed to load shop data', e);
  }

  document.addEventListener('astroraf-lang-changed', applyLanguage);
})();
