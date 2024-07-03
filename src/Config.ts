import File from "./File.js";
import JsonResponse from "./response/JsonResponse.js";

export default class Config {
    /**
     * Port on which the web server will listen
     */
    public readonly port: number = 9847;

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
    public discoverPaths: string[] = [];

    public constructor(options: {
        port?: typeof Config.prototype.port,
        discoverPaths?: typeof Config.prototype.discoverPaths
    }) {
        if (options.port !== undefined) this.port = options.port;
        if (options.discoverPaths !== undefined) this.discoverPaths = options.discoverPaths;
    }

    public static async fromFile(file: File): Promise<Config> {
        return new Config(await file.json<JsonResponse.Object>());
    }
}
