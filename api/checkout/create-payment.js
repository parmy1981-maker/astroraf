const SUPABASE_URL = 'https://fqjlfonsdazjwgwchvko.supabase.co';

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function cleanString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

async function sbFetch(path, serviceKey, init) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const customer = req.body?.customer || {};
  const name = cleanString(customer.name, 120);
  const email = cleanString(customer.email, 180);
  const address = cleanString(customer.address, 300);
  const notes = cleanString(customer.notes, 1000);
  const method = cleanString(req.body?.method, 40);
  const lang = cleanString(req.body?.lang, 5) || 'nl';
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];

  if (!name || !email || !address || !method || !items.length) {
    res.status(400).json({ error: 'Ongeldige bestelling' });
    return;
  }

  const validItems = items
    .map((item) => ({
      productId: cleanString(item?.productId, 60),
      fieldId: cleanString(item?.fieldId, 60) || null,
      material: cleanString(item?.material, 20) || null,
      qty: Number.isInteger(item?.qty) ? item.qty : parseInt(item?.qty, 10),
      acceptedSurchargeFieldIds: Array.isArray(item?.acceptedSurchargeFieldIds)
        ? item.acceptedSurchargeFieldIds.map((id) => cleanString(id, 60)).filter(Boolean)
        : [],
    }))
    .filter((item) => item.productId && item.qty >= 1 && item.qty <= 99);

  if (validItems.length !== items.length) {
    res.status(400).json({ error: 'Ongeldige bestelling' });
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let order;

  try {
    const productIds = [...new Set(validItems.map((i) => i.productId))];

    const productsRes = await sbFetch(
      `shop_products?select=id,active,price_cents,title_nl,category_id,shop_categories(slug),shop_product_field_prices(field_id,price_cents)&id=in.(${productIds.join(',')})`,
      serviceKey
    );
    const products = await productsRes.json();
    const productsById = new Map(products.map((p) => [p.id, p]));

    const categoryIds = [...new Set(products.map((p) => p.category_id))];
    const fieldsRes = categoryIds.length
      ? await sbFetch(`shop_category_fields?select=id,category_id,field_type,label,price_cents,mandatory&category_id=in.(${categoryIds.join(',')})`, serviceKey)
      : null;
    const allFields = fieldsRes ? await fieldsRes.json() : [];
    const fieldsByCategory = new Map();
    allFields.forEach((f) => {
      if (!fieldsByCategory.has(f.category_id)) fieldsByCategory.set(f.category_id, []);
      fieldsByCategory.get(f.category_id).push(f);
    });

    const orderItems = validItems.map((item) => {
      const product = productsById.get(item.productId);
      if (!product || !product.active) throw new Error(`Onbekend of inactief product: ${item.productId}`);

      const variantFields = (fieldsByCategory.get(product.category_id) || []).filter((f) => f.field_type === 'variant');

      let unitPriceCents;
      let fieldLabel = null;
      if (variantFields.length) {
        const field = variantFields.find((f) => f.id === item.fieldId);
        const priceRow = field && (product.shop_product_field_prices || []).find((r) => r.field_id === field.id);
        if (!field || !priceRow) throw new Error(`Onbekende of niet-ingestelde optie voor product ${item.productId}`);
        unitPriceCents = priceRow.price_cents;
        fieldLabel = field.label;
      } else {
        unitPriceCents = product.price_cents;
      }
      if (!(unitPriceCents > 0)) throw new Error(`Prijs nog niet ingesteld voor product ${item.productId}`);

      return {
        product_id: item.productId,
        category_slug: product.shop_categories?.slug || null,
        product_title: product.title_nl || '',
        format: fieldLabel,
        material: item.material,
        qty: item.qty,
        unit_price_cents: unitPriceCents,
        line_total_cents: unitPriceCents * item.qty,
      };
    });

    const subtotalCents = orderItems.reduce((sum, i) => sum + i.line_total_cents, 0);

    // Toeslagen (vroeger: shop_settings.shipping_fee_cents, één keer per
    // bestelling) worden nu één keer per AANWEZIGE rubriek opgeteld, nooit
    // per lijn/qty. Verplichte algemene kosten tellen altijd mee; optionele
    // enkel als minstens één item van die rubriek ze aanvaard heeft
    // (acceptedSurchargeFieldIds, ingevuld op de productpagina).
    const presentCategoryIds = [...new Set(validItems.map((i) => productsById.get(i.productId)?.category_id).filter(Boolean))];
    const surchargeCents = presentCategoryIds.reduce((sum, catId) => {
      const fields = (fieldsByCategory.get(catId) || []).filter((f) => f.field_type === 'surcharge');
      const itemsInCategory = validItems.filter((i) => productsById.get(i.productId)?.category_id === catId);
      return sum + fields.reduce((s, f) => {
        const accepted = f.mandatory || itemsInCategory.some((i) => i.acceptedSurchargeFieldIds.includes(f.id));
        return s + (accepted ? f.price_cents : 0);
      }, 0);
    }, 0);

    const totalCents = subtotalCents + surchargeCents;

    if (totalCents <= 0) {
      res.status(409).json({ error: 'Prijzen zijn nog niet ingesteld voor dit product' });
      return;
    }

    const insertOrderRes = await sbFetch('shop_orders', serviceKey, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'open',
        customer_name: name,
        customer_email: email,
        customer_address: address,
        customer_notes: notes || null,
        subtotal_cents: subtotalCents,
        shipping_cents: surchargeCents,
        total_cents: totalCents,
        currency: 'EUR',
      }),
    });
    [order] = await insertOrderRes.json();

    await sbFetch('shop_order_items', serviceKey, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(orderItems.map((i) => ({ ...i, order_id: order.id }))),
    });

    const mollieRes = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MOLLIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: { currency: 'EUR', value: (totalCents / 100).toFixed(2) },
        description: `AstroRaf.be bestelling #${order.id.slice(0, 8)}`,
        redirectUrl: `${baseUrl(req)}/shop.html?order=${order.id}`,
        webhookUrl: `${baseUrl(req)}/api/checkout/webhook`,
        method,
        metadata: { orderId: order.id },
        locale: { nl: 'nl_BE', fr: 'fr_BE', de: 'de_DE' }[lang] || 'en_US',
      }),
    });
    if (!mollieRes.ok) throw new Error(await mollieRes.text());
    const payment = await mollieRes.json();

    await sbFetch(`shop_orders?id=eq.${order.id}`, serviceKey, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ mollie_payment_id: payment.id, mollie_method: method, status: 'pending' }),
    });

    res.status(200).json({ orderId: order.id, checkoutUrl: payment._links.checkout.href });
  } catch (err) {
    console.error('checkout/create-payment: mislukt', err);
    if (order?.id) {
      try {
        await sbFetch(`shop_orders?id=eq.${order.id}`, serviceKey, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'failed' }),
        });
      } catch (patchErr) {
        console.error('checkout/create-payment: order op failed zetten mislukt', patchErr);
      }
    }
    res.status(502).json({ error: 'Betaling kon niet gestart worden, probeer opnieuw.' });
  }
}
