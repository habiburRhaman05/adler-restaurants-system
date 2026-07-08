// Bundle entry for the Vercel serverless function.
//
// This file is bundled by esbuild (`--packages=external`) into `api/index.js`,
// which is what Vercel actually runs. Bundling inlines all of our own source so
// the deployed function has NO relative imports for Node's ESM loader to choke
// on; third-party packages stay as bare imports resolved from node_modules.
//
// The Express app is itself a `(req, res)` handler — exactly what Vercel invokes.
// (Local dev still uses `src/server.ts`, which calls `app.listen()`.)
import app from "./app";

export default app;
