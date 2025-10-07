import type json from "./json";

function toLowerString(value: any) {
	return String.prototype.toLowerCase.call(value);
}

export class JsonSearch implements Iterable<json.Node> {
	static run(root: json.Node, text: string, mode: JsonSearch.Mode, caseSensitive: boolean) {
		const search = new JsonSearch(root, text, mode, caseSensitive);
		search.#apply();
		return search;
	}

	readonly #results = new Map<number, json.Node>;

	readonly #root: json.Node;
	readonly #text: string;
	readonly #mode: JsonSearch.Mode;
	readonly #caseSensitive: boolean;

	constructor(root: json.Node, text: string, mode: JsonSearch.Mode, caseSensitive: boolean) {
		this.#root = root;
		this.#text = text;
		this.#mode = mode;
		this.#caseSensitive = caseSensitive;
	}

	[Symbol.iterator](): IterableIterator<json.Node> {
		return this.#results.values();
	}

	has(id: number): boolean {
		return this.#results.has(id);
	}

	#apply() {
		const stringify = this.#caseSensitive ? String : toLowerString;
		const text = stringify(this.#text);
		const keys = !!(this.#mode & JsonSearch.Mode.Keys);
		const values = !!(this.#mode & JsonSearch.Mode.Values);
		this.#applyNode(this.#root, text, stringify, keys, values);
	}

	#applyNode(node: json.Node, text: string, stringify: (value: any) => string, keys: boolean, values: boolean) {
		let match: any = false;
		match ||= keys && node.key && stringify(node.key).includes(text);
		match ||= values && node.isValue() && stringify(node.value).includes(text);

		if (match) {
			this.#results.set(node.id, node);
		}

		for (const child of node)
			this.#applyNode(child, text, stringify, keys, values);
	}
}

export namespace JsonSearch {
	export const enum Mode {
		None,
		Keys = 1,
		Values = 2,
		Both = Keys | Values
	}
}

export default JsonSearch;