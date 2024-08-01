import JsonResponse from "./JsonResponse.js";
import ApiRequest from "../api/ApiRequest.js";

export default class ErrorResponse extends JsonResponse<{error: {message: string, fields: Record<string, string>}}> {
    public constructor(status: number, message: string, protected readonly headers: Record<string, string> = {}, private readonly cause?: Error) {
        super({error: {message, fields: {}}}, status);
    }

    public override send(req: ApiRequest): void {
        req.res.statusCode = this.status;
        for (const [header, value] of Object.entries(this.headers))
            req.res.setHeader(header, value);
        super.send(req);

        if (this.cause !== undefined) console.error(`Request error: ${req.req.socket.remoteAddress} ${req.method} ${req.url}\n`, this.cause);
    }
}
