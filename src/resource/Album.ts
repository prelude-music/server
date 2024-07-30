import HashID from "../HashID.js";
import Artist from "./Artist.js";
import JsonResponse from "../response/JsonResponse.js";
import Repository_ from "../Repository.js";
import ApiResource from "../api/ApiResource.js";
import ResourceController from "../api/ResourceController.js";
import Controller_ from "../api/Controller.js";
import ApiRequest from "../api/ApiRequest.js";
import ApiResponse from "../response/ApiResponse.js";
import PageResponse from "../response/PageResponse.js";
import ErrorResponse from "../response/ErrorResponse.js";
import Library from "../Library.js";
import BufferResponse from "../response/BufferResponse.js";
import Token from "./Token.js";

class Album extends ApiResource {
    public constructor(
        public override readonly id: Album.ID,
        public readonly title: string,
        public readonly artist: Artist.ID
    ) {
        super();
    }

    public override json(): JsonResponse.Object {
        return {
            id: this.id.id,
            title: this.title,
            artist: this.artist.id,
        }
    }
}

namespace Album {
    export class ID extends HashID {
        public constructor(id: string) {
            super(id);
        }

        public static override of(name: string, artist: Artist.ID): ID {
            return super.of(name, artist.id);
        }
    }

    export class Repository extends Repository_<Album> {
        private readonly statements = {
            get: this.database.prepare<[string], Record<string, any>>("SELECT * FROM `albums` WHERE `id` = ?"),
            list: this.database.prepare<[number, number], Record<string, any>>("SELECT * FROM `albums` LIMIT ? OFFSET ?"),
            count: this.database.prepare<[], { count: number }>("SELECT COUNT(*) as count FROM `albums`"),
            save: this.database.prepare<[string, string, string], void>("REPLACE INTO `albums` (`id`, `title`, `artist`) VALUES (?, ?, ?)"),
            delete: this.database.prepare<[string], void>("DELETE FROM `albums` WHERE `id` = ?"),
            artist: this.database.prepare<[string, number, number], Record<string, any>>("SELECT * FROM `albums` WHERE `artist` = ? ORDER BY `title` LIMIT ? OFFSET ?"),
            countArtist: this.database.prepare<[string], { count: number }>("SELECT COUNT(*) as count FROM `albums` WHERE `artist` = ?"),
        } as const;

        public override get(id: Album.ID) {
            const row = this.statements.get.get(id.id);
            if (row === undefined) return null;
            return new Album(id, row.title, new Artist.ID(row.artist));
        }

        public override list({limit, offset}: { limit: number, offset: number }) {
            return {
                resources: this.statements.list.all(limit, offset).map(row => new Album(new Album.ID(row.id), row.title, new Artist.ID(row.artist))),
                total: this.statements.count.get()!.count
            };
        }

        public override save(resource: Album) {
            this.statements.save.run(resource.id.id, resource.title, resource.artist.id);
        }

        public override delete(id: Album.ID) {
            this.statements.delete.run(id.id);
        }

        /**
         * Get albums by artist
         * @param artist Artist ID
         * @param limitOffset Limit and offset
         */
        public artist(artist: Artist.ID, {limit, offset}: { limit: number, offset: number }) {
            return {
                resources: this.statements.artist.all(artist.id, limit, offset).map(row => new Album(new Album.ID(row.id), row.title, new Artist.ID(row.artist))),
                total: this.statements.countArtist.get(artist.id)!.count
            };
        }
    }

    export class Controller extends ResourceController {
        protected override readonly path = ["albums"];
        protected override subControllers = [
            new TracksController(this.library),
            new ImageController(this.library),
        ]

        protected override list(req: ApiRequest): ApiResponse {
            req.require(Token.Scope.LIBRARY_READ);
            const limit = req.limit();
            const albums = this.library.repositories.albums.list(limit);
            return new PageResponse(req, albums.resources.map(a => a.json()), limit.page, limit.limit, albums.total);
        }

        protected override get(req: ApiRequest, id: string): ApiResponse {
            req.require(Token.Scope.LIBRARY_READ);
            const album = this.library.repositories.albums.get(new Album.ID(id));
            if (album === null) return Album.Controller.notFound();
            return new JsonResponse(album.json());
        }

        public static notFound() {
            return new ErrorResponse(404, "The requested album could not be found.");
        }
    }

    class TracksController extends ResourceController {
        protected override readonly path = ["albums", null, "tracks"];
        protected override readonly pathStartIndex = 2;

        protected override list(req: ApiRequest, urlParts: string[]): ApiResponse {
            req.require(Token.Scope.LIBRARY_READ);
            const album = this.library.repositories.albums.get(new Album.ID(urlParts[1]!));
            if (album === null) return Album.Controller.notFound();
            const limit = req.limit();
            const tracks = this.library.repositories.tracks.album(album.id, limit);
            return new PageResponse(req, tracks.resources.map(t => t.json()), limit.page, limit.limit, tracks.total);
        }
    }

    class ImageController extends Controller_ {
        public constructor(protected readonly library: Library) {
            super();
        }

        public override match(_req: ApiRequest, urlParts: string[]): boolean {
            return urlParts.length === 3 && urlParts[2] === "image";
        }

        public override async handle(req: ApiRequest, urlParts: string[]): Promise<ApiResponse> {
            if (!["GET", "HEAD"].includes(req.method)) return Controller_.methodNotAllowed(req);
            req.require(Token.Scope.LIBRARY_READ);
            const album = this.library.repositories.albums.get(new Album.ID(urlParts[1]!));
            if (album === null) return Album.Controller.notFound();
            const tracks = this.library.repositories.tracks.album(album.id, {limit: 5, offset: 0});
            for (const track of tracks.resources) {
                if (!await track.file.isReadable()) {
                    this.library.removeTrack(track);
                    continue;
                }
                const image = await track.cover();
                if (image !== null)
                    return new BufferResponse(image.data, image.type);
            }
            return ImageController.notFound(album);
        }

        public static notFound(album: Album) {
            return new ErrorResponse(404, `Album "${album.id}" (${album.title}) does not have an associated cover image.`);
        }
    }
}

export default Album;
