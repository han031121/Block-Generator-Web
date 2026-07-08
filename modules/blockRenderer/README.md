# blockRenderer

Reusable Three.js renderer code for generated block JSON data.

## Structure

```text
src/core/
  Browser-compatible renderer code. It receives normalized block data and render
  options, then renders to a canvas.

src/adapters/
  Node-side data adapters for loading blockGenerator JSON output.

src/main.js
  Console loader for inspecting a selected block from a JSON file.
```

The interactive web UI lives in:

```text
apps/web/
```

## Console Loader

```powershell
npm.cmd run cli
```

Optional arguments:

```powershell
node src/main.js [blockJsonPath] [blockIndex]
```

If no JSON path is provided, the loader reads:

```text
../blockGenerator/fixtures/output/test_output.json
```
