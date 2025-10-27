import type { Invalidator, Readable, Subscriber, Unsubscriber } from "svelte/store";
import type json from "./json";
import { StoreListeners } from "./store";

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

	get searchKeys() {
		return !!(this.#mode & JsonSearch.Mode.Keys);
	}

	get searchValues() {
		return !!(this.#mode & JsonSearch.Mode.Values);
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

	listen(run: Subscriber<JsonSearch>) {
		return this.#listeners.listen(run);
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
			f = '';
			let text = this.#text;
			if (text) {
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
			}

			this.#filterOrError = f;
		}

		if (typeof f !== 'string') {
			const keys = !!(this.#mode & JsonSearch.Mode.Keys);
			const values = !!(this.#mode & JsonSearch.Mode.Values);
			this.#checkNode(this.#root, f, keys, values, false);
		}

		this.#listeners.fire(this);
	}

	#checkNode(node: json.Node, filter: JsonSearch.Filter, keys: boolean, values: boolean, isObject: boolean) {
		let match: any = false;
		match ||= keys && isObject && node.key && filter.check(node.key);
		match ||= values && node.isValue() && filter.check(node.value);

		if (match) {
			this.#results.set(node.id, node);
		}

		isObject = node.isObject();
		for (const child of node)
			this.#checkNode(child, filter, keys, values, isObject);
	}
}

class TextFilter implements JsonSearch.Filter {
	readonly #text: string;
	readonly #matchCase: boolean;
	readonly #exactMatch: boolean;

	constructor(text: string, matchCase: boolean, exactMatch: boolean) {
		this.#text = matchCase ? text : text.toLowerCase();
		this.#matchCase = matchCase;
		this.#exactMatch = exactMatch;
	}

	check(value: any): boolean {
		let text = String(value);
		if (!this.#matchCase)
			text = text.toLowerCase();

		if (this.#exactMatch) {
			return this.#text === text;
		} else {
			return text.includes(this.#text)
		}
	}

	split(value: any): null | string[] {
		const search = this.#text;
		const text = String(value);
		const matcher = this.#matchCase ? text : text.toLowerCase();
		
		if (this.#exactMatch)
			return this.#text === matcher ? [text] : null;

		let i = matcher.indexOf(search);
		if (i < 0)
			return null;
		
		let last = 0;
		const results: string[] = [];
		while (true) {
			const end = i + search.length;
			const matchText = this.#matchCase ? search : text.slice(i, end);
			results.push(text.slice(last, i), matchText);

			last = end;
			i = matcher.indexOf(search, end);
			if (i < 0) {
				results.push(text.slice(end));
				return results;
			}
		}
	}
}

class RegexFilter implements JsonSearch.Filter {
	readonly #regex: RegExp;

	constructor(regex: RegExp) {
		this.#regex = regex;
	}

	check(value: any): boolean {
		return this.#regex.test(value);
	}
	
	split(value: any): null | string[] {
		const regex = this.#regex;
		let text = String(value);
		let match = regex.exec(text);
		if (!match)
			return null;

		const results: string[] = [];
		const prefix = text.slice(0, match.index);

		let [lastMatch] = match;
		results.push(prefix);
		text = text.slice(match.index + lastMatch.length);

		while (true) {
			match = regex.exec(text);
			if (!match)
				break;

			const [matchText] = match;
			if (match.index === 0) {
				lastMatch += matchText;
				text = text.slice(matchText.length);
				continue;
			}

			const prefix = text.slice(0, match.index);
			results.push(lastMatch, prefix);
			text = text.slice(match.index + matchText.length);
			lastMatch = matchText;
		}

		results.push(lastMatch, text);
		return results;
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
		split(text: any): null | string[];
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