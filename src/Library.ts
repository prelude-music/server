import {parseFile as getMetadataFromFile} from "music-metadata";
import File from "./File.js";
//import SpotifyApi from "./SpotifyApi.js";
import Database from "./db/Database.js";
import Artist from "./resource/Artist.js";
import Album from "./resource/Album.js";
import Track from "./resource/Track.js";
import Config from "./Config.js";
import PageResponse from "./response/PageResponse.js";
import JsonResponse from "./response/JsonResponse.js";
import ApiRequest from "./api/ApiRequest.js";

export default class Library {
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

    //private static readonly spotify = new SpotifyApi("https://api.spotify.com");

    public readonly repositories: { artists: Artist.Repository, albums: Album.Repository, tracks: Track.Repository };

    public constructor(private readonly db: Database, private readonly config: Config) {
        this.db = new Database(this.config.db);
        this.repositories = {
            artists: new Artist.Repository(this.db),
            albums: new Album.Repository(this.db),
            tracks: new Track.Repository(this.db)
        }
    }

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

    /**
     * Create track from file and save in library
     * @param file Local audio file
     */
    public async trackFromFile(file: File): Promise<Track> {
        const meta = await getMetadataFromFile(file.path);
        const artist = new Artist(Artist.ID.of(meta.common.artist ?? this.config.unknownArtist), meta.common.artist ?? this.config.unknownArtist, null);
        const album = meta.common.album ? new Album(Album.ID.of(meta.common.album, artist.id), meta.common.album, artist.id) : null;
        const title = meta.common.title ?? file.name();
        const id = Track.ID.of(title, artist.id, album?.id);
        const track = new Track(
            id,
            title,
            artist.id,
            album?.id ?? null,
            file,
            meta.common.year ?? null,
            meta.common.genre?.map(g => g.toLowerCase()) ?? [],
            meta.common.track.no === null ? null : {no: meta.common.track.no, of: meta.common.track.of},
            meta.common.disk.no === null ? null : {no: meta.common.disk.no, of: meta.common.disk.of},
            meta.format.duration === null ? 0 : Math.round(meta.format.duration!),
            {
                channels: meta.format.numberOfChannels ?? 0,
                sampleRate: meta.format.sampleRate ?? 0,
                bitrate: meta.format.bitrate ?? 0,
                lossless: meta.format.lossless ?? false
            }
        );

        const isNewArtist = this.repositories.artists.get(artist.id) === null;
        if (isNewArtist) this.repositories.artists.save(artist);

        const isNewAlbum = album && this.repositories.albums.get(album.id) === null;
        if (isNewAlbum) this.repositories.albums.save(album);

        const isNewTrack = this.repositories.tracks.get(id) === null;
        if (isNewTrack) this.repositories.tracks.save(track);

        return track;
    }

    /**
     * Remove track from library
     * @param track Track to remove
     */
    public removeTrack(track: Track): void {
        this.repositories.tracks.delete(track.id);
        // request an empty set just to get the count. if no tracks in artist & artist albums, delete those as well
        if (track.album !== null) {
            const {total: albumTracks} = this.repositories.tracks.album(track.album, {limit: 0, offset: 0});
            if (albumTracks === 0)
                this.repositories.albums.delete(track.album);
        }
        const {total: artistTracks} = this.repositories.tracks.artist(track.artist, {limit: 0, offset: 0});
        if (artistTracks === 0)
            this.repositories.artists.delete(track.artist);
    }

    /**
     * Validate all tracks in the library (tracks with missing audio will be removed) and check for new tracks on filesystem
     */
    public async reload() {
        return {
            removed: await this.removeOrphanedTracks(),
            added: await this.checkForNewTracks()
        }
    }

    /**
     * Remove tracks from the DB that are no longer present on disk
     */
    public async removeOrphanedTracks(): Promise<number> {
        let removed = 0;
        const {total} = this.repositories.tracks.list({limit: 0, offset: 0});
        const tracks = this.repositories.tracks.list({limit: total, offset: 0});
        const promises: Promise<void>[] = [];
        for (const track of tracks.resources)
            promises.push(track.file.isReadable().then(readable => {
                if (!readable) {
                    this.removeTrack(track);
                    ++removed;
                }
            }));
        await Promise.all(promises);
        return removed;
    }

    /**
     * Check local filesystem for new tracks
     */
    public async checkForNewTracks(): Promise<number> {
        let added = 0;
        const promises: Promise<any>[] = [];
        for (const path of this.config.discoverPaths) {
            const p = Library.getFiles(path);
            promises.push(p);
            p.then(files => {
                for (const file of files)
                    if (this.repositories.tracks.getFromFile(file) === null) {
                        promises.push(this.trackFromFile(file));
                        ++added;
                    }
            });
        }
        await Promise.all(promises);
        return added;
    }

    public tracks(req: ApiRequest): JsonResponse {
        const limit = req.limit();
        const tracks = this.repositories.tracks.list({limit: limit.limit, offset: limit.offset, sort: req.url.searchParams.get("sort")});
        return new PageResponse(req, tracks.resources.map(t => t.json()), limit.page, limit.limit, tracks.total);
    }

    public albums(req: ApiRequest): JsonResponse {
        const albums = this.repositories.albums.list(req.limit());
        const limit = req.limit();
        return new PageResponse(req, albums.resources.map(a => a.json()), limit.page, limit.limit, albums.total);
    }

    public artists(req: ApiRequest): JsonResponse {
        const artists = this.repositories.artists.list(req.limit());
        const limit = req.limit();
        return new PageResponse(req, artists.resources.map(a => a.json()), limit.page, limit.limit, artists.total);
    }
}
