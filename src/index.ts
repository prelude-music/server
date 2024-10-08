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
import User from "./resource/User.js";
import Token from "./resource/Token.js";
import Password from "./Password.js";
import Playlist from "./resource/Playlist.js";

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
    new User.Controller(library),
    new Token.Controller(library),
    new Playlist.Controller(library),
], library).listen();
console.log(`Server listening on http://0.0.0.0:${config.port}`);

console.log("Reloading library... (this may take a while)");
const libLoad = await library.reload();
console.log(`Library loaded. Added ${libLoad.added} new track${libLoad.added === 1 ? "" : "s"}${libLoad.removed > 0 ? `, removed ${libLoad.removed} orphaned track${libLoad.removed === 1 ? "" : "s"}` : ""}.`);

// if no users in db, create default admin user
if (library.repositories.users.list({limit: 0, offset: 0}).total === 0) {
    // using token secret generator just to get a good password
    const password = Token.Secret.random().id;
    library.repositories.users.save(new User(
        User.ID.random(),
        "admin",
        new Set([Token.Scope.ADMIN]),
        await Password.hash(password),
        false
    ));
    console.log("Generated a default administrator user:");
    console.log("Username: admin");
    console.log("Password: " + password);
}

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
