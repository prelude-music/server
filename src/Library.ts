import crypto from "node:crypto";
import File from "./File.js";
import Music from "./resource/Music.js";
import JsonResponse from "./response/JsonResponse.js";
import Api from "./api/Api.js";
import PageResponse from "./response/PageResponse.js";
import SpotifyApi from "./SpotifyApi.js";
import EnhancedSwitch from "enhanced-switch";
import Config from "./Config.js";

class Library {
    /**
     * Supported audio file extensions
     */
    public static readonly AUDIO_EXTENSIONS = [
        "aiff", "aifc", "aif", // AIFF / AIFF-C
        "aac",                 // AAC
        "ape",                 // APE
        "asf",                 // ASF
        "bwf",                 // BWF
        "dff",                 // DSDIFF
        "dsf",                 // DSF
        "flac",                // FLAC
        "mp2",                 // MP2
        "mka", "mkv",          // Matroska
        "mp3",                 // MP3
        "mpc",                 // MPC
        "m4a", "mp4",          // MPEG 4
        "ogg", "oga",          // Ogg
        "opus",                // Opus
        "spx",                 // Speex
        "ogv",                 // Theora
        "vorbis",              // Vorbis
        "wav",                 // WAV
        "webm",                // WebM
        "wv",                  // WV
        "wma"                  // WMA
    ];

    private static readonly spotify = new SpotifyApi("https://api.spotify.com");

    /**
     * Get absolute paths of supported audio files from file system
     * @param path Absolute path to parent directory or audio file
     * @param subDirectoryLevel The maximum subdirectory nesting level to scan (0 to not scan subdirectories)
     * @param [extensions] The file extensions to include
     */
    public static async getFiles(path: string, subDirectoryLevel: number = 20, extensions: string[] = Library.AUDIO_EXTENSIONS): Promise<File[]> {
        if (subDirectoryLevel < 0) return [];

        const current = new File(path);
        const stats = await current.stat();

        if (!stats.isDirectory()) {
            if (extensions.includes(current.extension()))
                return [current];
            return [];
        }

        const result: File[] = [];
        const entries = await current.files();

        for (const entry of entries) {
            if (entry.directory === true) {
                if (subDirectoryLevel > 0)
                    result.push(...await Library.getFiles(entry.path, subDirectoryLevel - 1, extensions));
            }
            else if (extensions.includes(entry.extension()))
                result.push(entry);
        }

        return result;
    }

    public static async from(config: Config): Promise<Library> {
        const library = new Library();
        for (const path of config.discoverPaths) {
            const music = await Promise.all((await Library.getFiles(path)).map(Music.fromFile.bind(Music)));
            await library.addTrack(...music);
        }

        return library;
    }

    readonly #music: Map<number, Library.Track> = new Map();

    public constructor() {
    }

    public getTracks(): Library.Track[] {
        return Array.from(this.#music.values());
    }

    public getTrack(id: number): Library.Track | null {
        return this.#music.get(id) ?? null;
    }

    public nextTrackId(): number {
        return this.#music.size === 0 ? 0 : Math.max(...this.#music.keys()) + 1;
    }

    public async addTrack(...tracks: Music[]): Promise<void> {
        for (const music of tracks) {
            let album: Library.Album | null = null;
            if (music.albumName !== null) {
                album = Array.from(this.#albums.values()).find(a => a.title === music.albumName && a.artist === music.artist) ?? null;
                if (album === null) {
                    album = new Library.Album(music.albumName ?? "Unknown", music.artist ?? null, []);
                    this.#albums.set(album.id, album);
                }
            }
            const track = music instanceof Library.Track ? music : new Library.Track(this.nextTrackId(), music, album);
            for (const artistName of music.artists) {
                const artist = this.#artists.get(Library.Artist.id(artistName)) ?? await (async () => {
                    try {
                        const image = await Library.spotify.getArtistImage(artistName, track.title);
                        return new Library.Artist(artistName, [], image);
                    }
                    catch (e) {
                        return new Library.Artist(artistName, [], null);
                    }
                })();
                artist.addTrack(track);
                this.#artists.set(artist.id, artist);
            }
            const artist = this.#artists.get(Library.Artist.id(music.artist ?? "Unknown Artist")) ?? await (async () => {
                if (music.artist === null) return new Library.Artist("Unknown Artist", [], null);
                try {
                    const image = await Library.spotify.getArtistImage(music.artist, track.title);
                    return new Library.Artist(music.artist, [], image);
                }
                catch (e) {
                    return new Library.Artist(music.artist, [], null);
                }
            })();
            artist.addTrack(track);
            this.#artists.set(artist.id, artist);
            this.#music.set(track.id, track);
            if (album !== null)
                album.addTrack(track);
        }
    }

    public clearTracks() {
        this.#music.clear();
    }

    public static id(...args: (string | null | undefined)[]) {
        return this.hash(args.map(s => {
            const k = ([null, undefined].some(t => t === s) ? "" : s as string);
            return k.length + k;
        }).join(""));
    }

    private static hash(string: string): string {
        return crypto.createHash("sha1").update(string).digest("base64").replace(/=+$/, "").replace(/\/+/g, "-");
    }

    #albums: Map<string, Library.Album> = new Map();

    public getAlbums(): Library.Album[] {
        return Array.from(this.#albums.values());
    }

    public getAlbum(id: string): Library.Album | null {
        return this.#albums.get(id) ?? null;
    }

    #artists: Map<string, Library.Artist> = new Map();

    public getArtists(): Library.Artist[] {
        return Array.from(this.#artists.values());
    }

    public getArtist(id: string): Library.Artist | null {
        return this.#artists.get(id) ?? null;
    }

    // HTTP

    public tracks(req: Api.Request): JsonResponse {
        return PageResponse.from(req, this.getTracks(), music => music.get());
    }

    public albums(req: Api.Request): JsonResponse {
        return PageResponse.from(req, new EnhancedSwitch<string | null, Library.Album[]>(req.url.searchParams.get("sort"))
            .case("title:desc", () => this.getAlbums().sort((a, b) => b.title.localeCompare(a.title)))
            .case("title:asc", () => this.getAlbums().sort((a, b) => a.title.localeCompare(b.title)))
            .case("tracks:desc", () => this.getAlbums().sort((a, b) => b.tracks().length - a.tracks().length))
            .case("tracks:asc", () => this.getAlbums().sort((a, b) => a.tracks().length - b.tracks().length))
            .case("duration:desc", () => this.getAlbums().sort((a, b) => b.duration() - a.duration()))
            .case("duration:asc", () => this.getAlbums().sort((a, b) => a.duration() - b.duration()))
            .default(this.getAlbums())
            .value, album => album.get());
    }

    public artists(req: Api.Request): JsonResponse {
        return PageResponse.from(req, new EnhancedSwitch<string | null, Library.Artist[]>(req.url.searchParams.get("sort"))
            .case("name:desc", () => this.getArtists().sort((a, b) => b.name.localeCompare(a.name)))
            .case("name:asc", () => this.getArtists().sort((a, b) => a.name.localeCompare(b.name)))
            .case("tracks:desc", () => this.getArtists().sort((a, b) => b.tracks().length - a.tracks().length))
            .case("tracks:asc", () => this.getArtists().sort((a, b) => a.tracks().length - b.tracks().length))
            .case("duration:desc", () => this.getArtists().sort((a, b) => b.duration() - a.duration()))
            .case("duration:asc", () => this.getArtists().sort((a, b) => a.duration() - b.duration()))
            .default(this.getArtists())
            .value, artist => artist.get());
    }
}

namespace Library {
    export class Track extends Music {
        public constructor(public readonly id: number, music: Music, public readonly album: Album | null) {
            super(music.file, music.meta, music);
        }

        public get(): JsonResponse.Object {
            return {
                id: this.id,
                title: this.title,
                artists: this.artists,
                artist: this.artist,
                album: this.album ? {
                    id: this.album.id,
                    title: this.album.title,
                    artist: this.album.artist
                } : null,
                year: this.year,
                genres: this.genres,
                track: this.track,
                disk: this.disk,
                meta: {
                    duration: this.meta.duration,
                    channels: this.meta.channels,
                    sampleRate: this.meta.sampleRate,
                    bitrate: this.meta.bitrate,
                    lossless: this.meta.lossless
                }
            }
        }
    }

    export class Album {
        #tracks: Track[] = [];
        public readonly id: string;

        public constructor(
            public readonly title: string,
            public readonly artist: string | null,
            tracks: Track[]
        ) {
            this.#tracks = tracks;
            this.id = Library.Album.id(title, artist);
        }

        public tracks() {
            return this.#tracks.sort((a, b) => {
                if (a.track === null && b.track === null) return 0;
                if (a.track === null) return 1;
                if (b.track === null) return -1;
                return a.track.no - b.track.no;
            });
        }

        public addTrack(track: Track) {
            if (this.#tracks.some(t => t.id === track.id)) return;
            this.#tracks.push(track);
        }

        public async cover() {
            for (let i = 0; i < Math.min(5, this.#tracks.length); ++i) {
                const cover = await this.#tracks[i]!.cover();
                if (cover !== null) return cover;
            }
            return null;
        }

        public duration() {
            return this.#tracks.reduce((a, b) => a + b.meta.duration, 0);
        }

        public get(): JsonResponse.Object {
            return {
                id: this.id,
                title: this.title,
                artist: this.artist,
                tracks: this.tracks().length,
                duration: this.duration(),
            }
        }

        public static id(name: string, artist: string | null) {
            return Library.id(artist, name);
        }
    }

    export class Artist {
        #tracks: Track[] = [];
        public readonly id: string;

        public constructor(
            public readonly name: string,
            tracks: Track[],
            public readonly image: string | null
        ) {
            this.#tracks = tracks;
            this.id = Artist.id(this.name);
        }

        public tracks() {
            return this.#tracks.sort((a, b) => a.title.localeCompare(b.title));
        }

        public albums() {
            return ([...new Set(this.#tracks.map(track => track.album))].filter(album => album !== null) as Album[]).sort((a, b) => b.tracks().length - a.tracks().length);
        }

        public addTrack(track: Track) {
            if (this.#tracks.some(t => t.id === track.id)) return;
            this.#tracks.push(track);
        }

        public duration() {
            return this.#tracks.reduce((a, b) => a + b.meta.duration, 0);
        }

        public get(): JsonResponse.Object {
            return {
                id: this.id,
                name: this.name,
                tracks: this.tracks().length,
                albums: this.albums().length,
                image: this.image,
                duration: this.duration(),
            }
        }

        public static id(name: string) {
            return Library.id(name);
        }
    }
}

export default Library;
