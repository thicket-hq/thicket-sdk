// Fails the build when dist/ imports a module it doesn't ship. tsc emits
// only what it compiles: a hand-placed .d.ts under src/ is an input it never
// copies, which once left every schema type resolving to `any` for
// consumers (skipLibCheck hides it). Every relative specifier in dist's
// .js and .d.ts files must name a file that exists in dist.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const root = new URL("../dist/", import.meta.url).pathname;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const specifier = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;
const missing = [];
for (const file of files(root).filter((f) => /\.(js|d\.ts)$/.test(f))) {
  const declaration = file.endsWith(".d.ts");
  for (const [, spec] of readFileSync(file, "utf8").matchAll(specifier)) {
    const target = join(dirname(file), spec);
    const wanted = declaration ? target.replace(/\.js$/, ".d.ts") : target;
    if (!existsSync(wanted)) missing.push(`${file.slice(root.length)} → ${spec}`);
  }
}
if (missing.length > 0) {
  console.error(`dist/ imports modules it doesn't ship:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
console.log("dist/ is self-contained");
