import JsonResponse from "./JsonResponse.js";
import Api from "../api/Api.js";

export default class ErrorResponse extends JsonResponse {
    public constructor(status: number, message: string, private readonly cause?: Error) {
        super({error: {message}}, status);
    }

    public override send(req: Api.Request): void {
        req.res.statusCode = this.status;
        super.send(req);

        if (this.cause !== undefined) console.error(`Request error: ${req.req.socket.remoteAddress} ${req.method} ${req.url}\n`, this.cause);
    }
}
