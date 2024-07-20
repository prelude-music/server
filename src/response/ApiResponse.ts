import ApiRequest from "../api/ApiRequest.js";

export default abstract class ApiResponse {
    protected constructor(public readonly status: number) {
    }
    public abstract send(req: ApiRequest): void | Promise<void>;
}
