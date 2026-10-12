const SUPABASE_URL = 'https://fqjlfonsdazjwgwchvko.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wBNO6y-u6E3ZV3_UOb1LMg_KnPPTdax';

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendMail({ to, subject, html, replyTo }) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'AstroRaf.be <meldingen@astroraf.be>',
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: [replyTo] } : {}),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    res.status(401).json({ error: 'Niet ingelogd' });
    return;
  }

  let user;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!userRes.ok) {
      res.status(401).json({ error: 'Ongeldige sessie' });
      return;
    }
    user = await userRes.json();
  } catch (err) {
    console.error('request-access: sessie-verificatie mislukt', err);
    res.status(401).json({ error: 'Ongeldige sessie' });
    return;
  }

  if (!user?.email || user.is_anonymous) {
    res.status(401).json({ error: 'Ongeldige sessie' });
    return;
  }

  const email = user.email.toLowerCase();
  const rawMessage = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 2000) : '';
  const displayName = user.user_metadata?.full_name || user.email;
  const safeName = escapeHtml(displayName);
  const safeEmail = escapeHtml(user.email);
  const safeMessage = rawMessage ? escapeHtml(rawMessage) : '';

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/access_requests?select=status&email=eq.${encodeURIComponent(email)}`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!existingRes.ok) throw new Error(await existingRes.text());
    const [existing] = await existingRes.json();
    if (existing?.status === 'blocked') {
      // Stilletjes niets doen: geen mail, geen foutmelding die verklapt dat dit adres geblokkeerd is.
      res.status(200).json({ ok: true });
      return;
    }

    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/access_requests`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        email,
        display_name: displayName,
        message: rawMessage || null,
        status: 'pending',
        requested_at: new Date().toISOString(),
      }),
    });
    if (!upsertRes.ok) throw new Error(await upsertRes.text());
  } catch (err) {
    console.error('request-access: aanvraag opslaan mislukt', err);
    res.status(500).json({ error: 'Opslaan mislukt' });
    return;
  }

  const ownerHtml = `
    <p>Nieuwe toegangsaanvraag voor albumbeheer op AstroRaf.be:</p>
    <p><b>${safeName}</b> &lt;${safeEmail}&gt;</p>
    <p>Bericht: ${safeMessage || '(geen bericht)'}</p>
  `;

  const requesterHtml = `
    <p>Beste ${safeName},</p>
    <p>We hebben je aanvraag voor toegang tot het albumbeheer van AstroRaf.be ontvangen. Raf neemt deze door en neemt indien nodig contact met je op.</p>
  `;

  try {
    const ownerSend = await sendMail({
      to: 'info@astroraf.be',
      subject: 'AstroRaf.be — nieuwe toegangsaanvraag',
      html: ownerHtml,
      replyTo: user.email,
    });
    if (!ownerSend.ok) {
      const detail = await ownerSend.text();
      throw new Error(`owner mail failed: ${detail}`);
    }
  } catch (err) {
    console.error('request-access: mail naar info@astroraf.be mislukt', err);
    res.status(502).json({ error: 'Versturen mislukt' });
    return;
  }

  try {
    await sendMail({
      to: user.email,
      subject: 'AstroRaf.be — we hebben je aanvraag ontvangen',
      html: requesterHtml,
    });
  } catch (err) {
    console.error('request-access: bevestigingsmail aan aanvrager mislukt', err);
  }

  res.status(200).json({ ok: true });
}
