import crypto from "node:crypto";
import ID from "./ID.js";

export default class RandomID extends ID {
    public static random(): RandomID {
        return new this(crypto.randomUUID());
    }
}
