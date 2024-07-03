import JsonResponse from "./JsonResponse.js";
import Api from "../api/Api.js";

export default class PageResponse extends JsonResponse {
    public constructor(resources: JsonResponse.Object[], page: number, limit: number, total: number = resources.length) {
        super({resources, page, limit, total}, 200);
    }

    public static array<T = JsonResponse.Object>(limits: { page: number, limit: number }, array: T[]): {
        resources: T[],
        page: number,
        limit: number,
        total: number
    } {
        return {
            resources: array.slice((limits.page - 1) * limits.limit, limits.page * limits.limit),
            page: limits.page,
            limit: limits.limit,
            total: array.length
        };
    }

    public static from<T>(
        ...args: T extends JsonResponse.Object
            ? [Api.Request, T[]] | [Api.Request, T[], (resource: T, index: number, array: T[]) => JsonResponse.Object]
            : [Api.Request, T[], (resource: T, index: number, array: T[]) => JsonResponse.Object]
    ): PageResponse {
        const req = args[0];
        const resources = args[1];
        const mapFn = args[2];

        const data = this.array<T>(req.limit(), resources);
        const res: JsonResponse.Object[] = (mapFn ? data.resources.map(mapFn) : data.resources) as JsonResponse.Object[];
        return new PageResponse(res, data.page, data.limit, data.total);
    }
}
