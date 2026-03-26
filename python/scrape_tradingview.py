#!/usr/bin/env python3
"""Simple TradingView scraper

Usage:
  python scrape_tradingview.py --limit 100 --out out.json

This script queries TradingView's symbol_search for exchange=IDX to get listed symbols,
then attempts to fetch each symbol page and extract an initial price from embedded JSON.
"""
import requests
import re
import json
import time
import argparse
from bs4 import BeautifulSoup

SYMBOL_SEARCH = 'https://symbol-search.tradingview.com/symbol_search/'

def fetch_symbol_list(limit=0):
    params = { 'text': '', 'exchange': 'IDX', 'type': 'stock' }
    r = requests.get(SYMBOL_SEARCH, params=params, headers={'User-Agent':'sahamme-scraper'})
    r.raise_for_status()
    items = r.json()
    # items are objects with 'symbol' like 'IDX:BBCA'
    results = []
    for it in items:
        sym = it.get('symbol') or it.get('s') or ''
        # normalize symbol to CODE.JK
        if sym.startswith('IDX:'):
            code = sym.split(':',1)[1].upper()
            results.append({'symbol': f'{code}.JK', 'description': it.get('description') or it.get('d') or ''})
        if limit and len(results) >= limit:
            break
    return results

def fetch_price_from_page(code):
    # code without .JK, e.g., BBCA
    url = f'https://www.tradingview.com/symbols/IDX-{code}/'
    r = requests.get(url, headers={'User-Agent':'sahamme-scraper'})
    if r.status_code != 200:
        return None
    html = r.text
    # TradingView often embeds initial state in a JS variable root.App.main
    m = re.search(r'root.App.main\s*=\s*(\{.+?\})\s*;\s*\(function', html, re.S)
    if not m:
        # try alternative pattern
        m = re.search(r'window\.__INITIAL_STATE__\s*=\s*(\{.+?\})\s*;\s*', html, re.S)
    if not m:
        return None
    try:
        js = m.group(1)
        data = json.loads(js)
    except Exception:
        # sometimes JSON is not strict; try to extract numbers via regex
        p = re.search(r'"price"\s*:\s*([0-9]+\.?[0-9]*)', html)
        if p:
            return float(p.group(1))
        return None
    # walk the JSON to find a price - heuristic
    def find_price(obj):
        if isinstance(obj, dict):
            for k,v in obj.items():
                if k.lower().find('price')!=-1 and isinstance(v,(int,float)):
                    return v
            for v in obj.values():
                res = find_price(v)
                if res is not None:
                    return res
        elif isinstance(obj, list):
            for v in obj:
                res = find_price(v)
                if res is not None:
                    return res
        return None
    return find_price(data)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--out', type=str, default='out.json')
    parser.add_argument('--delay', type=float, default=0.5)
    args = parser.parse_args()

    symbols = fetch_symbol_list(limit=args.limit)
    print(f'Found {len(symbols)} symbols')
    out = []
    for i,s in enumerate(symbols):
        code = s['symbol'].replace('.JK','')
        price = None
        try:
            price = fetch_price_from_page(code)
        except Exception as e:
            print('error fetching', code, e)
        out.append({'symbol': s['symbol'], 'description': s.get('description'), 'price': price})
        print(f'[{i+1}/{len(symbols)}] {s["symbol"]} price={price}')
        time.sleep(args.delay)

    with open(args.out,'w',encoding='utf8') as f:
        json.dump(out,f,ensure_ascii=False,indent=2)
    print('Saved', args.out)

if __name__=='__main__':
    main()
