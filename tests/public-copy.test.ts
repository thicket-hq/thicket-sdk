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

// The repository is public and npm shows package.json's description and
// keywords, so the scripts, the tests and the manifest are copy too.
const files = import.meta.glob<string>(
  [
    "../openapi.json",
    "../README.md",
    "../package.json",
    "../src/**/*",
    "../scripts/**/*",
    "./**/*",
    "!./public-copy.test.ts",
  ],
  { query: "?raw", import: "default", eager: true },
);

// Thicket's own names, never the words its model coined for its features
// (the web repository's eslint rule thicket/no-coined-term and its guard on
// the spec's prose hold the same list). Only a few protocol words are
// exact: the SSE keepalive `: ping`, the agent inbox's `pinged` reason
// value, search's recency boost. Wire names joined by a hyphen or an
// underscore pass.
const COINED =
  /(?<![A-Za-z_-])(card tables?|campfires?|pings?|pinged|boosts?|boosted|bubbles? up|bubbled up|work can wait|adminland|hill ?charts?|hillcharts?|needle)(?![A-Za-z_-])/i;
const PROTOCOL_WORDS = [/`: ping`/g, /"pinged"/g, /`pinged`/g, /recency boost/gi];

describe("public copy uses Thicket's names", () => {
  it("spec, sources, scripts, tests, manifest and README", () => {
    const hits = Object.entries(files).flatMap(([path, text]) =>
      text
        .split("\n")
        .map((line) => PROTOCOL_WORDS.reduce((s, re) => s.replace(re, ""), line))
        .filter((line) => COINED.test(line))
        .map((line) => `${path}: ${line.trim().slice(0, 120)}`),
    );
    expect(hits).toEqual([]);
  });
});

describe("public copy names no competitor", () => {
  it("spec, sources, scripts, tests, manifest and README", () => {
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
