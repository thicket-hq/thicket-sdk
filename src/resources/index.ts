// Thin typed wrappers over ThicketClient.request. One namespace per API
// family; anything not covered rides client.request/paginate directly with
// the reference (https://www.thickethq.com/developers/api) in hand.
import type { ThicketClient, RequestOptions } from "../client.js";
import type {
  Authorization,
  OrganizationSummary,
  PersonalAccessToken,
  Project,
  ProjectDetail,
  Recording,
  RecordingType,
  SearchResult,
  TimesheetAbsenceType,
  TimesheetApprovals,
  TimesheetEntry,
  TimesheetPickerItem,
  TimesheetWeek,
  TimesheetWeekApproval,
  TimesheetWeekRow,
  ToolEntry,
} from "../schemas.js";

/** Client-level: works before you know any organization. */
export class AuthorizationResource {
  constructor(private client: ThicketClient) {}
  /** Make this your first call: identity, reachable orgs, scope. */
  get(): Promise<Authorization> {
    return this.client.request("GET", "/api/v1/authorization");
  }
}

export class OrgsResource {
  constructor(private client: ThicketClient) {}
  list(): Promise<OrganizationSummary[]> {
    return this.client.request("GET", "/api/v1/orgs");
  }
  create(body: { name: string }): Promise<OrganizationSummary> {
    return this.client.request("POST", "/api/v1/orgs", { body });
  }
}

export class TokensResource {
  constructor(private client: ThicketClient) {}
  /** Session-only on the server; a token calling this gets 403. */
  list(): Promise<PersonalAccessToken[]> {
    return this.client.request("GET", "/api/v1/me/tokens");
  }
}

/** Everything scoped to one organization, addressed by slug. */
export class OrgScope {
  readonly projects: ProjectsResource;
  readonly recordings: RecordingsResource;
  readonly search: SearchResource;
  readonly timesheets: TimesheetsResource;

  constructor(
    private client: ThicketClient,
    readonly slug: string,
  ) {
    this.projects = new ProjectsResource(client, slug);
    this.recordings = new RecordingsResource(client, slug);
    this.search = new SearchResource(client, slug);
    this.timesheets = new TimesheetsResource(client, slug);
  }

  /** Escape hatch for org-scoped paths without a wrapper yet. */
  request<T>(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    return this.client.request(method, `/api/v1/${this.slug}${path}`, options);
  }
}

export class ProjectsResource {
  constructor(
    private client: ThicketClient,
    private slug: string,
  ) {}
  list(query?: {
    status?: "active" | "archived" | "trashed";
    include?: "members";
  }): Promise<Project[]> {
    return this.client.request("GET", `/api/v1/${this.slug}/projects`, {
      query,
    });
  }
  get(projectId: string): Promise<ProjectDetail> {
    return this.client.request(
      "GET",
      `/api/v1/${this.slug}/projects/${projectId}`,
    );
  }
  create(body: {
    name: string;
    description?: string;
    all_access?: boolean;
  }): Promise<Project> {
    return this.client.request("POST", `/api/v1/${this.slug}/projects`, {
      body,
    });
  }
  update(projectId: string, body: Record<string, unknown>): Promise<Project> {
    return this.client.request(
      "PATCH",
      `/api/v1/${this.slug}/projects/${projectId}`,
      { body },
    );
  }
  tools(projectId: string): Promise<ToolEntry[]> {
    return this.client.request(
      "GET",
      `/api/v1/${this.slug}/projects/${projectId}/tools`,
    );
  }
}

export class RecordingsResource {
  constructor(
    private client: ThicketClient,
    private slug: string,
  ) {}
  get(recordingId: string): Promise<Recording> {
    return this.client.request(
      "GET",
      `/api/v1/${this.slug}/recordings/${recordingId}`,
    );
  }
  /** Cross-project query: GET /recordings?type=todo&project_id=… */
  list(query?: {
    type?: RecordingType;
    project_id?: string;
    status?: string;
  }): Promise<Recording[]> {
    return this.client.request("GET", `/api/v1/${this.slug}/recordings`, {
      query,
    });
  }
  children(
    containerId: string,
    query?: Record<string, string | number | boolean>,
  ): Promise<Recording[]> {
    return this.client.request(
      "GET",
      `/api/v1/${this.slug}/recordings/${containerId}/children`,
      { query },
    );
  }
  createChild(
    containerId: string,
    body: { type: string } & Record<string, unknown>,
  ): Promise<Recording> {
    return this.client.request(
      "POST",
      `/api/v1/${this.slug}/recordings/${containerId}/children`,
      { body },
    );
  }
  comment(
    recordingId: string,
    body: { content_html?: string; content?: string } & Record<string, unknown>,
  ): Promise<Recording> {
    return this.client.request(
      "POST",
      `/api/v1/${this.slug}/recordings/${recordingId}/comments`,
      { body },
    );
  }
  complete(recordingId: string): Promise<void> {
    return this.client.request(
      "PUT",
      `/api/v1/${this.slug}/recordings/${recordingId}/completion`,
    );
  }
  uncomplete(recordingId: string): Promise<void> {
    return this.client.request(
      "DELETE",
      `/api/v1/${this.slug}/recordings/${recordingId}/completion`,
    );
  }
  /** Lifecycle: active | archived | trashed via the status sub-path. */
  setStatus(
    recordingId: string,
    status: "active" | "archived" | "trashed",
  ): Promise<void> {
    return this.client.request(
      "PUT",
      `/api/v1/${this.slug}/recordings/${recordingId}/status/${status}`,
    );
  }
  move(
    recordingId: string,
    body: { parent_id?: string; position?: number },
  ): Promise<void> {
    return this.client.request(
      "PUT",
      `/api/v1/${this.slug}/recordings/${recordingId}/position`,
      { body },
    );
  }
}

export class SearchResource {
  constructor(
    private client: ThicketClient,
    private slug: string,
  ) {}
  query(
    q: string,
    query?: Record<string, string | number | boolean>,
  ): Promise<SearchResult[]> {
    return this.client.request("GET", `/api/v1/${this.slug}/search`, {
      query: { q, ...query },
    });
  }
}

/** The report's filters, shared by its JSON and CSV forms. */
export type TimesheetReportQuery = {
  /** YYYY-MM-DD; send with end_date (default: the last month). */
  start_date?: string;
  /** YYYY-MM-DD, at most 366 days after start_date. */
  end_date?: string;
  person_id?: string;
  project_id?: string;
  /** While approvals are on; default approved. */
  status?: "approved" | "submitted" | "changed" | "not_submitted";
};

/** A new entry. `hours` is "1.5" or "1:30" (a number works too). */
export type TimesheetEntryInput = {
  /** YYYY-MM-DD. */
  date: string;
  hours: string | number;
  description?: string | null;
  /** Whose time (a membership id); owners and admins only. */
  person_id?: string;
};

/**
 * Timesheets: logged time on a project and its items, the report, the
 * weekly timesheet, absence and approvals. Team only: a client gets 404
 * from every call. Deleting an entry is permanent.
 */
export class TimesheetsResource {
  constructor(
    private client: ThicketClient,
    private slug: string,
  ) {}

  private path(rest: string): string {
    return `/api/v1/${this.slug}${rest}`;
  }

  /** Every counted entry in a date range, newest day first. Not paginated. */
  report(query?: TimesheetReportQuery): Promise<TimesheetEntry[]> {
    return this.client.request("GET", this.path("/reports/timesheet"), {
      query,
    });
  }
  /** The report as CSV: `Date,Person,Hours,Project,Item,Notes,Created[,Status]`. */
  reportCsv(query?: TimesheetReportQuery): Promise<string> {
    return this.client.requestText("GET", this.path("/reports/timesheet/csv"), {
      query,
      accept: "text/csv",
    });
  }

  /** One page of a project's timesheet: its own time and its items'. */
  project(
    projectId: string,
    query?: { page?: number; per_page?: number },
  ): Promise<TimesheetEntry[]> {
    return this.client.request(
      "GET",
      this.path(`/projects/${projectId}/timesheet`),
      { query },
    );
  }
  projectCsv(projectId: string): Promise<string> {
    return this.client.requestText(
      "GET",
      this.path(`/projects/${projectId}/timesheet/csv`),
      { accept: "text/csv" },
    );
  }
  /**
   * One page of an item's timesheet (a repeating event's is one day's:
   * pass `occurrence`). The project's timesheet id lists time on the
   * project itself.
   */
  recording(
    recordingId: string,
    query?: { occurrence?: string; page?: number; per_page?: number },
  ): Promise<TimesheetEntry[]> {
    return this.client.request(
      "GET",
      this.path(`/recordings/${recordingId}/timesheet`),
      { query },
    );
  }
  recordingCsv(
    recordingId: string,
    query?: { occurrence?: string },
  ): Promise<string> {
    return this.client.requestText(
      "GET",
      this.path(`/recordings/${recordingId}/timesheet/csv`),
      { query, accept: "text/csv" },
    );
  }

  /** Logs time on the project itself. */
  logOnProject(
    projectId: string,
    body: TimesheetEntryInput,
  ): Promise<TimesheetEntry> {
    return this.client.request(
      "POST",
      this.path(`/projects/${projectId}/timesheet/entries`),
      { body },
    );
  }
  /**
   * Logs time on an item (a to-do, message, document, file, card or
   * event; `occurrence` names a repeating event's day), or on the project
   * when the id is its timesheet's.
   */
  logOnRecording(
    recordingId: string,
    body: TimesheetEntryInput & { occurrence?: string },
  ): Promise<TimesheetEntry> {
    return this.client.request(
      "POST",
      this.path(`/recordings/${recordingId}/timesheet/entries`),
      { body },
    );
  }
  /** Logs absence (vacation, sick leave, …) against an absence type. */
  logAbsence(
    body: TimesheetEntryInput & { absence_type_id: string },
  ): Promise<TimesheetEntry> {
    return this.client.request(
      "POST",
      this.path("/my/timesheet/absences"),
      { body },
    );
  }

  getEntry(entryId: string): Promise<TimesheetEntry> {
    return this.client.request(
      "GET",
      this.path(`/timesheet-entries/${entryId}`),
    );
  }
  /** Changes the day, hours, notes or person; what the time is on never changes. */
  updateEntry(
    entryId: string,
    body: {
      date?: string;
      hours?: string | number;
      description?: string | null;
      person_id?: string;
    },
  ): Promise<TimesheetEntry> {
    return this.client.request(
      "PATCH",
      this.path(`/timesheet-entries/${entryId}`),
      { body },
    );
  }
  /** Permanent: an entry has no trash of its own. */
  deleteEntry(entryId: string): Promise<{ ok: true }> {
    return this.client.request(
      "DELETE",
      this.path(`/timesheet-entries/${entryId}`),
    );
  }

  /** One person's week (default the caller's, this week). */
  week(query?: { week?: string; person_id?: string }): Promise<TimesheetWeek> {
    return this.client.request("GET", this.path("/my/timesheet"), { query });
  }
  /** Adds a row to a week that may not have hours yet. */
  addRow(body: {
    project_id: string;
    recording_id?: string;
    occurrence?: string;
    week?: string;
    person_id?: string;
  }): Promise<TimesheetWeekRow> {
    return this.client.request("POST", this.path("/my/timesheet/rows"), {
      body,
    });
  }
  /**
   * Removes a row. A row with hours that week needs `delete_entries: true`,
   * which deletes them for good.
   */
  removeRow(query: {
    recording_id: string;
    occurrence?: string;
    week?: string;
    person_id?: string;
    delete_entries?: boolean;
  }): Promise<{ ok: true; deleted_entries: number }> {
    return this.client.request("DELETE", this.path("/my/timesheet/rows"), {
      query,
    });
  }
  /** What a new row in a project can be on, for a week (`q` searches). */
  items(
    projectId: string,
    query?: { week?: string; q?: string },
  ): Promise<TimesheetPickerItem[]> {
    return this.client.request(
      "GET",
      this.path(`/projects/${projectId}/timesheet/items`),
      { query },
    );
  }

  /** Submits or resubmits a week for approval (while approvals are on). */
  submitWeek(
    weekStart: string,
    body?: { person_id?: string },
  ): Promise<TimesheetWeekApproval> {
    return this.client.request(
      "POST",
      this.path(`/my/timesheet/weeks/${weekStart}/submit`),
      body ? { body } : undefined,
    );
  }
  /** The approvals page for a week: owners and admins. */
  approvals(query?: { week?: string }): Promise<TimesheetApprovals> {
    return this.client.request("GET", this.path("/timesheet/approvals"), {
      query,
    });
  }
  approve(
    membershipId: string,
    weekStart: string,
  ): Promise<TimesheetWeekApproval> {
    return this.client.request(
      "POST",
      this.path(`/timesheet/approvals/${membershipId}/${weekStart}/approve`),
    );
  }
  /** Rejects a week; the reason is required and reaches the person. */
  reject(
    membershipId: string,
    weekStart: string,
    reason: string,
  ): Promise<TimesheetWeekApproval> {
    return this.client.request(
      "POST",
      this.path(`/timesheet/approvals/${membershipId}/${weekStart}/reject`),
      { body: { reason } },
    );
  }

  absenceTypes(query?: {
    include_archived?: boolean;
  }): Promise<TimesheetAbsenceType[]> {
    return this.client.request(
      "GET",
      this.path("/timesheet/absence-types"),
      { query },
    );
  }
  /** Owners and admins. */
  createAbsenceType(body: { name: string }): Promise<TimesheetAbsenceType> {
    return this.client.request(
      "POST",
      this.path("/timesheet/absence-types"),
      { body },
    );
  }
  /** Owners and admins. `archived: true` removes a type; its hours keep the label. */
  updateAbsenceType(
    absenceTypeId: string,
    body: { name?: string; position?: number; archived?: boolean },
  ): Promise<TimesheetAbsenceType> {
    return this.client.request(
      "PATCH",
      this.path(`/timesheet/absence-types/${absenceTypeId}`),
      { body },
    );
  }
}
