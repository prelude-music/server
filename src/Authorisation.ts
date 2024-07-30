import User from "./resource/User.js";
import Token from "./resource/Token.js";
import Library from "./Library.js";
import ApiRequest from "./api/ApiRequest.js";
import ThrowableResponse from "./response/ThrowableResponse.js";
import ErrorResponse from "./response/ErrorResponse.js";

export default class Authorisation {
    public constructor(
        public readonly user: User,
        public readonly scopes: Readonly<Set<Token.Scope>>,
        public readonly expires: Date | null
    ) {
    }

    public require(scope: Token.Scope): void {
        if (!this.scopes.has(scope)) throw new ThrowableResponse(Authorisation.FORBIDDEN);
    }

    public static fromToken(secret: Token.Secret, library: Library): Authorisation | null {
        const token = library.repositories.tokens.getBySecret(secret);
        if (token === null) return null;
        const user = library.repositories.users.get(token.user);
        if (user === null) {
            library.repositories.tokens.delete(token.id);
            return null;
        }
        if (user.disabled) return null;
        return new Authorisation(user, Object.freeze(token.scopes), token.expires);
    }

    public static fromUser(user: User): Authorisation | null {
        if (user.disabled) return null;
        return new Authorisation(user, Object.freeze(user.scopes), null);
    }

    public static async fromBasic(username: string, password: string, library: Library): Promise<Authorisation | null> {
        const user = library.repositories.users.getByUsername(username);
        if (user === null) return null;
        if (!await user.password.verify(password)) return null;
        return this.fromUser(user);
    }

    public static async fromHeader(header: string, library: Library): Promise<Authorisation | null> {
        const [scheme] = header.split(" ");
        if (scheme === undefined) return null;
        const value = header.slice(scheme.length + 1);
        switch (scheme.toLowerCase()) {
            case "bearer":
                return this.fromToken(new Token.Secret(value), library);
            case "basic": {
                const credentials = Buffer.from(value, "base64").toString("utf8");
                const [username] = credentials.split(":");
                if (username === undefined) return null;
                const password = credentials.slice(username.length + 1);
                return await this.fromBasic(username, password, library);
            }
            default:
                return null;
        }
    }

    public static async fromReq(req: ApiRequest, library: Library): Promise<Authorisation | null> {
        const header = req.headers.authorization;
        if (header === undefined) return null;
        return await this.fromHeader(header, library);
    }

    public static readonly UNAUTHORISED = new ErrorResponse(401, "Authorisation is required to access this endpoint.", {
        "WWW-Authenticate": 'Basic realm="Prelude API", Bearer realm="Prelude API"'
    });

    public static readonly FORBIDDEN = new ErrorResponse(403, "You don't have permission to access this endpoint.");
}
