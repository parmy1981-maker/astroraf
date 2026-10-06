document.addEventListener('DOMContentLoaded', async () => {
  await (window.astrorafDynamicAlbumsReady || Promise.resolve());

  let likeCounts = await fetchLikeCounts();

  function updateLikeCountDisplay(id) {
    const count = likeCounts[id] || 0;
    document.querySelectorAll(`[data-like="${id}"] .like-count`).forEach((span) => {
      span.textContent = String(count);
    });
  }

  document.querySelectorAll('[data-like]').forEach((el) => {
    updateLikeCountDisplay(el.dataset.like);
  });

  const albumView = document.getElementById('albumView');
  const albumDetails = document.querySelectorAll('[data-album-detail]');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxLike = document.getElementById('lightboxLike');

  let openAlbum = null;
  let openLightbox = null;
  let openPhotoButtonExternal = null;

  function setLikeUI(el, liked) {
    el.classList.toggle('is-liked', liked);
    el.setAttribute('aria-pressed', String(liked));
  }

  function applyLikeState(id) {
    const liked = isLikedLocally(id);
    document.querySelectorAll('[data-like]').forEach((el) => {
      if (el.dataset.like === id) setLikeUI(el, liked);
    });
  }

  async function handleLikeClick(id) {
    const nowLiked = await toggleRemoteLike(id);
    if (nowLiked === null) return;
    likeCounts[id] = (likeCounts[id] || 0) + (nowLiked ? 1 : -1);
    updateLikeCountDisplay(id);
    applyLikeState(id);
  }

  document.querySelectorAll('.like-btn[data-like]').forEach((btn) => {
    applyLikeState(btn.dataset.like);
    btn.addEventListener('click', () => handleLikeClick(btn.dataset.like));
  });

  if (lightboxLike) {
    lightboxLike.addEventListener('click', () => {
      const id = lightboxLike.dataset.like;
      if (!id) return;
      handleLikeClick(id);
    });
  }

  if (albumView) {
    openAlbum = (id) => {
      albumView.hidden = true;
      albumDetails.forEach((section) => {
        section.hidden = section.getAttribute('data-album-detail') !== id;
      });
    };

    document.querySelectorAll('[data-open-album]').forEach((btn) => {
      btn.addEventListener('click', () => openAlbum(btn.getAttribute('data-open-album')));
    });

    document.querySelectorAll('[data-close-album]').forEach((btn) => {
      btn.addEventListener('click', () => {
        albumDetails.forEach((section) => { section.hidden = true; });
        albumView.hidden = false;
        history.replaceState(null, '', window.location.pathname);
      });
    });
  }

  const albumSearch = document.getElementById('albumSearch');
  const albumGrid = document.getElementById('albumGrid');
  const albumSearchEmpty = document.getElementById('albumSearchEmpty');

  if (albumSearch && albumGrid) {
    const albumCards = albumGrid.querySelectorAll('.album-card');

    albumSearch.addEventListener('input', () => {
      const query = albumSearch.value.trim().toLowerCase();
      let visibleCount = 0;

      albumCards.forEach((card) => {
        const name = card.querySelector('.album-name');
        const matches = !query || (name && name.textContent.toLowerCase().includes(query));
        card.hidden = !matches;
        if (matches) visibleCount += 1;
      });

      if (albumSearchEmpty) albumSearchEmpty.hidden = visibleCount > 0;
    });
  }

  let currentPhotoButtons = [];
  let currentPhotoIndex = -1;
  let returnToOrigin = false;

  if (lightbox && lightboxImg) {
    openLightbox = (src, alt, likeId) => {
      lightboxImg.src = src;
      lightboxImg.alt = alt || '';
      lightbox.hidden = false;

      if (lightboxLike) {
        const id = likeId || src.split('/').pop();
        lightboxLike.dataset.like = id;
        applyLikeState(id);
        updateLikeCountDisplay(id);
      }
    };

    const openPhotoButton = (btn, isOriginLink) => {
      const grid = btn.closest('.photo-grid');
      currentPhotoButtons = grid ? Array.from(grid.querySelectorAll('[data-lightbox-src]')) : [btn];
      currentPhotoIndex = currentPhotoButtons.indexOf(btn);
      const img = btn.querySelector('img');
      const tile = btn.closest('.photo-tile');
      const likeBtn = tile ? tile.querySelector('.like-btn[data-like]') : null;
      returnToOrigin = Boolean(isOriginLink);
      openLightbox(btn.getAttribute('data-lightbox-src'), img ? img.alt : '', likeBtn ? likeBtn.dataset.like : null);
    };
    openPhotoButtonExternal = openPhotoButton;

    const openPhotoAt = (index) => {
      const total = currentPhotoButtons.length;
      if (!total) return;
      currentPhotoIndex = (index + total) % total;
      openPhotoButton(currentPhotoButtons[currentPhotoIndex]);
    };

    const closeLightbox = () => {
      lightbox.hidden = true;
      lightboxImg.src = '';
      if (returnToOrigin) {
        returnToOrigin = false;
        history.back();
      }
    };

    document.querySelectorAll('[data-lightbox-src]').forEach((btn) => {
      btn.addEventListener('click', () => openPhotoButton(btn));
    });

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (lightbox.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') openPhotoAt(currentPhotoIndex + 1);
      if (e.key === 'ArrowLeft') openPhotoAt(currentPhotoIndex - 1);
    });
  }

  const rawHash = decodeURIComponent(window.location.hash.replace('#', ''));
  const [hashAlbum, hashPhoto] = rawHash.split(':');

  if (hashAlbum && openAlbum && document.querySelector(`[data-album-detail="${hashAlbum}"]`)) {
    openAlbum(hashAlbum);

    if (hashPhoto && openPhotoButtonExternal) {
      const targetBtn = document.querySelector(`[data-lightbox-src$="${hashPhoto}"]`);
      if (targetBtn) openPhotoButtonExternal(targetBtn, true);
    }
  }
});
