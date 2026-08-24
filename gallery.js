document.addEventListener('DOMContentLoaded', () => {
  const albumView = document.getElementById('albumView');
  const albumDetails = document.querySelectorAll('[data-album-detail]');

  if (albumView) {
    document.querySelectorAll('[data-open-album]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-open-album');
        albumView.hidden = true;
        albumDetails.forEach((section) => {
          section.hidden = section.getAttribute('data-album-detail') !== id;
        });
      });
    });

    document.querySelectorAll('[data-close-album]').forEach((btn) => {
      btn.addEventListener('click', () => {
        albumDetails.forEach((section) => { section.hidden = true; });
        albumView.hidden = false;
      });
    });
  }

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');

  if (lightbox && lightboxImg) {
    const openLightbox = (src, alt) => {
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
});
