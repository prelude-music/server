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
            return new Artist(id, row.name, row.image ?? null);
        }

        public override list({limit, offset}: { limit: number, offset: number }) {
            return {
                resources: this.statements.list.all(limit, offset).map(row => new Artist(new Artist.ID(row.id), row.name, row.image)),
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
        public override readonly path = "/artists";

        public override list(req: ApiRequest): ApiResponse {
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
}

export default Artist;
