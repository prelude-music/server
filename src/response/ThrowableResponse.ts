import ApiResponse from "./ApiResponse.js";

export default class ThrowableResponse<T extends ApiResponse> extends Error {
    public constructor(public readonly response: T) {
        super();
    }
}
