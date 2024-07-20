import ID from "../ID.js";
import JsonResponse from "../response/JsonResponse.js";

export default abstract class ApiResource {
    public abstract readonly id: ID;

    public abstract json(): JsonResponse.Object;
}
