import ApiRequest from "./ApiRequest.js";
import ApiResponse from "../response/ApiResponse.js";
import ErrorResponse from "../response/ErrorResponse.js";

export default abstract class Controller {
    public abstract handle(req: ApiRequest, _urlParts: string[]): Promise<ApiResponse> | ApiResponse;
    protected readonly subControllers: Controller[] = [];

    protected runSubControllers(req: ApiRequest, urlParts: string[]): ApiResponse | Promise<ApiResponse> {
        for (const controller of this.subControllers)
            if (controller.match(req, urlParts))
                return controller.handle(req, urlParts);
        return Controller.endpointNotFound(req);
    }

    public static methodNotAllowed(req: ApiRequest): ApiResponse {
        return new ErrorResponse(405, "The HTTP method `" + req.method + "` is not allowed for endpoint `" + req.url.pathname + "`.");
    }

    public static endpointNotFound(req: ApiRequest): ApiResponse {
        return new ErrorResponse(404, "The requested endpoint `" + req.url.pathname + "` does not exist.")
    }

    public abstract match(req: ApiRequest, urlParts: string[]): boolean;
}
