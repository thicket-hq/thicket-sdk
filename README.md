# thicket-sdk

The official TypeScript client for the [Thicket](https://www.thickethq.com)
API. Projects, to-dos, messages, docs, boards, calendar, chat, people,
timesheets and search: everything the product does is on the API, and the
web app runs on the same routes.

- **Reference**: [thickethq.com/developers/api](https://www.thickethq.com/developers/api)
- **OpenAPI spec**: [`openapi.json`](./openapi.json) at this repo's root
  (also served at [thickethq.com/openapi.json](https://www.thickethq.com/openapi.json)),
  for code generation in any language.
- **AI agents**: prefer plain HTTP? Start at
  [thickethq.com/ai-agents](https://www.thickethq.com/ai-agents). No SDK
  required.

## Install

```sh
npm install thicket-sdk
```

## Quick start

Create a personal access token in Thicket under **My settings → API tokens**,
then:

```ts
import { Thicket } from "thicket-sdk";

const thicket = new Thicket({
  token: process.env.THICKET_TOKEN!,
  userAgent: "AcmeSync (dev@acme.com)", // your app + a way to reach you
});

const { organizations } = await thicket.authorization.get();
const org = thicket.org(organizations[0].slug);

for (const project of await org.projects.list()) {
  console.log(project.id, project.name);
}
```

The token acts as its user: same workspaces, same project access, same
permissions. Read-only tokens exist; writes with one fail with
`read_only_token`.

## What the client handles for you

- **Auth**: `Authorization: Bearer` on every call; async token providers
  supported.
- **Errors**: every failure is a `ThicketError` with a stable `code`
  (`auth_required`, `forbidden`, `not_found`, `validation`, `plan_limit`,
  `rate_limit`, `network`, `api_error`), the HTTP status, the server's own
  `error.code` as `apiCode`, and `retryable`/`retryAfter`.
- **Retries**: 429 and 5xx retry with exponential backoff, honoring
  `Retry-After`. POST is never retried.
- **Pagination**: `client.paginate(path)` follows `?page`/`?per_page`
  listings to the end.
- **Types**: generated from `openapi.json` (`npm run generate`), so the
  types can't drift from the published contract.

## Timesheets

`org.timesheets` covers logged time: the report and its CSV, project and
item timesheets, logging and editing entries, the weekly timesheet,
absence, and approvals.

```ts
// Log 1 hour 30 minutes on a to-do
const entry = await org.timesheets.logOnRecording(todoId, {
  date: "2026-09-25",
  hours: "1:30",
  description: "Reviewed the launch checklist",
});
console.log(entry.hours); // "1.5"

// Last month's report, then the same rows as CSV
const entries = await org.timesheets.report({ project_id: projectId });
const csv = await org.timesheets.reportCsv({ project_id: projectId });

// This week, and submitting it while approvals are on
const week = await org.timesheets.week();
await org.timesheets.submitWeek(week.week_start);
```

Hours go in as `"1.5"` or `"1:30"` and come back as decimal strings. A
person can log at most 24 hours a day (`apiCode: "daily_cap"`), and
`deleteEntry` is permanent. Timesheets are for the team: a client's token
gets `not_found` from every call.

## Beyond the wrappers

Every route in the reference works through the escape hatches, typed by you:

```ts
// Post a message to a project's message board
const tools = await org.projects.tools(projectId);
const board = tools.find((t) => t.tool === "message_board")!;
await org.recordings.createChild(board.container_id!, {
  type: "message",
  title: "Week 33 summary",
  content: "Shipped the launch checklist.",
});

// Anything else
await org.request("PUT", `/recordings/${todoId}/completion`);
```

## Versioning

`openapi.json`'s `info.version` is a date, advanced whenever the API surface
changes; the SDK's semver tracks the client itself. The API keeps old
clients working: renames keep serving legacy aliases through a documented
transition window.

## License

MIT
