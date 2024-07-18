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
        return new Config(await file.json<JsonResponse.Object>());
    }
}
