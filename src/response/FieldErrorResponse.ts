import ErrorResponse from "./ErrorResponse.js";

/**
 * A 422 error indicating that one or more fields in the request body were invalid.
 */
export default class FieldErrorResponse extends ErrorResponse {
    public constructor(fields: Record<string, string>, headers?: Record<string, string>, status = 422) {
        super(status, "One or more fields in the request body were invalid.", headers);
        this.data.error.fields = fields;
    }
}
