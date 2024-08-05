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
import Config from "../Config.js";

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
            username(body: FormData): string {
                const username = body.get("username");
                if (username === null) throw new ThrowableResponse(new FieldErrorResponse({username: "Please enter a username."}));
                if (typeof username !== "string") throw new ThrowableResponse(new FieldErrorResponse({username: "Must be a string."}));
                if (username.length < 3) throw new ThrowableResponse(new FieldErrorResponse({username: "Must be at least 3 characters long."}));
                if (username.length > 24) throw new ThrowableResponse(new FieldErrorResponse({username: "Must not be longer than 24 characters."}));
                if (!/^[a-zA-Z0-9-_.]+$/.test(username)) throw new ThrowableResponse(new FieldErrorResponse({username: "Must only contain alphanumeric characters, hyphens, underscores, and periods."}));
                return username;
            },
            async password(body: FormData, config: Config): Promise<Password> {
                const password = body.get("password");
                if (password === null) throw new ThrowableResponse(new FieldErrorResponse({password: "Please enter a password."}));
                if (typeof password !== "string") throw new ThrowableResponse(new FieldErrorResponse({password: "Must be a string."}));
                if (password.length < config.minPasswordLength) throw new ThrowableResponse(new FieldErrorResponse({password: `Must be at least ${config.minPasswordLength} character${config.minPasswordLength !== 1 ? "s" : ""} long.`}));
                return new Password(password);
            },
            scopes(body: FormData): Set<Token.Scope> {
                if (!body.has("scopes")) throw new ThrowableResponse(new FieldErrorResponse({scopes: "This field is required."}));
                const scopes = body.getAll("scopes");
                const set = new Set<Token.Scope>();
                for (const scope of scopes) {
                    if (typeof scope !== "string") continue;
                    if (!Object.values(Token.Scope).includes(scope as Token.Scope)) throw new ThrowableResponse(new FieldErrorResponse({scopes: `Unknown scope ${scope}`}));
                    set.add(scope as Token.Scope);
                }
                return set;
            },
            disabled(body: FormData): boolean {
                const disabled = body.get("disabled");
                if (disabled === null) return false;
                if (
                    disabled === "true"
                    || disabled === "1"
                    || disabled === "on"
                ) return true;
                if (
                    disabled === "false"
                    || disabled === "0"
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
            const body = this.validateBodyType(req.body);
            const username = this.extract.username(body);
            const password = await this.extract.password(body, this.library.config);
            const scopes = this.extract.scopes(body);
            const disabled = this.extract.disabled(body);

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

            const body = this.validateBodyType(req.body);
            const username = this.extract.username(body);
            const password = await this.extract.password(body, this.library.config);
            const scopes = this.extract.scopes(body);
            const disabled = this.extract.disabled(body);

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

            const body = this.validateBodyType(req.body);
            if (body.has("username")) user.username = this.extract.username(body);
            if (body.has("password")) user.password = await this.extract.password(body, this.library.config);
            if (body.has("scopes")) user.scopes = this.extract.scopes(body);
            if (body.has("disabled")) user.disabled = this.extract.disabled(body);
            this.library.repositories.users.save(user);
            return new JsonResponse(user.json());
        }

        private validateBodyType(body: FormData | Buffer): FormData {
            if (Buffer.isBuffer(body)) throw new ThrowableResponse(new ErrorResponse(415, "The request body has unsupported media type.", {
                Accept: "application/json, application/x-www-form-urlencoded, multipart/form-data"
            }));
            return body;
        }
    }
}

export default User;
