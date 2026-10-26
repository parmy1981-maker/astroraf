window.astrorafDynamicAlbumsReady = (async () => {
  const albumGrid = document.getElementById('albumGrid');
  const gallerySection = document.querySelector('.gallery-page');
  if (!albumGrid || !gallerySection) return;

  const STORAGE_BUCKET = 'album-photos';
  const LOCAL_PREFIX = 'local:';
  const MAX_DIMENSION = 2000;
  const JPEG_QUALITY = 0.82;

  let albums = [];
  let photosByAlbum = {};
  let isEditor = false;
  let shopCategories = [];
  let shopProductsByPhoto = {};
  const langRefs = [];

  function currentLang() {
    return localStorage.getItem('astroraf-lang') || 'nl';
  }

  function t(key) {
    const dict = (typeof translations !== 'undefined' && translations[currentLang()]) || {};
    return dict[key] || '';
  }

  function albumName(album) {
    return album['name_' + currentLang()] || album.name_nl;
  }

  function photoCaption(photo, album) {
    return photo['caption_' + currentLang()] || photo.caption_nl || albumName(album);
  }

  function photoCaptionOnly(photo) {
    return photo['caption_' + currentLang()] || photo.caption_nl || '';
  }

  function publicPhotoUrl(storagePath) {
    if (storagePath.startsWith(LOCAL_PREFIX)) {
      return storagePath.slice(LOCAL_PREFIX.length);
    }
    const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
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
  }

  async function loadData() {
    const { data: albumRows, error: albumsError } = await supabaseClient
      .from('albums')
      .select('id,slug,name_nl,name_en,name_fr,name_de,copyright,created_at')
      .order('created_at', { ascending: true });
    if (albumsError) throw albumsError;
    albums = albumRows || [];

    photosByAlbum = {};
    if (albums.length) {
      const { data: photoRows, error: photosError } = await supabaseClient
        .from('album_photos')
        .select('id,album_id,storage_path,like_id,caption_nl,caption_en,caption_fr,caption_de,sort_order')
        .order('sort_order', { ascending: true });
      if (photosError) throw photosError;
      (photoRows || []).forEach((photo) => {
        if (!photosByAlbum[photo.album_id]) photosByAlbum[photo.album_id] = [];
        photosByAlbum[photo.album_id].push(photo);
      });
    }
  }

  async function loadShopData() {
    const { data: catRows, error: catError } = await supabaseClient
      .from('shop_categories')
      .select('id,slug,name_nl,name_en,name_fr,name_de,sort_order')
      .order('sort_order', { ascending: true });
    if (catError) throw catError;
    shopCategories = catRows || [];

    const { data: prodRows, error: prodError } = await supabaseClient
      .from('shop_products')
      .select('id,category_id,album_photo_id,active,sort_order,title_nl,title_en,title_fr,title_de,description_nl,description_en,description_fr,description_de');
    if (prodError) throw prodError;

    shopProductsByPhoto = {};
    (prodRows || []).forEach((product) => {
      if (!shopProductsByPhoto[product.album_photo_id]) shopProductsByPhoto[product.album_photo_id] = [];
      shopProductsByPhoto[product.album_photo_id].push(product);
    });
  }

  function shopCategoryById(id) {
    return shopCategories.find((cat) => cat.id === id);
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

  function trashSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.8 12.1a2 2 0 0 1-2 1.9H9.8a2 2 0 0 1-2-1.9L7 7"/></svg>';
  }

  function pencilSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5.5 16.5 4 20Z"/><path d="M14 6.5 17.5 10"/></svg>';
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

  function buildAlbumCard(album, photos) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'album-card';
    card.setAttribute('data-open-album', album.slug);

    const cover = document.createElement('span');
    cover.className = 'album-cover';
    if (photos.length) {
      const coverImg = document.createElement('img');
      coverImg.src = publicPhotoUrl(photos[0].storage_path);
      registerLangRef(coverImg, 'alt', () => albumName(album));
      cover.appendChild(coverImg);
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'album-name';
    registerLangRef(nameSpan, 'text', () => albumName(album));

    card.appendChild(cover);
    card.appendChild(nameSpan);

    if (album.copyright) {
      const copyrightSpan = document.createElement('span');
      copyrightSpan.className = 'album-card-copyright';
      registerLangRef(copyrightSpan, 'text', () => `${t('album_copyright_label')} ${album.copyright}`);
      card.appendChild(copyrightSpan);
    }

    if (isEditor) {
      card.appendChild(makeIconButton('icon-btn-delete', trashSvg(), 'Album verwijderen', (e) => {
        e.stopPropagation();
        deleteAlbum(album);
      }));
    }

    albumGrid.appendChild(card);
  }

  function buildPhotoTile(photo, album) {
    const tile = document.createElement('div');
    tile.className = 'photo-tile';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'photo-placeholder photo-open';
    openBtn.setAttribute('data-lightbox-src', publicPhotoUrl(photo.storage_path));

    const img = document.createElement('img');
    img.src = publicPhotoUrl(photo.storage_path);
    registerLangRef(img, 'alt', () => photoCaption(photo, album));
    openBtn.appendChild(img);

    const likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    likeBtn.className = 'like-btn';
    likeBtn.setAttribute('data-like', photo.like_id || photo.id);
    likeBtn.setAttribute('aria-label', 'Like');
    likeBtn.setAttribute('aria-pressed', 'false');
    likeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20.5s-7.5-4.6-9.8-9.1C.6 8.1 2 4.8 5.2 4.1c2-.4 3.9.5 5 2.1a5.6 5.6 0 0 1 1.8-2c2.8-1.9 6.4-.6 7.6 2.4 1.6 3.9-1.1 8.5-7.6 13.9z"/></svg><span class="like-count">0</span>';

    tile.appendChild(openBtn);
    tile.appendChild(likeBtn);

    if (photoCaptionOnly(photo)) {
      const caption = document.createElement('p');
      caption.className = 'photo-caption';
      registerLangRef(caption, 'text', () => photoCaptionOnly(photo));
      tile.appendChild(caption);
    }

    if (isEditor) {
      tile.appendChild(makeIconButton('photo-delete-btn', trashSvg(), 'Foto verwijderen', () => deletePhoto(photo)));
      tile.appendChild(makeIconButton('photo-caption-btn', pencilSvg(), 'Bijschrift bewerken', () => openPhotoCaptionModal(photo)));
      tile.appendChild(buildShopTagControls(photo));
    }

    return tile;
  }

  function shopTagSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 7V5.5A2.5 2.5 0 0 1 9.5 3h5A2.5 2.5 0 0 1 17 5.5V7"/><rect x="4" y="7" width="16" height="13" rx="2"/><circle cx="9" cy="11" r="0.6" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="0.6" fill="currentColor" stroke="none"/></svg>';
  }

  function buildShopTagControls(photo) {
    const wrap = document.createElement('div');
    wrap.className = 'shop-tag-controls';

    (shopProductsByPhoto[photo.id] || []).forEach((product) => {
      const category = shopCategoryById(product.category_id);
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'shop-tag-pill';
      pill.textContent = category ? category.name_nl : '?';
      pill.title = 'Klik om te bewerken';
      pill.addEventListener('click', () => openShopProductEditModal(product, category));
      wrap.appendChild(pill);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'shop-tag-add';
    addBtn.innerHTML = `${shopTagSvg()}<span>In shop</span>`;
    addBtn.addEventListener('click', () => openShopTagModal(photo));
    wrap.appendChild(addBtn);

    return wrap;
  }

  async function removeShopTag(product) {
    if (!window.confirm('Deze foto uit de shop halen?')) return;

    try {
      const { data: images, error: imagesError } = await supabaseClient
        .from('shop_product_images')
        .select('storage_path')
        .eq('product_id', product.id);
      if (imagesError) throw imagesError;

      const paths = (images || []).map((img) => img.storage_path);
      if (paths.length) await supabaseClient.storage.from(STORAGE_BUCKET).remove(paths);

      const { error } = await supabaseClient.from('shop_products').delete().eq('id', product.id);
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      console.error('AstroRaf: foto uit shop halen mislukt', err);
      window.alert(`Mislukt: ${err.message || err}`);
    }
  }

  async function removeShopProductImage(image) {
    if (!window.confirm('Deze foto verwijderen?')) return;

    try {
      await supabaseClient.storage.from(STORAGE_BUCKET).remove([image.storage_path]);
      const { error } = await supabaseClient.from('shop_product_images').delete().eq('id', image.id);
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      console.error('AstroRaf: shop-foto verwijderen mislukt', err);
      window.alert(`Mislukt: ${err.message || err}`);
    }
  }

  async function openShopProductEditModal(product, category) {
    const { panel } = buildModal(`Shop: ${category ? category.name_nl : ''}`);

    const textForm = document.createElement('form');
    textForm.className = 'checkout-form';
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
    ].forEach(([key, label, tag]) => {
      const field = document.createElement('label');
      field.className = 'form-field';
      const span = document.createElement('span');
      span.textContent = label;
      const input = document.createElement(tag);
      if (tag === 'input') { input.type = 'text'; input.maxLength = 80; }
      else { input.rows = 3; input.maxLength = 2000; }
      input.value = product[key] || '';
      field.appendChild(span);
      field.appendChild(input);
      textForm.appendChild(field);
      textInputs[key] = input;
    });

    const textSaveBtn = document.createElement('button');
    textSaveBtn.type = 'submit';
    textSaveBtn.className = 'checkout-submit';
    textSaveBtn.textContent = 'Tekst opslaan';
    textForm.appendChild(textSaveBtn);

    const textStatus = document.createElement('p');
    textStatus.className = 'admin-status';
    textForm.appendChild(textStatus);

    textForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      textSaveBtn.disabled = true;
      textStatus.textContent = 'Opslaan...';
      try {
        const updates = {};
        Object.keys(textInputs).forEach((key) => {
          updates[key] = textInputs[key].value.trim() || null;
        });
        const { error } = await supabaseClient.from('shop_products').update(updates).eq('id', product.id);
        if (error) throw error;
        Object.assign(product, updates);
        textStatus.textContent = 'Opgeslagen.';
      } catch (err) {
        console.error('AstroRaf: shop-tekst opslaan mislukt', err);
        textStatus.textContent = `Mislukt: ${err.message || err}`;
      } finally {
        textSaveBtn.disabled = false;
      }
    });

    panel.appendChild(textForm);

    const status = document.createElement('p');
    status.className = 'admin-status';
    status.textContent = "Foto's laden...";
    panel.appendChild(status);

    const imagesGrid = document.createElement('div');
    imagesGrid.className = 'shop-edit-images';
    panel.appendChild(imagesGrid);

    const { data: images, error: imagesError } = await supabaseClient
      .from('shop_product_images')
      .select('id,storage_path,sort_order')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true });

    if (imagesError) {
      status.textContent = `Mislukt: ${imagesError.message || imagesError}`;
    } else {
      status.textContent = '';
      (images || []).forEach((image) => {
        const thumb = document.createElement('div');
        thumb.className = 'shop-edit-thumb';

        const img = document.createElement('img');
        const { data: urlData } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(image.storage_path);
        img.src = urlData.publicUrl;
        thumb.appendChild(img);

        thumb.appendChild(makeIconButton('icon-btn-delete', trashSvg(), 'Foto verwijderen', () => removeShopProductImage(image)));
        imagesGrid.appendChild(thumb);
      });
    }

    const addForm = document.createElement('form');
    addForm.className = 'checkout-form';
    const { field: fileField, input: fileInput } = buildFileField();
    addForm.appendChild(fileField);

    const addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'checkout-submit';
    addBtn.textContent = "Foto's toevoegen";
    addForm.appendChild(addBtn);

    const addStatus = document.createElement('p');
    addStatus.className = 'admin-status';
    addForm.appendChild(addStatus);

    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const files = Array.from(fileInput.files || []);
      if (!files.length) { addStatus.textContent = 'Kies minstens 1 foto.'; return; }

      addBtn.disabled = true;
      try {
        const { count, error: countError } = await supabaseClient
          .from('shop_product_images')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', product.id);
        if (countError) throw countError;
        const base = count || 0;

        for (let i = 0; i < files.length; i += 1) {
          addStatus.textContent = `Foto ${i + 1}/${files.length} comprimeren...`;
          const compressed = await compressImage(files[i]);
          const path = `shop/${product.category_id}/${crypto.randomUUID()}.jpg`;

          addStatus.textContent = `Foto ${i + 1}/${files.length} uploaden...`;
          const { error: uploadError } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(path, compressed, { contentType: 'image/jpeg' });
          if (uploadError) throw uploadError;

          const { error: imageError } = await supabaseClient
            .from('shop_product_images')
            .insert({ product_id: product.id, storage_path: path, sort_order: base + i });
          if (imageError) throw imageError;
        }

        window.location.reload();
      } catch (err) {
        console.error('AstroRaf: foto toevoegen aan shop-product mislukt', err);
        addStatus.textContent = `Mislukt: ${err.message || err}`;
        addBtn.disabled = false;
      }
    });

    panel.appendChild(addForm);

    const removeAllBtn = document.createElement('button');
    removeAllBtn.type = 'button';
    removeAllBtn.className = 'shop-edit-remove-all';
    removeAllBtn.textContent = 'Dit product volledig uit de shop halen';
    removeAllBtn.addEventListener('click', () => removeShopTag(product));
    panel.appendChild(removeAllBtn);
  }

  function openShopTagModal(photo) {
    const { panel } = buildModal('Foto in de shop plaatsen');
    const form = document.createElement('form');
    form.className = 'checkout-form';

    const categoryField = document.createElement('label');
    categoryField.className = 'form-field';
    const categorySpan = document.createElement('span');
    categorySpan.textContent = 'Rubriek';
    const categorySelect = document.createElement('select');
    shopCategories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name_nl;
      categorySelect.appendChild(opt);
    });
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ Nieuwe rubriek...';
    categorySelect.appendChild(newOpt);
    categoryField.appendChild(categorySpan);
    categoryField.appendChild(categorySelect);
    form.appendChild(categoryField);

    const newCategoryFields = document.createElement('div');
    newCategoryFields.hidden = shopCategories.length > 0;
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
        if (required) input.required = true;
        field.appendChild(span);
        field.appendChild(input);
        newCategoryFields.appendChild(field);
        newNameInputs[key] = input;
      });
    form.appendChild(newCategoryFields);

    categorySelect.addEventListener('change', () => {
      newCategoryFields.hidden = categorySelect.value !== '__new__';
    });
    if (!shopCategories.length) categorySelect.value = '__new__';

    const mockupField = document.createElement('label');
    mockupField.className = 'form-field';
    const mockupSpan = document.createElement('span');
    mockupSpan.textContent = "Mockup-foto's (bv. deze foto gedrukt op een T-shirt) — voeg er gerust 2 of meer toe";
    const mockupInput = document.createElement('input');
    mockupInput.type = 'file';
    mockupInput.accept = 'image/jpeg,image/png,image/webp';
    mockupInput.multiple = true;
    mockupInput.required = true;
    mockupField.appendChild(mockupSpan);
    mockupField.appendChild(mockupInput);
    form.appendChild(mockupField);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'checkout-submit';
    submitBtn.textContent = 'Toevoegen aan shop';
    form.appendChild(submitBtn);

    const status = document.createElement('p');
    status.className = 'admin-status';
    form.appendChild(status);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const files = Array.from(mockupInput.files || []);
      if (!files.length) { status.textContent = "Kies minstens 1 mockup-foto."; return; }

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
          shopCategories.push(newCategory);
          categoryId = newCategory.id;
        }

        // Al een product voor deze foto in deze rubriek? Dan voegen we de
        // nieuwe foto's daar gewoon aan toe i.p.v. een dubbele rij te maken
        // (category_id + album_photo_id is unique).
        let product = (shopProductsByPhoto[photo.id] || []).find((p) => p.category_id === categoryId);
        let existingImageCount = 0;

        if (product) {
          const { count, error: countError } = await supabaseClient
            .from('shop_product_images')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', product.id);
          if (countError) throw countError;
          existingImageCount = count || 0;
        } else {
          const sortOrder = (shopProductsByPhoto[photo.id] || []).length;
          const { data: newProduct, error: productError } = await supabaseClient
            .from('shop_products')
            .insert({ category_id: categoryId, album_photo_id: photo.id, sort_order: sortOrder })
            .select()
            .single();
          if (productError) throw productError;
          product = newProduct;
          if (!shopProductsByPhoto[photo.id]) shopProductsByPhoto[photo.id] = [];
          shopProductsByPhoto[photo.id].push(product);
        }

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
            .insert({ product_id: product.id, storage_path: path, sort_order: existingImageCount + i });
          if (imageError) throw imageError;
        }

        status.textContent = 'Toegevoegd, pagina wordt herladen...';
        window.location.reload();
      } catch (err) {
        console.error('AstroRaf: foto in shop plaatsen mislukt', err);
        status.textContent = `Mislukt: ${err.message || err}`;
        submitBtn.disabled = false;
      }
    });

    panel.appendChild(form);
  }

  function buildCopyrightField(album) {
    if (isEditor) {
      const wrap = document.createElement('div');
      wrap.className = 'album-copyright-edit';

      const label = document.createElement('span');
      label.className = 'album-copyright-edit-label';
      registerLangRef(label, 'text', () => t('album_copyright_label'));

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'album-copyright-input';
      input.placeholder = 'bv. © Raf Janssens';
      input.maxLength = 200;
      input.value = album.copyright || '';

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      input.addEventListener('blur', async () => {
        const value = input.value.trim();
        if (value === (album.copyright || '')) return;
        const { error } = await supabaseClient.from('albums').update({ copyright: value || null }).eq('id', album.id);
        if (error) {
          console.error('AstroRaf: auteursrecht opslaan mislukt', error);
          window.alert(`Opslaan mislukt: ${error.message || error}`);
          return;
        }
        album.copyright = value || null;
      });

      wrap.appendChild(label);
      wrap.appendChild(input);
      return wrap;
    }

    const p = document.createElement('p');
    p.className = 'album-copyright';
    if (!album.copyright) { p.hidden = true; return p; }
    registerLangRef(p, 'text', () => `${t('album_copyright_label')} ${album.copyright}`);
    return p;
  }

  function buildTitleField(album) {
    if (!isEditor) {
      const h2 = document.createElement('h2');
      h2.className = 'section-title';
      registerLangRef(h2, 'text', () => albumName(album));
      return h2;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'section-title album-title-input';
    input.maxLength = 80;
    registerLangRef(input, 'value', () => albumName(album));

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    input.addEventListener('blur', async () => {
      const field = 'name_' + currentLang();
      const value = input.value.trim();
      if (!value) { input.value = albumName(album); return; }
      if (value === (album[field] || '')) return;

      const { error } = await supabaseClient.from('albums').update({ [field]: value }).eq('id', album.id);
      if (error) {
        console.error('AstroRaf: albumnaam opslaan mislukt', error);
        window.alert(`Opslaan mislukt: ${error.message || error}`);
        input.value = albumName(album);
        return;
      }
      album[field] = value;
      applyLanguage();
    });

    return input;
  }

  function buildNewPhotoTile(album) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'album-card album-card-new';

    const plus = document.createElement('span');
    plus.className = 'album-card-new-icon';
    plus.textContent = '+';

    const label = document.createElement('span');
    label.className = 'album-name';
    label.textContent = "Foto's toevoegen";

    tile.appendChild(plus);
    tile.appendChild(label);
    tile.addEventListener('click', () => openAddPhotosModal(album));
    return tile;
  }

  function buildAlbumDetail(album, photos) {
    const detail = document.createElement('div');
    detail.className = 'album-detail';
    detail.setAttribute('data-album-detail', album.slug);
    detail.hidden = true;

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'back-link';
    backBtn.setAttribute('data-close-album', '');
    backBtn.innerHTML = '&larr; <span></span>';
    registerLangRef(backBtn.querySelector('span'), 'text', () => t('back_to_albums'));

    const title = buildTitleField(album);

    const grid = document.createElement('div');
    grid.className = 'photo-grid';
    photos.forEach((photo) => grid.appendChild(buildPhotoTile(photo, album)));
    if (isEditor) grid.appendChild(buildNewPhotoTile(album));

    detail.appendChild(backBtn);
    detail.appendChild(title);
    detail.appendChild(buildCopyrightField(album));
    detail.appendChild(grid);
    gallerySection.appendChild(detail);
  }

  function buildNewAlbumTile() {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'album-card album-card-new';

    const plus = document.createElement('span');
    plus.className = 'album-card-new-icon';
    plus.textContent = '+';

    const label = document.createElement('span');
    label.className = 'album-name';
    label.textContent = 'Nieuw album';

    tile.appendChild(plus);
    tile.appendChild(label);
    tile.addEventListener('click', () => openNewAlbumModal());

    albumGrid.appendChild(tile);
  }

  function buildAll() {
    albums.forEach((album) => {
      const photos = photosByAlbum[album.id] || [];
      buildAlbumCard(album, photos);
      buildAlbumDetail(album, photos);
    });
    if (isEditor) buildNewAlbumTile();
  }

  // ---------- Image compression ----------

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

  // ---------- Modals ----------

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
    return `${base || 'album'}-${suffix}`;
  }

  function buildFileField() {
    const field = document.createElement('label');
    field.className = 'form-field';
    const span = document.createElement('span');
    span.textContent = "Foto's (jpeg, png of webp)";
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.multiple = true;
    input.required = true;
    field.appendChild(span);
    field.appendChild(input);
    return { field, input };
  }

  async function uploadPhotos(albumId, files, status) {
    let sortOrder = (photosByAlbum[albumId] || []).length;

    for (let i = 0; i < files.length; i += 1) {
      status.textContent = `Foto ${i + 1}/${files.length} comprimeren...`;
      const compressed = await compressImage(files[i]);
      const path = `${albumId}/${crypto.randomUUID()}.jpg`;

      status.textContent = `Foto ${i + 1}/${files.length} uploaden...`;
      const { error: uploadError } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { error: photoError } = await supabaseClient
        .from('album_photos')
        .insert({ album_id: albumId, storage_path: path, sort_order: sortOrder });
      if (photoError) throw photoError;
      sortOrder += 1;
    }
  }

  function openNewAlbumModal() {
    const { panel, close } = buildModal('Nieuw album aanmaken');
    const form = document.createElement('form');
    form.className = 'checkout-form';

    const nameInputs = {};
    [['name_nl', 'Naam (NL)', true], ['name_en', 'Naam (EN)', false], ['name_fr', 'Naam (FR)', false], ['name_de', 'Naam (DE)', false]]
      .forEach(([key, label, required]) => {
        const field = document.createElement('label');
        field.className = 'form-field';
        const span = document.createElement('span');
        span.textContent = label;
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 80;
        if (required) input.required = true;
        field.appendChild(span);
        field.appendChild(input);
        form.appendChild(field);
        nameInputs[key] = input;
      });

    const { field: fileField, input: fileInput } = buildFileField();
    form.appendChild(fileField);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'checkout-submit';
    submitBtn.textContent = 'Album aanmaken';
    form.appendChild(submitBtn);

    const status = document.createElement('p');
    status.className = 'admin-status';
    form.appendChild(status);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const files = Array.from(fileInput.files || []);
      if (!files.length) { status.textContent = 'Kies minstens 1 foto.'; return; }

      submitBtn.disabled = true;
      status.textContent = 'Album aanmaken...';

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const slug = slugify(nameInputs.name_nl.value);
        const { data: album, error: albumError } = await supabaseClient
          .from('albums')
          .insert({
            slug,
            name_nl: nameInputs.name_nl.value.trim(),
            name_en: nameInputs.name_en.value.trim() || null,
            name_fr: nameInputs.name_fr.value.trim() || null,
            name_de: nameInputs.name_de.value.trim() || null,
            created_by: session ? session.user.email : null,
          })
          .select()
          .single();
        if (albumError) throw albumError;

        await uploadPhotos(album.id, files, status);
        status.textContent = 'Album aangemaakt, pagina wordt herladen...';
        window.location.reload();
      } catch (err) {
        console.error('AstroRaf: nieuw album mislukt', err);
        status.textContent = `Mislukt: ${err.message || err}`;
        submitBtn.disabled = false;
      }
    });

    panel.appendChild(form);
  }

  function openAddPhotosModal(album) {
    const { panel, close } = buildModal(`Foto's toevoegen aan "${albumName(album)}"`);
    const form = document.createElement('form');
    form.className = 'checkout-form';

    const { field: fileField, input: fileInput } = buildFileField();
    form.appendChild(fileField);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'checkout-submit';
    submitBtn.textContent = "Foto's toevoegen";
    form.appendChild(submitBtn);

    const status = document.createElement('p');
    status.className = 'admin-status';
    form.appendChild(status);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const files = Array.from(fileInput.files || []);
      if (!files.length) { status.textContent = 'Kies minstens 1 foto.'; return; }

      submitBtn.disabled = true;
      try {
        await uploadPhotos(album.id, files, status);
        status.textContent = "Foto's toegevoegd, pagina wordt herladen...";
        window.location.reload();
      } catch (err) {
        console.error('AstroRaf: fotos toevoegen mislukt', err);
        status.textContent = `Mislukt: ${err.message || err}`;
        submitBtn.disabled = false;
      }
    });

    panel.appendChild(form);
  }

  async function deleteAlbum(album) {
    const photos = photosByAlbum[album.id] || [];
    if (!window.confirm(`Album "${albumName(album)}" en zijn ${photos.length} foto('s) definitief verwijderen?`)) return;

    try {
      const storagePaths = photos.map((p) => p.storage_path).filter((p) => !p.startsWith(LOCAL_PREFIX));
      if (storagePaths.length) {
        await supabaseClient.storage.from(STORAGE_BUCKET).remove(storagePaths);
      }
      const { error } = await supabaseClient.from('albums').delete().eq('id', album.id);
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      console.error('AstroRaf: album verwijderen mislukt', err);
      window.alert(`Verwijderen mislukt: ${err.message || err}`);
    }
  }

  function openPhotoCaptionModal(photo) {
    const { panel } = buildModal('Bijschrift bewerken');
    const form = document.createElement('form');
    form.className = 'checkout-form';
    const inputs = {};

    [['caption_nl', 'Bijschrift (NL)'], ['caption_en', 'Bijschrift (EN)'], ['caption_fr', 'Bijschrift (FR)'], ['caption_de', 'Bijschrift (DE)']]
      .forEach(([key, label]) => {
        const field = document.createElement('label');
        field.className = 'form-field';
        const span = document.createElement('span');
        span.textContent = label;
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 200;
        input.value = photo[key] || '';
        field.appendChild(span);
        field.appendChild(input);
        form.appendChild(field);
        inputs[key] = input;
      });

    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'checkout-submit';
    saveBtn.textContent = 'Opslaan';
    form.appendChild(saveBtn);

    const status = document.createElement('p');
    status.className = 'admin-status';
    form.appendChild(status);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      saveBtn.disabled = true;
      status.textContent = 'Opslaan...';
      try {
        const updates = {};
        Object.keys(inputs).forEach((key) => {
          updates[key] = inputs[key].value.trim() || null;
        });
        const { error } = await supabaseClient.from('album_photos').update(updates).eq('id', photo.id);
        if (error) throw error;
        window.location.reload();
      } catch (err) {
        console.error('AstroRaf: bijschrift opslaan mislukt', err);
        status.textContent = `Mislukt: ${err.message || err}`;
        saveBtn.disabled = false;
      }
    });

    panel.appendChild(form);
  }

  async function deletePhoto(photo) {
    if (!window.confirm('Deze foto definitief verwijderen?')) return;

    try {
      if (!photo.storage_path.startsWith(LOCAL_PREFIX)) {
        await supabaseClient.storage.from(STORAGE_BUCKET).remove([photo.storage_path]);
      }
      const { error } = await supabaseClient.from('album_photos').delete().eq('id', photo.id);
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      console.error('AstroRaf: foto verwijderen mislukt', err);
      window.alert(`Verwijderen mislukt: ${err.message || err}`);
    }
  }

  // ---------- Init ----------

  try {
    isEditor = await checkIsEditor();
    await loadData();
    if (isEditor) await loadShopData();
    buildAll();
  } catch (e) {
    console.error('AstroRaf: failed to load dynamic albums', e);
  }

  document.addEventListener('astroraf-lang-changed', applyLanguage);
})();
