import SQLite from "better-sqlite3";
import File from "../File.js";
import SystemFile from "../SystemFile.js";

export default class Database extends SQLite {
    public constructor(file: File) {
        super(file.path);
        super.pragma("journal_mode = WAL");
    }

    public async init() {
        const init = new SystemFile("/src/db/init.sql");
        return super.exec((await init.buffer()).toString("utf8"));
    }
}
