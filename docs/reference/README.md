# Reference Screenshots

These screenshots show the current app UI using a built-in reference seed so the docs stay consistent.

## Included images

- `app-overview.png`: populated grade workspace with warnings, controls, sliders, and classroom columns
- `summary-drawer.png`: the right-side grade summary drawer open over the same seeded roster
- `rules-manager.png`: the Rules Manager with no-contact, keep-together, and blocked-teacher examples

## Regenerate

1. Start the app locally:

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

2. Capture the screenshots:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --run-all-compositor-stages-before-draw --virtual-time-budget=4000 --window-size=1600,1200 --screenshot=docs/reference/app-overview.png "http://127.0.0.1:4173/?referenceSeed=docs"
```

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --run-all-compositor-stages-before-draw --virtual-time-budget=4000 --window-size=1600,1200 --screenshot=docs/reference/summary-drawer.png "http://127.0.0.1:4173/?referenceSeed=docs&drawer=summary"
```

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --run-all-compositor-stages-before-draw --virtual-time-budget=4000 --window-size=1600,1200 --screenshot=docs/reference/rules-manager.png "http://127.0.0.1:4173/?referenceSeed=docs&panel=rules"
```

The reference seed is only applied when the URL includes `?referenceSeed=docs`, so normal app behavior is unchanged.
