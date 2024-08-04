import crypto from "node:crypto";
import ApiResource from "../api/ApiResource.js";
import RandomID from "../RandomID.js";
import User from "./User.js";
import JsonResponse from "../response/JsonResponse.js";
import Repository_ from "../Repository.js";
import ResourceController from "../api/ResourceController.js";
import ThrowableResponse from "../response/ThrowableResponse.js";
import FieldErrorResponse from "../response/FieldErrorResponse.js";
import ErrorResponse from "../response/ErrorResponse.js";
import ApiRequest from "../api/ApiRequest.js";
import PageResponse from "../response/PageResponse.js";
import ApiResponse from "../response/ApiResponse.js";
import Authorisation from "../Authorisation.js";
import EmptyReponse from "../response/EmptyReponse.js";

class Token extends ApiResource {
    readonly #secret: Token.Secret;

    public constructor(
        public override readonly id: Token.ID,
        public readonly user: User.ID,
        secret: Token.Secret,
        /**
         * Date on which token expires, or `null` if it does not expire
         */
        public readonly expires: Date | null,
        public readonly scopes: Set<Token.Scope>,
        /**
         * User-provided note
         */
        public note: string
    ) {
        super();
        this.#secret = secret;
    }

    public get expired(): boolean {
        return this.expires !== null && this.expires < new Date();
    }

    public get secret(): Token.Secret {
        return this.#secret;
    }

    /**
     * JSON representation of the token. Does not include the secret key.
     */
    public override json(): JsonResponse.Object {
        return {
            id: this.id.id,
            user: this.user.id,
            expires: this.expires,
            scopes: Array.from(this.scopes.values()),
            note: this.note
        }
    }

    /**
     * JSON representation of the token, including the secret key.
     */
    public unsafeJson(): JsonResponse.Object {
        return {
            id: this.id.id,
            user: this.user.id,
            secret: this.secret.id,
            expires: this.expires,
            scopes: Array.from(this.scopes.values()),
            note: this.note
        }
    }

    public static row(row: Record<string, any>): Token {
        return new Token(
            new Token.ID(row.id),
            new User.ID(row.user),
            new Token.Secret(row.secret),
            row.expires === null ? null : new Date(row.expires),
            new Set(JSON.parse(row.scopes) as Token.Scope[]),
            row.note
        );
    }
}

namespace Token {
    export class ID extends RandomID {
        public static override random(): Token.ID {
            return new this(super.random().id);
        }
    }

    export class Secret extends RandomID {
        public static override random(): Token.Secret {
            return new this(this.generate(36));
        }

        private static characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        private static generate(length: number): string {
            const characters: string[] = [];
            for (let i = 0; i < length; ++i)
                characters.push(Secret.characters.charAt(crypto.randomInt(0, Secret.characters.length)));
            return characters.join("");
        }
    }

    /**
     * The token scopes specify which resources the token can read/write.
     */
    export enum Scope {
        /**
         * Read-only access to {@link Artist}, {@link Album} and {@link Track}.
         *
         * Recommended for: everyone
         */
        LIBRARY_READ = "library:read",

        /**
         * Write/modify access to {@link Artist}, {@link Album} and {@link Track}.
         * This allows the user to upload/delete audio files to/from the server.
         *
         * Recommended for: admin
         */
        LIBRARY_WRITE = "library:write",

        /**
         * Read-only access to your {@link Token}s
         *
         * Recommended for: everyone
         */
        TOKENS_READ_SELF = "tokens:read:self",

        /**
         * Write/modify access to your {@link Token}s
         *
         * Recommended for: everyone
         */
        TOKENS_WRITE_SELF = "tokens:write:self",

        /**
         * Read-only access to everyone's {@link Token}s
         *
         * Recommended for: admin
         */
        TOKENS_READ_ALL = "tokens:read:all",

        /**
         * Write/modify access to everyone's {@link Token}s
         *
         * Recommended for: admin
         */
        TOKENS_WRITE_ALL = "tokens:write:all",

        /**
         * Read-only access to {@link User}s
         *
         * Recommended for: admin
         */
        USERS_READ = "users:read",

        /**
         * Write/modify access to {@link User}s
         *
         * Recommended for: admin
         */
        USERS_WRITE = "users:write",

        /**
         * Read-only access to {@link Playlist}s (excluding private playlists of other users)
         *
         * Recommended for: everyone
         */
        PLAYLISTS_READ = "playlists:read",

        /**
         * Write/modify access to your own {@link Playlist}s
         *
         * Recommended for: everyone
         */
        PLAYLISTS_WRITE = "playlists:write",

        /**
         * Read-only access to everyone's {@link Playlist}s
         *
         * Recommended for: admin
         */
        PLAYLISTS_READ_ALL = "playlists:read:all",

        /**
         * Write/modify access to everyone's {@link Playlist}s
         *
         * Recommended for: admin
         */
        PLAYLISTS_WRITE_ALL = "playlists:write:all",

        /**
         * Grants full administrative access.
         * This scope acts as a wildcard, providing full access even if new API scopes are introduced in future updates.
         */
        ADMIN = "admin",
    }

    export class Repository extends Repository_<Token> {
        private readonly statements = {
            get: this.database.prepare<[string], Record<string, any>>("SELECT * FROM `tokens` WHERE `id` = ?"),
            getBySecret: this.database.prepare<[string], Record<string, any>>("SELECT * FROM `tokens` WHERE `secret` = ?"),
            save: this.database.prepare<[string, string, string, number | null, string, string]>("REPLACE INTO `tokens` (`id`, `user`, `secret`, `expires`, `scopes`, `note`) VALUES (?, ?, ?, ?, ?, ?)"),
            deleteAll: this.database.prepare<[], void>("DELETE FROM `tokens`"),
            list: this.database.prepare<[number, number], Record<string, any>>("SELECT * FROM `tokens` LIMIT ? OFFSET ?"),
            listOfUser: this.database.prepare<[string, number, number], Record<string, any>>("SELECT * FROM `tokens` WHERE `user` = ? LIMIT ? OFFSET ?"),
            count: this.database.prepare<[], { count: number }>("SELECT COUNT(*) as count FROM `tokens`"),
            delete: this.database.prepare<[string], void>("DELETE FROM `tokens` WHERE `id` = ?"),
            deleteOfUser: this.database.prepare<[string], void>("DELETE FROM `tokens` WHERE `user` = ?"),
        } as const;

        public override get(id: Token.ID) {
            const row = this.statements.get.get(id.id);
            if (row === undefined) return null;
            return Token.row(row);
        }

        public getBySecret(secret: Token.Secret) {
            const row = this.statements.getBySecret.get(secret.id);
            if (row === undefined) return null;
            return Token.row(row);
        }

        public override list(options: {limit: number, offset: number}) {
            const rows = this.statements.list.all(options.limit, options.offset);
            return {
                resources: rows.map(Token.row),
                total: this.statements.count.get()!.count
            };
        }

        public listOfUser(user: User.ID, options: {limit: number, offset: number}) {
            const rows = this.statements.listOfUser.all(user.id, options.limit, options.offset);
            return {
                resources: rows.map(Token.row),
                total: this.statements.count.get()!.count
            };
        }

        public override save(resource: Token) {
            this.statements.save.run(
                resource.id.id,
                resource.user.id,
                resource.secret.id,
                resource.expires === null ? null : resource.expires.getTime(),
                JSON.stringify(Array.from(resource.scopes.values())),
                resource.note
            );
        }

        public deleteAll() {
            this.statements.deleteAll.run();
        }

        public deleteOfUser(user: User.ID) {
            this.statements.deleteOfUser.run(user.id);
        }

        public override delete(id: Token.ID) {
            this.statements.delete.run(id.id);
        }
    }

    export class Controller extends ResourceController {
        protected override readonly path = ["tokens"];
        private readonly extract = {
            expires (body: any): Date | null {
                if (!("expires" in body)) throw new ThrowableResponse(new FieldErrorResponse({expires: "Please select a date."}));
                if (body.expires === null || body.expires === "null") return null;
                const t = Number(body.expires);
                if (!Number.isInteger(t)) throw new ThrowableResponse(new FieldErrorResponse({expires: "Must be a number representing UNIX time."}));
                if (t <= Date.now() / 1000) throw new ThrowableResponse(new FieldErrorResponse({expires: "Must be in the future."}));
                return new Date(t * 1000);
            },
            scopes(body: any): Set<Scope> {
                if (!("scopes" in body)) throw new ThrowableResponse(new FieldErrorResponse({scopes: "This field is required."}));
                if (!Array.isArray(body.scopes)) throw new ThrowableResponse(new FieldErrorResponse({scopes: "Must be an array."}));
                const set = new Set<Scope>();
                for (const scope of body.scopes) {
                    if (typeof scope !== "string") continue;
                    if (!Object.values(Token.Scope).includes(scope as Token.Scope)) throw new ThrowableResponse(new FieldErrorResponse({scopes: `Unknown scope ${scope}`}));
                    set.add(scope as Token.Scope);
                }
                return set;
            },
            note(body: any): string {
                if (!("note" in body)) throw new ThrowableResponse(new FieldErrorResponse({note: "Please enter a note."}));
                if (typeof body.note !== "string") throw new ThrowableResponse(new FieldErrorResponse({note: "Must be a string."}));
                if (body.note.length > 128) throw new ThrowableResponse(new FieldErrorResponse({note: "Must be 128 characters or less."}));
                return body.note;
            },
            user(body: any): User.ID | null {
                if (!("user" in body)) return null;
                if (typeof body.user !== "string") throw new ThrowableResponse(new FieldErrorResponse({user: "Must be a string."}));
                return new User.ID(body.user);
            },
            token(req: ApiRequest, repo: Token.Repository, id: string): Token {
                if (req.auth === null)
                    throw new ThrowableResponse(Authorisation.UNAUTHORISED);
                if (!req.auth.has(Token.Scope.TOKENS_READ_ALL) && !req.auth.has(Token.Scope.TOKENS_READ_SELF))
                    throw new ThrowableResponse(Authorisation.FORBIDDEN);

                const token = repo.get(new Token.ID(id));
                if (token === null || (!req.auth.has(Token.Scope.TOKENS_READ_ALL) && !token.user.equals(req.auth.user.id)))
                    throw new ThrowableResponse(Token.Controller.notFound());
                return token;
            }
        }

        /**
         * Validate that the authorisation context has access to all requested scopes, or else throw 403
         */
        private validateScopes(auth: Authorisation, scopes: Set<Token.Scope>) {
            for (const scope of scopes)
                if (!auth.has(scope)) throw new ThrowableResponse(new FieldErrorResponse({scopes: `You don't have permission to grant scope ${scope} in the current authorisation context.`}, {}, 403));
        }

        public static notFound() {
            return new ErrorResponse(404, "The requested token could not be found.");
        }

        protected override list(req: ApiRequest): ApiResponse {
            if (req.auth === null) return Authorisation.UNAUTHORISED;
            if (!req.auth.has(Token.Scope.TOKENS_READ_ALL) && !req.auth.has(Token.Scope.TOKENS_READ_SELF)) return Authorisation.FORBIDDEN;
            const limit = req.limit();
            const tokens = req.auth.has(Token.Scope.TOKENS_READ_ALL)
                ? (req.url.searchParams.has("user")
                    ? this.library.repositories.tokens.listOfUser(new User.ID(req.url.searchParams.get("user")!), limit)
                    : (req.url.searchParams.has("all")
                        ? this.library.repositories.tokens.list(limit)
                        : this.library.repositories.tokens.listOfUser(req.auth.user.id, limit)))
                : this.library.repositories.tokens.listOfUser(req.auth.user.id, limit);

            return new PageResponse(req, tokens.resources.map(t => t.json()), limit.page, limit.limit, tokens.total);
        }

        protected override create(req: ApiRequest): ApiResponse {
            if (req.auth === null) return Authorisation.UNAUTHORISED;

            const userId = req.auth.has(Token.Scope.TOKENS_WRITE_SELF)
                ? req.auth.user.id
                : (req.auth.has(Token.Scope.TOKENS_WRITE_ALL)
                    ? this.extract.user(req.body) ?? req.auth.user.id
                    : null);
            if (userId === null) return Authorisation.FORBIDDEN;

            const user = this.library.repositories.users.get(userId);
            if (user === null) return new FieldErrorResponse({user: "A user with the provided ID does not exist."}, {}, 404);

            this.validateBodyType(req.body);
            const expires = this.extract.expires(req.body);
            const scopes = this.extract.scopes(req.body);
            const note = this.extract.note(req.body);
            this.validateScopes(req.auth, scopes);
            const token = new Token(Token.ID.random(), user.id, Token.Secret.random(), expires, scopes, note);
            this.library.repositories.tokens.save(token);
            return new JsonResponse(token.unsafeJson(), 201);
        }

        protected override deleteAll(req: ApiRequest): ApiResponse {
            if (req.auth === null) return Authorisation.UNAUTHORISED;
            if (req.auth.has(Token.Scope.TOKENS_WRITE_ALL)) this.library.repositories.tokens.deleteAll();
            else if (req.auth.has(Token.Scope.TOKENS_WRITE_SELF)) this.library.repositories.tokens.deleteOfUser(req.auth.user.id);
            else return Authorisation.FORBIDDEN;
            return new EmptyReponse();
        }

        protected override get(req: ApiRequest, id: string): ApiResponse {
            const token = this.extract.token(req, this.library.repositories.tokens, id);
            return new JsonResponse(token.json());
        }

        protected override delete(req: ApiRequest, id: string): ApiResponse {
            const token = this.extract.token(req, this.library.repositories.tokens, id);
            this.library.repositories.tokens.delete(token.id);
            return new EmptyReponse();
        }

        protected override put(req: ApiRequest, id: string): ApiResponse {
            this.validateBodyType(req.body);
            const token = this.extract.token(req, this.library.repositories.tokens, id);
            token.note = this.extract.note(req.body);
            this.library.repositories.tokens.save(token);
            return new JsonResponse(token.json());
        }

        protected override patch(req: ApiRequest, id: string): ApiResponse {
            this.validateBodyType(req.body);
            const token = this.extract.token(req, this.library.repositories.tokens, id);
            if ("note" in req.body) token.note = this.extract.note(req.body);
            this.library.repositories.tokens.save(token);
            return new JsonResponse(token.json());
        }

        private validateBodyType(body: JsonResponse.Object | JsonResponse.Array | Buffer) {
            if (Buffer.isBuffer(body)) throw new ThrowableResponse(new ErrorResponse(415, "The request body has unsupported media type.", {
                Accept: "application/json, application/x-www-form-urlencoded"
            }));
            if (Array.isArray(body)) throw new ThrowableResponse(new ErrorResponse(422, "The request body is an array; expected an object."));
        }
    }
}

export default Token;
