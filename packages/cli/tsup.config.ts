import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  // Bundle @ghostchar/core into the CLI so the published binary is self-contained.
  noExternal: ["@ghostchar/core"],
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
