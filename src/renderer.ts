import type json from "./json.js";
import type { Subscriber } from "svelte/store";
import JsonSearch from "./search.js";
import { isIdentifier } from "./util.js";

export type RendererFunction<T = any> = (target: HTMLElement, value: T) => Renderer<T>;

export interface Renderer<T = any> {
	update(value: T): void;
	destroy?(): void;
}

type RendererParameter<T extends Renderer> = T extends Renderer<infer V> ? V : never;

export abstract class AbstractRenderer<T> implements Renderer<T> {
	static create<T extends AbstractRenderer<any>>(this: new(target: HTMLElement, param: RendererParameter<T>) => T, target: HTMLElement, param: RendererParameter<T>): T {
		const instance = Reflect.construct(this, [target, param]);
		instance.onUpdate(target, param);
		return instance;
	}

	#target: null | HTMLElement;
	#param: any;

	constructor(target: HTMLElement, param: T) {
		this.#target = target;
		this.#param = param;
		//this.onUpdate(target, param);
		this.update = this.update.bind(this);
		this.destroy = this.destroy.bind(this);
	}

	protected abstract onUpdate(target: HTMLElement, param: T): void;

	protected invalidate(): void {
		if (this.#target) {
			this.#target.innerHTML = '';
			this.onUpdate(this.#target, this.#param);
		}
	}

	update(param: any): void {
		if (this.#param !== param && this.#target != null) {
			this.#param = param;
			this.#target.innerHTML = "";
			this.onUpdate(this.#target, param);
		}
	}

	destroy(): void {
		if (this.#target) {
			this.#target.innerHTML = "";
			this.#target = null;
		}
	}
}

export class PlainTextValueRenderer extends AbstractRenderer<JsonRendererParam> {
	protected onUpdate(target: HTMLElement, { value }: JsonRendererParam): void {
		target.innerText = String(value);
	}
}

export interface JsonRendererParam<T = any> {
	value: T;
	search?: JsonSearch;
	searchFlag: JsonSearch.Mode;
}

type JsonRendererFn<T = any> = RendererFunction<JsonRendererParam<T>>;

export abstract class AbstractJsonRenderer<T> extends AbstractRenderer<JsonRendererParam<T>> {
	#value: any;
	#searchFlag: JsonSearch.Mode = JsonSearch.Mode.None;
	#searchResult: null | string[] = null;
	#search?: JsonSearch;
	#unsub?: VoidFunction;
	#boundOnSearch: Subscriber<JsonSearch>;
	
	constructor(target: HTMLElement, param: JsonRendererParam<T>) {
		super(target, param);
		this.#boundOnSearch = this.#onSearch.bind(this);
	}

	#onSearch(search: JsonSearch) {
		let result: null | string[] = null;
		if (search.filter && (search.mode & this.#searchFlag))
			result = search.filter.split(this.#value);

		if (this.#searchResult === result)
			return;

		if (!arrayEqual(result, this.#searchResult)) {
			this.#searchResult = result;
			this.invalidate();
		}
	}

	destroy(): void {
		super.destroy();
		this.#unsub?.();
	}

	protected onUpdate(target: HTMLElement, { value, search, searchFlag }: JsonRendererParam<T>): void {
		this.#value = value;
		this.#searchFlag = searchFlag;

		if (this.#search != search) {
			this.#unsub?.();
			this.#search = search;
			this.#unsub = search?.listen(this.#boundOnSearch);
			this.#searchResult = search?.filter?.split(value) ?? null;
		}

		this.renderText(target, value, this.#searchResult);
	}

	protected abstract wrapString(target: HTMLElement, text: string): HTMLElement;

	protected renderText(target: HTMLElement, value: T, filter: null | string[]) {
		let render: (target: HTMLElement, value: string) => void;
		if (typeof value === 'string') {
			target = this.wrapString(target, value);
			render = renderEscapedString;
		} else {
			render = appendSpanIf;
		}

		if (filter) {
			if (filter.length === 1) {
				const mark = append('mark', target);
				render(mark, filter[0]);
			} else {
				let i = 0;
				while (true) {
					render(target, filter[i]);
					if (++i == filter.length)
						break;

					const mark = append('mark', target);
					render(mark, filter[i++]);
				}
			}
		} else {
			render(target, String(value));
		}
	}
}

export class JsonValueRenderer extends AbstractJsonRenderer<json.ValueType> {
	protected wrapString(target: HTMLElement, text: string): HTMLElement {
		target = append('span', target, 'quote');
		if (text.startsWith('http://') || text.startsWith('https://')) {
			const a = append('a', target);
			a.href = text;
			a.target = "_blank";
			target = a;
		}

		return target;
	}
}

export class JsonKeyRenderer extends AbstractJsonRenderer<string | number> {
	protected wrapString(target: HTMLElement, text: string): HTMLElement {
		return isIdentifier(text) ? target : append('span', target, 'quote');
	}
}

export const renderKey: JsonRendererFn<number | string> = AbstractRenderer.create.bind(JsonKeyRenderer);
export const renderValue: JsonRendererFn<number | string> = AbstractRenderer.create.bind(JsonValueRenderer);
export const renderText: JsonRendererFn = AbstractRenderer.create.bind(PlainTextValueRenderer);

function appendSpanIf(parent: HTMLElement, text: string, start?: number, end?: number) {
	if ((text = text.slice(start, end)))
		append('span', parent, '', text);
}

function append<E extends keyof HTMLElementTagNameMap>(tag: E, parent: HTMLElement, className: string = '', text?: string): HTMLElementTagNameMap[E] {
	const element = document.createElement(tag);
	if (text != null)
		element.textContent = text;

	if (className)
		element.className = className;

	parent.appendChild(element);
	return element;
}

const replacements = Object.setPrototypeOf({
	'"': '\\"',
	'\\': '\\\\',
	'\b': '\\b',
	'\f': '\\f',
	'\n': '\\n',
	'\r': '\\r',
	'\t': '\\t',
	'\v': '\\v',
	'\0': '\\0',
}, null);

function* range(start: number, end: number) {
	yield start;
	while (++start <= end)
		yield start;
}

for (const code of [
	...range(0, 0x07),
	...range(0x000e, 0x001f),
	...range(0x007f, 0x009f),
	...range(0x2000, 0x200f),
	...range(0x2028, 0x202f),
	...range(0x205f, 0x206f),
	0x3000,
	0xFEFF,
]) {
	const str = String.fromCharCode(code);
	replacements[str] = '\\u' + code.toString(16).padStart(4, '0');
}

function renderEscapedString(target: HTMLElement, text: string) {
	let last = 0;
	let i = 0;

	while (i < text.length) {
		const c = text[i];
		const replacement = replacements[c];
		if (replacement !== undefined) {
			appendSpanIf(target, text, last, i);
			append('span', target, 'esc', replacement);
			last = ++i;
		} else {
			i++;
		}
	}

	appendSpanIf(target, text, last);
}

function arrayEqual(x: Opt<any[]>, y: Opt<any[]>) {
	if (x === y)
		return true;

	if (x == null)
		return y == null;

	if (y == null || x.length != y.length)
		return false;

	for (let i = 0; i < x.length; i++)
		if (x[i] !== y[i])
			return false;

	return true;
}
