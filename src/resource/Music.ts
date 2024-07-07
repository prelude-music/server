import {parseFile as getMetadataFromFile} from "music-metadata";
import File from "../File.js";
import Api from "../api/Api.js";

class Music extends Api.Resource {
    /**
     * File
     */
    public readonly file: File;

    /**
     * Meta
     */
    public readonly meta: Music.Meta;

    /**
     * Track title
     */
    public readonly title: string;

    /**
     * Track artists
     * @example ["Beth Hart", "Joe Bonamassa"]
     */
    public readonly artists: string[];

    /**
     * Literal written track artist
     * @example "Beth Hart & Joe Bonamassa"
     */
    public readonly artist: string | null;

    /**
     * Album title
     */
    public readonly albumName: string | null;

    /**
     * Year
     */
    public readonly year: number | null;

    /**
     * Genres
     */
    public readonly genres: string[];

    /**
     * Track number on the media
     * @example {no: 1, of: 2}
     */
    public readonly track: {no: number, of: number | null} | null;

    /**
     * Disk or media number
     * @example {no: 1, of: 2}
     */
    public readonly disk: {no: number, of: number | null} | null;

    /**
     * Create new Music
     * @param file See {@link File}
     * @param meta See {@link Meta}
     * @param [options]
     * @param [options.title] See {@link Meta#title}. Defaults to name of file
     * @param [options.artists] See {@link Meta#artists}. Defaults to empty array
     * @param [options.artist] See {@link Meta#artist}. Defaults to `null`
     * @param [options.albumName] See {@link Meta#albumName}. Defaults to `null`
     * @param [options.year] See {@link Meta#year}. Defaults to `null`
     * @param [options.genres] See {@link Meta#genres}. Defaults to empty array
     * @param [options.track] See {@link Meta#track}. Defaults to `null`
     * @param [options.disk] See {@link Meta#disk}. Defaults to `null`
     */
    public constructor(
        file: File,
        meta: Music.Meta,
        options: Partial<{
            title: typeof Music.prototype.title,
            artists: typeof Music.prototype.artists,
            artist: typeof Music.prototype.artist,
            albumName: typeof Music.prototype.albumName,
            year: typeof Music.prototype.year,
            genres: typeof Music.prototype.genres,
            track: typeof Music.prototype.track,
            disk: typeof Music.prototype.disk
        }> = {}
    ) {
        super();
        this.file = file;
        this.meta = meta;

        this.title = options.title ?? file.name();
        this.artists = options.artists ?? [];
        this.artist = options.artist ?? null;
        this.albumName = options.albumName ?? null;
        this.year = options.year ?? null;
        this.genres = options.genres?.map(g => g.toLowerCase()) ?? [];
        this.track = options.track ?? null;
        this.disk = options.disk ?? null;
    }

    /**
     * Get cover art
     */
    public async cover(): Promise<{type: string, data: Buffer} | null> {
        const meta = await getMetadataFromFile(this.file.path);
        if (meta.common.picture === undefined || meta.common.picture!.length === 0) return null;
        const pic = meta.common.picture!.length === 1 ? meta.common.picture![0] : meta.common.picture!.find(p => ["cover", "front", "album"].some(t => p.type?.toLowerCase().includes(t)));
        if (pic === undefined) return null;
        return {
            type: pic.format,
            data: pic.data
        };
    }

    public static async fromFile(file: File): Promise<Music> {
        const meta = await getMetadataFromFile(file.path);
        return new Music(file, {
            duration: meta.format.duration ?? 0,
            channels: meta.format.numberOfChannels ?? 0,
            sampleRate: meta.format.sampleRate ?? 0,
            bitrate: meta.format.bitrate ?? 0,
            lossless: meta.format.lossless ?? false
        }, {
            title: meta.common.title,
            artists: meta.common.artists ?? [],
            artist: meta.common.artist ?? null,
            albumName: meta.common.album ?? null,
            year: meta.common.year ?? null,
            genres: meta.common.genre ?? [],
            track: meta.common.track !== undefined && typeof meta.common.track.no !== null ? {no: meta.common.track.no!, of: meta.common.track.of} : null,
            disk: meta.common.disk !== undefined && typeof meta.common.disk.no !== null ? {no: meta.common.disk.no!, of: meta.common.disk.of} : null
        });
    }
}

namespace Music {
    export interface Meta {
        /**
         * Audio duration in seconds
         */
        readonly duration: number;

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
}

export default Music;
