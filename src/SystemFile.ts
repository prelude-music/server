import {fileURLToPath} from "node:url";
import Path from "node:path";
import File from "./File.js";

/**
 * A file that is part of the source project
 */
export default class SystemFile extends File {
    /**
     * @param path Absolute file path inside the project root
     * @param [type] File MIME type
     * @param [directory] Whether this is a directory
     */
    public constructor(
        path: string,
        type?: string | null,
        directory?: boolean | null
    ) {
        super(Path.join(SystemFile.projectRoot, path), type, directory);
    }

    public static readonly projectRoot = fileURLToPath(new URL("../", import.meta.url));
}
