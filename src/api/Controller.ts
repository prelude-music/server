import ApiRequest from "./ApiRequest.js";
import ApiResponse from "../response/ApiResponse.js";
import ErrorResponse from "../response/ErrorResponse.js";

export default abstract class Controller {
    public abstract handle(req: ApiRequest): Promise<ApiResponse> | ApiResponse;

    public static methodNotAllowed(req: ApiRequest): ApiResponse {
        return new ErrorResponse(405, "The HTTP method `" + req.method + "` is not allowed for endpoint `" + req.url.pathname + "`.");
    }

    public static endpointNotFound(req: ApiRequest): ApiResponse {
        return new ErrorResponse(404, "The requested endpoint `" + req.url.pathname + "` does not exist.")
    }

    public abstract match(req: ApiRequest): boolean;
}
