import ApiResponse from "./ApiResponse.js";
import File from "../File.js";
import Api from "../api/Api.js";
import ErrorResponse from "./ErrorResponse.js";

class FileResponse extends ApiResponse {
    public constructor(public readonly file: File, status: number = 200) {
        super(status);
    }

    public override async send(req: Api.Request) {
        let stats;
        try {
            stats = await this.file.stat();
        }
        catch (e) {
            if (e instanceof Error && "code" in e && e.code === "ENOENT")
                return new ErrorResponse(404, "File not found").send(req);
            return new ErrorResponse(500, "Internal server error", e as Error).send(req);
        }

        const rangeHeader = req.req.headers["range"];
        let ranges: FileResponse.Ranges<FileResponse.Range> | null;
        try {
            ranges = rangeHeader !== undefined ? FileResponse.Ranges.from(rangeHeader) : null;
        }
        catch (e) {
            if (e instanceof SyntaxError)
                return new ErrorResponse(400, e.message).send(req);
            else return new ErrorResponse(500, "Internal server error", e as Error).send(req);
        }
        if (ranges !== null && this.status === 200) {
            if (ranges.ranges.length === 0) return new ErrorResponse(400, "No ranges were specified").send(req);
            let absoluteRanges: FileResponse.Ranges<FileResponse.AbsoluteRange>;
            try {
                absoluteRanges = ranges.absolute(stats.size);
            }
            catch (e) {
                if (e instanceof RangeError)
                    return new ErrorResponse(416, e.message).send(req);
                else return new ErrorResponse(500, "Internal server error", e as Error).send(req);
            }
           if (absoluteRanges.ranges.length === 1) {
               req.res.setHeader("Content-Type", this.file.type ?? "application/octet-stream");
               req.res.setHeader("Content-Range", "bytes " + absoluteRanges.ranges[0]!.start + "-" + absoluteRanges.ranges[0]!.end + "/" + stats.size);
               req.res.statusCode = 206;
               this.file.stream(absoluteRanges.ranges[0]!.start, absoluteRanges.ranges[0]!.end).pipe(req.res);
               return;
           }
        }
        req.res.setHeader("Content-Type", this.file.type ?? "application/octet-stream");
        this.file.stream().pipe(req.res);
    }
}

namespace FileResponse {
    export class Range {
        public constructor(
            public unit: "bytes",
            public start: number | null,
            public end: number
        ) {
        }

        /**
         * @param size Byte size of the data for calculating `suffix-length`
         * @throws {RangeError} If the range is unsatisfiable (return as 416 to client)
         */
        public absolute(size: number): AbsoluteRange {
            if (typeof this.start === "number") {
                if (this.start < 0 || this.start >= size) throw new RangeError("Bad range start `" + this.start + "`");
                const end = Number.isFinite(this.end) ? this.end : size - 1;
                if (end >= size || end < this.start) throw new RangeError("Bad range end `" + end + "`");
                return new AbsoluteRange(this.unit, this.start, end);
            }
            const start = size - this.end;
            if (start < 0 || start >= size) throw new RangeError("Bad range start `" + start + "`");
            return new AbsoluteRange(this.unit, start, size - 1);
        }
    }

    export class AbsoluteRange extends Range {
        public override start: number;

        public constructor(unit: typeof Range.prototype.unit, start: number, end: number) {
            super(unit, start, end);
            this.start = start;
        }

        /**
         * This is already an absolute range.
         */
        public override absolute(): this {
            return this;
        }
    }

    export class Ranges<T extends Range> {
        #ranges: T[] = [];
        public constructor(
            ranges: T[]
        ) {
            this.#ranges = ranges;
        }

        public get ranges(): readonly T[] {
            return Object.freeze(this.#ranges);
        }

        /**
         * @param size Byte size of the data for calculating `suffix-length`
         * @throws {RangeError} If the range is unsatisfiable (return as 416 to client)
         * @see FileResponse.Range#absolute
         */
        public absolute(size: number): Ranges<AbsoluteRange> {
            try {
                return new Ranges<AbsoluteRange>(this.ranges.map(range => range.absolute(size)));
            }
            catch (e) {
                throw e;
            }
        }

        public optimised(): Ranges<T> {
            if (this.ranges.length === 0) return this;
            const ranges = [...this.ranges];
            ranges.sort((a, b) => a.start === null || b.start === null ? -1 : a.start - b.start);

            const optimised: T[] = [];
            let current = ranges[0]!;

            for (const range of ranges) {
                if (range.start === null) continue;
                if (current.start === null) {
                    current = range;
                    continue;
                }
                if (range.start <= current.end)
                    current.end = Math.max(current.end, range.end);
                else {
                    optimised.push(current);
                    current = range;
                }
            }

            optimised.push(current);
            return new Ranges<T>(optimised);
        }

        /**
         * @throws {SyntaxError} For issues with parsing the ranges. Should be sent as 400
         */
        public static from(rangeHeader: string) {
            const result = new Ranges<Range>([]);
            const [unit] = rangeHeader.split("=");
            if (unit !== "bytes") throw new SyntaxError("The Range unit `" + unit + "` is not supported. Only `bytes` is supported.");
            const rangesString = rangeHeader.slice(unit.length + 1);
            if (rangesString.length === 0) throw new SyntaxError("No ranges specified in the Range header.");
            const ranges = rangesString.split(",");
            for (const range of ranges) {
                const parts = range.split("-");
                if (parts.length !== 2) throw new SyntaxError("Invalid range `" + range + "` in the Range header.");
                const startNumber = Number.parseInt(parts[0]!, 10);
                const endNumber = Number.parseInt(parts[1]!, 10);
                const start = Number.isNaN(startNumber) || !Number.isFinite(startNumber) ? null : startNumber;
                const end = Number.isNaN(endNumber) || !Number.isFinite(endNumber) ? null : endNumber;
                if (start === null && end === null) throw new SyntaxError("Invalid range `" + range + "` in the Range header.");
                result.#ranges.push(new Range(unit, start, end ?? Infinity));
            }

            return result;
        }
    }
}

export default FileResponse;
