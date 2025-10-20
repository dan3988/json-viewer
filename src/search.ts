import type { Invalidator, Readable, Subscriber, Unsubscriber } from "svelte/store";
import type json from "./json";
import { StoreListeners } from "./store";

function toLowerString(value: any) {
	return String.prototype.toLowerCase.call(value);
}

function isEqual(filter: string, value: string) {
	return filter === value;
}

function contains(filter: string, value: string) {
	return value.includes(filter);
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
			this.#update(true);
		}
	}

	#isRegex = false;
	get isRegex() {
		return this.#isRegex;
	}

	set isRegex(value) {
		value = !!value;
		if (this.#isRegex !== value) {
			this.#isRegex = value;
			this.#update(true);
		}
	}

	#isCaseSensitive = false;
	get isCaseSensitive() {
		return this.#isCaseSensitive;
	}

	set isCaseSensitive(value) {
		value = !!value;
		if (this.#isCaseSensitive !== value) {
			this.#isCaseSensitive = value;
			this.#update(true);
		}
	}

	#isExactMatch = false;
	get isExactMatch() {
		return this.#isExactMatch;
	}

	set isExactMatch(value) {
		value = !!value;
		if (this.#isExactMatch !== value) {
			this.#isExactMatch = value;
			this.#update(true);
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

	#filterOrError: JsonSearch.Filter | string = '';
	get filter(): JsonSearch.Filter | null {
		const v = this.#filterOrError;
		return typeof v === 'string' ? null : v;
	}

	get error(): string {
		const v = this.#filterOrError;
		return typeof v === 'string' ? v : '';
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

	#update(recompile: boolean = false) {
		this.#results.clear();

		let f = this.#filterOrError;
		if (recompile) {
			let text = this.#text;
			if (this.#isRegex) {
				if (this.#isExactMatch)
					text = `^${text}$`;

				const flag = this.#isCaseSensitive ? '' : 'i';
				try {
					const regex = new RegExp(text, flag);
					f = new RegexFilter(regex);
				} catch (error) {
					f = getRegexError(error, text, flag);
				}
			} else {
				f = new TextFilter(text, this.#isCaseSensitive, this.#isExactMatch);
			}

			this.#filterOrError = f;
		}

		if (typeof f !== 'string') {
			const keys = !!(this.#mode & JsonSearch.Mode.Keys);
			const values = !!(this.#mode & JsonSearch.Mode.Values);
			this.#checkNode(this.#root, f, keys, values);
		}

		this.#listeners.fire(this);
	}

	#checkNode(node: json.Node, filter: JsonSearch.Filter, keys: boolean, values: boolean) {
		let match: any = false;
		match ||= keys && node.key && filter.check(node.key);
		match ||= values && node.isValue() && filter.check(node.value);

		if (match) {
			this.#results.set(node.id, node);
		}

		for (const child of node)
			this.#checkNode(child, filter, keys, values);
	}
}

class TextFilter implements JsonSearch.Filter {
	readonly #text: string;
	readonly #compare: (filter: string, value: string) => boolean;
	readonly #stringify: (value: any) => string;

	constructor(text: string, matchCase: boolean, exactMatch: boolean) {
		if (matchCase) {
			this.#text = text;
			this.#stringify = String;
		} else {
			this.#text = text.toLowerCase();
			this.#stringify = toLowerString;
		}

		this.#compare = exactMatch ? isEqual : contains;
	}

	check(text: any): boolean {
		text = this.#stringify(text);
		return this.#compare(this.#text, text);
	}
}

class RegexFilter implements JsonSearch.Filter {
	readonly #regex: RegExp;

	constructor(regex: RegExp) {
		this.#regex = regex;
	}

	check(text: any): boolean {
		return this.#regex.test(text);
	}
}

export namespace JsonSearch {
	export const enum Mode {
		None,
		Keys = 1,
		Values = 2,
		Both = Keys | Values
	}

	export interface Filter {
		check(text: any): boolean;
	}
}

function getRegexError(error: any, pattern: string, flags: string) {
	if (!(error instanceof Error))
		return String(error);

	let { message } = error;
	if (error instanceof SyntaxError && message.startsWith('Invalid regular expression: ')) {
		message = message.substring(32 + pattern.length + flags.length);
	}

	return message;
}

export default JsonSearch;