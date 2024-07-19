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
    public abstract readonly path: (string | null)[];

    /**
     * Index at which the path for this controller starts
     */
    public readonly pathStartIndex: number = 0;

    public constructor(protected readonly library: Library) {
        super();
    }

    /**
     * GET /
     *
     * Get resources
     */
    public list(req: ApiRequest, _urlParts: string[]): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * POST /
     *
     * Create resource
     */
    public create(req: ApiRequest, _urlParts: string[]): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * DELETE /
     *
     * Delete all resources
     */
    public deleteAll(req: ApiRequest, _urlParts: string[]): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * GET /:id
     *
     * Get resource
     */
    public get(req: ApiRequest, _id: string, _urlParts: string[]): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * DELETE /:id
     *
     * Delete resource
     */
    public delete(req: ApiRequest, _id: string, _urlParts: string[]): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * PUT /:id
     *
     * Replace resource
     */
    public put(req: ApiRequest, _id: string, _urlParts: string[]): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * PATCH /:id
     *
     * Update resource
     */
    public patch(req: ApiRequest, _id: string, _urlParts: string[]): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    public override handle(req: ApiRequest, urlParts: string[]): Promise<ApiResponse> | ApiResponse {
        if (urlParts.length === this.pathStartIndex + 1) switch (req.method) {
            case "GET": return this.list(req, urlParts);
            case "POST": return this.create(req, urlParts);
            case "DELETE": return this.deleteAll(req, urlParts);
            default: return Controller.methodNotAllowed(req);
        }
        if (urlParts.length === this.pathStartIndex + 2) {
            const id = urlParts[this.pathStartIndex + 1]!;
            switch (req.method) {
                case "GET": return this.get(req, id, urlParts);
                case "DELETE": return this.delete(req, id, urlParts);
                case "PUT": return this.put(req, id, urlParts);
                case "PATCH": return this.patch(req, id, urlParts);
                default: return Controller.methodNotAllowed(req);
            }
        }
        return this.runSubControllers(req, urlParts);
    }

    public match(_req: ApiRequest, urlParts: string[]): boolean {
        return urlParts.length >= this.path.length && this.path.every((p, i) => p === null || p === urlParts[i]);
    }
}
