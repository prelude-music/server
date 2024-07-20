import ApiResponse from "./ApiResponse.js";
import ApiRequest from "../api/ApiRequest.js";

class JsonResponse extends ApiResponse {
    private readonly data: Readonly<JsonResponse.Object | JsonResponse.Array>;

    public constructor(data: JsonResponse.Object | JsonResponse.Array, status: number = 200) {
        super(status);
        this.data = Object.freeze(data);
    }

    public override send(req: ApiRequest): void {
        req.res.setHeader("Content-Type", "application/json");
        req.res.end(JSON.stringify(this.data));
    }
}

namespace JsonResponse {
    export type Value = string | number | boolean | Date | null | JsonResponse.Array | JsonResponse.Object;
    export type Array = Value[] | readonly [];
    export type Object = NodeJS.Dict<Value> | {[key: string]: Value};
}

export default JsonResponse;
