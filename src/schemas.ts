// Named exports over the spec-generated types (src/generated/openapi.d.ts,
// produced by `npm run generate` from openapi.json at the repo root).
// Regenerate whenever openapi.json advances; never edit the generated file.
import type { components } from "./generated/openapi.js";

export type Recording = components["schemas"]["Recording"];
export type RecordingType = components["schemas"]["RecordingType"];
export type RecordingStatus = components["schemas"]["RecordingStatus"];
export type SearchResult = components["schemas"]["SearchResult"];
export type Project = components["schemas"]["Project"];
export type ProjectDetail = components["schemas"]["ProjectDetail"];
export type ToolEntry = components["schemas"]["ToolEntry"];
export type OrganizationSummary = components["schemas"]["OrganizationSummary"];
export type Authorization = components["schemas"]["Authorization"];
export type PersonalAccessToken = components["schemas"]["PersonalAccessToken"];
