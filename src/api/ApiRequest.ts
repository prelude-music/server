import http from "node:http";
import {parse as queryStringParse} from "querystring";
import JsonResponse from "../response/JsonResponse.js";
import EnhancedSwitch from "enhanced-switch";
import ErrorResponse from "../response/ErrorResponse.js";
import ApiResponse from "../response/ApiResponse.js";

export default class ApiRequest {
    /**
     * @internal
     */
    public _handled: boolean = false;

    public get handled(): boolean {
        return this._handled;
    }

    /**
     * @internal
     */
    public _body: JsonResponse.Object | JsonResponse.Array | Buffer = {};

    public readonly url: URL;

    public static async create(req: http.IncomingMessage, res: http.ServerResponse): Promise<ApiRequest> {
        const request = new ApiRequest(req, res);
        const contentType = request.req.headers["content-type"];
        if (contentType === undefined)
            return request;

        const contentLengthHeader = request.req.headers["content-length"];
        if (contentLengthHeader === undefined)
            return request;
        const contentLength = Number.parseInt(contentLengthHeader, 10);
        if (Number.isFinite(contentLength) && contentLength > 0)
            return request;
        const data = Buffer.alloc(Number.parseInt(contentLengthHeader, 10));
        let offset = 0;
        for await (const chunk of request.req) {
            if (offset + chunk.length > data.length)
                return request;
            data.set(chunk, offset);
            offset += chunk.length;
        }

        new EnhancedSwitch(contentType.toLowerCase().trim())
            .case("application/json", () => {
                try {
                    request._body = JSON.parse(data.toString());
                }
                catch (e) {
                    const err: SyntaxError = e as SyntaxError;
                    request.end(new ErrorResponse(400, "The request body is not valid JSON: " + err.message, err));
                }
            })
            .case("application/x-www-form-urlencoded", () => {
                request._body = queryStringParse(data.toString());
            })
            .default(() => {
                request._body = Buffer.from(data);
            });

        return request;
    }

    private constructor(
        public readonly req: http.IncomingMessage,
        public readonly res: http.ServerResponse
    ) {
        this.url = new URL(`http://${process.env.HOST ?? "localhost"}${req.url ?? "/"}`);
    }

    public end(res: ApiResponse) {
        if (this._handled) return;
        res.send(this);
        this._handled = true;
    }

    public get method(): string {
        return this.req.method ?? "";
    }

    public get headers(): http.IncomingHttpHeaders {
        return this.req.headers;
    }

    /**
     * Get request params for limit & page. Limit is inclusive and page starts at 1.
     */
    public limit() {
        const limitParam = Number.parseInt(this.url.searchParams.get("limit") ?? "100", 10);
        const pageParam = Number.parseInt(this.url.searchParams.get("page") ?? "1", 10);
        const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : 100;
        const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
        const offset = (page - 1) * limit;
        return {limit, page, offset};
    }
}
