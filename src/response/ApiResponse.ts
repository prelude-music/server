import Api from "../api/Api.js";

export default abstract class ApiResponse {
    protected constructor(public readonly status: number) {
    }
    public abstract send(req: Api.Request): void | Promise<void>;
}
