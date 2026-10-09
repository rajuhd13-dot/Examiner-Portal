# Examiner Portal v2

Search an examiner by **TPIN or mobile number** → profile, assessments (Allow / Not Allow), remarks.

```
Browser ──► Node server (in-memory index of the whole sheet, 0 ms search)
                 ▲  background sync every 60 s (cheap REV check)
                 ▲  webhook on every sheet edit (instant)
                 └──► Google Apps Script ◄── Google Sheet
```

## 1. Apps Script (once)
1. Replace your script with `apps-script/Code.gs`.
2. Run `setupSecurity()` → copy `APPSCRIPT_TOKEN` and `WEBHOOK_SECRET` from the log.
3. Project Settings ▸ Script properties ▸ add `WEBHOOK_URLS` = `https://YOUR-SERVER/api/refresh` (optional).
4. Run `setupTriggers()` and authorise.
5. Deploy ▸ Manage deployments ▸ Edit ▸ **New version** ▸ Deploy (Execute as *Me*, access *Anyone*).

## 2. Server
```bash
cp .env.example .env.local   # fill APPSCRIPT_URL, APPSCRIPT_TOKEN, WEBHOOK_SECRET (+ PORTAL_PASSCODE if wanted)
npm install
npm run dev                  # http://localhost:3000
npm test                     # logic tests
npm run build && npm start   # production (honours $PORT)
```
Deploy on any Node host (Cloud Run, Render, Railway, Fly, VPS). Health check: `GET /api/health`.

### Vercel
`api/*.ts` work, but serverless has no shared memory: every search is a live single-row lookup (cached 15 s).
Set the same env vars in Vercel. For full speed + instant webhook updates use the Node server.

## Behaviour notes
* Pass mark per subject: `ALLOW_MARK` in `shared/examiner.ts`. A cell may hold several attempts
  (`40, 65`) – any attempt ≥ mark = Allow. Fractions are converted (`45/50` = 90 %).
* Timeouts / quota errors are **never** shown as "No examiner found" – you get a Retry button, or the last saved copy with an amber banner.
* `FRESH_MS=0` makes every search hit the sheet live (slower, uses Apps Script quota).
