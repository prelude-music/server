import http from "node:http";
import {parse as queryStringParse} from "node:querystring";
import EnhancedSwitch from "enhanced-switch";
import ApiResponse from "../response/ApiResponse.js";
import ErrorResponse from "../response/ErrorResponse.js";
import JsonResponse from "../response/JsonResponse.js";
import Library from "../Library.js";
import FileResponse from "../response/FileResponse.js";
import BufferResponse from "../response/BufferResponse.js";
import PageResponse from "../response/PageResponse.js";

class Api {
    public constructor(
        private readonly library: Library,
        private readonly packageJson: JsonResponse.Object
    ) {
    }

    public async requestListener(q: http.IncomingMessage, s: http.ServerResponse): Promise<void> {
        const req = await Api.Request.create(q, s);
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

        const endpointNotFound = new ErrorResponse(404, "The requested endpoint `" + req.url.pathname + "` does not exist.");

        const parts = req.url.pathname.split("/").filter(p => p.length > 0);

        if (parts.length === 0)
            return new JsonResponse({
                version: this.packageJson.version
            }).send(req);

        (await new EnhancedSwitch<string | undefined, ApiResponse | Promise<ApiResponse>>(parts[0])
            .case("tracks", async () => {
                if (parts.length === 1) {
                    return new EnhancedSwitch<typeof http.METHODS[number], ApiResponse>(req.method)
                        .case("GET", this.library.tracks(req))
                        .default(new ErrorResponse(405, "The HTTP method `" + req.method + "` is not allowed for endpoint `" + req.url.pathname + "`."))
                        .value;
                }
                else {
                    const track = this.library.getTrack(Number.parseInt(parts[1]!, 10));
                    if (track === null)
                        return new ErrorResponse(404, "The requested track is not part of this library.");

                    if (parts.length === 2)
                        return new JsonResponse(track.get());

                    else return new EnhancedSwitch<string, ApiResponse | Promise<ApiResponse>>(parts[2]!)
                        .case("audio", new FileResponse(track.file))
                        .case("image", async () => {
                            const image = await track.cover();
                            if (image === null)
                                return new ErrorResponse(404, "No cover art available for this track.");
                            return new BufferResponse(image.data, image.type);
                        })
                        .default(endpointNotFound)
                        .value;
                }
            })
            .case("albums", async () => {
                if (parts.length === 1) {
                    return new EnhancedSwitch<typeof http.METHODS[number], ApiResponse>(req.method)
                        .case("GET", this.library.albums(req))
                        .default(new ErrorResponse(405, "The HTTP method `" + req.method + "` is not allowed for endpoint `" + req.url.pathname + "`."))
                        .value;
                }
                else {
                    const album = this.library.getAlbum(parts[1]!);
                    if (album === null)
                        return new ErrorResponse(404, "The requested album is not part of this library.");

                    if (parts.length === 2)
                        return new JsonResponse(album.get());
                    else return new EnhancedSwitch<string, ApiResponse | Promise<ApiResponse>>(parts[2]!)
                        .case("tracks", PageResponse.from(req, album.tracks(), track => track.get()))
                        .case("image", async () => {
                            const image = await album.cover();
                            if (image === null)
                                return new ErrorResponse(404, "No cover art available for this album.");
                            return new BufferResponse(image.data, image.type);
                        })
                        .default(endpointNotFound)
                        .value;
                }
            })
            .case("artists", async () => {
                if (parts.length === 1) {
                    return new EnhancedSwitch<typeof http.METHODS[number], ApiResponse>(req.method)
                        .case("GET", this.library.artists(req))
                        .default(new ErrorResponse(405, "The HTTP method `" + req.method + "` is not allowed for endpoint `" + req.url.pathname + "`."))
                        .value;
                }
                else {
                    const artist = this.library.getArtist(parts[1]!);
                    if (artist === null)
                        return new ErrorResponse(404, "The requested artist is not part of this library.");
                    if (parts.length === 2)
                        return new JsonResponse(artist.get());
                    else return new EnhancedSwitch<string, ApiResponse | Promise<ApiResponse>>(parts[2]!)
                        .case("tracks", PageResponse.from(req, artist.tracks(), track => track.get()))
                        .case("albums", PageResponse.from(req, artist.albums(), album => album.get()))
                        .default(endpointNotFound)
                        .value;
                }
            })
            .default(endpointNotFound)
            .value)
            .send(req);
    }
}

namespace Api {
    export class RawContent {
        public constructor(
            public readonly buffer: Buffer
        ) {
        }
    }

    export class Request {
        /**
         * @internal
         */
        public _handled: boolean = false;

        public get handled(): boolean {
            return this._handled;
        }

        /**
         * @internal
         */
        public _body: JsonResponse.Object | JsonResponse.Array | Api.RawContent = {};

        public readonly url: URL;

        public static async create(req: http.IncomingMessage, res: http.ServerResponse): Promise<Request> {
            const request = new Request(req, res);
            const contentType = request.req.headers["content-type"];
            if (contentType === undefined)
                return request;

            const contentLengthHeader = request.req.headers["content-length"];
            if (contentLengthHeader === undefined)
                return request;
            const contentLength = Number.parseInt(contentLengthHeader, 10);
            if (Number.isFinite(contentLength) && contentLength > 0)
                return request;
            const data = Buffer.alloc(Number.parseInt(contentLengthHeader, 10));
            let offset = 0;
            for await (const chunk of request.req) {
                if (offset + chunk.length > data.length)
                    return request;
                data.set(chunk, offset);
                offset += chunk.length;
            }

            new EnhancedSwitch(contentType.toLowerCase().trim())
                .case("application/json", () => {
                    try {
                        request._body = JSON.parse(data.toString());
                    }
                    catch (e) {
                        const err: SyntaxError = e as SyntaxError;
                        request.end(new ErrorResponse(400, "The request body is not valid JSON: " + err.message, err));
                    }
                })
                .case("application/x-www-form-urlencoded", () => {
                    request._body = queryStringParse(data.toString());
                })
                .default(() => {
                    request._body = new RawContent(data);
                });

            return request;
        }

        private constructor(
            public readonly req: http.IncomingMessage,
            public readonly res: http.ServerResponse
        ) {
            this.url = new URL(`http://${process.env.HOST ?? "localhost"}${req.url ?? "/"}`);
        }

        public end(res: ApiResponse) {
            if (this._handled) return;
            res.send(this);
            this._handled = true;
        }

        public get method(): string {
            return this.req.method ?? "";
        }

        public get headers(): http.IncomingHttpHeaders {
            return this.req.headers;
        }

        /**
         * Get request params for limit & page. Limit is inclusive and page starts at 1.
         */
        public limit() {
            const limitParam = Number.parseInt(this.url.searchParams.get("limit") ?? "100", 10);
            const pageParam = Number.parseInt(this.url.searchParams.get("page") ?? "1", 10);
            const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : 100;
            const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
            return {limit, page};
        }
    }

    export class Resource {
        public delete(req: Request): ApiResponse {
            return new ErrorResponse(405, "The HTTP method `" + req.method + "` is not allowed for endpoint `" + req.url.pathname + "`.");
        }

        public put(req: Request): ApiResponse {
            return new ErrorResponse(405, "The HTTP method `" + req.method + "` is not allowed for endpoint `" + req.url.pathname + "`.");
        }

        public patch(req: Request): ApiResponse {
            return new ErrorResponse(405, "The HTTP method `" + req.method + "` is not allowed for endpoint `" + req.url.pathname + "`.");
        }
    }
}

export default Api;
