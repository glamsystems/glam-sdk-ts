import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { build } from "esbuild";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const bundledPackages = new Set(["@glamsystems/sanctum-lst-list"]);
const externalPackages = Object.keys(packageJson.dependencies ?? {}).filter(
  (name) => !bundledPackages.has(name),
);
const external = externalPackages.flatMap((name) => [name, `${name}/*`]);
const anchorBytesImport = "@coral-xyz/anchor/dist/cjs/utils/bytes";

const plugins = [
  {
    name: "anchor-bytes-index",
    setup(build) {
      build.onResolve(
        { filter: /^@coral-xyz\/anchor\/dist\/cjs\/utils\/bytes$/ },
        () => ({
          path: `${anchorBytesImport}/index.js`,
          external: true,
        }),
      );
    },
  },
];

async function prepareTarget() {
  await rm("target", { recursive: true, force: true });
  await mkdir("target", { recursive: true });
  await cp("idl", "target/idl", { recursive: true });
  await cp("types", "target/types", { recursive: true });
}

function runTsc() {
  const tsc = join("node_modules", ".bin", "tsc");
  execFileSync(tsc, ["-p", "tsconfig.build.json"], { stdio: "inherit" });
}

async function copyDeclarations() {
  await cp(".build/types/src", "src", { recursive: true });

  try {
    await cp(".build/types/target/types", "target/types", { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const entryDeclaration = 'export * from "./src/index";\n';
  await writeFile("index.cjs.d.ts", entryDeclaration);
  await writeFile("index.esm.d.ts", entryDeclaration);
}

async function bundle(format, outfile) {
  await build({
    entryPoints: ["src/index.ts"],
    outfile,
    bundle: true,
    format,
    platform: "node",
    target: "es2020",
    external,
    sourcemap: false,
    minify: true,
    logLevel: "info",
    plugins,
  });
}

execFileSync(process.execPath, ["scripts/clean.mjs"], { stdio: "inherit" });
await prepareTarget();
await Promise.all([
  bundle("cjs", "index.cjs.js"),
  bundle("esm", "index.esm.js"),
]);
runTsc();
await copyDeclarations();
