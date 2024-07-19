import Controller from "./Controller.js";
import ApiRequest from "./ApiRequest.js";
import ApiResponse from "../response/ApiResponse.js";
import Library from "../Library.js";

export default abstract class ResourceController extends Controller {
    /**
     * Resource API base path, e.g. `/tracks`
     * Trailing slashes not allowed.
     */
    public abstract readonly path: string;

    public constructor(protected readonly library: Library) {
        super();
    }

    /**
     * GET /
     *
     * Get resources
     */
    public list(req: ApiRequest): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * POST /
     *
     * Create resource
     */
    public create(req: ApiRequest): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * DELETE /
     *
     * Delete all resources
     */
    public deleteAll(req: ApiRequest): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * GET /:id
     *
     * Get resource
     */
    public get(req: ApiRequest, _id: string): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * DELETE /:id
     *
     * Delete resource
     */
    public delete(req: ApiRequest, _id: string): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * PUT /:id
     *
     * Replace resource
     */
    public put(req: ApiRequest, _id: string): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    /**
     * PATCH /:id
     *
     * Update resource
     */
    public patch(req: ApiRequest, _id: string): ApiResponse {
        return Controller.methodNotAllowed(req);
    }

    public override handle(req: ApiRequest): Promise<ApiResponse> | ApiResponse {
        if (!this.match(req)) return Controller.endpointNotFound(req);
        const parts = req.url.pathname.replace(this.path, "").split("/").filter(p => p.length > 0);
        if (parts.length === 0) switch (req.method) {
            case "GET": return this.list(req);
            case "POST": return this.create(req);
            case "DELETE": return this.deleteAll(req);
            default: return Controller.methodNotAllowed(req);
        }
        if (parts.length === 1) {
            const id = parts[0]!;
            switch (req.method) {
                case "GET": return this.get(req, id);
                case "DELETE": return this.delete(req, id);
                case "PUT": return this.put(req, id);
                case "PATCH": return this.patch(req, id);
                default: return Controller.methodNotAllowed(req);
            }
        }
        return Controller.endpointNotFound(req);
    }

    public match(req: ApiRequest): boolean {
        return req.url.pathname.startsWith(this.path);
    }
}
