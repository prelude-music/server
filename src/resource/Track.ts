import {parseFile as getMetadataFromFile} from "music-metadata";
import ID_ from "../ID.js";
import File from "../File.js";
import Artist from "./Artist.js";
import Album from "./Album.js";
import JsonResponse from "../response/JsonResponse.js";
import Repository_ from "../Repository.js";
import {Statement} from "better-sqlite3";
import ApiResource from "../api/ApiResource.js";
import ResourceController from "../api/ResourceController.js";
import Controller_ from "../api/Controller.js";
import ApiRequest from "../api/ApiRequest.js";
import ApiResponse from "../response/ApiResponse.js";
import PageResponse from "../response/PageResponse.js";
import ErrorResponse from "../response/ErrorResponse.js";
import FileResponse from "../response/FileResponse.js";
import Library from "../Library.js";
import BufferResponse from "../response/BufferResponse.js";

class Track extends ApiResource {
    public constructor(
        public override readonly id: Track.ID,
        public readonly title: string,
        public readonly artist: Artist.ID,
        public readonly album: Album.ID | null,
        public readonly file: File,
        public year: number | null,
        public genres: string[],
        public track: { no: number, of: number | null } | null,
        public disk: { no: number, of: number | null } | null,
        public readonly duration: number,
        public meta: Track.Meta
    ) {
        super();
    }

    public override json(): JsonResponse.Object {
        return {
            id: this.id.id,
            title: this.title,
            artist: this.artist.id,
            album: this.album?.id ?? null,
            year: this.year,
            genres: this.genres,
            track: this.track,
            disk: this.disk,
            duration: this.duration,
            meta: {
                channels: this.meta.channels,
                sampleRate: this.meta.sampleRate,
                bitrate: this.meta.bitrate,
                lossless: this.meta.lossless
            }
        }
    }

    public async cover(): Promise<{ type: string, data: Buffer } | null> {
        const meta = await getMetadataFromFile(this.file.path);
        if (meta.common.picture === undefined || meta.common.picture!.length === 0) return null;
        const pic = meta.common.picture!.length === 1 ? meta.common.picture![0] : meta.common.picture!.find(p => ["cover", "front", "album"].some(t => p.type?.toLowerCase().includes(t)));
        if (pic === undefined) return null;
        return {
            type: pic.format,
            data: pic.data
        };
    }

    public static row(row: Record<string, any>): Track {
        return new Track(
            new Track.ID(row.id),
            row.title,
            new Artist.ID(row.artist),
            row.album === null ? null : new Album.ID(row.album),
            new File(row.file),
            row.year,
            JSON.parse(row.genres),
            row.track_no === null ? null : {no: row.track_no, of: row.track_of},
            row.disk_no === null ? null : {no: row.disk_no, of: row.disk_of},
            row.duration,
            JSON.parse(row.meta)
        );
    }
}

namespace Track {
    export class ID extends ID_ {
        public static override of(title: string, artist: Artist.ID, album?: Album.ID | null): ID {
            return super.of(title, artist.id, album?.id);
        }
    }

    export interface Meta {
        /**
         * The number of audio channels
         */
        readonly channels: number;

        /**
         * Sample rate in Hz
         */
        readonly sampleRate: number;

        /**
         * Bitrate in bits per second
         */
        readonly bitrate: number;

        /**
         * Whether the audio format is lossless.
         */
        readonly lossless: boolean;
    }

    export class Repository extends Repository_<Track> {
        private readonly statements = {
            get: this.database.prepare<[string], Record<string, any>>("SELECT * FROM `tracks` WHERE `id` = ?"),
            getFromFile: this.database.prepare<[string], Record<string, any>>("SELECT * FROM `tracks` WHERE `file` = ?"),
            list: this.database.prepare<[number, number], Record<string, any>>("SELECT * FROM `tracks` LIMIT ? OFFSET ?"),
            listSorted: (() => {
                const fields = ["title", "year", "track_no", "disk_no", "duration"] as const;
                const stmts: Record<keyof typeof fields, {asc: Statement<[number, number], Record<string, any>>, desc: Statement<[number, number], any>}> = {} as any;
                for (const field of fields) {
                    stmts[field as any] = {
                        asc: this.database.prepare<[number, number], Record<string, any>>(`SELECT * FROM \`tracks\` ORDER BY \`${field}\` LIMIT ? OFFSET ?`),
                        desc: this.database.prepare<[number, number], Record<string, any>>(`SELECT * FROM \`tracks\` ORDER BY \`${field}\` DESC LIMIT ? OFFSET ?`),
                    };
                }
                return stmts;
            })(),
            count: this.database.prepare<[], { count: number }>("SELECT COUNT(*) as count FROM `tracks`"),
            save: this.database.prepare<[string, string, string, string | null, string, number | null, string, number | null, number | null, number | null, number | null, number, string], any>("REPLACE INTO `tracks` (`id`, `title`, `artist`, `album`, `file`, `year`, `genres`, `track_no`, `track_of`, `disk_no`, `disk_of`, `duration`, `meta`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
            delete: this.database.prepare<[string], void>("DELETE FROM `tracks` WHERE `id` = ?"),
            artist: this.database.prepare<[string, number, number], Record<string, any>>("SELECT * FROM `tracks` WHERE `artist` = ? ORDER BY `year` DESC LIMIT ? OFFSET ?"),
            countArtist: this.database.prepare<[string], { count: number }>("SELECT COUNT(*) as count FROM `tracks` WHERE `artist` = ?"),
            album: this.database.prepare<[string, number, number], Record<string, any>>("SELECT * FROM `tracks` WHERE `album` = ? ORDER BY `track_no` DESC LIMIT ? OFFSET ?"),
            countAlbum: this.database.prepare<[string], { count: number }>("SELECT COUNT(*) as count FROM `tracks` WHERE `album` = ?"),
        } as const;

        public override get(id: Track.ID) {
            const row = this.statements.get.get(id.id);
            if (row === undefined) return null;
            return Track.row(row);
        }

        public getFromFile(file: File) {
            const row = this.statements.getFromFile.get(file.path);
            if (row === undefined) return null;
            return Track.row(row);
        }

        public override list({limit, offset, sort}: { limit: number, offset: number, sort?: string | null }) {
            sort: if (sort !== undefined && sort !== null) {
                const parts = sort.split(":");
                const col = parts[0];
                if (col === undefined || !(col in this.statements.listSorted))
                    break sort;
                const dir = parts[1] === "desc" ? "desc" : "asc";
                return {
                    resources: this.statements.listSorted[col as any]![dir]!.all(limit, offset).map(Track.row),
                    total: this.statements.count.get()!.count
                };
            }
            return {
                resources: this.statements.list.all(limit, offset).map(Track.row),
                total: this.statements.count.get()!.count
            };
        }

        public override save(resource: Track): void {
            this.statements.save.run(
                resource.id.id,
                resource.title,
                resource.artist.id,
                resource.album?.id ?? null,
                resource.file.path,
                resource.year,
                JSON.stringify(resource.genres),
                resource.track?.no ?? null,
                resource.track?.of ?? null,
                resource.disk?.no ?? null,
                resource.disk?.of ?? null,
                resource.duration,
                JSON.stringify(resource.meta)
            );
        }

        public override delete(id: Track.ID): void {
            this.statements.delete.run(id.id);
        }

        /**
         * Get tracks by artist. Tracks are sorted descending by year.
         * @param artist Artist ID
         * @param limitOffset Limit and offset
         */
        public artist(artist: Artist.ID, {limit, offset}: { limit: number, offset: number }): { resources: Track[], total: number } {
            return {
                resources: this.statements.artist.all(artist.id, limit, offset).map(Track.row),
                total: this.statements.countArtist.get(artist.id)!.count
            };
        }

        /**
         * Get tracks by album. Tracks are sorted descending by track number.
         * @param album Album ID
         * @param limitOffset Limit and offset
         */
        public album(album: Album.ID, {limit, offset}: { limit: number, offset: number }): { resources: Track[], total: number } {
            return {
                resources: this.statements.album.all(album.id, limit, offset).map(Track.row),
                total: this.statements.countAlbum.get(album.id)!.count
            };
        }
    }

    export class Controller extends ResourceController {
        protected override readonly path = ["tracks"];
        protected override readonly subControllers = [
            new AudioController(this.library),
            new ImageController(this.library),
        ];

        protected override list(req: ApiRequest): ApiResponse {
            const sort = req.url.searchParams.get("sort");
            const limit = req.limit();
            const tracks = this.library.repositories.tracks.list({limit: limit.limit, offset: limit.offset, sort});
            return new PageResponse(req, tracks.resources.map(t => t.json()), limit.page, limit.limit, tracks.total);
        }

        protected override get(_req: ApiRequest, id: string): ApiResponse {
            const track = this.library.repositories.tracks.get(new Track.ID(id));
            if (track === null) return Track.Controller.notFound();
            return new JsonResponse(track.json());
        }

        public static notFound() {
            return new ErrorResponse(404, "The requested track could not be found.");
        }
    }

    class AudioController extends Controller_ {
        public constructor(protected readonly library: Library) {
            super();
        }

        public override match(_req: ApiRequest, urlParts: string[]): boolean {
            return urlParts.length === 3 && urlParts[2] === "audio";
        }

        public override async handle(req: ApiRequest, urlParts: string[]): Promise<ApiResponse> {
            if (req.method !== "GET") return Controller_.methodNotAllowed(req);
            const track = this.library.repositories.tracks.get(new Track.ID(urlParts[1]!));
            if (track === null) return Track.Controller.notFound();
            if (!await track.file.isReadable()) {
                this.library.removeTrack(track);
                return Track.Controller.notFound();
            }
            return new FileResponse(track.file);
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
            if (req.method !== "GET") return Controller_.methodNotAllowed(req);
            const track = this.library.repositories.tracks.get(new Track.ID(urlParts[1]!));
            if (track === null) return Track.Controller.notFound();
            if (!await track.file.isReadable()) {
                this.library.removeTrack(track);
                return Track.Controller.notFound();
            }
            const image = await track.cover();
            if (image === null) return ImageController.notFound(track);
            return new BufferResponse(image.data, image.type);
        }

        public static notFound(track: Track) {
            return new ErrorResponse(404, `Track "${track.id}" (${track.title}) does not have an associated cover image.`);
        }
    }
}

export default Track;
