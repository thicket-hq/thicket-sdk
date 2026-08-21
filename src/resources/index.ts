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

  constructor(
    private client: ThicketClient,
    readonly slug: string,
  ) {
    this.projects = new ProjectsResource(client, slug);
    this.recordings = new RecordingsResource(client, slug);
    this.search = new SearchResource(client, slug);
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
