/// <reference types="vite/client" />
// Guard: this repository and its npm package are public, so everything in
// them is product copy. The vendored spec's descriptions, the generated
// types' doc comments, and the README describe Thicket by what it does and
// never name a competitor.
import { describe, expect, it } from "vitest";

// Stored encoded, so the guard never spells out a name itself.
const COMPETITORS = new RegExp(
  ["YmFzZWNhbXA=", "MzdzaWduYWxz"].map((name) => atob(name)).join("|"),
  "i",
);

const files = import.meta.glob<string>(
  ["../openapi.json", "../README.md", "../src/**/*"],
  { query: "?raw", import: "default", eager: true },
);

describe("public copy names no competitor", () => {
  it("spec, sources, and README", () => {
    expect(Object.keys(files).length).toBeGreaterThan(3);
    const hits = Object.entries(files).flatMap(([path, text]) =>
      text
        .split("\n")
        .filter((line) => COMPETITORS.test(line))
        .map((line) => `${path}: ${line.trim().slice(0, 120)}`),
    );
    expect(hits).toEqual([]);
  });
});
