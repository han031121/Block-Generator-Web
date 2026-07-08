# Build and Run

## blockGenerator

```powershell
cd modules\blockGenerator
mingw32-make run
```

WebAssembly build:

```powershell
cd modules\blockGenerator
mingw32-make wasm
```

The WebAssembly output is written to:

```text
apps/web/public/generated/
```

## Web UI

```powershell
cd apps\web
npm.cmd start
```

Open the printed local URL. The UI builds the generator WebAssembly first, then
lets the user enter block generation conditions, select `시작`, browse generated
blocks in order, and tune renderer variables with immediate canvas updates.

## Tests

```powershell
cd apps\web
npm.cmd test
```

The `modules/blockRenderer` package is the reusable renderer module. Its Node
adapter tests can be run separately:

```powershell
cd modules\blockRenderer
npm.cmd test
```
