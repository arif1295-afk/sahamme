Sahamme - IDX stocks frontend + Netlify functions

This workspace contains a static frontend and Netlify Functions proxies to fetch stock ticker list and quotes.

Quick start:

1. Install dependencies (if any):

```powershell
npm install
```

2. Test Netlify functions locally (Node):

```powershell
node -e "const fn=require('./netlify/functions/yahoo-quote.js'); (async()=>{ const out=await fn.handler({queryStringParameters:{symbols:'BBCA.JK'}},{}); console.log(out); })()"
```

3. Commit and push:

```powershell
git add .
git commit -m "fix: yahoo proxy and add gitignore/readme"
git push origin main
```
