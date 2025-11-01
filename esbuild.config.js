import * as esbuild from "esbuild";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProduction = process.env.NODE_ENV === "production";

// Shared build options
const sharedOptions = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  sourcemap: !isProduction,
  minify: isProduction,
  treeShaking: true,
  metafile: true,
  // External dependencies that should not be bundled
  external: [
    "node-pty", // Native module
    "puppeteer", // Has its own bundled browser
    "grammy", // Keep external for easier updates
    "@ai-sdk/*", // AI SDK packages
    "@google/genai", // Google AI
    "archiver",
    "dotenv",
    "zod",
    "ai",
  ],
  logLevel: "info",
  outExtension: { ".js": ".js" },
};

async function build() {
  try {
    console.log(
      `🔨 Building coderBOT (${
        isProduction ? "production" : "development"
      } mode)...`
    );

    // Build main app entry point
    const appResult = await esbuild.build({
      ...sharedOptions,
      entryPoints: ["src/app.ts"],
      outfile: "dist/app.js",
    });

    // Build CLI entry point
    const cliResult = await esbuild.build({
      ...sharedOptions,
      entryPoints: ["src/cli.ts"],
      outfile: "dist/cli.js",
    });

    // Build bot worker
    const workerResult = await esbuild.build({
      ...sharedOptions,
      entryPoints: ["src/bot-worker.ts"],
      outfile: "dist/bot-worker.js",
    });

    console.log("✅ Build completed successfully!");

    if (isProduction) {
      console.log("\n📊 Bundle analysis:");
      await analyzeBundle(appResult.metafile, "app.js");
      await analyzeBundle(cliResult.metafile, "cli.js");
      await analyzeBundle(workerResult.metafile, "bot-worker.js");
    }
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

async function analyzeBundle(metafile, name) {
  if (!metafile) return;

  const analysis = await esbuild.analyzeMetafile(metafile, {
    verbose: false,
  });

  console.log(`\n📦 ${name}:`);
  console.log(analysis);
}

// Watch mode
if (process.argv.includes("--watch")) {
  console.log("👀 Watching for changes...");

  const ctx = await esbuild.context({
    ...sharedOptions,
    entryPoints: ["src/app.ts", "src/cli.ts", "src/bot-worker.ts"],
    outdir: "dist",
  });

  await ctx.watch();
  console.log("Watching...");
} else {
  build();
}
