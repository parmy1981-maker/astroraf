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
  let shopLinksByPhoto = {};
  let photoLinkedProductIds = {};
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
    const { data: linkRows, error: linkError } = await supabaseClient
      .from('shop_product_photo_links')
      .select('id,photo_id,product_id,shop_products(id,product_number,title_nl,active)');
    if (linkError) throw linkError;

    shopLinksByPhoto = {};
    (linkRows || []).forEach((link) => {
      if (!link.shop_products) return;
      if (!shopLinksByPhoto[link.photo_id]) shopLinksByPhoto[link.photo_id] = [];
      shopLinksByPhoto[link.photo_id].push(link);
    });
  }

  async function loadPublicShopLinks() {
    const { data, error } = await supabaseClient
      .from('shop_product_photo_links')
      .select('photo_id,product_id,shop_products!inner(active)')
      .eq('shop_products.active', true);
    if (error) {
      console.error('AstroRaf: shop-koppelingen laden mislukt', error);
      return;
    }
    photoLinkedProductIds = {};
    (data || []).forEach((row) => {
      if (!photoLinkedProductIds[row.photo_id]) photoLinkedProductIds[row.photo_id] = [];
      photoLinkedProductIds[row.photo_id].push(row.product_id);
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

    const media = document.createElement('div');
    media.className = 'photo-media';

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

    media.appendChild(openBtn);
    media.appendChild(likeBtn);

    const linkedIds = photoLinkedProductIds[photo.id] || [];
    if (linkedIds.length) {
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'shop-link-badge';
      badge.setAttribute('aria-label', 'Beschikbaar in de shop');
      badge.innerHTML = shopTagSvg();
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = linkedIds.length === 1
          ? `shop.html?product=${linkedIds[0]}`
          : `shop.html?photo=${photo.id}`;
      });
      media.appendChild(badge);
    }

    if (isEditor) {
      media.appendChild(makeIconButton('photo-delete-btn', trashSvg(), 'Foto verwijderen', () => deletePhoto(photo)));
      media.appendChild(makeIconButton('photo-caption-btn', pencilSvg(), 'Bijschrift bewerken', () => openPhotoCaptionModal(photo)));
    }

    tile.appendChild(media);

    if (photoCaptionOnly(photo)) {
      const caption = document.createElement('p');
      caption.className = 'photo-caption';
      registerLangRef(caption, 'text', () => photoCaptionOnly(photo));
      tile.appendChild(caption);
    }

    if (isEditor) {
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

    (shopLinksByPhoto[photo.id] || []).forEach((link) => {
      const product = link.shop_products;
      const pill = document.createElement('span');
      pill.className = 'shop-tag-pill';
      pill.textContent = `#${product.product_number} ${product.title_nl || ''}`.trim();

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'shop-tag-pill-remove';
      removeBtn.setAttribute('aria-label', 'Koppeling verwijderen');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => removeShopLink(link));
      pill.appendChild(removeBtn);
      wrap.appendChild(pill);
    });

    const addWrap = document.createElement('div');
    addWrap.className = 'shop-tag-add-inline';

    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = 1;
    numberInput.step = 1;
    numberInput.className = 'shop-tag-number-input';
    numberInput.placeholder = '#nummer';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'shop-tag-add';
    confirmBtn.innerHTML = `${shopTagSvg()}<span>Koppelen</span>`;

    const errorEl = document.createElement('span');
    errorEl.className = 'shop-tag-error';
    errorEl.hidden = true;

    confirmBtn.addEventListener('click', () => linkShopProductByNumber(photo, numberInput, errorEl));

    addWrap.appendChild(numberInput);
    addWrap.appendChild(confirmBtn);
    addWrap.appendChild(errorEl);
    wrap.appendChild(addWrap);

    return wrap;
  }

  async function linkShopProductByNumber(photo, numberInput, errorEl) {
    errorEl.hidden = true;
    const num = parseInt(numberInput.value, 10);
    if (!num || num < 1) {
      errorEl.textContent = 'Geef een geldig nummer in.';
      errorEl.hidden = false;
      return;
    }

    const { data: product, error: lookupError } = await supabaseClient
      .from('shop_products')
      .select('id')
      .eq('product_number', num)
      .eq('active', true)
      .maybeSingle();
    if (lookupError) {
      errorEl.textContent = `Mislukt: ${lookupError.message}`;
      errorEl.hidden = false;
      return;
    }
    if (!product) {
      errorEl.textContent = `Geen actief artikel met nummer #${num}.`;
      errorEl.hidden = false;
      return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    const { error: insertError } = await supabaseClient
      .from('shop_product_photo_links')
      .insert({ product_id: product.id, photo_id: photo.id, created_by: session ? session.user.email : null });
    if (insertError) {
      errorEl.textContent = insertError.code === '23505' ? 'Al gekoppeld.' : `Mislukt: ${insertError.message}`;
      errorEl.hidden = false;
      return;
    }

    window.location.reload();
  }

  async function removeShopLink(link) {
    if (!window.confirm('Deze koppeling verwijderen?')) return;
    const { error } = await supabaseClient.from('shop_product_photo_links').delete().eq('id', link.id);
    if (error) {
      window.alert(`Mislukt: ${error.message || error}`);
      return;
    }
    window.location.reload();
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
    await loadPublicShopLinks();
    if (isEditor) await loadShopData();
    buildAll();
  } catch (e) {
    console.error('AstroRaf: failed to load dynamic albums', e);
  }

  document.addEventListener('astroraf-lang-changed', applyLanguage);
})();
