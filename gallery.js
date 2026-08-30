const LIKES_KEY = 'astroraf-likes';

function loadLikes() {
  try {
    const raw = localStorage.getItem(LIKES_KEY);
    const likes = raw ? JSON.parse(raw) : [];
    return Array.isArray(likes) ? likes : [];
  } catch (e) {
    return [];
  }
}

function saveLikes(likes) {
  localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
}

function isLiked(photoId) {
  return loadLikes().includes(photoId);
}

function toggleLike(photoId) {
  const likes = loadLikes();
  const idx = likes.indexOf(photoId);
  if (idx === -1) likes.push(photoId); else likes.splice(idx, 1);
  saveLikes(likes);
  return likes.includes(photoId);
}

document.addEventListener('DOMContentLoaded', () => {
  const albumView = document.getElementById('albumView');
  const albumDetails = document.querySelectorAll('[data-album-detail]');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxLike = document.getElementById('lightboxLike');

  let openAlbum = null;
  let openLightbox = null;

  function setLikeUI(el, liked) {
    el.classList.toggle('is-liked', liked);
    el.setAttribute('aria-pressed', String(liked));
  }

  function applyLikeState(id) {
    const liked = isLiked(id);
    document.querySelectorAll('[data-like]').forEach((el) => {
      if (el.dataset.like === id) setLikeUI(el, liked);
    });
  }

  document.querySelectorAll('.like-btn[data-like]').forEach((btn) => {
    applyLikeState(btn.dataset.like);
    btn.addEventListener('click', () => {
      toggleLike(btn.dataset.like);
      applyLikeState(btn.dataset.like);
    });
  });

  if (lightboxLike) {
    lightboxLike.addEventListener('click', () => {
      const id = lightboxLike.dataset.like;
      if (!id) return;
      toggleLike(id);
      applyLikeState(id);
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

  if (lightbox && lightboxImg) {
    openLightbox = (src, alt) => {
      lightboxImg.src = src;
      lightboxImg.alt = alt || '';
      lightbox.hidden = false;

      if (lightboxLike) {
        const id = src.split('/').pop();
        lightboxLike.dataset.like = id;
        applyLikeState(id);
      }
    };

    const closeLightbox = () => {
      lightbox.hidden = true;
      lightboxImg.src = '';
    };

    document.querySelectorAll('[data-lightbox-src]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const img = btn.querySelector('img');
        openLightbox(btn.getAttribute('data-lightbox-src'), img ? img.alt : '');
      });
    });

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
    });
  }

  const rawHash = decodeURIComponent(window.location.hash.replace('#', ''));
  const [hashAlbum, hashPhoto] = rawHash.split(':');

  if (hashAlbum && openAlbum && document.querySelector(`[data-album-detail="${hashAlbum}"]`)) {
    openAlbum(hashAlbum);

    if (hashPhoto && openLightbox) {
      const targetBtn = document.querySelector(`[data-lightbox-src$="${hashPhoto}"]`);
      if (targetBtn) {
        const img = targetBtn.querySelector('img');
        openLightbox(targetBtn.getAttribute('data-lightbox-src'), img ? img.alt : '');
      }
    }
  }
});
