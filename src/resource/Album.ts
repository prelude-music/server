import ID_ from "../ID.js";
import Artist from "./Artist.js";
import JsonResponse from "../response/JsonResponse.js";
import Repository_ from "../Repository.js";
import ApiResource from "../api/ApiResource.js";

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
    export class ID extends ID_ {
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
}

export default Album;
