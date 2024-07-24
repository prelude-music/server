import http from "node:http";
import YAML from "yaml";
import ApiRequest from "./ApiRequest.js";
import Controller from "./Controller.js";
import ApiResponse from "../response/ApiResponse.js";
import JsonResponse from "../response/JsonResponse.js";
import FileResponse from "../response/FileResponse.js";
import SystemFile from "../SystemFile.js";

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

        private readonly paths = ["/", "/openapi.yaml", "/openapi.json"] as const;

        private readonly openApi = new SystemFile("/openapi.yaml");

        public override match(req: ApiRequest): boolean {
            return this.paths.includes(req.url.pathname as typeof this.paths[number]);
        }

        public override async handle(req: ApiRequest): Promise<ApiResponse> {
            if (req.method !== "GET") return Controller.methodNotAllowed(req);
            switch (req.url.pathname as typeof this.paths[number]) {
                case "/": return new JsonResponse({
                    prelude: {
                        version: this.version,
                        spec: {
                            json: "/openapi.json",
                            yaml: "/openapi.yaml"
                        }
                    }
                });
                case "/openapi.yaml": return new FileResponse(this.openApi);
                case "/openapi.json": {
                    const data = await this.openApi.buffer();
                    return new JsonResponse(YAML.parse(data.toString("utf8")));
                }
            }
        }
    }
}

export default Api;
