import Controller from "./Controller.js";
import ApiRequest from "./ApiRequest.js";
import ApiResponse from "../response/ApiResponse.js";
import Library from "../Library.js";

export default abstract class ResourceController extends Controller {
    /**
     * Resource API base path parts
     * `null` matches any string in that position. Do not use slashes.
     * @example ["tracks"] // matches everything that starts with /tracks/
     * @example ["artists", null, "tracks"] // matches everything that starts with /artists/<any>/tracks/
     */
    protected abstract readonly path: (string | null)[];

    /**
     * Index at which the path for this controller starts
     */
    protected readonly pathStartIndex: number = 0;

    public constructor(protected readonly library: Library) {
        super();
    }

    /**
     * GET /
     *
     * Get resources
     */
    protected list(req: ApiRequest, _urlParts: string[]): ApiResponse | Promise<ApiResponse> {
        return Controller.methodNotAllowed(req);
    }

    /**
     * POST /
     *
     * Create resource
     */
    protected create(req: ApiRequest, _urlParts: string[]): ApiResponse | Promise<ApiResponse> {
        return Controller.methodNotAllowed(req);
    }

    /**
     * DELETE /
     *
     * Delete all resources
     */
    protected deleteAll(req: ApiRequest, _urlParts: string[]): ApiResponse | Promise<ApiResponse> {
        return Controller.methodNotAllowed(req);
    }

    /**
     * GET /:id
     *
     * Get resource
     */
    protected get(req: ApiRequest, _id: string, _urlParts: string[]): ApiResponse | Promise<ApiResponse> {
        return Controller.methodNotAllowed(req);
    }

    /**
     * DELETE /:id
     *
     * Delete resource
     */
    protected delete(req: ApiRequest, _id: string, _urlParts: string[]): ApiResponse | Promise<ApiResponse> {
        return Controller.methodNotAllowed(req);
    }

    /**
     * PUT /:id
     *
     * Replace resource
     */
    protected put(req: ApiRequest, _id: string, _urlParts: string[]): ApiResponse | Promise<ApiResponse> {
        return Controller.methodNotAllowed(req);
    }

    /**
     * PATCH /:id
     *
     * Update resource
     */
    protected patch(req: ApiRequest, _id: string, _urlParts: string[]): ApiResponse | Promise<ApiResponse> {
        return Controller.methodNotAllowed(req);
    }

    public override async handle(req: ApiRequest, urlParts: string[]): Promise<ApiResponse> {
        if (urlParts.length === this.pathStartIndex + 1) switch (req.method) {
            case "GET": case "HEAD": return await this.list(req, urlParts);
            case "POST": return await this.create(req, urlParts);
            case "DELETE": return await this.deleteAll(req, urlParts);
            default: return Controller.methodNotAllowed(req);
        }
        if (urlParts.length === this.pathStartIndex + 2) {
            const id = urlParts[this.pathStartIndex + 1]!;
            switch (req.method) {
                case "GET": case "HEAD": return await this.get(req, id, urlParts);
                case "DELETE": return await this.delete(req, id, urlParts);
                case "PUT": return await this.put(req, id, urlParts);
                case "PATCH": return await this.patch(req, id, urlParts);
                default: return Controller.methodNotAllowed(req);
            }
        }
        return this.runSubControllers(req, urlParts);
    }

    public match(_req: ApiRequest, urlParts: string[]): boolean {
        return urlParts.length >= this.path.length && this.path.every((p, i) => p === null || p === urlParts[i]);
    }
}
