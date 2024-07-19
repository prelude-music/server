import ID_ from "../ID.js";
import JsonResponse from "../response/JsonResponse.js";
import Repository_ from "../Repository.js";
import ApiResource from "../api/ApiResource.js";
import ResourceController from "../api/ResourceController.js";
import ApiRequest from "../api/ApiRequest.js";
import ApiResponse from "../response/ApiResponse.js";
import PageResponse from "../response/PageResponse.js";
import ErrorResponse from "../response/ErrorResponse.js";

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
    export class ID extends ID_ {
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
                const artist = this.get(iterator.next().value)!;
                if (artist !== null) artists.push(artist);
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
        public override readonly path = ["artists"];
        public override subControllers = [
            new TracksController(this.library)
        ];

        public override list(req: ApiRequest): ApiResponse {
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

        public override get(_req: ApiRequest, id: string): ApiResponse {
            const artist = this.library.repositories.artists.get(new Artist.ID(id));
            if (artist === null) return Artist.Controller.notFound();
            return new JsonResponse(artist.json());
        }

        public static notFound() {
            return new ErrorResponse(404, "The requested artist could not be found.");
        }
    }

    class TracksController extends ResourceController {
        public override readonly path = ["artists", null, "tracks"];
        public override readonly pathStartIndex = 2;
        public override list(req: ApiRequest, urlParts: string[]): ApiResponse {
            const artist = this.library.repositories.artists.get(new Artist.ID(urlParts[1]!));
            if (artist === null) return Artist.Controller.notFound();
            const limit = req.limit();
            const tracks = this.library.repositories.tracks.artist(artist.id, limit);
            return new PageResponse(req, tracks.resources.map(t => t.json()), limit.page, limit.limit, tracks.total);
        }
    }
}

export default Artist;
