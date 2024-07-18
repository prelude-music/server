import http from "node:http";
import EnhancedSwitch from "enhanced-switch";
import ApiResponse from "../response/ApiResponse.js";
import ErrorResponse from "../response/ErrorResponse.js";
import JsonResponse from "../response/JsonResponse.js";
import Library from "../Library.js";
import FileResponse from "../response/FileResponse.js";
import BufferResponse from "../response/BufferResponse.js";

export default class Api {
    public constructor(
        private readonly library: Library,
        private readonly packageJson: JsonResponse.Object
    ) {
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
                    const track = this.library.getTrack(parts[1]!);
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
