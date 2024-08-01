export default abstract class ID {
    readonly #id: string;

    /**
     * Create ID from the string representation of an ID.
     */
    public constructor(id: string) {
        this.#id = id;
    }

    /**
     * Get string representation of this ID
     */
    public get id(): string {
        return this.#id;
    }

    /**
     * Get string representation of this ID
     */
    public toString(): string {
        return this.id;
    }

    /**
     * Check if another ID is for the same resource as this one
     */
    public equals(other: ID): boolean {
        return this instanceof other.constructor && this.id === other.id;
    }
}
