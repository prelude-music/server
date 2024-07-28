import crypto from "node:crypto";
import ID from "./ID.js";

export default class HashID extends ID {
    private static hash(string: string): string {
        return crypto.createHash("sha1").update(string).digest("base64").replace(/=+$/, "").replace(/\/+/g, "-");
    }

    /**
     * Calculate ID from strings/IDs
     */
    protected static of(...args: (string | ID | null | undefined)[]): HashID {
        return new this(HashID.hash(args.map(s => {
            const k = (typeof s === "string") ? s : s?.id ?? "";
            return k.length + k;
        }).join("")));
    }
}
