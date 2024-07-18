import ApiResponse from "./ApiResponse.js";
import Api from "../api/Api.js";

export default class BufferResponse extends ApiResponse {
    public constructor(
        public readonly buffer: Uint8Array,
        public readonly contentType: string = "application/octet-stream",
        status: number = 200
    ) {
        super(status);
    }

    public override send(req: Api.Request) {
        req.res.setHeader("Content-Type", this.contentType);
        req.res.end(this.buffer);
    }
}
