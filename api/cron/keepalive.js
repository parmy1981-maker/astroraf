const SUPABASE_URL = 'https://fqjlfonsdazjwgwchvko.supabase.co';
const TIJDZONE = 'Europe/Brussels';

// Doel-uur voor vandaag: dag < 25 -> uur = dag; dag >= 25 -> uur = dag - 10.
// De modulo vangt dag 24 op (uur 24 bestaat niet -> wordt 0u).
function doelUur(dag) {
  return (dag < 25 ? dag : dag - 10) % 24;
}

function lokaalDagUurDatum(datum) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIJDZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(datum);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    dag: Number(map.day),
    uur: Number(map.hour) % 24,
    datumStr: `${map.year}-${map.month}-${map.day}`,
  };
}

// Wordt elk uur aangeroepen (zie .github/workflows/keepalive.yml) maar voert de
// echte keep-alive maar 1x per dag uit, op een per-dag wisselend uur (doelUur).
// "uur >= doel + nog niet gelogd vandaag" i.p.v. exacte gelijkheid, zodat een
// gemiste/vertraagde GitHub Actions-run de dag niet overslaat.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Niet geautoriseerd' });
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { dag, uur, datumStr } = lokaalDagUurDatum(new Date());
  const doel = doelUur(dag);

  let laatste;
  try {
    const leesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/keep_alive_log?select=executed_at&order=executed_at.desc&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    if (!leesRes.ok) throw new Error(await leesRes.text());
    const rows = await leesRes.json();
    laatste = rows[0] || null;
  } catch (err) {
    console.error('keepalive: lezen mislukt', err);
    res.status(500).json({ error: 'Lezen mislukt' });
    return;
  }

  const laatsteDatumStr = laatste ? lokaalDagUurDatum(new Date(laatste.executed_at)).datumStr : null;

  if (laatsteDatumStr === datumStr) {
    res.status(200).json({ ok: true, uitgevoerd: false, reden: 'vandaag al gebeurd' });
    return;
  }

  if (uur < doel) {
    res.status(200).json({ ok: true, uitgevoerd: false, reden: 'nog voor doeluur', doel_uur: doel });
    return;
  }

  try {
    const schrijfRes = await fetch(`${SUPABASE_URL}/rest/v1/keep_alive_log`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ target_hour: doel, note: `automatische keep-alive, doeluur ${doel}u` }),
    });
    if (!schrijfRes.ok) throw new Error(await schrijfRes.text());
  } catch (err) {
    console.error('keepalive: schrijven mislukt', err);
    res.status(500).json({ error: 'Schrijven mislukt' });
    return;
  }

  res.status(200).json({ ok: true, uitgevoerd: true, doel_uur: doel });
}
