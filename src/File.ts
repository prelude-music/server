import fs from "node:fs";
import path from "node:path";
import mime from "mime";
import JSON5 from "json5";
import JsonResponse from "./response/JsonResponse.js";

export default class File {
    /**
     * Create new File
     * @param path Absolute file path
     * @param [type] File MIME type
     * @param [directory] Whether this is a directory
     */
    public constructor(
        /**
         * Absolute file path
         */
        public readonly path: string,
        /**
         * File MIME type
         */
        public readonly type: string | null = mime.getType(path),
        /**
         * Whether this is a directory
         */
        public readonly directory: boolean | null = null
    ) {
    }

    /**
     * Get file name
     */
    public name(): string {
        return path.basename(this.path);
    }

    /**
     * Get file extension
     */
    public extension(): string {
        return path.extname(this.path).replace(/^\./, "");
    }

    /**
     * Stat
     */
    public async stat(): Promise<fs.Stats> {
        return await fs.promises.stat(this.path);
    }

    /**
     * Check if can be read
     */
    public async isReadable(): Promise<boolean> {
        try {
            await fs.promises.access(this.path, fs.constants.R_OK);
            return true;
        }
        catch {
            return false;
        }
    }

    /**
     * Read file to Buffer
     * @param [start] Start offset
     * @param [end] End offset
     */
    public async buffer(start?: number, end?: number): Promise<Buffer> {
        return (await fs.promises.readFile(this.path)).subarray(start, end);
    }

    /**
     * Read file and parse using JSON5
     */
    public async json<T = JsonResponse.Value>(): Promise<T> {
        return JSON5.parse((await this.buffer()).toString("utf8"));
    }

    /**
     * Copy file
     * @param file Destination
     */
    public async copy(file: File): Promise<void> {
        await fs.promises.copyFile(this.path, file.path);
    }


    /**
     * Create file read stream
     * @param [start] Start offset
     * @param [end] End offset
     */
    public stream(start?: number, end?: number): NodeJS.ReadableStream {
        return fs.createReadStream(this.path, {start, end});
    }

    /**
     * Get entries of directory
     */
    public async files(): Promise<File[]> {
        return (await fs.promises.readdir(this.path, {withFileTypes: true})).map(this.fromDirent.bind(this));
    }

    /**
     * Crate File from Dirent
     */
    public fromDirent(dirent: fs.Dirent): File {
        return new File(path.join(this.path, dirent.name), dirent.isDirectory() ? null : undefined, dirent.isDirectory() ? true : (dirent.isFile() ? false : null));
    }
}
