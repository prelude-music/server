import http from "node:http";
import {Component, Multipart} from "multipart-ts";
import EnhancedSwitch from "enhanced-switch";
import ErrorResponse from "../response/ErrorResponse.js";
import ApiResponse from "../response/ApiResponse.js";
import Authorisation from "../Authorisation.js";
import Library from "../Library.js";
import Token from "../resource/Token.js";
import ThrowableResponse from "../response/ThrowableResponse.js";

export default class ApiRequest {
    /**
     * @internal
     */
    public _handled: boolean = false;

    public get handled(): boolean {
        return this._handled;
    }

    #body: FormData | Buffer = Buffer.alloc(0);
    public get body(): FormData | Buffer {
        return this.#body;
    }

    #auth: Authorisation | null = null;
    public get auth(): Authorisation | null {
        return this.#auth;
    }

    public require(scope: Token.Scope) {
        if (this.auth === null) throw new ThrowableResponse(Authorisation.UNAUTHORISED);
        this.auth.require(scope);
    }

    public readonly url: URL;

    private static jsonToFormData(json: Record<string, any>, formData: FormData = new FormData(), parentKey: string | null = null): FormData {
        for (const [k, value] of Object.entries(json)) {
            const key = parentKey === null ? k : `${parentKey}.${k}`;
            if (Array.isArray(value))
                for (const v of value)
                    formData.append(key, `${v}`);
            else if (value !== null && typeof value === "object")
                this.jsonToFormData(value, formData, key)
            else formData.append(key, `${value}`);
        }
        return formData;
    }


    public static async create(req: http.IncomingMessage, res: http.ServerResponse, library: Library): Promise<ApiRequest> {
        const request = new ApiRequest(req, res);

        request.#auth = await Authorisation.fromReq(request, library);

        if (["CONNECT", "GET", "HEAD", "OPTIONS", "TRACE"].includes(request.method))
            return request;

        const contentType = request.req.headers["content-type"]?.split(";")[0];
        if (contentType === undefined)
            return request;

        try {
            const chunks: Uint8Array[] = []
            for await (const chunk of req) chunks.push(chunk);
            const data = Buffer.concat(chunks);

            new EnhancedSwitch(contentType.toLowerCase().trim())
                .case("application/json", () => {
                    try {
                        request.#body = this.jsonToFormData(JSON.parse(data.toString()));
                    } catch (e) {
                        const err: SyntaxError = e as SyntaxError;
                        request.end(new ErrorResponse(400, "The request body is not valid JSON: " + err.message, {}, err));
                    }
                })
                .case("application/x-www-form-urlencoded", () => {
                    const usp = new URLSearchParams(data.toString());
                    const formData = new FormData();
                    for (const [key, value] of usp.entries())
                        formData.append(key, value);
                    request.#body = formData;
                })
                .case("multipart/form-data", () => {
                    const multipart = Multipart.part(new Component({
                        "Content-Type": req.headers["content-type"]!
                    }, data));
                    request.#body = multipart.formData();
                })
                .default(() => {
                    request.#body = data;
                });
        }
        catch (error) {
            if (error instanceof Error)
                throw new ThrowableResponse(new ErrorResponse(400, error.message, {}, error));
            throw new ThrowableResponse(new ErrorResponse(500, "Internal server error.", {}, error as any));
        }
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
