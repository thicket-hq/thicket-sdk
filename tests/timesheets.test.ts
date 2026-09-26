// The timesheets resource: every wrapper hits its documented route with
// the right method, query and body, and the CSV exports come back as text
// through the same transport (auth, errors) as the JSON calls.
import { describe, expect, it, vi } from "vitest";
import { Thicket, ThicketError } from "../src/index.js";

const OPTS = {
  token: "thicket_pat_test",
  userAgent: "sdk-tests (dev@test.local)",
};

type Call = { url: URL; init: RequestInit };

function recorder(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (url: URL, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    return respond(call);
  }) as unknown as typeof globalThis.fetch;
  const org = new Thicket({ ...OPTS, fetch }).org("acme");
  return { org, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function describeCall(c: Call) {
  const body = c.init.body ? JSON.parse(String(c.init.body)) : undefined;
  return `${c.init.method} ${c.url.pathname}${c.url.search}${
    body === undefined ? "" : ` ${JSON.stringify(body)}`
  }`;
}

describe("timesheets", () => {
  it("routes every wrapper to its documented operation", async () => {
    const { org, calls } = recorder(() => json(200, {}));
    const t = org.timesheets;
    await t.report({ start_date: "2026-09-01", end_date: "2026-09-25", status: "changed" });
    await t.project("p1", { page: 2 });
    await t.recording("r1", { occurrence: "2026-10-05" });
    await t.logOnProject("p1", { date: "2026-09-25", hours: "1:30" });
    await t.logOnRecording("r1", { date: "2026-09-25", hours: 2, occurrence: "2026-09-25" });
    await t.logAbsence({ absence_type_id: "a1", date: "2026-09-24", hours: "8" });
    await t.getEntry("e1");
    await t.updateEntry("e1", { description: null });
    await t.deleteEntry("e1");
    await t.week({ week: "2026-09-21", person_id: "m2" });
    await t.addRow({ project_id: "p1", recording_id: "r1" });
    await t.removeRow({ recording_id: "r1", delete_entries: true });
    await t.items("p1", { q: "launch" });
    await t.submitWeek("2026-09-21");
    await t.submitWeek("2026-09-21", { person_id: "m2" });
    await t.approvals({ week: "2026-09-21" });
    await t.approve("m2", "2026-09-21");
    await t.reject("m2", "2026-09-21", "Tuesday is missing");
    await t.absenceTypes({ include_archived: true });
    await t.createAbsenceType({ name: "Jury duty" });
    await t.updateAbsenceType("a1", { archived: true });

    expect(calls.map(describeCall)).toEqual([
      "GET /api/v1/acme/reports/timesheet?start_date=2026-09-01&end_date=2026-09-25&status=changed",
      "GET /api/v1/acme/projects/p1/timesheet?page=2",
      "GET /api/v1/acme/recordings/r1/timesheet?occurrence=2026-10-05",
      'POST /api/v1/acme/projects/p1/timesheet/entries {"date":"2026-09-25","hours":"1:30"}',
      'POST /api/v1/acme/recordings/r1/timesheet/entries {"date":"2026-09-25","hours":2,"occurrence":"2026-09-25"}',
      'POST /api/v1/acme/my/timesheet/absences {"absence_type_id":"a1","date":"2026-09-24","hours":"8"}',
      "GET /api/v1/acme/timesheet-entries/e1",
      'PATCH /api/v1/acme/timesheet-entries/e1 {"description":null}',
      "DELETE /api/v1/acme/timesheet-entries/e1",
      "GET /api/v1/acme/my/timesheet?week=2026-09-21&person_id=m2",
      'POST /api/v1/acme/my/timesheet/rows {"project_id":"p1","recording_id":"r1"}',
      "DELETE /api/v1/acme/my/timesheet/rows?recording_id=r1&delete_entries=true",
      "GET /api/v1/acme/projects/p1/timesheet/items?q=launch",
      "POST /api/v1/acme/my/timesheet/weeks/2026-09-21/submit",
      'POST /api/v1/acme/my/timesheet/weeks/2026-09-21/submit {"person_id":"m2"}',
      "GET /api/v1/acme/timesheet/approvals?week=2026-09-21",
      "POST /api/v1/acme/timesheet/approvals/m2/2026-09-21/approve",
      'POST /api/v1/acme/timesheet/approvals/m2/2026-09-21/reject {"reason":"Tuesday is missing"}',
      "GET /api/v1/acme/timesheet/absence-types?include_archived=true",
      'POST /api/v1/acme/timesheet/absence-types {"name":"Jury duty"}',
      'PATCH /api/v1/acme/timesheet/absence-types/a1 {"archived":true}',
    ]);
  });

  it("returns the CSV exports as text, asking for text/csv", async () => {
    const csv = "Date,Person,Hours,Project,Item,Notes,Created\n";
    const { org, calls } = recorder(
      () =>
        new Response(csv, {
          status: 200,
          headers: { "content-type": "text/csv; charset=utf-8" },
        }),
    );
    expect(await org.timesheets.reportCsv({ project_id: "p1" })).toBe(csv);
    expect(await org.timesheets.projectCsv("p1")).toBe(csv);
    expect(await org.timesheets.recordingCsv("r1", { occurrence: "2026-10-05" })).toBe(csv);
    expect(calls.map((c) => `${c.url.pathname}${c.url.search}`)).toEqual([
      "/api/v1/acme/reports/timesheet/csv?project_id=p1",
      "/api/v1/acme/projects/p1/timesheet/csv",
      "/api/v1/acme/recordings/r1/timesheet/csv?occurrence=2026-10-05",
    ]);
    for (const c of calls) {
      const headers = c.init.headers as Record<string, string>;
      expect(headers.accept).toBe("text/csv");
      expect(headers.authorization).toBe("Bearer thicket_pat_test");
    }
  });

  it("maps a refused CSV to the error taxonomy", async () => {
    const { org } = recorder(() =>
      json(422, { error: { code: "invalid", message: "At most 366 days" } }),
    );
    const err = await org.timesheets
      .reportCsv({ start_date: "2025-01-01", end_date: "2026-09-25" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ThicketError);
    expect(err).toMatchObject({
      code: "validation",
      status: 422,
      apiCode: "invalid",
      message: "At most 366 days",
    });
  });

  it("surfaces the daily cap's own code", async () => {
    const { org } = recorder(() =>
      json(422, {
        error: {
          code: "daily_cap",
          message: "That would put Priya over 24 hours on Sep 25.",
        },
      }),
    );
    const err = await org.timesheets
      .logOnRecording("r1", { date: "2026-09-25", hours: "3" })
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "validation", apiCode: "daily_cap" });
  });
});
