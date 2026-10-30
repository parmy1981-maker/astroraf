const SUPABASE_URL = 'https://fqjlfonsdazjwgwchvko.supabase.co';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Publiek, zonder login bereikbaar (de klant landt hier net na Mollie zonder
// sessie) -- het order-id zelf is het enige "bewijs", dus geeft bewust nooit
// klantgegevens terug, enkel de status + het bedrag.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const orderId = typeof req.query.order === 'string' ? req.query.order : '';
  if (!UUID_RE.test(orderId)) {
    res.status(400).json({ error: 'Ongeldig bestelnummer' });
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const sbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/shop_orders?select=status,total_cents,currency&id=eq.${orderId}`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!sbRes.ok) throw new Error(await sbRes.text());
    const [order] = await sbRes.json();
    if (!order) {
      res.status(404).json({ error: 'Niet gevonden' });
      return;
    }
    res.status(200).json(order);
  } catch (err) {
    console.error('checkout/order-status: mislukt', err);
    res.status(500).json({ error: 'Opzoeken mislukt' });
  }
}
