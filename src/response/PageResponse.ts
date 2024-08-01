import JsonResponse from "./JsonResponse.js";
import ApiRequest from "../api/ApiRequest.js";

export default class PageResponse extends JsonResponse<JsonResponse.Object> {
    public constructor(req: ApiRequest, resources: JsonResponse.Object[], page: number, limit: number, total: number = resources.length) {
        const href: URL = new URL(req.url);
        const previous: URL | null = page > 1 ? new URL(req.url) : null;
        if (previous !== null) previous.searchParams.set("page", String(page - 1));
        const next: URL | null = page < Math.ceil(total / limit) ? new URL(req.url) : null;
        if (next !== null) next.searchParams.set("page", String(page + 1));
        super({
            page,
            limit,
            total,
            href: href.pathname + href.search,
            previous: previous === null ? null : previous.pathname + previous.search,
            next: next === null ? null : next.pathname + next.search,
            resources,
        }, 200);
    }
}
