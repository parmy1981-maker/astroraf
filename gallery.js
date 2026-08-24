document.addEventListener('DOMContentLoaded', () => {
  const albumView = document.getElementById('albumView');
  const albumDetails = document.querySelectorAll('[data-album-detail]');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');

  let openAlbum = null;
  let openLightbox = null;

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
