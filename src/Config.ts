import File from "./File.js";
import JsonResponse from "./response/JsonResponse.js";
import SystemFile from "./SystemFile.js";

export default class Config {
    /**
     * Port on which the web server will listen
     */
    public readonly port: number;

    /**
     * Absolute paths to music files and/or directories.
     *
     * When providing a directory path, you can add a colon and a number to the path to set a subdirectory search limit.
     * By default, the limit is 20.
     *
     * Examples:
     *  - `/music` will check subdirectories of `/music` up to 20 levels deep
     *  - `/music:0` will only check for music files in `/music` and will not check subdirectories
     *  - `/music:1` will only check for music files in `/music` and direct subdirectories (1 level deep)
     *  - `/music/audio.flac` will include the file `audio.flac`
     */
    public discoverPaths: string[];

    /**
     * Name to use when track artist not known
     */
    public readonly unknownArtist: string;

    /**
     * SQLite database path
     */
    public readonly db: File;

    public constructor(options: {
        port?: typeof Config.prototype.port,
        discoverPaths?: typeof Config.prototype.discoverPaths,
        unknownArtist?: typeof Config.prototype.unknownArtist,
        db?: typeof Config.prototype.db,
    }) {
        this.port = options.port ?? 9847;
        this.discoverPaths = options.discoverPaths ?? [];
        this.unknownArtist = options.unknownArtist ?? "Unknown Artist";
        this.db = options.db ?? new SystemFile("/prelude.db");
    }

    public static async fromFile(file: File): Promise<Config> {
        const json = await file.json<JsonResponse.Object>();
        const options: ConstructorParameters<typeof Config>[0] = {};

        if ("port" in json) {
            if (typeof json.port !== "number")
                throw new TypeError(`Config option "port" must be a number; got (${typeof json.port}) ${json.port}`);
            options.port = json.port;
        }

        if ("discoverPaths" in json) {
            if (!Array.isArray(json.discoverPaths) || !json.discoverPaths.every(p => typeof p === "string"))
                throw new TypeError(`Config option "discoverPaths" must be an array of strings; got (${typeof json.discoverPaths}) ${json.discoverPaths}`);
            options.discoverPaths = json.discoverPaths;
        }

        if ("unknownArtist" in json) {
            if (typeof json.unknownArtist !== "string")
                throw new TypeError(`Config option "unknownArtist" must be a string; got (${typeof json.unknownArtist}) ${json.unknownArtist}`);
            options.unknownArtist = json.unknownArtist;
        }

        if ("db" in json) {
            if (typeof json.db !== "string")
                throw new TypeError(`Config option "db" must be a string; got (${typeof json.db}) ${json.db}`);
            options.db = new SystemFile(json.db);
        }

        return new Config(options);
    }
}
