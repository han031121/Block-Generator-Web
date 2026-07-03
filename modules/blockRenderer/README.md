# blockRenderer

Three.js-based block renderer for generated block JSON data.

## Structure

```text
src/core/
  Reusable renderer code. It receives block data and render options, then renders
  to a canvas.

src/adapters/
  Data adapters for external formats. The current adapter reads blockGenerator
  JSON output and normalizes selected block data.

src/testApp/
  Browser UI used to inspect and tune renderer behavior during development.
```

## Usage

```powershell
npm start
```

Open the printed local URL in a browser.

## Console Loader

```powershell
npm run cli
```

Optional arguments:

```powershell
node src/main.js [blockJsonPath] [blockIndex]
```

If no JSON path is provided, the renderer reads:

```text
../blockGenerator/fixtures/output/test_output.json
```

The browser renderer outputs a 1200 x 1200 canvas and can download the result as a JPG.
