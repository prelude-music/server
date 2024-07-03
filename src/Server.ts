import http from "node:http";
import EnhancedSwitch from "enhanced-switch";
import Config from "./Config.js";
import Library from "./Library.js";
import Api from "./api/Api.js";
import JsonResponse from "./response/JsonResponse.js";

export default class Server {
    private readonly http: http.Server;

    public constructor(
        public readonly config: Config,
        public readonly library: Library,
        public readonly packageJson: JsonResponse.Object
    ) {
        const api = new Api(library, packageJson);
        this.http = http.createServer<typeof http.IncomingMessage, typeof http.ServerResponse>(api.requestListener.bind(api));
    }

    public async listen(port: number = this.config.port): Promise<this> {
        return await new Promise<this>(resolve => {
            this.http.listen(port, () => resolve(this));
            this.http.on("error", (err) => {
                if ("code" in err && typeof err.code === "string") new EnhancedSwitch(err.code)
                    .case("EADDRINUSE", () => console.error(`Error: Port ${port} is already in use.`))
                    .case("EACCES", () => console.error(`Error: Port ${port} requires elevated privileges.`))
                    .case("ERR_SOCKET_BAD_PORT", () => console.error(`Error: Port ${port} is out of range.`))
                    .default(() => console.error(`Server error occurred`, err));
                process.exit(1);
            });
        });
    }

    public async close(): Promise<this> {
        return await new Promise<this>((resolve, reject) => {
            this.http.close((err) => {
                if (err !== undefined) reject(err);
                else resolve(this);
            });
        });
    }
}
