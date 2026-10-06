window.astrorafDynamicAlbumsReady = (async () => {
  const albumGrid = document.getElementById('albumGrid');
  const gallerySection = document.querySelector('.gallery-page');
  if (!albumGrid || !gallerySection) return;

  let albums = [];
  let photosByAlbum = {};

  try {
    const { data: albumRows, error: albumsError } = await supabaseClient
      .from('albums')
      .select('id,slug,name,created_at')
      .order('created_at', { ascending: true });
    if (albumsError) throw albumsError;
    albums = albumRows || [];

    if (albums.length) {
      const { data: photoRows, error: photosError } = await supabaseClient
        .from('album_photos')
        .select('id,album_id,storage_path,caption,sort_order')
        .order('sort_order', { ascending: true });
      if (photosError) throw photosError;
      (photoRows || []).forEach((photo) => {
        if (!photosByAlbum[photo.album_id]) photosByAlbum[photo.album_id] = [];
        photosByAlbum[photo.album_id].push(photo);
      });
    }
  } catch (e) {
    console.error('AstroRaf: failed to load dynamic albums', e);
    return;
  }

  albums.forEach((album) => {
    const photos = photosByAlbum[album.id] || [];
    if (!photos.length) return;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'album-card';
    card.setAttribute('data-open-album', album.slug);

    const cover = document.createElement('span');
    cover.className = 'album-cover';
    const coverImg = document.createElement('img');
    coverImg.src = publicPhotoUrl(photos[0].storage_path);
    coverImg.alt = album.name;
    cover.appendChild(coverImg);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'album-name';
    nameSpan.textContent = album.name;

    card.appendChild(cover);
    card.appendChild(nameSpan);
    albumGrid.appendChild(card);

    const detail = document.createElement('div');
    detail.className = 'album-detail';
    detail.setAttribute('data-album-detail', album.slug);
    detail.hidden = true;

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'back-link';
    backBtn.setAttribute('data-close-album', '');
    backBtn.innerHTML = '&larr; <span>Terug naar albums</span>';

    const title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = album.name;

    const grid = document.createElement('div');
    grid.className = 'photo-grid';

    photos.forEach((photo) => {
      const tile = document.createElement('div');
      tile.className = 'photo-tile';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'photo-placeholder photo-open';
      openBtn.setAttribute('data-lightbox-src', publicPhotoUrl(photo.storage_path));

      const img = document.createElement('img');
      img.src = publicPhotoUrl(photo.storage_path);
      img.alt = photo.caption || album.name;
      openBtn.appendChild(img);

      const likeBtn = document.createElement('button');
      likeBtn.type = 'button';
      likeBtn.className = 'like-btn';
      likeBtn.setAttribute('data-like', photo.id);
      likeBtn.setAttribute('aria-label', 'Like');
      likeBtn.setAttribute('aria-pressed', 'false');
      likeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20.5s-7.5-4.6-9.8-9.1C.6 8.1 2 4.8 5.2 4.1c2-.4 3.9.5 5 2.1a5.6 5.6 0 0 1 1.8-2c2.8-1.9 6.4-.6 7.6 2.4 1.6 3.9-1.1 8.5-7.6 13.9z"/></svg><span class="like-count">0</span>';

      tile.appendChild(openBtn);
      tile.appendChild(likeBtn);
      grid.appendChild(tile);
    });

    detail.appendChild(backBtn);
    detail.appendChild(title);
    detail.appendChild(grid);
    gallerySection.appendChild(detail);
  });

  function publicPhotoUrl(storagePath) {
    const { data } = supabaseClient.storage.from('album-photos').getPublicUrl(storagePath);
    return data.publicUrl;
  }
})();
