import HashID from "../HashID.js";
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
import ProxyResponse from "../response/ProxyResponse.js";
import Token from "./Token.js";

class Artist extends ApiResource {
    public constructor(
        public override readonly id: Artist.ID,
        public readonly name: string,
        public externalImage: string | null
    ) {
        super();
    }

    public override json(): JsonResponse.Object {
        return {
            id: this.id.id,
            name: this.name,
            image: this.externalImage,
        }
    }
}

namespace Artist {
    export class ID extends HashID {
        public constructor(id: string) {
            super(id);
        }
        
        public static override of(name: string): ID {
            return super.of(name);
        }
    }

    export class Repository extends Repository_<Artist> {
        private readonly statements = {
            get: this.database.prepare<[string], Record<string, any>>("SELECT * FROM `artists` WHERE `id` = ?"),
            list: this.database.prepare<[number, number], Record<string, any>>("SELECT * FROM `artists` LIMIT ? OFFSET ?"),
            count: this.database.prepare<[], { count: number }>("SELECT COUNT(*) as count FROM `artists`"),
            save: this.database.prepare<[string, string, string | null], void>("REPLACE INTO `artists` (`id`, `name`, `external_image`) VALUES (?, ?, ?)"),
            delete: this.database.prepare<[string], void>("DELETE FROM `artists` WHERE `id` = ?"),
        } as const;

        public override get(id: Artist.ID) {
            const row = this.statements.get.get(id.id);
            if (row === undefined) return null;
            return new Artist(id, row.name, row.external_image);
        }

        /**
         * Get multiple artists by ID
         * @param ids Array of artist IDs. Max 100.
         */
        public getMultiple(ids: Set<Artist.ID>): Artist[] {
            const artists: Artist[] = [];
            const iterations = Math.min(ids.size, 100);
            const iterator = ids.values();
            for (let i = 0; i < iterations; ++i) {
                const id = iterator.next().value;
                if (id === undefined) continue;
                const artist = this.get(id)!;
                if (artist === null) continue;
                artists.push(artist);
            }
            return artists;
        }

        public override list({limit, offset}: { limit: number, offset: number }) {
            return {
                resources: this.statements.list.all(limit, offset).map(row => new Artist(new Artist.ID(row.id), row.name, row.external_image)),
                total: this.statements.count.get()!.count
            };
        }

        public override save(resource: Artist) {
            this.statements.save.run(resource.id.id, resource.name, resource.externalImage);
        }

        public override delete(id: Artist.ID) {
            this.statements.delete.run(id.id);
        }
    }

    export class Controller extends ResourceController {
        protected override readonly path = ["artists"];
        protected override subControllers = [
            new AlbumsController(this.library),
            new TracksController(this.library),
            new ImageController(this.library),
        ];

        protected override list(req: ApiRequest): ApiResponse {
            req.require(Token.Scope.LIBRARY_READ);
            const ids = req.url.searchParams.getAll("id");
            if (ids.length > 0) {
                const idSet = new Set<Artist.ID>(ids.map(id => new Artist.ID(id)));
                if (idSet.size > 100) return new ErrorResponse(400, `You can only query up to 100 artists at a time. (got ${idSet.size})`);
                const artists = this.library.repositories.artists.getMultiple(idSet);
                return new PageResponse(req, artists.map(a => a.json()), 1, idSet.size, artists.length);
            }
            const limit = req.limit();
            const artists = this.library.repositories.artists.list(limit);
            return new PageResponse(req, artists.resources.map(a => a.json()), limit.page, limit.limit, artists.total);
        }

        protected override get(req: ApiRequest, id: string): ApiResponse {
            req.require(Token.Scope.LIBRARY_READ);
            const artist = this.library.repositories.artists.get(new Artist.ID(id));
            if (artist === null) return Artist.Controller.notFound();
            return new JsonResponse(artist.json());
        }

        public static notFound() {
            return new ErrorResponse(404, "The requested artist could not be found.");
        }
    }

    class AlbumsController extends ResourceController {
        protected override readonly path = ["artists", null, "albums"];
        protected override readonly pathStartIndex = 2;
        protected override list(req: ApiRequest, urlParts: string[]): ApiResponse {
            req.require(Token.Scope.LIBRARY_READ);
            const artist = this.library.repositories.artists.get(new Artist.ID(urlParts[1]!));
            if (artist === null) return Artist.Controller.notFound();
            const limit = req.limit();
            const albums = this.library.repositories.albums.artist(artist.id, limit);
            return new PageResponse(req, albums.resources.map(a => a.json()), limit.page, limit.limit, albums.total);
        }
    }

    class TracksController extends ResourceController {
        protected override readonly path = ["artists", null, "tracks"];
        protected override readonly pathStartIndex = 2;
        protected override list(req: ApiRequest, urlParts: string[]): ApiResponse {
            req.require(Token.Scope.LIBRARY_READ);
            const artist = this.library.repositories.artists.get(new Artist.ID(urlParts[1]!));
            if (artist === null) return Artist.Controller.notFound();
            const limit = req.limit();
            const tracks = this.library.repositories.tracks.artist(artist.id, limit);
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
            const artist = this.library.repositories.artists.get(new Artist.ID(urlParts[1]!));
            if (artist === null) return Artist.Controller.notFound();
            if (artist.externalImage === null) return ImageController.notFound(artist);
            const init: RequestInit = {
                method: "GET"
            };
            if (req.headers.range) init.headers = {Range: req.headers.range};
            return new ProxyResponse(artist.externalImage, init, false, 200, /^image\/.+$/);
        }

        public static notFound(artist: Artist) {
            return new ErrorResponse(404, `Artist "${artist.id}" (${artist.name}) does not have an associated image.`);
        }
    }
}

export default Artist;
