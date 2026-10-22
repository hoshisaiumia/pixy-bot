import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  minify: true,
  sourcemap: true,
  legalComments: "eof", // keeps the libraries' license notices at the end of the file
  outfile: "dist/index.js",
  // optional native add-ons that can't be bundled; discord.js works without them
  external: ["zlib-sync", "bufferutil", "utf-8-validate"],
  // lets bundled CommonJS code call require() inside an ESM file
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
});