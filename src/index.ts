import Server from "./Server.js";
import Config from "./Config.js";
import Library from "./Library.js";
import SystemFile from "./SystemFile.js";
import JsonResponse from "./response/JsonResponse.js";
import File from "./File.js";
import Database from "./db/Database.js";
import Artist from "./resource/Artist.js";
import Album from "./resource/Album.js";
import Track from "./resource/Track.js";

const configArgIndex = process.argv.findIndex(arg => arg === "--config" || arg === "-c");
const customConfig = configArgIndex >= 0 && process.argv.length > configArgIndex + 1;
const configFile: File = customConfig ? new File(process.argv[configArgIndex + 1]!) : new SystemFile("prelude.json");

try {
    await configFile.isReadable();
    const stats = await configFile.stat();
    if (stats.isDirectory()) {
        console.error(`Error: ${configFile.path} is a directory.`);
        process.exit(1);
    }
}
catch (e) {
    if (!customConfig && e instanceof Error && "code" in e && e.code === "ENOENT") {
        const defaultConfig = new SystemFile("default-config.json");
        await defaultConfig.copy(configFile);
    }
    throw e;
}

console.log(`Loading config path=${configFile.path}`);
const config = await Config.fromFile(configFile);
const packageJson = await new SystemFile("/package.json", "application/json", false).json<JsonResponse.Object>();

const db = new Database(config.db);
console.log("Initialising database...");
await db.init();
const library = new Library(db, config);
const server = await new Server(config, packageJson, [
    new Artist.Controller(library),
    new Album.Controller(library),
    new Track.Controller(library),
]).listen();
console.log(`Server listening on http://0.0.0.0:${config.port}`);

console.log("Reloading library... (this may take a while)");
const libLoad = await library.reload();
console.log(`Library loaded. Added ${libLoad.added} new track${libLoad.added === 1 ? "" : "s"}${libLoad.removed > 0 ? `, removed ${libLoad.removed} orphaned track${libLoad.removed === 1 ? "" : "s"}` : ""}.`);

process.on("SIGINT", async () => {
    console.log("\rStopping...");
    setTimeout(() => {
        console.log("Did not stop in 5 seconds. Forcefully closing...");
        process.exit(0);
    }, 5000);
    await server.close();
    console.log("Server closed.");
    process.exit(0);
});
