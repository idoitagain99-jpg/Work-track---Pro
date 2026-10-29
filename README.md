# WorkTrack Pro (phone-friendly package)
All files are in one folder (no sub-folders) so they can be uploaded from an Android phone.
Data is stored only in the browser on each device (IndexedDB). It is NOT synced. Use Settings → "Download JSON backup" regularly.

## Computer commands (optional)
    npm install && npm run dev      # try it locally
    npm run typecheck               # full TypeScript check (needs npm install)
    npm test                        # salary / advance accounting checks
    npm run build                   # creates dist/

See the chat instructions for the phone-only deployment steps (GitHub → Vercel).
