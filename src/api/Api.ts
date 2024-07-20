import http from "node:http";
import ApiRequest from "./ApiRequest.js";
import Controller from "./Controller.js";
import ApiResponse from "../response/ApiResponse.js";
import JsonResponse from "../response/JsonResponse.js";

class Api {
    public constructor(
        private readonly controllers: Controller[],
        private readonly packageJson: JsonResponse.Object
    ) {
        this.controllers.unshift(new Api.RootController(this.packageJson.version as string));
    }

    public async requestListener(q: http.IncomingMessage, s: http.ServerResponse): Promise<void> {
        const req = await ApiRequest.create(q, s);
        req.res.setHeader("Accept-Ranges", "bytes");
        req.res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
        req.res.setHeader("Access-Control-Allow-Credentials", "true");
        req.res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, PURGE, OPTIONS");
        req.res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            req.res.statusCode = 204;
            req.res.end();
            return;
        }

        const urlParts = (req.url.pathname.endsWith("/") ? req.url.pathname.slice(0, -1) : req.url.pathname).slice(1).split("/");

        for (const controller of this.controllers)
            if (controller.match(req, urlParts)) {
                (await controller.handle(req, urlParts)).send(req);
                return;
            }
        return Controller.endpointNotFound(req).send(req);
    }
}

namespace Api {
    export class RootController extends Controller {
        public constructor(private readonly version: string) {
            super();
        }


        public override match(req: ApiRequest): boolean {
            return req.url.pathname === "/";
        }

        public override handle(req: ApiRequest): ApiResponse {
            if (req.method === "GET") return new JsonResponse({version: this.version});
            return Controller.methodNotAllowed(req);
        }
    }
}

export default Api;
