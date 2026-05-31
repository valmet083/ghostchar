const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

// Emits markers the editor task problemMatcher uses to detect when a watch
// rebuild starts/finishes, so debug launches wait for a fresh build.
const watchMarkerPlugin = {
  name: "watch-marker",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`);
        }
      });
      console.log("[watch] build finished");
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node18",
    outfile: "dist/extension.js",
    // The editor runtime provides `vscode`; everything else (incl. the
    // workspace `@ghostchar/core`) is bundled into a single file.
    external: ["vscode"],
    sourcemap: !production,
    minify: production,
    logLevel: "info",
    plugins: [watchMarkerPlugin],
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
