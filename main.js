async function loadFromTV(){
  const st = document.getElementById('status');
  try{
    const r = await fetch('/.netlify/functions/tv-tickers');
    if(!r.ok) throw new Error('Gagal memuat dari server');
    const data = await r.json();
    renderList(data);
    if(st) st.textContent = `Menampilkan ${data.length} simbol (sumber: TradingView)`;
    // after rendering, fetch prices for visible symbols
    try{
      const codes = data.slice(0,200).map(it => (it.symbol||'').toUpperCase()).filter(Boolean);
      if(codes.length){
        const quotes = await fetchYahooQuotesBatch(codes);
        const by = {};
        for(const q of quotes) by[(q.symbol||'').toUpperCase()] = q;
        for(const it of data.slice(0,200)){
          const code = (it.symbol||'').replace('.JK','');
          const row = document.getElementById('tvrow-'+code);
          if(!row) continue;
          const ph = row.querySelector('.price-placeholder');
          const ch = row.querySelector('.change-placeholder');
          const vl = row.querySelector('.vol-placeholder');
          const q = by[(it.symbol||'').toUpperCase()];
          if(q && typeof q.regularMarketPrice === 'number'){
            ph.textContent = q.regularMarketPrice.toLocaleString('id-ID',{style:'currency',currency:'IDR'});
            const pct = (typeof q.regularMarketChangePercent === 'number') ? q.regularMarketChangePercent.toFixed(2) : null;
            ch.textContent = pct !== null ? (pct + '%') : '-';
            ch.style.color = (pct!==null && Number(pct) < 0) ? '#b91c1c' : '#047857';
            vl.textContent = (q.regularMarketVolume || 0) ? (q.regularMarketVolume).toLocaleString('id-ID') : '-';
          }
        }
      }
    }catch(e){ console.warn('fetch prices', e); }
  }catch(e){
    if(st) st.textContent = 'Error: '+e.message;
  }
}

function renderList(list){
  const container = document.getElementById('list');
  if(!container) return;
  if(!Array.isArray(list) || list.length===0){ container.innerHTML = '<div>Tidak ada data</div>'; return; }
  const rows = list.map(it=>{
    const code = (it.symbol||'').replace('.JK','');
    return `<div id="tvrow-${code}" class="row"><div class="sym">${code}</div><div class="desc">${escapeHtml(it.description||'')}</div><div style="width:180px;text-align:right"><span class="price-placeholder">-</span></div><div style="width:120px;text-align:right"><span class="change-placeholder">-</span></div><div style="width:140px;text-align:right"><span class="vol-placeholder">-</span></div></div>`;
  }).join('');
  container.innerHTML = `<div class="table">${rows}</div>`;
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" })[c]); }

window.addEventListener('load', ()=>{ loadFromTV(); });
async function loadTickers(){
  const st = document.getElementById('status');
  try{
    const r = await fetch('/.netlify/functions/idx-tickers');
    if(!r.ok) throw new Error('Gagal memuat');
    const data = await r.json();
    renderList(data);
    if(st) st.textContent = `Menampilkan ${data.length} emiten`;
  }catch(e){
    if(st) st.textContent = 'Gagal memuat daftar saham: '+e.message;
  }
}

function renderList(list){
  const container = document.getElementById('list');
  if(!container) return;
  if(!Array.isArray(list) || list.length===0){ container.innerHTML = '<div>Tidak ada data</div>'; return; }
  const rows = list.map(it => `<div class="row"><div class="sym">${(it.symbol||'').replace('.JK','')}</div><div class="name">${it.name||''}</div><div class="sector">${it.sector||''}</div></div>`).join('');
  container.innerHTML = `<div class="table">${rows}</div>`;
}

window.addEventListener('load', ()=>{ loadTickers(); });
// Use TradingView Market Overview widget for realtime data
async function loadTickers(){
  // Only use live IDX source from Netlify function. No static fallback.
  try{
    const r = await fetch('/.netlify/functions/idx-tickers');
    if(r.ok){
      const arr = await r.json();
      if(Array.isArray(arr) && arr.length){
        // support both array of strings and array of objects {symbol, marketCap}
        const normalized = arr.map(item=>{
          if(typeof item === 'string') return { symbol: item.toUpperCase(), marketCap: null };
          if(item && item.symbol) return { symbol: String(item.symbol).toUpperCase(), marketCap: item.marketCap || null };
          return null;
        }).filter(Boolean).filter(o=>/^[A-Z0-9\-]{1,10}\.JK$/.test(o.symbol));
        if(normalized.length) return normalized;
      }
    }
  }catch(e){ /* ignore */ }
  // If live source unavailable, return empty list so UI can show message
  return [];
}

// removed TradingView symbol mapping — we use StockAnalysis-derived list only

function performSearch(q){
  if(!q) return;
  let s = q.trim().toUpperCase();
  if(s.startsWith('IDX:')) s = s.replace('IDX:','');
  if(!s.includes('.')) s = s + '.JK';
  // render single-row list for the searched symbol
  renderStockList([{ symbol: s, marketCap: null }]);
}

function createMarketOverview(symbols){
  const container = document.getElementById('market-overview');
  container.innerHTML = '<div class="tradingview-widget-container"></div>';
  const parent = container.querySelector('.tradingview-widget-container');
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
  const cfg = {
    "colorTheme": "light",
    "dateRange": "12M",
    "showChart": true,
    "locale": "id",
    "width": "100%",
    "height": 600,
    "isTransparent": true,
    "displayCurrency": "IDR",
    "showSymbolLogo": true,
    "tabs": [
      {
        "title": "Saham ID",
        "symbols": symbols.map(s => ({ s: toTradingViewSymbol(s), d: s.replace('.JK','') }))
      }
    ]
  };
  script.innerHTML = JSON.stringify(cfg);
  parent.appendChild(script);
}

function createScreener(){
  const container = document.getElementById('market-overview');
  container.innerHTML = '<div class="tradingview-widget-container"></div>';
  const parent = container.querySelector('.tradingview-widget-container');
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js';
  const cfg = {
    "width": "100%",
    "height": 700,
    "defaultColumn": "overview",
    "locale": "id",
    "market": "all",
    "exchange": "IDX",
    "showToolbar": true,
    "colorTheme": "light",
    "isTransparent": true,
    "displayCurrency": "IDR"
  };
  script.innerHTML = JSON.stringify(cfg);
  parent.appendChild(script);
}

async function start(){
  const defaults = await loadTickers();
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const liveToggle = document.getElementById('liveToggle');
  const autoRefreshToggle = document.getElementById('autoRefreshToggle');
  const autoAnalyzeToggle = document.getElementById('autoAnalyzeToggle');
  const analyzeBtn = document.getElementById('analyzeBtn');

  if(searchBtn){
    searchBtn.addEventListener('click', ()=>{
      performSearch(searchInput.value);
    });
  }
  if(searchInput){
    searchInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        performSearch(searchInput.value);
      }
    });
  }
  if(clearBtn){
    clearBtn.addEventListener('click', ()=>{
      if(searchInput) searchInput.value = '';
      // reset to the same live list shown on home
      const resetList = Array.isArray(defaults) ? defaults.slice(0,200) : [];
      if(resetList.length) renderStockList(resetList);
      else createScreener();
      stopYahooPolling();
    });
  }

  // open analysis page and auto-run
  const openAnalyzeBtn = document.getElementById('openAnalyzeBtn');
  if(openAnalyzeBtn){
    openAnalyzeBtn.addEventListener('click', ()=>{
      window.location.href = 'analysis.html?auto=1';
    });
  }

  if(analyzeBtn){
    analyzeBtn.addEventListener('click', async ()=>{
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = 'Analisis...';
      try{
        const all = await loadTickers();
        const res = await analyzeAllTickers(all);
        renderAnalysisResults(res);
      }catch(e){
        console.error('Analisis gagal', e);
        document.getElementById('analysisResults').textContent = 'Analisis gagal: '+e.message;
      }finally{
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analisis';
      }
    });
  }

    let currentList = Array.isArray(defaults) ? defaults : [];
      // Show the full StockAnalysis-derived IDX list by default in the market-overview area
      function renderStockList(list){
        const container = document.getElementById('market-overview');
        if(!container) return;
        if(!Array.isArray(list) || list.length===0){
          container.innerHTML = '<div style="padding:12px;background:#fff;border-radius:8px;border:1px solid #eef0f5">Daftar saham IDX tidak tersedia saat ini.</div>';
          return;
        }
        // Build a table header + rows with placeholders for price, change%, volume
        const header = `<div style="display:flex;justify-content:space-between;padding:10px;background:#f8fafc;border-bottom:1px solid #e6eef7;font-weight:700"><div style="flex:1">Saham</div><div style="width:180px;text-align:right">Harga (IDR)</div><div style="width:120px;text-align:right">Δ %</div><div style="width:140px;text-align:right">Volume</div></div>`;
        const rows = list.map(item=>{
          const s = (typeof item === 'string') ? item : (item && item.symbol) || '';
          const code = s.replace('.JK','');
          const marketCapText = (typeof item === 'object' && item && item.marketCap) ? item.marketCap : '';
          const tv = `https://id.tradingview.com/symbols/IDX-${code}/`;
          const sa = `https://stockanalysis.com/symbol/${code}/`;
          return `<div id="row-${code}" style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #f1f5f9;align-items:center"><div style="flex:1"><a href="${tv}" target="_blank" rel="noopener noreferrer" style="font-weight:600;color:#0b1220">${code}</a> <span style="color:#6b7280;margin-left:8px"><a href="${sa}" target="_blank" rel="noopener noreferrer">(stockanalysis)</a></span><div style="color:#6b7280;font-size:12px;margin-top:4px">${marketCapText || ''}</div></div><div style="width:180px;text-align:right"><span class=\"price-placeholder\">-</span></div><div style="width:120px;text-align:right"><span class=\"change-placeholder\">-</span></div><div style="width:140px;text-align:right"><span class=\"vol-placeholder\">-</span></div></div>`;
        }).join('');
        container.innerHTML = `<div id="stock-list-box" style="background:#fff;border-radius:8px;border:1px solid #eef0f5;overflow:auto;max-height:600px">${header}${rows}</div>`;

        // After rendering, fetch numeric quotes (Yahoo proxy) for visible symbols and update prices, change%, volume
        (async ()=>{
          try{
            const codes = list.map(s=> s.replace('.JK',''));
            const ysymbols = codes.map(c=> c + '.JK');
            // fetch in batches to avoid long query strings
            const batchSize = 100;
            for(let i=0;i<ysymbols.length;i+=batchSize){
              const batch = ysymbols.slice(i,i+batchSize);
              const quotes = await fetchYahooQuotesBatch(batch);
              const bySym = {};
              for(const q of quotes){ if(q && q.symbol) bySym[q.symbol.toUpperCase()] = q; }
              for(const c of batch.map(x=>x.replace('.JK',''))){
                const key = (c + '.JK').toUpperCase();
                const q = bySym[key];
                const row = document.getElementById('row-'+c);
                if(!row) continue;
                const ph = row.querySelector('.price-placeholder');
                const ch = row.querySelector('.change-placeholder');
                const vl = row.querySelector('.vol-placeholder');
                if(q && typeof q.regularMarketPrice === 'number'){
                  const p = q.regularMarketPrice;
                  ph.textContent = p.toLocaleString('id-ID',{style:'currency',currency:'IDR'});
                  const changePct = (typeof q.regularMarketChangePercent === 'number') ? q.regularMarketChangePercent.toFixed(2) : null;
                  ch.textContent = changePct !== null ? (changePct + '%') : '-';
                  if(changePct !== null){ ch.style.color = (Number(changePct) < 0) ? '#b91c1c' : '#047857'; }
                  const vol = q.regularMarketVolume || 0;
                  vl.textContent = vol ? vol.toLocaleString('id-ID') : '-';
                } else {
                  if(ph) ph.textContent = '-';
                  if(ch) ch.textContent = '-';
                  if(vl) vl.textContent = '-';
                }
              }
            }
          }catch(e){ console.warn('update stock list prices', e); }
        })();
      }

      renderStockList(currentList);
    
    // (no show-more button; the full list is rendered above)

  // periodic refresh: fetch live idx list every 5 minutes when enabled
  const REFRESH_MS = 1000 * 60 * 5;
  let refreshTimer = null;
  async function refreshIdxList(){
    try{
      const fresh = await loadTickers();
      const clean = Array.isArray(fresh) ? fresh : [];
      // compare changed
      const changed = JSON.stringify(clean) !== JSON.stringify(currentList);
      if(changed){
        currentList = clean;
        // render the updated StockAnalysis-derived list on home
        renderStockList(currentList.slice(0,200));
        // if auto-analyze enabled, navigate to analysis page with auto flag
        if(autoAnalyzeToggle && autoAnalyzeToggle.checked){
          try{ window.open('analysis.html?auto=1','_blank'); }catch(e){}
        }
      }
    }catch(e){ console.warn('refreshIdxList', e); }
  }

  function startAutoRefresh(){ if(refreshTimer) clearInterval(refreshTimer); refreshTimer = setInterval(refreshIdxList, REFRESH_MS); }
  function stopAutoRefresh(){ if(refreshTimer){ clearInterval(refreshTimer); refreshTimer = null; } }

  if(autoRefreshToggle && autoRefreshToggle.checked) startAutoRefresh();
  if(autoRefreshToggle){ autoRefreshToggle.addEventListener('change', ()=>{ if(autoRefreshToggle.checked) startAutoRefresh(); else stopAutoRefresh(); }); }

  // Live toggle behavior (Yahoo polling)
  if(liveToggle){
    liveToggle.addEventListener('change', ()=>{
      if(liveToggle.checked){
        // build symbols array from search input or from currentList objects
        let symbols = [];
        if(searchInput && searchInput.value.trim()){
          let s = searchInput.value.trim().toUpperCase();
          if(!s.includes('.')) s = s + '.JK';
          symbols = [s];
        } else {
          symbols = currentList.slice(0,10).map(it => (typeof it === 'string') ? it : (it && it.symbol) || '').filter(Boolean);
        }
        startYahooPolling(symbols, 1000);
      } else {
        stopYahooPolling();
      }
    });
  }

  // price source selector removed: no-op (kept for backward-compatibility)
}

start();

// --- Yahoo polling implementation ---
let _yahooTimer = null;
let _yahooSymbols = [];

function startYahooPolling(symbols, intervalMs = 1000){
  stopYahooPolling();
  if(!symbols || !symbols.length) return;
  _yahooSymbols = symbols.map(s=> s.toUpperCase().replace(/\s+/g,''));
  const run = async ()=>{
    try{
      const url = `/.netlify/functions/yahoo-quote?symbols=${encodeURIComponent(_yahooSymbols.join(','))}`;
      const r = await fetch(url);
      if(!r.ok) throw new Error('Yahoo fetch failed');
      const j = await r.json();
      const quotes = j.quoteResponse && j.quoteResponse.result ? j.quoteResponse.result : [];
      // format for renderLiveTicker
      const data = quotes.map(q=>({ symbol: q.symbol, price: q.regularMarketPrice, change: q.regularMarketChange }));
      // format price to IDR
      data.forEach(d=>{ if(typeof d.price === 'number'){ d.formatted = d.price.toLocaleString('id-ID',{style:'currency',currency:'IDR'}) } });
      renderLiveTicker(data);
    }catch(e){
      console.warn('Yahoo polling error', e);
    }
  };
  run();
  _yahooTimer = setInterval(run, intervalMs);
}

function stopYahooPolling(){
  if(_yahooTimer){ clearInterval(_yahooTimer); _yahooTimer = null; }
}

function renderLiveTicker(data){
  const box = document.getElementById('live-ticker');
  if(!box) return;
  const items = Array.isArray(data) ? data : [data];
  const html = items.map(it=>{
    const sym = (it.symbol||'').replace('.JK','');
    const p = it.formatted ? it.formatted : ((typeof it.price !== 'undefined' && it.price !== null) ? Number(it.price).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2, style:'decimal'}) : '-');
    const cls = (it.change && Number(it.change) < 0) ? 'down' : 'up';
    return `<span class="live-pill">${sym} <span class="price ${cls}">${p}</span></span>`;
  }).join('');
  box.innerHTML = html;
}

// --- Analysis helpers ---
async function fetchYahooQuotesBatch(symbols){
  if(!symbols || !symbols.length) return [];
  const url = `/.netlify/functions/yahoo-quote?symbols=${encodeURIComponent(symbols.join(','))}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error('Yahoo fetch failed');
  const j = await r.json();
  return j.quoteResponse && j.quoteResponse.result ? j.quoteResponse.result : [];
}

async function analyzeAllTickers(allTickers){
  // fetch in batches of 50
  const batchSize = 50;
  const chunks = [];
  for(let i=0;i<allTickers.length;i+=batchSize) chunks.push(allTickers.slice(i,i+batchSize));
  const results = [];
  for(const c of chunks){
    const quotes = await fetchYahooQuotesBatch(c);
    for(const q of quotes){
      // heuristics for scalping candidate:
      // - significant recent volume (regularMarketVolume)
      // - change percent magnitude moderate (0.3% - 5%)
      // - tight spread relative to price (use bid/ask if available) -> fallback none
      const vol = q.regularMarketVolume || 0;
      const changePct = q.regularMarketChangePercent || 0;
      const absPct = Math.abs(changePct);
      // score: weight volume (log) and absPct
      const score = (Math.log10(Math.max(1, vol)) * 0.6) + (Math.min(absPct, 10) * 0.4);
      results.push({ symbol: q.symbol, name: q.shortName || '', price: q.regularMarketPrice, changePct, vol, score });
    }
  }
  // filter candidates with moderate movement and reasonable volume
  const candidates = results.filter(r=> r.vol > 1000 && Math.abs(r.changePct) >= 0.3 && Math.abs(r.changePct) <= 8);
  candidates.sort((a,b)=>b.score - a.score);
  return candidates.slice(0,30);
}

function renderAnalysisResults(list){
  const el = document.getElementById('analysisResults');
  if(!el) return;
  if(!list || !list.length){ el.innerHTML = '<div>Tidak ditemukan kandidat untuk scalping berdasarkan kriteria saat ini.</div>'; return; }
  const rows = list.map(it=>{
    const price = (typeof it.price==='number')? it.price.toLocaleString('id-ID',{style:'currency',currency:'IDR'}) : '-';
    return `<div style="padding:8px 0;border-bottom:1px solid #eef0f5;display:flex;justify-content:space-between;align-items:center"><div><b>${it.symbol.replace('.JK','')}</b> — ${it.name}</div><div style="text-align:right">${price}<br><small style="color:#6b7280">Δ ${it.changePct?it.changePct.toFixed(2):'0'}% • Vol ${it.vol?it.vol.toLocaleString('id-ID'):'-'} </small></div></div>`;
  }).join('');
  el.innerHTML = rows;
}
