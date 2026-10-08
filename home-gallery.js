document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('homeGalleryGrid');
  if (!grid) return;

  const STORAGE_BUCKET = 'album-photos';
  const LOCAL_PREFIX = 'local:';

  function currentLang() {
    return localStorage.getItem('astroraf-lang') || 'nl';
  }

  function albumName(album) {
    return album['name_' + currentLang()] || album.name_nl;
  }

  function photoCaption(photo, album) {
    return photo['caption_' + currentLang()] || photo.caption_nl || albumName(album);
  }

  function t(key) {
    const dict = (typeof translations !== 'undefined' && translations[currentLang()]) || {};
    return dict[key] || '';
  }

  function publicPhotoUrl(storagePath) {
    if (storagePath.startsWith(LOCAL_PREFIX)) return storagePath.slice(LOCAL_PREFIX.length);
    const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  async function loadTopEntries(counts) {
    const { data: albumRows, error: albumsError } = await supabaseClient
      .from('albums')
      .select('id,slug,name_nl,name_en,name_fr,name_de');
    if (albumsError) throw albumsError;
    if (!albumRows || !albumRows.length) return [];

    const albumsById = {};
    albumRows.forEach((a) => { albumsById[a.id] = a; });

    const { data: photoRows, error: photosError } = await supabaseClient
      .from('album_photos')
      .select('id,album_id,storage_path,like_id,caption_nl,caption_en,caption_fr,caption_de');
    if (photosError) throw photosError;

    return (photoRows || [])
      .map((photo) => {
        const album = albumsById[photo.album_id];
        if (!album) return null;
        const likeId = photo.like_id || photo.id;
        const likeCount = counts[likeId] || 0;
        return { photo, album, likeCount };
      })
      .filter((entry) => entry && entry.likeCount > 0)
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, 6);
  }

  function fillStaticFallback(counts) {
    grid.querySelectorAll('.photo-grid-item').forEach((item) => {
      const img = item.querySelector('img');
      const id = img ? img.getAttribute('src').split('/').pop() : null;
      const countEl = item.querySelector('.photo-like-total');
      if (countEl) countEl.textContent = `♥ ${counts[id] || 0}`;
    });
  }

  const counts = await fetchLikeCounts();

  let topEntries = [];
  try {
    topEntries = await loadTopEntries(counts);
  } catch (e) {
    console.error('AstroRaf: failed to load top-6 photos', e);
  }

  if (!topEntries.length) {
    fillStaticFallback(counts);
    return;
  }

  grid.innerHTML = '';
  const langRefs = [];

  topEntries.forEach(({ photo, album, likeCount }) => {
    const item = document.createElement('div');
    item.className = 'photo-grid-item';

    const url = publicPhotoUrl(photo.storage_path);
    const hashPhoto = url.split('/').pop();

    const link = document.createElement('a');
    link.className = 'photo-placeholder';
    link.href = `fotos.html#${album.slug}:${hashPhoto}`;

    const img = document.createElement('img');
    img.src = url;
    langRefs.push({ el: img, attr: 'alt', compute: () => photoCaption(photo, album) });
    link.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'photo-meta';

    const tag = document.createElement('a');
    tag.className = 'photo-album-tag';
    tag.href = `fotos.html#${album.slug}`;
    langRefs.push({ el: tag, attr: 'html', compute: () => `${t('album_tag_prefix')} ${albumName(album)} &rarr;` });

    const likeTotal = document.createElement('span');
    likeTotal.className = 'photo-like-total';
    likeTotal.textContent = `♥ ${likeCount}`;

    meta.appendChild(tag);
    meta.appendChild(likeTotal);

    item.appendChild(link);
    item.appendChild(meta);
    grid.appendChild(item);
  });

  function applyLangRefs() {
    langRefs.forEach((ref) => {
      const value = ref.compute();
      if (ref.attr === 'html') ref.el.innerHTML = value;
      else ref.el[ref.attr] = value;
    });
  }

  applyLangRefs();
  document.addEventListener('astroraf-lang-changed', applyLangRefs);
});
