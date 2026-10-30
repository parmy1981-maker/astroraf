// Haalt op welke betaalmethodes Raf echt actief heeft staan in zijn Mollie-
// dashboard, zodat de methode-kiezer op shop.html nooit uit de pas loopt met
// wat daar werkelijk is ingeschakeld.
const MOLLIE_LOCALES = { nl: 'nl_BE', fr: 'fr_BE', de: 'de_DE' };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const lang = typeof req.query.lang === 'string' ? req.query.lang : 'nl';
  const locale = MOLLIE_LOCALES[lang] || 'en_US';

  try {
    const mollieRes = await fetch(`https://api.mollie.com/v2/methods?locale=${locale}`, {
      headers: { Authorization: `Bearer ${process.env.MOLLIE_API_KEY}` },
    });
    if (!mollieRes.ok) throw new Error(await mollieRes.text());
    const body = await mollieRes.json();
    const methods = (body._embedded?.methods || []).map((m) => ({ id: m.id, label: m.description }));
    res.status(200).json({ methods });
  } catch (err) {
    console.error('checkout/methods: Mollie-methodes ophalen mislukt', err);
    res.status(502).json({ methods: [], error: 'Betaalmethodes laden mislukt' });
  }
}
