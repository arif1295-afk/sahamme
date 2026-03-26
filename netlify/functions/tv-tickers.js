const fetch = globalThis.fetch || require('node-fetch');

// Simple Netlify function that returns IDX-listed symbols from TradingView symbol_search
exports.handler = async function(event){
  const headers = { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' };
  try{
    // caching in-memory across warm invocations
    if(!global._tv_cache) global._tv_cache = { ts:0, data:null };
    const TTL = 1000 * 60 * 5;
    const now = Date.now();
    if(global._tv_cache.data && (now - global._tv_cache.ts) < TTL){
      return { statusCode: 200, headers, body: JSON.stringify(global._tv_cache.data) };
    }

    const url = 'https://symbol-search.tradingview.com/symbol_search/';
    const params = new URLSearchParams({ text: '', exchange: 'IDX', type: 'stock' });
    const res = await fetch(url + '?' + params.toString(), { headers: { 'User-Agent':'sahamme-tv-proxy' } });
    if(!res.ok) throw new Error('TradingView fetch failed: ' + res.status);
    const items = await res.json();
    const out = [];
    for(const it of items){
      const sym = it.symbol || it.s || '';
      if(!sym) continue;
      if(sym.startsWith('IDX:')){
        const code = sym.split(':',2)[1].toUpperCase();
        out.push({ symbol: code + '.JK', description: it.description || it.d || '', full: sym });
      }
    }
    global._tv_cache = { ts: now, data: out };
    return { statusCode: 200, headers, body: JSON.stringify(out) };
  }catch(err){
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
