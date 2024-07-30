import ApiResponse from "./ApiResponse.js";
import ApiRequest from "../api/ApiRequest.js";

export default class EmptyReponse extends ApiResponse {
    public constructor() {
        super(204);
    }

    public override send(req: ApiRequest) {
        req.res.statusCode = this.status;
        req.res.end();
    }
}
