// Guard: this repository and its npm package are public, so everything in
// them is product copy. The vendored spec's descriptions, the generated
// types' doc comments, and the README describe Thicket by what it does and
// never name a competitor.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Stored encoded, so the guard never spells out a name itself.
const COMPETITORS = new RegExp(
  ["YmFzZWNhbXA=", "MzdzaWduYWxz"].map((name) => atob(name)).join("|"),
  "i",
);
const ROOT = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("public copy names no competitor", () => {
  it("spec, sources, and README", () => {
    const scanned = [
      join(ROOT, "openapi.json"),
      join(ROOT, "README.md"),
      ...files(join(ROOT, "src")),
    ];
    const hits = scanned.flatMap((path) =>
      readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => COMPETITORS.test(line))
        .map((line) => `${path.slice(ROOT.length + 1)}: ${line.trim().slice(0, 120)}`),
    );
    expect(hits).toEqual([]);
  });
});
