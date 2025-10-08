import type { Invalidator, Readable, Subscriber, Unsubscriber } from "svelte/store";
import type json from "./json";
import { StoreListeners } from "./store";

function toLowerString(value: any) {
	return String.prototype.toLowerCase.call(value);
}

export class JsonSearch implements Iterable<json.Node>, Readable<JsonSearch> {
	readonly #listeners = new StoreListeners<JsonSearch>;
	readonly #results = new Map<number, json.Node>;
	readonly #root: json.Node;

	#text: string = '';
	get text() {
		return this.#text;
	}

	set text(value) {
		if (this.#text !== value) {
			this.#text = value;
			this.#update();
		}
	}

	#mode = JsonSearch.Mode.Both;
	get mode() {
		return this.#mode;
	}

	set mode(value) {
		value &= JsonSearch.Mode.Both;
		if (this.#mode !== value) {
			this.#mode = value;
			this.#update();
		}
	}

	#caseSensitive = false;
	get caseSensitive() {
		return this.#caseSensitive;
	}

	set caseSensitive(value) {
		value = !!value;
		if (this.#caseSensitive !== value) {
			this.#caseSensitive = value;
			this.#update();
		}
	}

	constructor(root: json.Node) {
		this.#root = root;
	}

	subscribe(run: Subscriber<JsonSearch>, invalidate?: Invalidator<JsonSearch> | undefined): Unsubscriber {
		const unsub = this.#listeners.listen(run, invalidate);
		run(this);
		return unsub;
	}

	[Symbol.iterator](): IterableIterator<json.Node> {
		return this.#results.values();
	}

	has(id: number): boolean {
		return this.#results.has(id);
	}

	#update() {
		this.#results.clear();

		if (this.#text) {
			const stringify = this.#caseSensitive ? String : toLowerString;
			const text = stringify(this.#text);
			const keys = !!(this.#mode & JsonSearch.Mode.Keys);
			const values = !!(this.#mode & JsonSearch.Mode.Values);
			this.#checkNode(this.#root, text, stringify, keys, values);
		}

		this.#listeners.fire(this);
	}

	#checkNode(node: json.Node, text: string, stringify: (value: any) => string, keys: boolean, values: boolean) {
		let match: any = false;
		match ||= keys && node.key && stringify(node.key).includes(text);
		match ||= values && node.isValue() && stringify(node.value).includes(text);

		if (match) {
			this.#results.set(node.id, node);
		}

		for (const child of node)
			this.#checkNode(child, text, stringify, keys, values);
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