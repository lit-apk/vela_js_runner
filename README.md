# vela-runner

A Xiaomi Vela quick app that runs arbitrary JavaScript inside the app's own
QuickJS context and shows console output, the completion value, or the error
(with stack trace). Think of it as a tiny on-watch JS console.

This first version has no on-device code editor: every `src/demo/*.js` file
becomes a button on the home page; tapping one runs that file on a new page.

## Layout

```
src/
  manifest.json          features declared here are `require()`-able from snippets
  app.ux
  pages/index/index.ux   lists demo files as buttons
  pages/run/run.ux       runs the selected demo, shows logs / result / error, Back + Rerun
  common/runner.js       the runner: new Function + console shim + async/error capture
  common/demos.gen.js    GENERATED from src/demo/*.js (git-ignored)
  demo/*.js              snippets to run
scripts/gen-demos.js     generates demos.gen.js (runs automatically before start/build/release)
```

## Usage

```bash
npm install
npm run build      # -> dist/*.rpk   (debug)
npm run release    # -> dist/*.rpk   (release, needs sign/ certs)
npm run start      # watch + push to emulator / device via AIoT-IDE tooling
```

Add a snippet: drop a `.js` file into `src/demo/` and rebuild.

## Writing snippets

The runner compiles the snippet with `new Function`, trying two modes:

1. **Expression mode** (`return (<code>)`): a bare expression's value is the
   result, e.g. `[1,2,3].map(x => x * x)`.
2. **Statement mode** (`<code>` as a function body): used when the snippet is
   not a single expression. Use `return value` to report a result; without it
   the result is `undefined`.

If the result is a Promise it is awaited; a rejection is reported as an error.

Bindings available to snippets (besides the normal QuickJS globals):

| name      | meaning                                                                  |
|-----------|--------------------------------------------------------------------------|
| `console` | `log/info/debug/warn/error` captured to the output page (and to logcat) |
| `print`   | alias of `console.log`                                                  |
| `repr`    | format any value as a string (strings quoted, cycle-safe, depth-limited) |
| `require` | `require('@system.vibrator')` etc. -- only features listed in `manifest.json` |

## Limitations

- Errors thrown later from timers/callbacks the snippet installed (rather than
  through the returned Promise) are not captured; no global error hook is
  exposed to quick app JS.
- Snippets run in global scope; ES `import` is not available (use `require`).
- Infinite loops or heavy allocation will hang/kill the app; the JS heap is
  small (4 MB by default on the platform).
- A feature used via `require('@system.x')` must be declared under `features`
  in `src/manifest.json`; some also need entries under `permissions`.

## How it works

Vela quick apps run on QuickJS (see `open-vela/frameworks_runtimes_quickapp`),
and the production runtime keeps `eval`/`Function` enabled. The toolkit wraps
each page in `function(global, globalThis, window, $app_exports$, $app_evaluate$)`
and rewrites `require('@system.x')` to `$app_require$('@app-module/system.x')`;
`runner.js` reproduces that rewrite at runtime so snippets can load features
dynamically.
