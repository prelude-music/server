import ID from "../ID.js";
import JsonResponse from "../response/JsonResponse.js";
import ApiResponse from "../response/ApiResponse.js";
import ErrorResponse from "../response/ErrorResponse.js";
import ApiRequest from "./ApiRequest.js";

export default abstract class ApiResource {
    public abstract readonly id: ID;

    public abstract json(): JsonResponse.Object;

    public httpDelete(req: ApiRequest): ApiResponse {
        return this.methodNotAllowed(req);
    }

    public httpPut(req: ApiRequest): ApiResponse {
        return this.methodNotAllowed(req);
    }

    public httpPatch(req: ApiRequest): ApiResponse {
        return this.methodNotAllowed(req);
    }

    public methodNotAllowed(req: ApiRequest): ApiResponse {
        return new ErrorResponse(405, "The HTTP method `" + req.method + "` is not allowed for endpoint `" + req.url.pathname + "`.");
    }

    public handle(req: ApiRequest): Promise<ApiResponse> | ApiResponse {
        switch (req.method) {
            case "DELETE": return this.httpDelete(req);
            case "PUT": return this.httpPut(req);
            case "PATCH": return this.httpPatch(req);
            default: return this.methodNotAllowed(req);
        }
    }
}
