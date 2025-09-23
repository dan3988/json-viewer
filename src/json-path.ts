import Linq from "@daniel.pickett/linq-js";
import { isIdentifier, toPointer } from "./util";


function isArrayKey(value: string | number) {
	value = Number(value);
	return Number.isInteger(value);
}

export namespace JsonPath {
	export type Segment = number | string;
}

export interface JsonPath {
	readonly segments: readonly JsonPath.Segment[];
	toString(): string;
}

type IJsonPath = JsonPath;

interface BaseJsonPathConstructor {
	readonly root: JsonPath;
	escape(segment: JsonPath.Segment): string;
	parse(path: string): JsonPath;
}

interface JsonPathConstructor extends BaseJsonPathConstructor {
	new(segments: Iterable<JsonPath.Segment>): JsonPath;
}

const Class: BaseJsonPathConstructor = class JsonPath implements IJsonPath {
	static readonly root = new this(['$']);

	static escape(segment: string | number): string {
		const str = String(segment);
		if (isArrayKey(segment) || isIdentifier(str))
			return str;

		return JSON5.stringify(str, { quote: "'" });
	}

	static parse(path: string): JsonPath {
		let i = path.indexOf("/");
		if (i === 0) {
			if (path.startsWith("'"))
				path = JSON5.parse(path);

			return new JsonPath([path]);
		}

		const results: JsonPath.Segment[] = [];

		let start = 0;
		while (true) {
			let part: string;
			let end: boolean;
			//let part = path.substring(start, i);
			if (path.charAt(start) === "'") {
				const regex = /'(?!\\)/g;
				regex.lastIndex = start + 1;
				const results = regex.exec(path);
				if (results == null)
					throw new TypeError("Unclosed quoted path segment: " + path.substring(start));

				part = path.substring(start, i = results.index + 1);
				part = JSON5.parse(part);
				end = i === path.length;
			} else {
				end = (i = path.indexOf("/", start)) < 0;
				part = path.substring(start, end ? undefined : i);
			}

			results.push(part);
			if (end)
				return new JsonPath(results);

			start = i + 1;
		}
	}

	readonly #path: readonly JsonPath.Segment[];
	#text?: string;
	#pointer?: string;

	get segments() {
		return this.#path;
	}

	get pointer() {
		return this.#pointer ??= '/' + Linq(this.segments).select(toPointer).joinText('/');
	}

	constructor(path: JsonPath.Segment[]) {
		this.#path = Object.freeze(path);
	}

	[Symbol.iterator](): IterableIterator<JsonPath.Segment> {
		return this.#path[Symbol.iterator]();
	}

	toString() {
		return this.#text ??= Linq(this.#path).select(JsonPath.escape).joinText('/');
	}
}

export const JsonPath: JsonPathConstructor = <any>new Proxy(Class, {
	construct(target, [path]: [Iterable<JsonPath.Segment>], newTarget) {
		const array: JsonPath.Segment[] = [];
		for (let segment of path) {
			if (!isArrayKey(segment)) 
				segment = String(segment);

			array.push(segment);
		}

		return Reflect.construct(<any>target, [array]);
	},
});

export default JsonPath;
