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
  const MAX_DIMENSION = 2000;
  const JPEG_QUALITY = 0.82;
  // Een rubriek met minder dan dit aantal producten krijgt geen eigen
  // sectie, maar wordt samen met andere "eenzame" producten getoond in de
  // gedeelde Specials-sectie (zie PENDING_CHANGES.md voor de achtergrond).
  const MIN_PRODUCTS_FOR_OWN_SECTION = 2;

  // Voorbeeld-doos schaalt altijd op de natuurlijke afmetingen van de foto
  // (zie sizePreviewToImage) -- geen apart per-formaat schaalsysteem meer
  // nodig nu elk prijsveld zijn eigen rij met aantal krijgt i.p.v. één keuze.
  const PREVIEW_MAX_WIDTH = 370;
  const PREVIEW_MAX_LONG_SIDE = 480;

  let categories = [];
  let productsByCategory = {};
  let currentProduct = null;
  let currentCategory = null;
  let currentImages = [];
  let currentImageIndex = 0;
  let categoryFieldsById = {};
  let isEditor = false;
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

  function formatEuro(cents) {
    return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
  }

  // Prijsvelden in de admin-UI laten de editor een normaal euro-bedrag met
  // 2 decimalen intikken (komma of punt, beide toegestaan) i.p.v. zelf te
  // moeten rekenen in centen -- hier wordt dat omgezet naar/van centen.
  function eurosToCents(value) {
    const parsed = parseFloat(String(value).trim().replace(',', '.'));
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
  }

  function centsToEuroInputValue(cents) {
    return ((cents || 0) / 100).toFixed(2).replace('.', ',');
  }

  function categoryVariantFields(category) {
    return category ? (categoryFieldsById[category.id] || []).filter((f) => f.field_type === 'variant') : [];
  }

  function categorySurchargeFields(category) {
    return category ? (categoryFieldsById[category.id] || []).filter((f) => f.field_type === 'surcharge') : [];
  }

  // Enkel velden waarvoor dit artikel al een eigen prijsrij heeft -- een
  // rubriekveld dat de editor nog niet voor dit specifieke artikel heeft
  // ingevuld telt nergens mee als "€0", anders toont de winkel een
  // misleidende nulprijs voor iets dat gewoon nog niet ingesteld is.
  function configuredFieldPrices(product, category) {
    const fields = categoryVariantFields(category);
    return fields
      .map((field) => ({ field, row: (product.shop_product_field_prices || []).find((r) => r.field_id === field.id) }))
      .filter(({ row }) => row);
  }

  function tilePriceLabel(product, category) {
    const configured = configuredFieldPrices(product, category);
    if (categoryVariantFields(category).length) {
      if (!configured.length) return '';
      const cheapest = Math.min(...configured.map(({ row }) => row.price_cents));
      return `${t('shop_price_from')} ${formatEuro(cheapest)}`;
    }
    return formatEuro(product.price_cents ?? 0);
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
    categoryFieldsById = {};
    if (!categories.length) return;

    const [{ data: prodRows, error: prodError }, { data: fieldRows, error: fieldError }] = await Promise.all([
      supabaseClient
        .from('shop_products')
        .select(
          'id,category_id,album_photo_id,sort_order,title_nl,title_en,title_fr,title_de,' +
          'description_nl,description_en,description_fr,description_de,price_cents,product_number,active,' +
          'shop_product_images(storage_path,sort_order),shop_product_field_prices(field_id,price_cents)'
        )
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      supabaseClient
        .from('shop_category_fields')
        .select('id,category_id,field_type,label,price_cents,mandatory,sort_order')
        .order('sort_order', { ascending: true }),
    ]);
    if (prodError) throw prodError;
    if (fieldError) throw fieldError;

    (prodRows || []).forEach((product) => {
      if (!productsByCategory[product.category_id]) productsByCategory[product.category_id] = [];
      productsByCategory[product.category_id].push(product);
    });

    (fieldRows || []).forEach((field) => {
      if (!categoryFieldsById[field.category_id]) categoryFieldsById[field.category_id] = [];
      categoryFieldsById[field.category_id].push(field);
    });
  }

  async function checkIsEditor() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session || session.user.is_anonymous || !session.user.email) return false;
      const { data, error } = await supabaseClient.rpc('is_editor');
      if (error) throw error;
      return Boolean(data);
    } catch (e) {
      console.error('AstroRaf: is_editor check failed', e);
      return false;
    }
  }

  // ---------- Kleine helpers, hergebruikt (niet gedeeld -- elk bestand
  // in dit project herhaalt zijn eigen kopie, zie dynamic-albums.js) ----------

  function buildModal(titleText) {
    const modal = document.createElement('div');
    modal.className = 'modal';

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const panel = document.createElement('div');
    panel.className = 'modal-panel';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';

    const heading = document.createElement('h2');
    heading.className = 'section-title';
    heading.textContent = titleText;

    panel.appendChild(closeBtn);
    panel.appendChild(heading);
    modal.appendChild(backdrop);
    modal.appendChild(panel);

    function close() { modal.remove(); }
    backdrop.addEventListener('click', close);
    closeBtn.addEventListener('click', close);

    document.body.appendChild(modal);
    return { panel, close };
  }

  function slugify(name) {
    const base = (name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Mark}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base || 'artikel'}-${suffix}`;
  }

  async function compressImage(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);

    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });
  }

  function makeIconButton(extraClass, svgContent, label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `icon-btn ${extraClass}`;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = svgContent;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function trashSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.8 12.1a2 2 0 0 1-2 1.9H9.8a2 2 0 0 1-2-1.9L7 7"/></svg>';
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

    const price = document.createElement('span');
    price.className = 'shop-product-price';
    registerLangRef(price, 'text', () => tilePriceLabel(product, category));

    item.appendChild(btn);
    item.appendChild(label);
    item.appendChild(price);

    if (isEditor) {
      const number = document.createElement('span');
      number.className = 'shop-product-number';
      number.textContent = `#${product.product_number}`;
      item.appendChild(number);
    }

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
  const shopMaterialGroup = document.getElementById('shopMaterialGroup');
  const shopNotesGroup = document.getElementById('shopNotesGroup');
  const shopMaterialBtns = document.querySelectorAll('.shop-material-btn');
  const shopVariantRows = document.getElementById('shopVariantRows');
  const shopSurcharges = document.getElementById('shopSurcharges');
  const shopDetailTotal = document.getElementById('shopDetailTotal');
  const shopAddToCart = document.getElementById('shopAddToCart');
  const shopDetailProductNumber = document.getElementById('shopDetailProductNumber');
  const shopDetailEditBtn = document.getElementById('shopDetailEditBtn');
  const shopAdminTiles = document.getElementById('shopAdminTiles');
  const shopProductDescription = document.getElementById('shopProductDescription');
  const shopProductDescriptionText = document.getElementById('shopProductDescriptionText');
  const shopDetailBack = document.getElementById('shopDetailBack');
  const shopDetailPrev = document.getElementById('shopDetailPrev');
  const shopDetailNext = document.getElementById('shopDetailNext');

  let selectedMaterial = 'mat';
  let currentVariantRows = [];
  let currentSurchargeRows = [];

  function isPostersCategory(category) {
    return Boolean(category) && category.slug === 'posters';
  }

  function refreshDetailLanguage() {
    if (!currentProduct || !currentCategory) return;
    const label = productTitle(currentProduct, currentCategory);
    if (shopDetailTitle) shopDetailTitle.textContent = label;
    if (shopDetailImg) shopDetailImg.alt = label;
    const description = productDescription(currentProduct);
    if (shopProductDescription) shopProductDescription.hidden = !description;
    if (shopProductDescriptionText) shopProductDescriptionText.textContent = description;

    if (shopDetailProductNumber) {
      shopDetailProductNumber.hidden = !isEditor;
      shopDetailProductNumber.textContent = isEditor ? `#${currentProduct.product_number}` : '';
    }
    if (shopDetailEditBtn) shopDetailEditBtn.hidden = !isEditor;
  }

  // Elk prijsveld van de rubriek (of, zonder prijsvelden, het artikel zelf)
  // krijgt zijn eigen rij met een losse aantal-kiezer, zodat je in één keer
  // meerdere maten/varianten tegelijk kan bestellen en meteen ziet hoe de
  // totaalprijs evolueert -- i.p.v. één gecombineerde keuzelijst.
  function buildVariantRows(product, category) {
    if (!shopVariantRows) return [];
    shopVariantRows.innerHTML = '';
    const configured = configuredFieldPrices(product, category);
    const rowDefs = configured.length
      ? configured.map(({ field, row }) => ({ field, unitCents: row.price_cents }))
      : [{ field: null, unitCents: product.price_cents ?? 0 }];

    return rowDefs.map(({ field, unitCents }) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'shop-variant-row';

      const label = document.createElement('span');
      label.className = 'shop-variant-row-label';
      label.textContent = field ? `${field.label} — ${formatEuro(unitCents)}` : formatEuro(unitCents);
      rowEl.appendChild(label);

      const stepper = document.createElement('div');
      stepper.className = 'qty-stepper';
      const decBtn = document.createElement('button');
      decBtn.type = 'button';
      decBtn.className = 'qty-btn';
      decBtn.setAttribute('aria-label', '-');
      decBtn.textContent = '−';
      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.className = 'qty-input';
      qtyInput.min = 0;
      qtyInput.value = 0;
      qtyInput.inputMode = 'numeric';
      const incBtn = document.createElement('button');
      incBtn.type = 'button';
      incBtn.className = 'qty-btn';
      incBtn.setAttribute('aria-label', '+');
      incBtn.textContent = '+';
      stepper.append(decBtn, qtyInput, incBtn);
      rowEl.appendChild(stepper);

      const rowTotal = document.createElement('span');
      rowTotal.className = 'shop-variant-row-total';
      rowEl.appendChild(rowTotal);

      function currentQty() {
        return Math.max(0, parseInt(qtyInput.value, 10) || 0);
      }

      function refreshRow() {
        const qty = currentQty();
        qtyInput.value = qty;
        rowTotal.textContent = qty > 0 ? `= ${formatEuro(unitCents * qty)}` : '';
        updateDetailTotal();
      }

      decBtn.addEventListener('click', () => { qtyInput.value = Math.max(0, currentQty() - 1); refreshRow(); });
      incBtn.addEventListener('click', () => { qtyInput.value = currentQty() + 1; refreshRow(); });
      qtyInput.addEventListener('input', refreshRow);

      shopVariantRows.appendChild(rowEl);
      return { field, unitCents, qtyInput, currentQty, refreshRow };
    });
  }

  // Vaste kosten (bv. Verzendkosten) van de rubriek -- apart getoond met een
  // subtiele lijn, want dit is geen keuze per artikel maar komt één keer
  // bovenop de bestelling zodra je effectief iets selecteert.
  function buildSurchargeRows(category) {
    currentSurchargeRows = [];
    if (!shopSurcharges) return;
    shopSurcharges.innerHTML = '';
    const fields = categorySurchargeFields(category);
    shopSurcharges.hidden = fields.length === 0;

    currentSurchargeRows = fields.map((field) => {
      const row = document.createElement('div');
      row.className = 'shop-surcharge-row';

      const labelWrap = document.createElement('label');
      labelWrap.className = 'shop-surcharge-label';

      let checkbox = null;
      if (!field.mandatory) {
        checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.addEventListener('change', updateDetailTotal);
        labelWrap.appendChild(checkbox);
      }

      const text = document.createElement('span');
      text.textContent = field.mandatory ? field.label : `${field.label} (optioneel)`;
      labelWrap.appendChild(text);

      const price = document.createElement('span');
      price.className = 'shop-surcharge-price';
      price.textContent = formatEuro(field.price_cents);

      row.append(labelWrap, price);
      shopSurcharges.appendChild(row);
      return { field, checkbox };
    });
  }

  function acceptedSurchargeCents() {
    return currentSurchargeRows.reduce((sum, r) => {
      const accepted = r.field.mandatory || (r.checkbox ? r.checkbox.checked : true);
      return sum + (accepted ? r.field.price_cents : 0);
    }, 0);
  }

  function acceptedSurchargeFieldIds() {
    return currentSurchargeRows
      .filter((r) => !r.field.mandatory && r.checkbox && r.checkbox.checked)
      .map((r) => r.field.id);
  }

  function updateDetailTotal() {
    const subtotal = currentVariantRows.reduce((sum, row) => sum + row.unitCents * row.currentQty(), 0);
    const total = subtotal > 0 ? subtotal + acceptedSurchargeCents() : 0;
    if (shopDetailTotal) {
      shopDetailTotal.textContent = total > 0 ? `${t('checkout_summary_total')}: ${formatEuro(total)}` : '';
    }
    if (shopAddToCart) shopAddToCart.disabled = total <= 0;
  }

  // Past de voorbeeld-doos aan op de natuurlijke afmetingen van de foto,
  // zodat een liggende of staande mockup-foto ook zo getoond wordt.
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

    sizePreviewToImage();
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

    currentVariantRows = buildVariantRows(product, category);
    buildSurchargeRows(category);
    updateDetailTotal();

    const isPosters = isPostersCategory(category);
    if (shopMaterialGroup) shopMaterialGroup.hidden = !isPosters;
    if (shopNotesGroup) shopNotesGroup.hidden = !isPosters;

    shopSections.hidden = true;
    if (shopEmpty) shopEmpty.hidden = true;
    shopDetail.hidden = false;
  }

  function closeProductDetail() {
    currentProduct = null;
    currentCategory = null;
    currentImages = [];
    currentImageIndex = 0;
    currentVariantRows = [];
    currentSurchargeRows = [];
    shopDetail.hidden = true;
    shopSections.hidden = false;
    if (shopEmpty) shopEmpty.hidden = shopSections.children.length > 0;
  }

  if (shopDetailBack) shopDetailBack.addEventListener('click', closeProductDetail);
  if (shopDetailEditBtn) {
    shopDetailEditBtn.addEventListener('click', () => {
      if (currentProduct && currentCategory) openShopProductModal(currentProduct, currentCategory);
    });
  }
  if (shopDetailPrev) shopDetailPrev.addEventListener('click', () => showImageAtIndex(currentImageIndex - 1));
  if (shopDetailNext) shopDetailNext.addEventListener('click', () => showImageAtIndex(currentImageIndex + 1));

  document.addEventListener('keydown', (e) => {
    if (shopDetail.hidden) return;
    if (e.key === 'ArrowRight') showImageAtIndex(currentImageIndex + 1);
    if (e.key === 'ArrowLeft') showImageAtIndex(currentImageIndex - 1);
  });

  shopMaterialBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      shopMaterialBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedMaterial = btn.getAttribute('data-material');
    });
  });

  if (shopAddToCart) {
    shopAddToCart.addEventListener('click', () => {
      if (!currentProduct || !currentCategory || !window.astrorafCart) return;
      const isPosters = isPostersCategory(currentCategory);
      const material = isPosters ? selectedMaterial : null;
      const rowsToAdd = currentVariantRows.filter((row) => row.currentQty() > 0);
      if (!rowsToAdd.length) return;

      const acceptedSurcharges = acceptedSurchargeFieldIds();

      rowsToAdd.forEach((row) => {
        window.astrorafCart.add({
          id: ['product', currentProduct.id, row.field ? row.field.id : null, material].filter(Boolean).join('-'),
          productId: currentProduct.id,
          categoryId: currentCategory.id,
          label: productTitle(currentProduct, currentCategory),
          categoryLabel: categoryName(currentCategory),
          image: currentImages[0] || '',
          fieldId: row.field ? row.field.id : null,
          fieldLabel: row.field ? row.field.label : null,
          material,
          qty: row.currentQty(),
          unitPriceCents: row.unitCents,
          acceptedSurchargeFieldIds: acceptedSurcharges,
        });
        row.qtyInput.value = 0;
        row.refreshRow();
      });

      const originalText = shopAddToCart.textContent;
      shopAddToCart.classList.add('is-added');
      shopAddToCart.textContent = '✓';
      setTimeout(() => {
        shopAddToCart.classList.remove('is-added');
        shopAddToCart.textContent = originalText;
      }, 1200);
    });
  }

  // ---------- Admin: artikelen/rubrieken/instellingen (enkel editors) ----------

  async function removeShopProductImage(image, refreshFn) {
    if (!window.confirm('Deze foto verwijderen?')) return;
    try {
      await supabaseClient.storage.from(STORAGE_BUCKET).remove([image.storage_path]);
      const { error } = await supabaseClient.from('shop_product_images').delete().eq('id', image.id);
      if (error) throw error;
      refreshFn();
    } catch (err) {
      console.error('AstroRaf: artikel-foto verwijderen mislukt', err);
      window.alert(`Mislukt: ${err.message || err}`);
    }
  }

  async function deleteShopProduct(product) {
    if (!window.confirm('Dit artikel volledig verwijderen? Dit kan niet ongedaan gemaakt worden.')) return;
    try {
      const { data: images } = await supabaseClient
        .from('shop_product_images')
        .select('storage_path')
        .eq('product_id', product.id);
      const paths = (images || []).map((img) => img.storage_path);
      if (paths.length) await supabaseClient.storage.from(STORAGE_BUCKET).remove(paths);

      const { error } = await supabaseClient.from('shop_products').delete().eq('id', product.id);
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      console.error('AstroRaf: artikel verwijderen mislukt', err);
      window.alert(`Mislukt: ${err.message || err}`);
    }
  }

  function openShopProductModal(product, category) {
    const isEdit = Boolean(product);
    const { panel } = buildModal(isEdit ? 'Artikel bewerken' : 'Nieuw artikel');

    if (isEdit) {
      const numberLine = document.createElement('p');
      numberLine.className = 'admin-status';
      numberLine.innerHTML = `Artikelnummer: <strong>#${product.product_number}</strong> — gebruik dit nummer om foto's te koppelen op de albumpagina.`;
      panel.appendChild(numberLine);
    }

    const form = document.createElement('form');
    form.className = 'checkout-form';

    // Rubriek kiezen/aanmaken
    const categoryField = document.createElement('label');
    categoryField.className = 'form-field';
    const categorySpan = document.createElement('span');
    categorySpan.textContent = 'Rubriek';
    const categorySelect = document.createElement('select');
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name_nl;
      if (isEdit && cat.id === category.id) opt.selected = true;
      categorySelect.appendChild(opt);
    });
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ Nieuwe rubriek...';
    categorySelect.appendChild(newOpt);
    categoryField.appendChild(categorySpan);
    categoryField.appendChild(categorySelect);

    const categoryFieldsBtn = document.createElement('button');
    categoryFieldsBtn.type = 'button';
    categoryFieldsBtn.className = 'back-link shop-manage-fields-btn';
    categoryFieldsBtn.textContent = 'Velden beheren';
    categoryField.appendChild(categoryFieldsBtn);

    form.appendChild(categoryField);

    const newCategoryFields = document.createElement('div');
    newCategoryFields.hidden = categories.length > 0;
    const newNameInputs = {};
    [['name_nl', 'Rubrieknaam (NL)', true], ['name_en', 'Rubrieknaam (EN)', false], ['name_fr', 'Rubrieknaam (FR)', false], ['name_de', 'Rubrieknaam (DE)', false]]
      .forEach(([key, label, required]) => {
        const field = document.createElement('label');
        field.className = 'form-field';
        const span = document.createElement('span');
        span.textContent = label;
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 60;
        input.dataset.requiredWhenNew = required ? '1' : '';
        field.appendChild(span);
        field.appendChild(input);
        newCategoryFields.appendChild(field);
        newNameInputs[key] = input;
      });
    form.appendChild(newCategoryFields);

    // "required" enkel aanzetten terwijl het veld ook echt zichtbaar is --
    // anders probeert de browser bij het opslaan een verborgen verplicht
    // veld te focussen en crasht met "An invalid form control is not
    // focusable" i.p.v. gewoon te valideren.
    function syncNewCategoryVisibility() {
      const isNew = categorySelect.value === '__new__';
      newCategoryFields.hidden = !isNew;
      Object.values(newNameInputs).forEach((input) => {
        input.required = isNew && input.dataset.requiredWhenNew === '1';
      });
    }

    // Titel/beschrijving/prijs
    const textInputs = {};
    [
      ['title_nl', 'Titel (NL)', 'input'],
      ['title_en', 'Titel (EN)', 'input'],
      ['title_fr', 'Titel (FR)', 'input'],
      ['title_de', 'Titel (DE)', 'input'],
      ['description_nl', 'Beschrijving (NL)', 'textarea'],
      ['description_en', 'Beschrijving (EN)', 'textarea'],
      ['description_fr', 'Beschrijving (FR)', 'textarea'],
      ['description_de', 'Beschrijving (DE)', 'textarea'],
      ['price_cents', 'Prijs (€)', 'euro'],
    ].forEach(([key, label, tag]) => {
      const field = document.createElement('label');
      field.className = 'form-field';
      const span = document.createElement('span');
      span.textContent = label;
      const input = document.createElement(tag === 'textarea' ? 'textarea' : 'input');
      if (tag === 'input') { input.type = 'text'; input.maxLength = 80; }
      else if (tag === 'euro') { input.type = 'text'; input.inputMode = 'decimal'; input.placeholder = '0,00'; }
      else { input.rows = 3; input.maxLength = 2000; }
      input.value = isEdit ? (tag === 'euro' ? centsToEuroInputValue(product[key]) : product[key] || '') : '';
      field.appendChild(span);
      field.appendChild(input);
      form.appendChild(field);
      textInputs[key] = input;
    });

    // Prijs per variant-veld van de gekozen rubriek (vervangt de vlakke
    // prijs hierboven zodra de rubriek eigen velden heeft).
    const priceCentsFieldWrapper = textInputs.price_cents.parentElement;
    const priceFieldsContainer = document.createElement('div');
    form.insertBefore(priceFieldsContainer, priceCentsFieldWrapper.nextSibling);
    let fieldPriceInputs = {};

    function renderFieldPriceInputs(categoryId) {
      priceFieldsContainer.innerHTML = '';
      fieldPriceInputs = {};
      const fields = categoryId && categoryId !== '__new__'
        ? (categoryFieldsById[categoryId] || []).filter((f) => f.field_type === 'variant').slice().sort((a, b) => a.sort_order - b.sort_order)
        : [];
      priceCentsFieldWrapper.hidden = fields.length > 0;

      fields.forEach((field) => {
        const wrapper = document.createElement('label');
        wrapper.className = 'form-field';
        const span = document.createElement('span');
        span.textContent = `${field.label} (€)`;
        const input = document.createElement('input');
        input.type = 'text'; input.inputMode = 'decimal'; input.placeholder = '0,00';
        const existing = isEdit ? (product.shop_product_field_prices || []).find((r) => r.field_id === field.id) : null;
        input.value = centsToEuroInputValue(existing ? existing.price_cents : 0);
        wrapper.append(span, input);
        priceFieldsContainer.appendChild(wrapper);
        fieldPriceInputs[field.id] = input;
      });
    }

    function syncFieldsBtnState() {
      const val = categorySelect.value;
      categoryFieldsBtn.disabled = !val || val === '__new__';
    }

    categoryFieldsBtn.addEventListener('click', () => {
      const cat = categories.find((c) => c.id === categorySelect.value);
      if (cat) openCategoryFieldsModal(cat, () => renderFieldPriceInputs(categorySelect.value));
    });

    categorySelect.addEventListener('change', () => {
      syncNewCategoryVisibility();
      renderFieldPriceInputs(categorySelect.value);
      syncFieldsBtnState();
    });
    if (!categories.length) categorySelect.value = '__new__';
    syncNewCategoryVisibility();
    renderFieldPriceInputs(categorySelect.value);
    syncFieldsBtnState();

    // Optionele basisfoto (zoeken op bijschrift)
    let selectedPhotoId = null;
    const photoField = document.createElement('div');
    photoField.className = 'form-field';
    const photoLabel = document.createElement('span');
    photoLabel.textContent = 'Basisfoto (optioneel, enkel voor eigen referentie)';
    const photoSearchRow = document.createElement('div');
    photoSearchRow.className = 'shop-photo-search-row';
    const photoSearchInput = document.createElement('input');
    photoSearchInput.type = 'text';
    photoSearchInput.placeholder = 'Zoek op bijschrift...';
    const photoSearchBtn = document.createElement('button');
    photoSearchBtn.type = 'button';
    photoSearchBtn.className = 'checkout-submit shop-photo-search-btn';
    photoSearchBtn.textContent = 'Zoeken';
    photoSearchRow.appendChild(photoSearchInput);
    photoSearchRow.appendChild(photoSearchBtn);
    const photoResults = document.createElement('div');
    photoResults.className = 'shop-photo-results';
    const photoSelected = document.createElement('p');
    photoSelected.className = 'admin-status';
    photoField.appendChild(photoLabel);
    photoField.appendChild(photoSearchRow);
    photoField.appendChild(photoResults);
    photoField.appendChild(photoSelected);
    form.appendChild(photoField);

    function renderPhotoSelection(label) {
      selectedPhotoId = label ? selectedPhotoId : null;
      photoSelected.innerHTML = label
        ? `Geselecteerd: ${label} — <a href="#" class="shop-photo-clear">wissen</a>`
        : '';
      const clearLink = photoSelected.querySelector('.shop-photo-clear');
      if (clearLink) {
        clearLink.addEventListener('click', (e) => {
          e.preventDefault();
          selectedPhotoId = null;
          renderPhotoSelection(null);
        });
      }
    }

    if (isEdit && product.album_photo_id) {
      supabaseClient.from('album_photos').select('id,caption_nl').eq('id', product.album_photo_id).single()
        .then(({ data }) => {
          if (data) { selectedPhotoId = data.id; renderPhotoSelection(data.caption_nl || '(zonder bijschrift)'); }
        });
    }

    photoSearchBtn.addEventListener('click', async () => {
      const term = photoSearchInput.value.trim();
      photoResults.innerHTML = '';
      if (!term) return;
      const { data: photos, error } = await supabaseClient
        .from('album_photos')
        .select('id,storage_path,caption_nl')
        .ilike('caption_nl', `%${term}%`)
        .limit(20);
      if (error) { photoResults.textContent = `Mislukt: ${error.message}`; return; }
      (photos || []).forEach((p) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'shop-photo-result';
        const thumb = document.createElement('img');
        thumb.src = mockupUrl(p.storage_path);
        row.appendChild(thumb);
        const caption = document.createElement('span');
        caption.textContent = p.caption_nl || '(zonder bijschrift)';
        row.appendChild(caption);
        row.addEventListener('click', () => {
          selectedPhotoId = p.id;
          renderPhotoSelection(p.caption_nl || '(zonder bijschrift)');
          photoResults.innerHTML = '';
        });
        photoResults.appendChild(row);
      });
      if (!photos?.length) photoResults.textContent = 'Geen foto\'s gevonden.';
    });

    // Mockup-foto's
    const mockupField = document.createElement('label');
    mockupField.className = 'form-field';
    const mockupSpan = document.createElement('span');
    mockupSpan.textContent = "Mockup-foto's (bv. deze foto gedrukt op een T-shirt) — voeg er gerust 2 of meer toe";
    const mockupInput = document.createElement('input');
    mockupInput.type = 'file';
    mockupInput.accept = 'image/jpeg,image/png,image/webp';
    mockupInput.multiple = true;
    if (!isEdit) mockupInput.required = true;
    mockupField.appendChild(mockupSpan);
    mockupField.appendChild(mockupInput);
    form.appendChild(mockupField);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'checkout-submit';
    submitBtn.textContent = isEdit ? 'Opslaan' : 'Artikel aanmaken';
    form.appendChild(submitBtn);

    const status = document.createElement('p');
    status.className = 'admin-status';
    form.appendChild(status);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      try {
        let categoryId = categorySelect.value;
        if (categoryId === '__new__') {
          const nameNl = newNameInputs.name_nl.value.trim();
          if (!nameNl) { status.textContent = 'Vul een rubrieknaam in.'; submitBtn.disabled = false; return; }
          status.textContent = 'Rubriek aanmaken...';
          const { data: { session } } = await supabaseClient.auth.getSession();
          const { data: newCategory, error: categoryError } = await supabaseClient
            .from('shop_categories')
            .insert({
              slug: slugify(nameNl),
              name_nl: nameNl,
              name_en: newNameInputs.name_en.value.trim() || null,
              name_fr: newNameInputs.name_fr.value.trim() || null,
              name_de: newNameInputs.name_de.value.trim() || null,
              created_by: session ? session.user.email : null,
            })
            .select()
            .single();
          if (categoryError) throw categoryError;
          categories.push(newCategory);
          categoryId = newCategory.id;
        }

        const fields = {};
        Object.keys(textInputs).forEach((key) => {
          fields[key] = key === 'price_cents'
            ? eurosToCents(textInputs[key].value)
            : textInputs[key].value.trim() || null;
        });

        let savedProduct;
        if (isEdit) {
          const { error } = await supabaseClient
            .from('shop_products')
            .update({ ...fields, category_id: categoryId, album_photo_id: selectedPhotoId || null })
            .eq('id', product.id);
          if (error) throw error;
          savedProduct = product;
        } else {
          const { data: newProduct, error } = await supabaseClient
            .from('shop_products')
            .insert({ ...fields, category_id: categoryId, album_photo_id: selectedPhotoId || null })
            .select()
            .single();
          if (error) throw error;
          savedProduct = newProduct;
        }

        if (isEdit) {
          await supabaseClient.from('shop_product_field_prices').delete().eq('product_id', savedProduct.id);
        }
        const fieldPriceRows = Object.entries(fieldPriceInputs).map(([fieldId, input]) => ({
          product_id: savedProduct.id,
          field_id: fieldId,
          price_cents: eurosToCents(input.value),
        }));
        if (fieldPriceRows.length) {
          const { error: fieldPriceError } = await supabaseClient.from('shop_product_field_prices').insert(fieldPriceRows);
          if (fieldPriceError) throw fieldPriceError;
        }

        if (selectedPhotoId) {
          await supabaseClient
            .from('shop_product_photo_links')
            .insert({ product_id: savedProduct.id, photo_id: selectedPhotoId })
            .then(() => {}, () => {}); // dubbele koppeling (al gelinkt) stil negeren
        }

        const files = Array.from(mockupInput.files || []);
        if (files.length) {
          const { count } = await supabaseClient
            .from('shop_product_images')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', savedProduct.id);
          const base = count || 0;
          for (let i = 0; i < files.length; i += 1) {
            status.textContent = `Mockup-foto ${i + 1}/${files.length} comprimeren...`;
            const compressed = await compressImage(files[i]);
            const path = `shop/${categoryId}/${crypto.randomUUID()}.jpg`;
            status.textContent = `Mockup-foto ${i + 1}/${files.length} uploaden...`;
            const { error: uploadError } = await supabaseClient.storage
              .from(STORAGE_BUCKET)
              .upload(path, compressed, { contentType: 'image/jpeg' });
            if (uploadError) throw uploadError;
            const { error: imageError } = await supabaseClient
              .from('shop_product_images')
              .insert({ product_id: savedProduct.id, storage_path: path, sort_order: base + i });
            if (imageError) throw imageError;
          }
        }

        status.textContent = 'Opgeslagen, pagina wordt herladen...';
        window.location.reload();
      } catch (err) {
        console.error('AstroRaf: artikel opslaan mislukt', err);
        status.textContent = `Mislukt: ${err.message || err}`;
        submitBtn.disabled = false;
      }
    });

    panel.appendChild(form);

    if (isEdit) {
      const imagesHeading = document.createElement('p');
      imagesHeading.className = 'admin-status';
      imagesHeading.textContent = "Bestaande mockup-foto's:";
      panel.appendChild(imagesHeading);

      const imagesGrid = document.createElement('div');
      imagesGrid.className = 'shop-edit-images';
      panel.appendChild(imagesGrid);

      (product.shop_product_images || []).forEach((image) => {
        const thumb = document.createElement('div');
        thumb.className = 'shop-edit-thumb';
        const img = document.createElement('img');
        img.src = mockupUrl(image.storage_path);
        thumb.appendChild(img);
        thumb.appendChild(makeIconButton('icon-btn-delete', trashSvg(), 'Foto verwijderen', () =>
          removeShopProductImage(image, () => window.location.reload())));
        imagesGrid.appendChild(thumb);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'shop-edit-remove-all';
      deleteBtn.textContent = 'Dit artikel volledig verwijderen';
      deleteBtn.addEventListener('click', () => deleteShopProduct(product));
      panel.appendChild(deleteBtn);
    }
  }

  function buildNewProductTile() {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'album-card album-card-new';
    const plus = document.createElement('span');
    plus.className = 'album-card-new-icon';
    plus.textContent = '+';
    const label = document.createElement('span');
    label.className = 'album-name';
    label.textContent = 'Nieuw artikel';
    tile.appendChild(plus);
    tile.appendChild(label);
    tile.addEventListener('click', () => openShopProductModal());
    if (shopAdminTiles) shopAdminTiles.appendChild(tile);
  }

  function buildCategoriesTile() {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'album-card album-card-new';
    const icon = document.createElement('span');
    icon.className = 'album-card-new-icon';
    icon.textContent = '⚙';
    const label = document.createElement('span');
    label.className = 'album-name';
    label.textContent = 'Rubrieken beheren';
    tile.appendChild(icon);
    tile.appendChild(label);
    tile.addEventListener('click', () => openCategoriesModal());
    if (shopAdminTiles) shopAdminTiles.appendChild(tile);
  }

  function openCategoriesModal() {
    const { panel } = buildModal('Rubrieken beheren');

    const list = document.createElement('div');
    list.className = 'shop-category-fields-list';
    panel.appendChild(list);

    function renderCategoriesList() {
      list.innerHTML = '';
      categories.forEach((category) => {
        const row = document.createElement('div');
        row.className = 'shop-category-field-row';
        const label = document.createElement('span');
        label.textContent = category.name_nl;
        row.appendChild(label);

        const fieldsBtn = document.createElement('button');
        fieldsBtn.type = 'button';
        fieldsBtn.className = 'checkout-submit shop-manage-fields-inline-btn';
        fieldsBtn.textContent = 'Velden beheren';
        fieldsBtn.addEventListener('click', () => openCategoryFieldsModal(category));
        row.appendChild(fieldsBtn);

        list.appendChild(row);
      });
    }
    renderCategoriesList();

    const form = document.createElement('form');
    form.className = 'checkout-form';

    const newNameInputs = {};
    [['name_nl', 'Rubrieknaam (NL)', true], ['name_en', 'Rubrieknaam (EN)', false], ['name_fr', 'Rubrieknaam (FR)', false], ['name_de', 'Rubrieknaam (DE)', false]]
      .forEach(([key, labelText, required]) => {
        const field = document.createElement('label');
        field.className = 'form-field';
        const span = document.createElement('span');
        span.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 60;
        if (required) input.required = true;
        field.appendChild(span);
        field.appendChild(input);
        form.appendChild(field);
        newNameInputs[key] = input;
      });

    const addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'checkout-submit';
    addBtn.textContent = 'Nieuwe rubriek aanmaken';
    form.appendChild(addBtn);

    const status = document.createElement('p');
    status.className = 'admin-status';
    form.appendChild(status);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      addBtn.disabled = true;
      try {
        const nameNl = newNameInputs.name_nl.value.trim();
        if (!nameNl) { status.textContent = 'Vul een rubrieknaam in.'; addBtn.disabled = false; return; }
        const { data: { session } } = await supabaseClient.auth.getSession();
        const { data: newCategory, error } = await supabaseClient
          .from('shop_categories')
          .insert({
            slug: slugify(nameNl),
            name_nl: nameNl,
            name_en: newNameInputs.name_en.value.trim() || null,
            name_fr: newNameInputs.name_fr.value.trim() || null,
            name_de: newNameInputs.name_de.value.trim() || null,
            created_by: session ? session.user.email : null,
          })
          .select()
          .single();
        if (error) throw error;
        categories.push(newCategory);
        Object.values(newNameInputs).forEach((input) => { input.value = ''; });
        renderCategoriesList();
        status.textContent = 'Rubriek aangemaakt.';
      } catch (err) {
        console.error('AstroRaf: rubriek aanmaken mislukt', err);
        status.textContent = `Mislukt: ${err.message || err}`;
      } finally {
        addBtn.disabled = false;
      }
    });

    panel.appendChild(form);
  }

  function openCategoryFieldsModal(category, onFieldsChanged) {
    const { panel } = buildModal(`Prijsvelden "${category.name_nl}"`);

    const list = document.createElement('div');
    list.className = 'shop-category-fields-list';
    panel.appendChild(list);

    let dragFieldId = null;

    function renderList() {
      list.innerHTML = '';
      const fields = (categoryFieldsById[category.id] || []).slice().sort((a, b) => a.sort_order - b.sort_order);
      if (!fields.length) {
        const empty = document.createElement('p');
        empty.className = 'admin-status';
        empty.textContent = 'Nog geen verschillende prijsvelden — artikelen in deze rubriek gebruiken voorlopig hun vlakke prijs.';
        list.appendChild(empty);
      }
      fields.forEach((field) => {
        const row = document.createElement('div');
        row.className = 'shop-category-field-row';
        row.draggable = true;

        const handle = document.createElement('span');
        handle.className = 'shop-category-field-handle';
        handle.setAttribute('aria-label', 'Verslepen om volgorde te wijzigen');
        handle.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>';
        row.appendChild(handle);

        const label = document.createElement('span');
        label.className = 'shop-category-field-label';
        label.textContent = field.field_type === 'surcharge'
          ? `${field.label} — ${formatEuro(field.price_cents)} (algemene kost, ${field.mandatory ? 'verplicht' : 'optioneel'})`
          : `${field.label} (variant, prijs per artikel)`;
        row.appendChild(label);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'shop-category-field-remove';
        removeBtn.setAttribute('aria-label', 'Veld verwijderen');
        removeBtn.innerHTML = trashSvg();
        removeBtn.addEventListener('click', () => deleteCategoryField(field, () => { renderList(); if (onFieldsChanged) onFieldsChanged(); }));
        row.appendChild(removeBtn);

        row.addEventListener('dragstart', () => {
          dragFieldId = field.id;
          row.classList.add('is-dragging');
        });
        row.addEventListener('dragend', () => {
          row.classList.remove('is-dragging');
        });
        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (dragFieldId && dragFieldId !== field.id) row.classList.add('is-drag-over');
        });
        row.addEventListener('dragleave', () => {
          row.classList.remove('is-drag-over');
        });
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          row.classList.remove('is-drag-over');
          if (!dragFieldId || dragFieldId === field.id) return;
          reorderFields(dragFieldId, field.id);
          dragFieldId = null;
        });

        list.appendChild(row);
      });
    }
    renderList();

    async function reorderFields(draggedId, targetId) {
      const fields = (categoryFieldsById[category.id] || []).slice().sort((a, b) => a.sort_order - b.sort_order);
      const fromIndex = fields.findIndex((f) => f.id === draggedId);
      const toIndex = fields.findIndex((f) => f.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return;

      const [moved] = fields.splice(fromIndex, 1);
      fields.splice(toIndex, 0, moved);
      const reordered = fields.map((f, index) => ({ ...f, sort_order: index }));
      categoryFieldsById[category.id] = reordered;
      renderList();
      if (onFieldsChanged) onFieldsChanged();

      try {
        await Promise.all(reordered.map((f) =>
          supabaseClient.from('shop_category_fields').update({ sort_order: f.sort_order }).eq('id', f.id)
        ));
      } catch (err) {
        console.error('AstroRaf: volgorde opslaan mislukt', err);
        window.alert(`Mislukt: ${err.message || err}`);
      }
    }

    const form = document.createElement('form');
    form.className = 'checkout-form';

    const typeSelect = document.createElement('select');
    [['variant', 'Variant (bv. L/XL/XXL)'], ['surcharge', 'Algemene kost (bv. Transportkost)']]
      .forEach(([value, text]) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        typeSelect.appendChild(opt);
      });
    const typeField = document.createElement('label');
    typeField.className = 'form-field';
    const typeSpan = document.createElement('span');
    typeSpan.textContent = 'Type veld';
    typeField.append(typeSpan, typeSelect);
    form.appendChild(typeField);

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.maxLength = 60;
    labelInput.required = true;
    const labelField = document.createElement('label');
    labelField.className = 'form-field';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = 'Label';
    labelField.append(labelSpan, labelInput);
    form.appendChild(labelField);

    const surchargePriceInput = document.createElement('input');
    surchargePriceInput.type = 'text';
    surchargePriceInput.inputMode = 'decimal';
    surchargePriceInput.placeholder = '0,00';
    surchargePriceInput.value = '0,00';
    const surchargePriceField = document.createElement('label');
    surchargePriceField.className = 'form-field';
    surchargePriceField.hidden = true;
    const surchargePriceSpan = document.createElement('span');
    surchargePriceSpan.textContent = 'Prijs (€)';
    surchargePriceField.append(surchargePriceSpan, surchargePriceInput);
    form.appendChild(surchargePriceField);

    const mandatoryInput = document.createElement('input');
    mandatoryInput.type = 'checkbox';
    mandatoryInput.checked = true;
    const mandatoryField = document.createElement('label');
    mandatoryField.className = 'form-field shop-mandatory-field';
    mandatoryField.hidden = true;
    const mandatorySpan = document.createElement('span');
    mandatorySpan.textContent = 'Verplicht meerekenen (anders krijgt de klant een aanvinkvakje)';
    mandatoryField.append(mandatoryInput, mandatorySpan);
    form.appendChild(mandatoryField);

    typeSelect.addEventListener('change', () => {
      const isSurcharge = typeSelect.value === 'surcharge';
      surchargePriceField.hidden = !isSurcharge;
      mandatoryField.hidden = !isSurcharge;
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'checkout-submit';
    addBtn.textContent = 'Veld toevoegen';
    form.appendChild(addBtn);

    const status = document.createElement('p');
    status.className = 'admin-status';
    form.appendChild(status);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      addBtn.disabled = true;
      try {
        const label = labelInput.value.trim();
        if (!label) { status.textContent = 'Vul een label in.'; addBtn.disabled = false; return; }
        const existingCount = (categoryFieldsById[category.id] || []).length;
        const { data: { session } } = await supabaseClient.auth.getSession();
        const { data: newField, error } = await supabaseClient
          .from('shop_category_fields')
          .insert({
            category_id: category.id,
            field_type: typeSelect.value,
            label,
            price_cents: typeSelect.value === 'surcharge' ? eurosToCents(surchargePriceInput.value) : 0,
            mandatory: typeSelect.value === 'surcharge' ? mandatoryInput.checked : true,
            sort_order: existingCount,
            created_by: session ? session.user.email : null,
          })
          .select()
          .single();
        if (error) throw error;
        if (!categoryFieldsById[category.id]) categoryFieldsById[category.id] = [];
        categoryFieldsById[category.id].push(newField);
        labelInput.value = '';
        surchargePriceInput.value = '0,00';
        mandatoryInput.checked = true;
        renderList();
        if (onFieldsChanged) onFieldsChanged();
        status.textContent = 'Veld toegevoegd.';
      } catch (err) {
        console.error('AstroRaf: veld toevoegen mislukt', err);
        status.textContent = `Mislukt: ${err.message || err}`;
      } finally {
        addBtn.disabled = false;
      }
    });

    panel.appendChild(form);
  }

  async function deleteCategoryField(field, onDeleted) {
    if (!window.confirm(`Veld "${field.label}" verwijderen? Bijhorende artikelprijzen voor dit veld gaan mee verloren.`)) return;
    try {
      const { error } = await supabaseClient.from('shop_category_fields').delete().eq('id', field.id);
      if (error) throw error;
      categoryFieldsById[field.category_id] = (categoryFieldsById[field.category_id] || []).filter((f) => f.id !== field.id);
      if (onDeleted) onDeleted();
    } catch (err) {
      console.error('AstroRaf: veld verwijderen mislukt', err);
      window.alert(`Mislukt: ${err.message || err}`);
    }
  }

  function buildAdminTiles() {
    if (!isEditor || !shopAdminTiles) return;
    buildNewProductTile();
    buildCategoriesTile();
  }

  // ---------- Query-param-navigatie vanuit albums ----------

  function findProductById(id) {
    for (const catId of Object.keys(productsByCategory)) {
      const found = productsByCategory[catId].find((p) => p.id === id);
      if (found) return { product: found, category: categories.find((c) => c.id === catId) };
    }
    return null;
  }

  async function loadPhotoLinkedProductIds(photoId) {
    const { data, error } = await supabaseClient
      .from('shop_product_photo_links')
      .select('product_id')
      .eq('photo_id', photoId);
    if (error) { console.error('AstroRaf: foto-koppelingen opvragen mislukt', error); return []; }
    return (data || []).map((r) => r.product_id);
  }

  function renderFiltered(productIds) {
    shopSections.innerHTML = '';
    const idSet = new Set(productIds);
    let anyProducts = false;

    const backLink = document.createElement('button');
    backLink.type = 'button';
    backLink.className = 'back-link shop-filter-back';
    backLink.innerHTML = '&larr; <span>Volledige shop</span>';
    backLink.addEventListener('click', () => {
      window.history.replaceState(null, '', 'shop.html');
      buildAll();
    });
    shopSections.appendChild(backLink);

    categories.forEach((category) => {
      const products = (productsByCategory[category.id] || []).filter((p) => idSet.has(p.id));
      if (!products.length) return;
      anyProducts = true;
      buildSection(() => categoryName(category), products.map((product) => ({ product, category })), true);
    });

    if (shopEmpty) shopEmpty.hidden = anyProducts;
  }

  async function applyQueryParamFilter() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product');
    const photoId = params.get('photo');

    buildAll();

    if (productId) {
      const found = findProductById(productId);
      if (found) openProductDetail(found.product, found.category, productImageUrls(found.product));
      return;
    }
    if (photoId) {
      const ids = await loadPhotoLinkedProductIds(photoId);
      renderFiltered(ids);
    }
  }

  try {
    isEditor = await checkIsEditor();
    await loadData();
    buildAdminTiles();
    await applyQueryParamFilter();
    window.astrorafShopPricing = { categoryFields: categoryFieldsById };
  } catch (e) {
    console.error('AstroRaf: failed to load shop data', e);
  }

  document.addEventListener('astroraf-lang-changed', applyLanguage);
})();
