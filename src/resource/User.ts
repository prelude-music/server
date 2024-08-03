import ApiResource from "../api/ApiResource.js";
import JsonResponse from "../response/JsonResponse.js";
import RandomID from "../RandomID.js";
import Token from "./Token.js";
import Password from "../Password.js";
import Repository_ from "../Repository.js";
import ResourceController from "../api/ResourceController.js";
import ApiRequest from "../api/ApiRequest.js";
import ApiResponse from "../response/ApiResponse.js";
import PageResponse from "../response/PageResponse.js";
import ErrorResponse from "../response/ErrorResponse.js";
import EmptyReponse from "../response/EmptyReponse.js";
import ThrowableResponse from "../response/ThrowableResponse.js";
import FieldErrorResponse from "../response/FieldErrorResponse.js";

class User extends ApiResource {
    public constructor(
        public override readonly id: User.ID,
        public username: string,
        public scopes: Set<Token.Scope>,
        public password: Password,
        public disabled: boolean
    ) {
        super();
    }

    public static row(row: Record<string, any>): User {
        return new User(
            new User.ID(row.id),
            row.username,
            new Set(JSON.parse(row.scopes)),
            new Password(row.password),
            row.disabled === 1
        );
    }

    public override json(): JsonResponse.Object {
        return {
            id: this.id.id,
            username: this.username,
            scopes: Array.from(this.scopes.values()),
            disabled: this.disabled
        }
    }
}

namespace User {
    export class ID extends RandomID {
        public static override random(): User.ID {
            return new this(super.random().id);
        }
    }

    export class Repository extends Repository_<User> {
        private readonly statements = {
            get: this.database.prepare<[string], Record<string, any>>("SELECT * FROM `users` WHERE `id` = ?"),
            getByUsername: this.database.prepare<[string], Record<string, any>>("SELECT * FROM `users` WHERE `username` = ?"),
            save: this.database.prepare<[string, string, string, string, 1 | 0], void>("REPLACE INTO `users` (`id`, `username`, `scopes`, `password`, `disabled`) VALUES (?, ?, ?, ?, ?)"),
            deleteAll: this.database.prepare<[], void>("DELETE FROM `users`"),
            list: this.database.prepare<[number, number], Record<string, any>>("SELECT * FROM `users` LIMIT ? OFFSET ?"),
            count: this.database.prepare<[], { count: number }>("SELECT COUNT(*) as count FROM `users`"),
            delete: this.database.prepare<[string], void>("DELETE FROM `users` WHERE `id` = ?"),
        } as const;

        public override get(id: User.ID) {
            const row = this.statements.get.get(id.id);
            if (row === undefined) return null;
            return User.row(row);
        }

        public getByUsername(username: string) {
            const row = this.statements.getByUsername.get(username);
            if (row === undefined) return null;
            return User.row(row);
        }

        public usernameAvailable(username: string) {
            return this.getByUsername(username) === null;
        }

        public override list({limit, offset}: { limit: number, offset: number }) {
            const rows = this.statements.list.all(limit, offset);
            return {
                resources: rows.map(User.row),
                total: this.statements.count.get()!.count
            }
        }

        public override save(resource: User) {
            this.statements.save.run(resource.id.id, resource.username, JSON.stringify(Array.from(resource.scopes.values())), resource.password.hash, resource.disabled ? 1 : 0);
        }

        public deleteAll() {
            this.statements.deleteAll.run();
        }

        public override delete(id: User.ID) {
            this.statements.delete.run(id.id);
        }
    }

    export class Controller extends ResourceController {
        protected override readonly path = ["users"];
        private readonly extract = {
            username(body: any): string {
                if (!("username" in body)) throw new ThrowableResponse(new FieldErrorResponse({username: "Please enter a username."}));
                if (typeof body.username !== "string") throw new ThrowableResponse(new FieldErrorResponse({username: "Must be a string."}));
                if (body.username.length < 3) throw new ThrowableResponse(new FieldErrorResponse({username: "Must be at least 3 characters long."}));
                if (body.username.length > 24) throw new ThrowableResponse(new FieldErrorResponse({username: "Must not be longer than 24 characters."}));
                if (!/^[a-zA-Z0-9-_.]+$/.test(body.username)) throw new ThrowableResponse(new FieldErrorResponse({username: "Must only contain alphanumeric characters, hyphens, underscores, and periods."}));
                return body.username;
            },
            async password(body: any): Promise<Password> {
                if (!("password" in body)) throw new ThrowableResponse(new FieldErrorResponse({password: "Please enter a password."}));
                if (typeof body.password !== "string") throw new ThrowableResponse(new FieldErrorResponse({password: "Must be a string."}));
                if (body.password.length < 3) throw new ThrowableResponse(new FieldErrorResponse({password: "Must be at least 3 characters long."}));
                if (body.password.length > 24) throw new ThrowableResponse(new FieldErrorResponse({password: "Must not be longer than 24 characters."}));
                return await Password.hash(body.password);
            },
            scopes(body: any): Set<Token.Scope> {
                if (!("scopes" in body)) throw new ThrowableResponse(new FieldErrorResponse({scopes: "This field is required."}));
                if (!Array.isArray(body.scopes)) throw new ThrowableResponse(new FieldErrorResponse({scopes: "Must be an array."}));
                const set = new Set<Token.Scope>();
                for (const scope of body.scopes) {
                    if (typeof scope !== "string") continue;
                    if (!Object.values(Token.Scope).includes(scope as Token.Scope)) throw new ThrowableResponse(new FieldErrorResponse({scopes: `Unknown scope ${scope}`}));
                    set.add(scope as Token.Scope);
                }
                return set;
            },
            disabled(body: any): boolean {
                if (!("disabled" in body)) return false;
                if (
                    body.disabled === true
                    || body.disabled === "true"
                    || body.disabled === 1
                    || body.disabled === "1"
                    || body.disabled === "on"
                ) return true;
                if (
                    body.disabled === false
                    || body.disabled === "false"
                    || body.disabled === 0
                    || body.disabled === "0"
                ) return false;
                throw new ThrowableResponse(new FieldErrorResponse({disabled: "Must be a boolean."}));
            }
        } as const;

        public static notFound() {
            return new ErrorResponse(404, "The requested user could not be found.");
        }

        protected override list(req: ApiRequest): ApiResponse {
            req.require(Token.Scope.USERS_READ);
            const limit = req.limit();
            const users = this.library.repositories.users.list(limit);
            return new PageResponse(req, users.resources.map(u => u.json()), limit.page, limit.limit, users.total);
        }

        protected override async create(req: ApiRequest): Promise<ApiResponse> {
            req.require(Token.Scope.USERS_WRITE);
            this.validateBodyType(req.body);
            const username = this.extract.username(req.body);
            const password = await this.extract.password(req.body);
            const scopes = this.extract.scopes(req.body);
            const disabled = this.extract.disabled(req.body);

            if (!this.library.repositories.users.usernameAvailable(username))
                return new ErrorResponse(409, `The username "${username}" is already taken.`);

            const user = new User(User.ID.random(), username, scopes, password, disabled);
            this.library.repositories.users.save(user);
            return new JsonResponse(user.json(), 201);
        }

        protected override deleteAll(req: ApiRequest): ApiResponse {
            req.require(Token.Scope.USERS_WRITE);
            this.library.repositories.tokens.deleteAll();
            this.library.repositories.users.deleteAll();
            return new EmptyReponse();
        }

        protected override get(req: ApiRequest, id: string): ApiResponse {
            req.require(Token.Scope.USERS_READ);
            const user = this.library.repositories.users.get(new User.ID(id));
            if (user === null) return User.Controller.notFound();
            return new JsonResponse(user.json());
        }

        protected override delete(req: ApiRequest, id: string): ApiResponse {
            req.require(Token.Scope.USERS_WRITE);
            const user = this.library.repositories.users.get(new User.ID(id));
            if (user === null) return User.Controller.notFound();
            this.library.repositories.tokens.deleteOfUser(user.id);
            this.library.repositories.users.delete(user.id);
            return new EmptyReponse();
        }

        protected override async put(req: ApiRequest, id: string): Promise<ApiResponse> {
            req.require(Token.Scope.USERS_WRITE);
            const user = this.library.repositories.users.get(new User.ID(id));
            if (user === null) return User.Controller.notFound();

            this.validateBodyType(req.body);
            const username = this.extract.username(req.body);
            const password = await this.extract.password(req.body);
            const scopes = this.extract.scopes(req.body);
            const disabled = this.extract.disabled(req.body);

            if (!this.library.repositories.users.usernameAvailable(username))
                return new ErrorResponse(409, `The username "${username}" is already taken.`);

            user.username = username;
            user.password = password;
            user.scopes = scopes;
            user.disabled = disabled;
            this.library.repositories.users.save(user);
            return new JsonResponse(user.json());
        }

        protected override async patch(req: ApiRequest, id: string): Promise<ApiResponse> {
            req.require(Token.Scope.USERS_WRITE);
            const user = this.library.repositories.users.get(new User.ID(id));
            if (user === null) return User.Controller.notFound();

            this.validateBodyType(req.body);
            if ("username" in req.body) {
                user.username = this.extract.username(req.body);
                if (!this.library.repositories.users.usernameAvailable(user.username))
                    return new ErrorResponse(409, `The username "${user.username}" is already taken.`);
            }
            if ("password" in req.body) user.password = await this.extract.password(req.body);
            if ("scopes" in req.body) user.scopes = this.extract.scopes(req.body);
            if ("disabled" in req.body) user.disabled = this.extract.disabled(req.body);
            this.library.repositories.users.save(user);
            return new JsonResponse(user.json());
        }

        private validateBodyType(body: JsonResponse.Object | JsonResponse.Array | Buffer) {
            if (Buffer.isBuffer(body)) throw new ThrowableResponse(new ErrorResponse(415, "The request body has unsupported media type.", {
                Accept: "application/json, application/x-www-form-urlencoded"
            }));
            if (Array.isArray(body)) throw new ThrowableResponse(new ErrorResponse(422, "The request body is an array; expected an object."));
        }
    }
}

export default User;
