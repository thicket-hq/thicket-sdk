// thicket-sdk: the official TypeScript client for the Thicket API.
// Reference: https://www.thickethq.com/developers/api (spec: /openapi.json).
import {
  ThicketClient,
  type ThicketClientOptions,
} from "./client.js";
import {
  AuthorizationResource,
  OrgScope,
  OrgsResource,
  TokensResource,
} from "./resources/index.js";

export {
  ThicketClient,
  ThicketError,
  type ThicketClientOptions,
  type RequestOptions,
  type ErrorCode,
} from "./client.js";
export * from "./schemas.js";
export * from "./resources/index.js";

/** The front door: construct once, scope into organizations by slug. */
export class Thicket {
  readonly client: ThicketClient;
  readonly authorization: AuthorizationResource;
  readonly orgs: OrgsResource;
  readonly tokens: TokensResource;

  constructor(options: ThicketClientOptions) {
    this.client = new ThicketClient(options);
    this.authorization = new AuthorizationResource(this.client);
    this.orgs = new OrgsResource(this.client);
    this.tokens = new TokensResource(this.client);
  }

  /** Scope into one organization by its slug (from authorization.get()). */
  org(slug: string): OrgScope {
    return new OrgScope(this.client, slug);
  }
}
