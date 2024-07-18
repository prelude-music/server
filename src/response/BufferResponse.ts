import ApiResponse from "./ApiResponse.js";
import ApiRequest from "../api/ApiRequest.js";

export default class BufferResponse extends ApiResponse {
    public constructor(
        public readonly buffer: Buffer,
        public readonly contentType: string = "application/octet-stream",
        status: number = 200
    ) {
        super(status);
    }

    public override send(req: ApiRequest) {
        req.res.setHeader("Content-Type", this.contentType);
        req.res.end(this.buffer);
    }
}
