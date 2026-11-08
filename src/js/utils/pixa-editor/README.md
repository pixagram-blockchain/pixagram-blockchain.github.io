# pixa-editor (vendored)

The headless pixel-art editor core (remastered from pixa.pics), vendored from
`@pixa/editor` 0.1.0. Plain ES modules with JSDoc; no runtime dependencies.

- `index.js` is the public API (`createEditor`, models, ops, IO).
- `view/index.js` adds `editor.attach(element, options)`: the canvas zone.
- `worker/entry.js` is the worker script for `createEditor({ workers })`; the
  app does not use workers (Pixagram artwork is at most a few hundred pixels
  a side, which every effect handles on the main thread in a few ms).

Edit the core upstream and copy it here again rather than patching it in place,
so the two never drift. The UI around it lives in
`src/js/components/pixel-editor/`.
