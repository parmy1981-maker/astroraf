const SUPABASE_URL = 'https://fqjlfonsdazjwgwchvko.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wBNO6y-u6E3ZV3_UOb1LMg_KnPPTdax';

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendMail({ to, subject, html }) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: 'AstroRaf.be <meldingen@astroraf.be>', to: [to], subject, html }),
  });
}

async function requireAdmin(req, res) {
  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    res.status(401).json({ error: 'Niet ingelogd' });
    return null;
  }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) {
    res.status(401).json({ error: 'Ongeldige sessie' });
    return null;
  }
  const user = await userRes.json();
  if (!user?.email || user.is_anonymous) {
    res.status(401).json({ error: 'Ongeldige sessie' });
    return null;
  }

  const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const isAdmin = adminRes.ok && (await adminRes.json()) === true;
  if (!isAdmin) {
    res.status(403).json({ error: 'Enkel voor admins' });
    return null;
  }

  return { email: user.email.toLowerCase() };
}

async function fetchAllAuthUsers(serviceKey) {
  const map = {};
  let page = 1;
  for (;;) {
    const r = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!r.ok) break;
    const body = await r.json();
    const users = body.users || [];
    for (const u of users) {
      if (u.email) map[u.email.toLowerCase()] = u.last_sign_in_at || null;
    }
    if (users.length < 200) break;
    page += 1;
  }
  return map;
}

async function handleList(req, res, serviceKey) {
  const [editorsRes, requestsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/editors?select=email,role`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    }),
    fetch(`${SUPABASE_URL}/rest/v1/access_requests?select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    }),
  ]);
  if (!editorsRes.ok || !requestsRes.ok) {
    const editorsErr = editorsRes.ok ? null : await editorsRes.text();
    const requestsErr = requestsRes.ok ? null : await requestsRes.text();
    throw new Error(`lezen mislukt — editors: ${editorsErr || 'ok'} | access_requests: ${requestsErr || 'ok'}`);
  }
  const editors = await editorsRes.json();
  const requests = await requestsRes.json();
  const lastLogins = await fetchAllAuthUsers(serviceKey);

  const byEmail = new Map();
  for (const r of requests) {
    byEmail.set(r.email, {
      email: r.email,
      display_name: r.display_name,
      message: r.message,
      requested_at: r.requested_at,
      status: r.status === 'blocked' ? 'blocked' : 'pending',
      role: null,
    });
  }
  for (const e of editors) {
    const existing = byEmail.get(e.email) || { email: e.email, display_name: null, message: null, requested_at: null };
    byEmail.set(e.email, { ...existing, status: 'accepted', role: e.role });
  }

  const list = Array.from(byEmail.values()).map((row) => ({
    ...row,
    last_sign_in_at: lastLogins[row.email] || null,
  }));
  list.sort((a, b) => new Date(b.last_sign_in_at || 0) - new Date(a.last_sign_in_at || 0));

  res.status(200).json({ requests: list });
}

async function handleAction(req, res, serviceKey, adminEmail) {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const action = req.body?.action;
  if (!email || !['accept', 'revoke', 'block', 'unblock', 'delete', 'promote', 'demote'].includes(action)) {
    res.status(400).json({ error: 'Ongeldige actie' });
    return;
  }
  if (email === adminEmail && (action === 'revoke' || action === 'block' || action === 'delete')) {
    res.status(400).json({ error: 'Je kan jezelf niet verwijderen/blokkeren' });
    return;
  }

  const sbHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  if (action === 'revoke' || action === 'block' || action === 'delete' || action === 'demote') {
    const adminsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/editors?select=email&role=eq.admin`,
      { headers: sbHeaders }
    );
    const admins = adminsRes.ok ? await adminsRes.json() : [];
    const targetIsOnlyAdmin = admins.length === 1 && admins[0].email === email;
    if (targetIsOnlyAdmin) {
      res.status(400).json({ error: 'Kan de laatste admin niet verwijderen/degraderen' });
      return;
    }
  }

  if (action === 'revoke' || action === 'block' || action === 'delete') {
    const delRes = await fetch(
      `${SUPABASE_URL}/rest/v1/editors?email=eq.${encodeURIComponent(email)}`,
      { method: 'DELETE', headers: sbHeaders }
    );
    if (!delRes.ok) throw new Error(await delRes.text());
  }

  if (action === 'promote' || action === 'demote') {
    const roleRes = await fetch(
      `${SUPABASE_URL}/rest/v1/editors?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ role: action === 'promote' ? 'admin' : 'editor' }),
      }
    );
    if (!roleRes.ok) throw new Error(await roleRes.text());
  }

  if (action === 'accept') {
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/editors`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ email, role: 'editor' }),
    });
    if (!insRes.ok) throw new Error(await insRes.text());

    try {
      await sendMail({
        to: email,
        subject: 'AstroRaf.be — je hebt toegang tot het albumbeheer',
        html: `<p>Goed nieuws! Je aanvraag voor toegang tot het albumbeheer van AstroRaf.be is goedgekeurd. Je kan nu inloggen via astroraf.be en albums/foto's bewerken.</p>`,
      });
    } catch (err) {
      console.error('access-requests: bevestigingsmail mislukt', err);
    }
  }

  if (action === 'block' || action === 'unblock') {
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/access_requests`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        email,
        status: action === 'block' ? 'blocked' : 'pending',
        decided_at: new Date().toISOString(),
        decided_by: adminEmail,
      }),
    });
    if (!upsertRes.ok) throw new Error(await upsertRes.text());
  }

  if (action === 'revoke') {
    const updRes = await fetch(
      `${SUPABASE_URL}/rest/v1/access_requests?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ decided_at: new Date().toISOString(), decided_by: adminEmail }),
      }
    );
    void updRes;
  }

  if (action === 'delete') {
    const delReqRes = await fetch(
      `${SUPABASE_URL}/rest/v1/access_requests?email=eq.${encodeURIComponent(email)}`,
      { method: 'DELETE', headers: sbHeaders }
    );
    if (!delReqRes.ok) throw new Error(await delReqRes.text());
  }

  res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    if (req.method === 'GET') {
      await handleList(req, res, serviceKey);
    } else if (req.method === 'POST') {
      await handleAction(req, res, serviceKey, admin.email);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('access-requests:', err);
    res.status(500).json({ error: 'Er ging iets mis' });
  }
}
