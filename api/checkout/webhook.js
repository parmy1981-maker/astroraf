const SUPABASE_URL = 'https://fqjlfonsdazjwgwchvko.supabase.co';

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

async function readPaymentId(req) {
  if (req.body?.id) return req.body.id;
  if (typeof req.body === 'string' && req.body) return new URLSearchParams(req.body).get('id');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return new URLSearchParams(raw).get('id');
}

function formatEuro(cents) {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sbHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  let paymentId;
  try {
    paymentId = await readPaymentId(req);
  } catch (err) {
    console.error('checkout/webhook: body lezen mislukt', err);
    res.status(400).json({ error: 'Ongeldig verzoek' });
    return;
  }
  if (!paymentId) {
    res.status(400).json({ error: 'Geen betalings-id' });
    return;
  }

  let payment;
  try {
    const paymentRes = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MOLLIE_API_KEY}` },
    });
    if (paymentRes.status === 404) {
      // Onbekende/verwijderde betaling -- niets te doen, stop Mollie's retries.
      res.status(200).json({ ok: true });
      return;
    }
    if (!paymentRes.ok) throw new Error(await paymentRes.text());
    payment = await paymentRes.json();
  } catch (err) {
    console.error('checkout/webhook: Mollie-betaling ophalen mislukt', err);
    res.status(500).json({ error: 'Opzoeken bij Mollie mislukt' });
    return;
  }

  const statusMap = { paid: 'paid', open: 'pending', pending: 'pending', authorized: 'pending', failed: 'failed', canceled: 'canceled', expired: 'expired' };
  const localStatus = statusMap[payment.status] || 'pending';

  try {
    if (localStatus !== 'paid') {
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/shop_orders?mollie_payment_id=eq.${paymentId}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: localStatus, mollie_status: payment.status }),
      });
      if (!patchRes.ok) throw new Error(await patchRes.text());
      res.status(200).json({ ok: true });
      return;
    }

    // Enkel de eerste keer dat dit order overgaat naar "paid" wordt de rij
    // geraakt (status=neq.paid) -- zo blijft dit idempotent als Mollie de
    // webhook meermaals aanroept.
    const transitionRes = await fetch(
      `${SUPABASE_URL}/rest/v1/shop_orders?mollie_payment_id=eq.${paymentId}&status=neq.paid`,
      {
        method: 'PATCH',
        headers: { ...sbHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'paid', mollie_status: 'paid', paid_at: new Date().toISOString() }),
      }
    );
    if (!transitionRes.ok) throw new Error(await transitionRes.text());
    const [order] = await transitionRes.json();

    if (!order) {
      // Al eerder op "paid" gezet door een vorige webhook-aanroep -- niets meer te doen.
      res.status(200).json({ ok: true });
      return;
    }

    try {
      const itemsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/shop_order_items?select=*&order_id=eq.${order.id}`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      const items = itemsRes.ok ? await itemsRes.json() : [];

      const itemLines = items
        .map((i) => {
          const parts = [escapeHtml(i.product_title)];
          if (i.format) parts.push(escapeHtml(i.format));
          if (i.material) parts.push(escapeHtml(i.material));
          return `<li>${parts.join(' — ')} × ${i.qty} = ${formatEuro(i.line_total_cents)}</li>`;
        })
        .join('');

      const html = `
        <p>Nieuwe betaalde bestelling op AstroRaf.be:</p>
        <ul>${itemLines}</ul>
        <p>Subtotaal: ${formatEuro(order.subtotal_cents)}<br>
        Toeslagen: ${formatEuro(order.shipping_cents)}<br>
        <b>Totaal: ${formatEuro(order.total_cents)}</b></p>
        <p><b>${escapeHtml(order.customer_name)}</b> &lt;${escapeHtml(order.customer_email)}&gt;<br>
        ${escapeHtml(order.customer_address)}</p>
        <p>Opmerkingen: ${order.customer_notes ? escapeHtml(order.customer_notes) : '(geen)'}</p>
        <p>Mollie-betaling: ${escapeHtml(paymentId)}</p>
      `;

      const mailRes = await sendMail({
        to: 'info@astroraf.be',
        subject: 'AstroRaf.be — nieuwe betaalde bestelling',
        html,
        replyTo: order.customer_email,
      });
      if (!mailRes.ok) throw new Error(await mailRes.text());

      await fetch(`${SUPABASE_URL}/rest/v1/shop_orders?id=eq.${order.id}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ notified_at: new Date().toISOString() }),
      });
    } catch (mailErr) {
      // Mollie moet hoe dan ook een 200 krijgen (de betaalstatus zelf staat al
      // correct) -- enkel loggen, nooit de webhook laten falen op een mailfout.
      console.error('checkout/webhook: melding naar Raf mislukt', mailErr);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('checkout/webhook: status bijwerken mislukt', err);
    res.status(500).json({ error: 'Bijwerken mislukt' });
  }
}
