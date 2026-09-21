# Deezul Components

A reusable [Deezul](https://github.com/S-t-u-r-m/deezul) component library, with a live
gallery for building and previewing blocks in isolation.

## Running it

```bash
npm install
npm run dev        # http://localhost:8081 — builds dist/, serves it, pushes each save into it
```

```bash
npm run build      # → dist/ : a self-contained, hostable folder
```

`npm run dev` serves `dist/` itself, so the gallery you test is the real build: a file the
build would leave out is missing here too. Only what a save changes is rewritten — an
edited component recompiles alone — and the page reloads. The live-reload script is
injected by the dev server; `index.html` doesn't carry one.

## Layout

```
index.html            app shell
main.js               boot: Deezul.init + globals the compiled views read
modules.config.js     dz-type → source file (every mountable component)
routes.config.js      URL → view
catalog.config.js     what the gallery shows, and the demo props for each component
assets/tokens.css     the --dz-* design tokens all components paint from
src/
  component/          the library — this is the part you reuse in other projects,
                      one folder per gallery group (controls/, lists/, layout/, news/ …)
  view/               the gallery screens (index + per-component workbench)
  layout/             the gallery chrome
```

`src/component/` is the deliverable; everything else is the harness that lets you see it.

## Adding a component

Three edits:

1. **`src/component/<group>/Thing.js`** — the component itself, in the folder for its
   gallery group (make a new folder for a new group).
2. **`modules.config.js`** — `{ ref: 'dz-thing', src: 'component/<group>/Thing.js' }`.
   The `ref` is the `dz-type` templates use to mount it; `src` is the file under `src/`
   (deezul maps it to the compiled module — never write a compiled path).
3. **`catalog.config.js`** — a gallery entry with a `demos` array: one entry per state
   worth seeing (each variant, the empty case, the overflowing case), each just the props
   a host app would pass.

Then `/c/dz-thing` is its workbench page.

[`src/component/controls/Button.js`](src/component/controls/Button.js) is the worked example — copy its
shape. Delete it once you have components of your own (remove its lines from the two
config files too).

## House rules for components

- **Paint from tokens, with literal fallbacks.** `var(--dz-color-primary, #5b5ef0)` — a
  component dropped into an app that never loaded `tokens.css` still looks right.
- **Declare a `schema`.** It is what lets a host editor drive the block, and it doubles as
  the component's documentation. Mirror the same defaults in `data()`.
- **Emit, don't reach.** `this.$emit('press')` — the parent decides what a press means.
- **Give `:host` a display.** Shadow hosts default to inline; say `block` or
  `inline-block` explicitly.
- **Compiled components cannot import app modules.** They only see globals. `main.js`
  publishes what they need on `window` (e.g. `window.DzCatalog`).

## Reusing these elsewhere

Copy the `src/component/` folders into the target app's `src/component/`, add their
lines to that app's `modules.config.js`, and make sure it defines the `--dz-*` tokens
they read (or rely on the fallbacks). The files are plain Deezul source — the consuming
app compiles them with its own `deezul-dev` / `deezul-build`.

## Testing

```bash
npm test           # builds, then runs every gallery page and behaviour check in headless Edge or Chrome
npm run test:only  # the same, without rebuilding first
```

Every gallery page is also checked with axe-core for accessibility violations.

## License

MIT — see [LICENSE](LICENSE). The Material Symbols icons in `assets/icons/` are
Apache 2.0; [NOTICE](NOTICE) lists which ones.
