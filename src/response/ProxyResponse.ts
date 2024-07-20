import ApiResponse from "./ApiResponse.js";
import ErrorResponse from "./ErrorResponse.js";
import ApiRequest from "../api/ApiRequest.js";
import {Readable} from 'node:stream';
import type {ReadableStream} from 'node:stream/web';

export default class ProxyResponse extends ApiResponse {
    public constructor(protected readonly url: string | URL, protected readonly options?: RequestInit, protected readonly proxyHeaders: boolean = true, protected readonly requiresStatus?: number, protected readonly requriedContentType?: string | RegExp) {
        super(200);
    }

    public override async send(req: ApiRequest) {
        const res = await fetch(this.url, this.options);

        if (this.requiresStatus !== undefined && res.status !== this.requiresStatus)
            return this.proxyError(res).send(req);
        if (this.requriedContentType !== undefined) {
            if (!res.headers.has("content-type"))
                return this.proxyError(res).send(req);
            if (typeof this.requriedContentType === "string"
                    ? res.headers.get("content-type") !== this.requriedContentType
                    : !this.requriedContentType.test(res.headers.get("content-type")!))
                return this.proxyError(res).send(req);
        }


        if (this.proxyHeaders)
            for (const [header, value] of res.headers) req.res.setHeader(header, value);

        req.res.statusCode = res.status;

        if (res.body) Readable.fromWeb(res.body as ReadableStream<Uint8Array>).pipe(req.res);
    }

    private proxyError(res: Response) {
        return new ErrorResponse(503, `Failed to proxy URL "${this.url}": got ${res.status} ${res.headers.get("content-type") ?? "(no content-type)"}`);
    }
}
