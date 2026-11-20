# Roadmap

## Done
- Backend enabled: `incidents` table (public read/insert/update, live updates).
- `analyzeFrames` AI function (Claude Sonnet 5, image + instruction -> raw text).
- Routes: `/` home with Camera and Guard buttons, `/camera` placeholder, `/guard` live feed.
- Project renamed to TheftWatch; app name updated in page titles, Guard header and README.
- Logo: lens-eye emblem in the CCTV logo's navy/cyan/red palette, placed in the Guard header,
  the home page and the browser tab icon (`public/logo.png`, `public/logo-mark.png`,
  `public/favicon.png`; default `favicon.ico` removed).

## Blocked / for the teammate
- `src/routes/camera.tsx` head metadata still says "Shoplifting Detection Demo" (old name).
  That file is teammate-owned, so it needs changing through their Git branch.
