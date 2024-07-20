import Database from "./db/Database.js";
import ID from "./ID.js";
import ApiResource from "./api/ApiResource.js";

export default abstract class Repository<T extends ApiResource> {
    public constructor(
        protected readonly database: Database
    ) {
    }

    public abstract get(id: ID): T | null;

    public abstract list(options: {limit: number, offset: number}): { resources: T[], total: number };

    public abstract save(resource: T): void;

    public abstract delete(id: ID): void;
}
