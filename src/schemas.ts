// Named exports over the spec-generated types (src/generated/openapi.ts,
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

// Timesheets (team only: clients get 404 from every timesheet route).
export type TimesheetEntry = components["schemas"]["TimesheetEntry"];
export type TimesheetEntryParent = components["schemas"]["TimesheetEntryParent"];
export type TimesheetWeek = components["schemas"]["TimesheetWeek"];
export type TimesheetWeekRow = components["schemas"]["TimesheetWeekRow"];
export type TimesheetAbsenceType = components["schemas"]["TimesheetAbsenceType"];
export type TimesheetPickerItem = components["schemas"]["TimesheetPickerItem"];
export type TimesheetWeekApproval = components["schemas"]["TimesheetWeekApproval"];
export type TimesheetApprovalRow = components["schemas"]["TimesheetApprovalRow"];
export type TimesheetApprovals = components["schemas"]["TimesheetApprovals"];
