import argon2 from "argon2";

/**
 * A password hash
 */
export default class Password {
    public constructor(public readonly hash: string) {}

    public async verify(password: string): Promise<boolean> {
        return await argon2.verify(this.hash, password);
    }

    public static async hash(password: string): Promise<Password> {
        return new this(await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 2**16, // 64 MB
            timeCost: 3, // iterations
            parallelism: 1, // threads
        }));
    }
}
