const accessReqIcon = document.getElementById('accessRequestsIcon');
const accessReqBadge = document.getElementById('accessRequestsBadge');

let accessReqSession = null;
let accessReqModalEl = null;

function accessReqFmtDate(iso) {
  if (!iso) return 'nooit';
  return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'medium', timeStyle: 'short' });
}

function accessReqEnsureModal() {
  if (accessReqModalEl) return accessReqModalEl;
  const el = document.createElement('div');
  el.className = 'modal';
  el.id = 'accessRequestsModal';
  el.hidden = true;
  el.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal-panel access-requests-panel">
      <button type="button" class="modal-close" data-close>&times;</button>
      <h2>Gebruikersbeheer</h2>
      <p class="access-requests-hint">Nieuwste login staat boven.</p>
      <div class="access-requests-legend">
        <span><span class="req-toggle is-on req-toggle-demo"><span class="req-toggle-knob"></span></span> schuifje = toegang verlenen/intrekken</span>
        <span><button type="button" class="req-block-btn is-text" disabled>Blokkeren</button> = weigeren + ook toekomstige aanvragen van dit e-mailadres negeren</span>
      </div>
      <div class="access-requests-list" id="accessRequestsList"></div>
    </div>
  `;
  document.body.appendChild(el);
  el.querySelectorAll('[data-close]').forEach((n) => n.addEventListener('click', accessReqCloseModal));
  accessReqModalEl = el;
  return el;
}

function accessReqCloseModal() {
  if (accessReqModalEl) accessReqModalEl.hidden = true;
}

function accessReqStatusLabel(row) {
  if (row.status === 'accepted') return row.role === 'admin' ? 'Admin' : 'Toegang';
  if (row.status === 'blocked') return 'Geblokkeerd';
  return 'Aanvraag in afwachting';
}

function accessReqRenderRow(row) {
  const wrap = document.createElement('div');
  wrap.className = 'access-request-row';

  const info = document.createElement('div');
  info.className = 'access-request-info';
  info.innerHTML = `
    <div class="access-request-name">${row.display_name ? escapeForHtml(row.display_name) : escapeForHtml(row.email)}</div>
    <div class="access-request-email">${escapeForHtml(row.email)}</div>
    ${row.message ? `<div class="access-request-message">${escapeForHtml(row.message)}</div>` : ''}
    <div class="access-request-meta">Laatste login: ${accessReqFmtDate(row.last_sign_in_at)} &middot; ${accessReqStatusLabel(row)}</div>
  `;

  const actions = document.createElement('div');
  actions.className = 'access-request-actions';

  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'req-toggle-wrap';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'req-toggle' + (row.status === 'accepted' ? ' is-on' : '');
  toggle.setAttribute('aria-pressed', row.status === 'accepted' ? 'true' : 'false');
  toggle.disabled = row.status === 'blocked';
  toggle.title = row.status === 'accepted' ? 'Toegang intrekken' : 'Toegang verlenen';
  toggle.innerHTML = '<span class="req-toggle-knob"></span>';
  toggle.addEventListener('click', () => accessReqAction(row.email, row.status === 'accepted' ? 'revoke' : 'accept'));
  const toggleLabel = document.createElement('span');
  toggleLabel.className = 'req-toggle-label';
  toggleLabel.textContent = row.status === 'accepted' ? 'Toegang' : 'Geen toegang';
  toggleWrap.appendChild(toggle);
  toggleWrap.appendChild(toggleLabel);

  const blockBtn = document.createElement('button');
  blockBtn.type = 'button';
  blockBtn.className = 'req-block-btn is-text';
  if (row.status === 'blocked') {
    blockBtn.title = 'Deblokkeren';
    blockBtn.textContent = 'Deblokkeren';
    blockBtn.addEventListener('click', () => accessReqAction(row.email, 'unblock'));
  } else {
    blockBtn.classList.add('is-danger');
    blockBtn.title = 'Blokkeren (weigert + negeert toekomstige aanvragen van dit e-mailadres)';
    blockBtn.textContent = 'Blokkeren';
    blockBtn.addEventListener('click', () => accessReqAction(row.email, 'block'));
  }

  actions.appendChild(toggleWrap);
  actions.appendChild(blockBtn);
  wrap.appendChild(info);
  wrap.appendChild(actions);
  return wrap;
}

function escapeForHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function accessReqAction(email, action) {
  if (!accessReqSession?.access_token) return;
  try {
    const res = await fetch('/api/admin/access-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessReqSession.access_token}`,
      },
      body: JSON.stringify({ email, action }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'actie mislukt');
    }
    await accessReqLoadList();
  } catch (err) {
    console.error('access-requests-panel:', err);
    alert('Actie mislukt: ' + err.message);
  }
}

async function accessReqFetchList() {
  const res = await fetch('/api/admin/access-requests', {
    headers: { Authorization: `Bearer ${accessReqSession.access_token}` },
  });
  if (!res.ok) throw new Error('ophalen mislukt');
  const body = await res.json();
  return body.requests || [];
}

async function accessReqLoadList() {
  const listEl = document.getElementById('accessRequestsList');
  try {
    const rows = await accessReqFetchList();
    if (listEl) {
      listEl.innerHTML = '';
      if (!rows.length) {
        listEl.innerHTML = '<p class="access-requests-empty">Nog geen aanvragen.</p>';
      } else {
        rows.forEach((row) => listEl.appendChild(accessReqRenderRow(row)));
      }
    }
    const pending = rows.filter((r) => r.status === 'pending').length;
    if (accessReqBadge) {
      accessReqBadge.hidden = pending === 0;
      accessReqBadge.textContent = String(pending);
    }
  } catch (err) {
    console.error('access-requests-panel:', err);
    if (listEl) listEl.innerHTML = '<p class="access-requests-empty">Laden mislukt.</p>';
  }
}

async function accessReqOpenModal() {
  const modal = accessReqEnsureModal();
  modal.hidden = false;
  await accessReqLoadList();
}

async function initAccessRequestsPanel() {
  if (!accessReqIcon) return;

  const client = typeof accountSupabase !== 'undefined' ? accountSupabase : null;
  if (!client) return;

  const { data: { session } } = await client.auth.getSession();
  if (!session || session.user.is_anonymous || !session.user.email) return;
  accessReqSession = session;

  const { data: isAdmin } = await client.rpc('is_admin');
  if (!isAdmin) return;

  accessReqIcon.hidden = false;
  accessReqIcon.addEventListener('click', accessReqOpenModal);
  try {
    const rows = await accessReqFetchList();
    const pending = rows.filter((r) => r.status === 'pending').length;
    accessReqBadge.hidden = pending === 0;
    accessReqBadge.textContent = String(pending);
  } catch (err) {
    console.error('access-requests-panel: init telling mislukt', err);
  }
}

initAccessRequestsPanel();
