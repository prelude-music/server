import crypto from "node:crypto";

export default class ID {
    readonly #id: string;

    /**
     * Create ID from the string representation of an ID.
     */
    public constructor(id: string) {
        if (id.length !== 27 && id.length !== 26) throw new TypeError(`String (${id.length}) "${id}" does not look like a valid ID`);
        this.#id = id;
    }

    /**
     * Get string representation of this ID
     */
    public get id(): string {
        return this.#id;
    }

    public toString(): string {
        return this.id;
    }

    public equals(other: ID): boolean {
        return this instanceof other.constructor && this.id === other.id;
    }

    private static hash(string: string): string {
        return crypto.createHash("sha1").update(string).digest("base64").replace(/=+$/, "").replace(/\/+/g, "-");
    }

    /**
     * Calculate ID from strings/IDs
     */
    protected static of(...args: (string | ID | null | undefined)[]): ID {
        return new this(ID.hash(args.map(s => {
            const k = (typeof s === "string") ? s : s?.id ?? "";
            return k.length + k;
        }).join("")));
    }
}
