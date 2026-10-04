document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('homeGalleryGrid');
  if (!grid) return;

  const counts = await fetchLikeCounts();
  const topPhotos = PHOTOS
    .map((p) => ({ ...p, likeCount: counts[p.id] || 0 }))
    .filter((p) => p.likeCount > 0)
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 6);

  if (!topPhotos.length) return;

  grid.innerHTML = '';

  topPhotos.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'photo-grid-item';

    const link = document.createElement('a');
    link.className = 'photo-placeholder';
    link.href = `fotos.html#${p.album}:${p.id}`;

    const img = document.createElement('img');
    img.src = p.src;
    img.setAttribute('data-i18n-alt', p.altKey);
    link.appendChild(img);

    const tag = document.createElement('a');
    tag.className = 'photo-album-tag';
    tag.href = `fotos.html#${p.album}`;
    tag.setAttribute('data-i18n-html', p.albumTagKey);

    item.appendChild(link);
    item.appendChild(tag);
    grid.appendChild(item);
  });

  applyLanguage(localStorage.getItem('astroraf-lang') || 'nl');
});
