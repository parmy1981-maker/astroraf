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

function accessReqMakeToggle({ isOn, labelOn, labelOff, disabled, danger, title, onClick }) {
  const wrap = document.createElement('div');
  wrap.className = 'req-toggle-wrap';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'req-toggle' + (isOn ? ' is-on' : '') + (danger ? ' is-danger-toggle' : '');
  toggle.setAttribute('aria-pressed', isOn ? 'true' : 'false');
  toggle.disabled = Boolean(disabled);
  toggle.title = title;
  toggle.innerHTML = '<span class="req-toggle-knob"></span>';
  toggle.addEventListener('click', onClick);
  const label = document.createElement('span');
  label.className = 'req-toggle-label';
  label.textContent = isOn ? labelOn : labelOff;
  wrap.appendChild(toggle);
  wrap.appendChild(label);
  return wrap;
}

function accessReqRenderRow(row) {
  const isSelf = row.email === (accessReqSession?.user?.email || '').toLowerCase();

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

  const accessToggle = accessReqMakeToggle({
    isOn: row.status === 'accepted',
    labelOn: 'Toegang',
    labelOff: row.status === 'blocked' ? 'Geblokkeerd' : 'Geen toegang',
    disabled: row.status === 'blocked' || isSelf,
    danger: row.status === 'blocked',
    title: isSelf
      ? 'Een andere admin moet dit voor jou doen'
      : row.status === 'accepted'
        ? 'Toegang intrekken (blokkeert ook meteen nieuwe aanvragen van dit e-mailadres)'
        : 'Toegang verlenen',
    onClick: () => accessReqAction(row.email, row.status === 'accepted' ? 'revoke' : 'accept'),
  });

  const adminToggle = row.status === 'accepted' ? accessReqMakeToggle({
    isOn: row.role === 'admin',
    labelOn: 'Admin',
    labelOff: 'Editor',
    disabled: isSelf && row.role === 'admin',
    title: isSelf && row.role === 'admin'
      ? 'Een andere admin moet dit voor jou doen'
      : row.role === 'admin' ? 'Admin-rechten intrekken' : 'Admin-rechten geven (mag dit gebruikersbeheer ook zelf bedienen)',
    onClick: () => accessReqAction(row.email, row.role === 'admin' ? 'demote' : 'promote'),
  }) : null;

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'req-delete-btn';
  deleteBtn.disabled = isSelf;
  deleteBtn.title = isSelf ? 'Een andere admin moet dit voor jou doen' : 'Volledig verwijderen (geen blokkade — kan opnieuw een aanvraag indienen)';
  deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>';
  deleteBtn.addEventListener('click', () => {
    if (confirm(`"${row.display_name || row.email}" (${row.email}) volledig verwijderen?\n\nGeen blokkade: deze persoon kan daarna opnieuw een toegangsaanvraag indienen.`)) {
      accessReqAction(row.email, 'delete');
    }
  });

  actions.appendChild(accessToggle);
  if (adminToggle) actions.appendChild(adminToggle);
  actions.appendChild(deleteBtn);
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
