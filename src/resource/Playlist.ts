import ApiResource from "../api/ApiResource.js";
import RandomID from "../RandomID.js";
import User from "./User.js";
import Track from "./Track.js";
import JsonResponse from "../response/JsonResponse.js";
import Repository_ from "../Repository.js";
import ResourceController from "../api/ResourceController.js";
import Token from "./Token.js";
import ApiRequest from "../api/ApiRequest.js";
import ApiResponse from "../response/ApiResponse.js";
import PageResponse from "../response/PageResponse.js";
import ErrorResponse from "../response/ErrorResponse.js";
import Authorisation from "../Authorisation.js";
import EmptyReponse from "../response/EmptyReponse.js";
import ThrowableResponse from "../response/ThrowableResponse.js";
import FieldErrorResponse from "../response/FieldErrorResponse.js";

class Playlist extends ApiResource {
    public constructor(
        public override readonly id: Playlist.ID,
        public name: string,
        public readonly user: User.ID,
        public visibility: Playlist.Visibility,
        public tracks: Track.ID[]
    ) {
        super();
    }

    public static row(row: Record<string, any>): Playlist {
        return new Playlist(
            new Playlist.ID(row.id),
            row.name,
            new User.ID(row.user),
            row.visibility,
            JSON.parse(row.tracks).map((t: string) => new Track.ID(t))
        );
    }

    public override json(): JsonResponse.Object {
        return {
            id: this.id.id,
            name: this.name,
            user: this.user.id,
            visibility: this.visibility,
            tracks: this.tracks.map(t => t.id)
        }
    }
}

namespace Playlist {
    export class ID extends RandomID {
        public static override random(): Playlist.ID {
            return new this(super.random().id);
        }
    }

    export enum Visibility {
        /**
         * The playlist is only visible to its owner.
         * The owner can see it in their list and access it using its ID.
         */
        PRIVATE = "private",

        /**
         * The playlist is visible to the owner in their list and can be accessed by anyone with the playlist ID.
         * It is not included in any public lists or searchable by other users.
         */
        UNLISTED = "unlisted",

        /**
         * The playlist is visible to everyone.
         * It is included in public lists and can be searched and accessed by all users.
         */
        PUBLIC = "public"
    }

    export class Repository extends Repository_<Playlist> {
        private readonly statements = {
            get: this.database.prepare<[string], Record<string, any>>("SELECT * FROM `playlists` WHERE `id` = ?"),
            list: this.database.prepare<[number, number], Record<string, any>>("SELECT * FROM `playlists` LIMIT ? OFFSET ?"),
            listByUser: this.database.prepare<[string, number, number], Record<string, any>>("SELECT * FROM `playlists` WHERE `user` = ? LIMIT ? OFFSET ?"),
            listPublicExceptUser: this.database.prepare<[string, number, number], Record<string, any>>("SELECT * FROM `playlists` WHERE `visibility` = 'public' AND `user` != ? LIMIT ? OFFSET ?"),
            count: this.database.prepare<[], { count: number }>("SELECT COUNT(*) as count FROM `playlists`"),
            save: this.database.prepare<[string, string, string, string, string], void>("REPLACE INTO `playlists` (`id`, `name`, `user`, `visibility`, `tracks`) VALUES (?, ?, ?, ?, ?)"),
            delete: this.database.prepare<[string], void>("DELETE FROM `playlists` WHERE `id` = ?"),
            deleteAll: this.database.prepare<[], void>("DELETE FROM `playlists`"),
            deleteOfUser: this.database.prepare<[string], void>("DELETE FROM `playlists` WHERE `user` = ?"),
        } as const;

        public override get(id: Playlist.ID) {
            const row = this.statements.get.get(id.id);
            if (row === undefined) return null;
            return Playlist.row(row);
        }

        public override list({limit, offset}: { limit: number, offset: number }) {
            const rows = this.statements.list.all(limit, offset);
            return {
                resources: rows.map(Playlist.row),
                total: this.statements.count.get()!.count
            };
        }

        public listByUser(user: User.ID, {limit, offset}: { limit: number, offset: number }) {
            const rows = this.statements.listByUser.all(user.id, limit, offset);
            return {
                resources: rows.map(Playlist.row),
                total: this.statements.count.get()!.count
            };
        }

        public listPublicExceptUser(user: User.ID, {limit, offset}: { limit: number, offset: number }) {
            const rows = this.statements.listPublicExceptUser.all(user.id, limit, offset);
            return {
                resources: rows.map(Playlist.row),
                total: this.statements.count.get()!.count
            };
        }

        public override save(resource: Playlist) {
            this.statements.save.run(
                resource.id.id,
                resource.name,
                resource.user.id,
                resource.visibility,
                JSON.stringify(resource.tracks.map(t => t.id))
            );
        }

        public override delete(id: Playlist.ID) {
            this.statements.delete.run(id.id);
        }

        public deleteAll() {
            this.statements.deleteAll.run();
        }

        public deleteOfUser(user: User.ID) {
            this.statements.deleteOfUser.run(user.id);
        }
    }

    export class Controller extends ResourceController {
        public override readonly path = ["playlists"];

        private static readonly notFound = new ErrorResponse(404, "The requested playlist could not be found.");

        private readonly extract = {
            name(body: any): string {
                if (!("name" in body)) throw new ThrowableResponse(new FieldErrorResponse({expires: "Please enter a name for this playlist."}));
                if (typeof body.name !== "string") throw new ThrowableResponse(new FieldErrorResponse({name: "Must be a string."}));
                if (body.name.length > 128) throw new ThrowableResponse(new FieldErrorResponse({note: "Must be 128 characters or less."}));
                return body.name;
            },
            user(auth: Authorisation, users: User.Repository, body: any): User.ID {
                if (!auth.has(Token.Scope.PLAYLISTS_WRITE_ALL) || !("user" in body)) return auth.user.id;
                if (typeof body.user !== "string") throw new ThrowableResponse(new FieldErrorResponse({user: "Must be a string."}));
                const user = users.get(new User.ID(body.user));
                if (user === null) throw new ThrowableResponse(new FieldErrorResponse({user: "A user with the provided ID does not exist."}, {}, 404));
                return user.id;
            },
            visibility(body: any): Playlist.Visibility {
                if (!("visibility" in body)) throw new ThrowableResponse(new FieldErrorResponse({expires: "Please select playlist visibility."}));
                if (typeof body.visibility !== "string") throw new ThrowableResponse(new FieldErrorResponse({visibility: "Must be a string."}));
                if (!Object.values(Playlist.Visibility).includes(body.visibility as Playlist.Visibility)) throw new ThrowableResponse(new FieldErrorResponse({visibility: "Invalid visibility setting."}));
                return body.visibility as Playlist.Visibility;
            },
            tracks(tracks: Track.Repository, body: any): Track.ID[] {
                if (!("tracks" in body)) throw new ThrowableResponse(new FieldErrorResponse({tracks: "Please select the tracks for this playlist."}));
                if (!Array.isArray(body.tracks)) throw new ThrowableResponse(new FieldErrorResponse({tracks: "Must be an array."}));
                const ids: Track.ID[] = [];
                for (const track of body.tracks) {
                    if (typeof track !== "string") continue;
                    const id = new Track.ID(track);
                    if (tracks.get(id) === null) throw new ThrowableResponse(new FieldErrorResponse({tracks: `Track ${id} does not exist.`}, {}, 404));
                    ids.push(id);
                }
                if (ids.length === 0) throw new ThrowableResponse(new FieldErrorResponse({tracks: "The playlist must have at least one track."}));
                return ids;
            }
        } as const;

        public override list(req: ApiRequest): ApiResponse {
            req.require(Token.Scope.PLAYLISTS_READ);
            const limit = req.limit();
            let playlists: {resources: Playlist[], total: number};
            if (req.url.searchParams.has("all") && !req.auth!.has(Token.Scope.PLAYLISTS_READ_ALL))
                playlists = this.library.repositories.playlists.list(limit);
            else if (req.url.searchParams.has("public"))
                playlists = this.library.repositories.playlists.listPublicExceptUser(req.auth!.user.id, limit);
            else
                playlists = this.library.repositories.playlists.listByUser(req.auth!.user.id, limit);
            return new PageResponse(req, playlists.resources.map(p => p.json()), limit.page, limit.limit, playlists.total);
        }

        public override create(req: ApiRequest): ApiResponse | Promise<ApiResponse> {
            req.require(Token.Scope.PLAYLISTS_WRITE);
            this.validateBodyType(req.body);
            const name = this.extract.name(req.body);
            const user = this.extract.user(req.auth!, this.library.repositories.users, req.body);
            const visibility = this.extract.visibility(req.body);
            const tracks = this.extract.tracks(this.library.repositories.tracks, req.body);

            const playlist = new Playlist(Playlist.ID.random(), name, user, visibility, tracks);
            this.library.repositories.playlists.save(playlist);
            return new JsonResponse(playlist.json(), 201);
        }

        public override deleteAll(req: ApiRequest): ApiResponse {
            if (req.auth === null) return Authorisation.UNAUTHORISED;
            if (req.auth.has(Token.Scope.PLAYLISTS_WRITE_ALL))
                this.library.repositories.playlists.deleteAll();
            else if (req.auth.has(Token.Scope.PLAYLISTS_WRITE))
                this.library.repositories.playlists.deleteOfUser(req.auth.user.id);
            else return Authorisation.FORBIDDEN;
            return new EmptyReponse();
        }

        protected override get(req: ApiRequest, id: string): ApiResponse {
            req.require(Token.Scope.PLAYLISTS_READ);
            const playlist = this.library.repositories.playlists.get(new Playlist.ID(id));
            if (playlist === null || (playlist.visibility === Playlist.Visibility.PRIVATE && !req.auth!.has(Token.Scope.PLAYLISTS_READ_ALL) && !playlist.user.equals(req.auth!.user.id))) return Playlist.Controller.notFound;
            return new JsonResponse(playlist.json());
        }

        protected override delete(req: ApiRequest, id: string): ApiResponse {
            req.require(Token.Scope.PLAYLISTS_WRITE);
            const playlist = this.library.repositories.playlists.get(new Playlist.ID(id));
            if (playlist === null || (!req.auth!.has(Token.Scope.PLAYLISTS_WRITE_ALL) && !playlist.user.equals(req.auth!.user.id))) return Playlist.Controller.notFound;
            this.library.repositories.playlists.delete(playlist.id);
            return new EmptyReponse();
        }

        protected override put(req: ApiRequest, id: string): ApiResponse {
            req.require(Token.Scope.PLAYLISTS_WRITE);
            this.validateBodyType(req.body);
            const playlist = this.library.repositories.playlists.get(new Playlist.ID(id));
            if (playlist === null || (!req.auth!.has(Token.Scope.PLAYLISTS_WRITE_ALL) && !playlist.user.equals(req.auth!.user.id))) return Playlist.Controller.notFound;
            const name = this.extract.name(req.body);
            const visibility = this.extract.visibility(req.body);
            const tracks = this.extract.tracks(this.library.repositories.tracks, req.body);
            playlist.name = name;
            playlist.visibility = visibility;
            playlist.tracks = tracks;
            this.library.repositories.playlists.save(playlist);
            return new JsonResponse(playlist.json());
        }

        protected override patch(req: ApiRequest, id: string): ApiResponse {
            req.require(Token.Scope.PLAYLISTS_WRITE);
            this.validateBodyType(req.body);
            const playlist = this.library.repositories.playlists.get(new Playlist.ID(id));
            if (playlist === null || (!req.auth!.has(Token.Scope.PLAYLISTS_WRITE_ALL) && !playlist.user.equals(req.auth!.user.id))) return Playlist.Controller.notFound;
            if ("name" in req.body) playlist.name = this.extract.name(req.body);
            if ("visibility" in req.body) playlist.visibility = this.extract.visibility(req.body);
            if ("tracks" in req.body) playlist.tracks = this.extract.tracks(this.library.repositories.tracks, req.body);
            this.library.repositories.playlists.save(playlist);
            return new JsonResponse(playlist.json());
        }

        private validateBodyType(body: JsonResponse.Object | JsonResponse.Array | Buffer) {
            if (Buffer.isBuffer(body)) throw new ThrowableResponse(new ErrorResponse(415, "The request body has unsupported media type.", {
                Accept: "application/json, application/x-www-form-urlencoded"
            }));
            if (Array.isArray(body)) throw new ThrowableResponse(new ErrorResponse(422, "The request body is an array; expected an object."));
        }
    }
}

export default Playlist;
