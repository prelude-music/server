import ID_ from "../ID.js";
import JsonResponse from "../response/JsonResponse.js";
import Repository_ from "../Repository.js";
import ApiResource from "../api/ApiResource.js";

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
}

export default Artist;
