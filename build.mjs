/* eslint-env node */
import { build } from "esbuild";
import babel from "esbuild-plugin-babel";
import process from "process";

const args = process.argv.slice(2);

const watch = args.some((a) => a === "--watch" || a === "-w");

build({
  entryPoints: {
    forko: "./src/index.ts",
    "forko-combat": "./src/combat.ts",
    "forko-lib": "./src/lib.ts",
    asdonlib: "./src/asdon.ts",
    wl: "./src/wl.ts",
    forkostatus: "./src/status.ts",
    sewers: "./src/sewers.ts",
    ee: "./src/SubZones/ee.ts",
    rescue: "./src/rescue.ts",
    finishsewers: "./src/finishsewers.ts",
    bkbuffs: "./src/bkbuffs.ts",
    bkfights: "./src/bkfights.ts",
    heap: "./src/SubZones/heap.ts",
    pld: "./src/SubZones/pld.ts",
    ahbg: "./src/SubZones/ahbg.ts",
    townsquare: "./src/townsquare.ts",
    bb: "./src/SubZones/bb.ts",
  },
  bundle: true,
  minifySyntax: true,
  platform: "node",
  target: "rhino1.7.14",
  external: ["kolmafia"],
  plugins: [babel()],
  outdir: "KoLmafia/scripts/forko",
  watch: watch && {
    onRebuild(error, result) {
      if (error) console.error("watch build failed:", error);
      else console.log("watch build succeeded:", result);
    },
  },
  loader: { ".json": "text" },
  inject: ["./kolmafia-polyfill.js"],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
