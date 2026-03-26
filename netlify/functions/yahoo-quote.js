const fetch = globalThis.fetch || require('node-fetch');

function mapItemToYahooShape(it){
  if(!it) return null;
  const symbol = (it.symbol || it.ticker || it.code || it.s || '').toString().toUpperCase();
  const price = Number(it.price ?? it.last ?? it.last_price ?? it.close ?? it.last_trade_price ?? NaN);
  const vol = Number(it.volume ?? it.v ?? it.vol ?? 0) || 0;
  const changePct = Number(it.change_percent ?? it.changePct ?? it.p_change ?? it.change_percentage ?? it.change_percent_raw ?? NaN);
  const change = Number(it.change ?? it.diff ?? it.price_change ?? NaN);
  const high = Number(it.high ?? it.h ?? NaN);
  const low = Number(it.low ?? it.l ?? NaN);
  const name = it.name || it.company || it.shortName || '';
  return {
    symbol,
    regularMarketPrice: isNaN(price) ? null : price,
    regularMarketVolume: vol,
    regularMarketChangePercent: isNaN(changePct) ? null : changePct,
    regularMarketChange: isNaN(change) ? null : change,
    regularMarketDayHigh: isNaN(high) ? null : high,
    regularMarketDayLow: isNaN(low) ? null : low,
    shortName: name
  };
}

exports.handler = async function(event){
  const params = event.queryStringParameters || {};
  const symbols = params.symbols;
  if(!symbols) return { statusCode: 400, headers:{'Access-Control-Allow-Origin':'*'}, body: JSON.stringify({error: 'missing symbols'}) };

  // Prefer QuantumStock API if configured, then Invezgo, then Yahoo
  const qurl = process.env.QUANTUM_API_URL;
  const qheaders = { 'User-Agent': 'sahamme-netlify', 'Accept': 'application/json' };
  if(process.env.QUANTUM_API_KEY) qheaders['Authorization'] = `Bearer ${process.env.QUANTUM_API_KEY}`;

  if(qurl){
    try{
      let url = qurl;
      if(url.includes('{symbols}')) url = url.replace('{symbols}', encodeURIComponent(symbols));
      else url = url.replace(/\/?$/, '/') + 'quotes?symbols=' + encodeURIComponent(symbols);
      const r = await fetch(url, { headers: qheaders });
      if(!r.ok) throw new Error('Quantum fetch failed: ' + r.status);
      const j = await r.json();
      const items = j && (j.data || j.quotes || j.results || j.items || j);
      const arr = Array.isArray(items) ? items.map(mapItemToYahooShape).filter(Boolean) : [];
      return {
        statusCode: 200,
        headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' },
        body: JSON.stringify({ quoteResponse: { result: arr } })
      };
    }catch(err){
      console.warn('Quantum quote error', err && err.message);
      // fallback to Invezgo/Yahoo below
    }
  }

  // If INVEZGO_API_URL is set, try Invezgo quotes API and normalize response
  const ivez = process.env.INVEZGO_API_URL;
  const ivezHeaders = { 'User-Agent': 'sahamme-netlify', 'Accept': 'application/json' };
  if(process.env.INVEZGO_API_KEY) ivezHeaders['X-API-KEY'] = process.env.INVEZGO_API_KEY;
  if(ivez){
    try{
      let url = ivez;
      if(url.includes('{symbols}')) url = url.replace('{symbols}', encodeURIComponent(symbols));
      else url = url.replace(/\/?$/, '/') + 'quotes?symbols=' + encodeURIComponent(symbols);
      const r = await fetch(url, { headers: ivezHeaders });
      if(r.ok){
        const j = await r.json();
        const items = j && (j.data || j.quotes || j.results || j.items || j);
        const arr = Array.isArray(items) ? items.map(mapItemToYahooShape).filter(Boolean) : [];
        return {
          statusCode: 200,
          headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' },
          body: JSON.stringify({ quoteResponse: { result: arr } })
        };
      }
    }catch(err){
      console.warn('Invezgo quote error', err && err.message);
    }
  }

  // Fallback: Yahoo Finance
  const yahoo = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
  try{
    const res = await fetch(yahoo, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7' } });
    const json = await res.json();
    // Detect Yahoo unauthorized envelope and return clear error
    if(json && json.finance && json.finance.error && json.finance.error.code === 'Unauthorized'){
      return {
        statusCode: 502,
        headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' },
        body: JSON.stringify({ error: 'Yahoo returned Unauthorized', detail: json.finance.error })
      };
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET'
      },
      body: JSON.stringify(json)
    };
  }catch(err){
    return { statusCode: 502, headers:{'Access-Control-Allow-Origin':'*'}, body: JSON.stringify({error: err.message}) };
  }
}
