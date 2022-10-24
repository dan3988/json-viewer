export type HTMLTagName = string & keyof HTMLElementTagNameMap;

type ElementType<K extends string> = K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : Element;
type OptionsType<K extends string> = HTMLElementCreationOptions<ElementType<K>>

export type ElementInitArgs<K extends string = string> = [tagName: K, options?: OptionsType<K>];
export type ElementChild = Node | HTML | string | ElementInit<any>;

export interface HTMLElementCreationOptions<T extends Element = Element> extends ElementCreationOptions {
	id?: string;
	class?: string | string[];
	html?: string;
	textNodeOptions?: string | ElementInitArgs;
	props?: { [P in keyof T]?: T[P] };
	children?: ElementChild[];
	events?: EventsObject<T>;
}

export type EventsObject<T extends Element> = {
	[P in keyof HTMLElementEventMap]?: (this: T, e: HTMLElementEventMap[P]) => void;
}

type TextNodeFactory = (this: Document, text: string) => Node;

interface Cache {
	tf: TextNodeFactory;
	dp: DOMParser;
}

type OptionHandler<E extends Element, K extends string & keyof HTMLElementCreationOptions<E>> = (e: E, value: Exclude<HTMLElementCreationOptions<E>[K], undefined>, cache: Cache, options: HTMLElementCreationOptions<E>) => void;

let createTextFactory = function (options: HTMLElementCreationOptions): TextNodeFactory {
	let { textNodeOptions } = options;
	if (textNodeOptions == null) {
		return Document.prototype.createTextNode;
	} else if (Array.isArray(textNodeOptions)) {
		const [ tagName, init ] = textNodeOptions;
		return function (txt) {
			const e = createElement(this, tagName, init);
			e.textContent = txt;
			return e;
		}
	} else {
		return function (txt) {
			let e = this.createElement(textNodeOptions as any);
			e.textContent = txt;
			return e;
		}
	}
}

type InitHandlers = {
	[P in keyof HTMLElementCreationOptions]: OptionHandler<Element, P>
}

let initHandlers: InitHandlers = {
	id(e, value) {
		e.id = value
	},
	class(e, value) {
		if (Array.isArray(value)) {
			e.classList.add(...value);
		} else {
			e.className = value;
		}
	},
	html(e, value, cache) {
		let parser = cache.dp ??= new DOMParser();
		let doc = parser.parseFromString(value, 'text/html');

		for (let c = doc.body.firstChild; c != null;) {
			let next = c.nextSibling;
			e.appendChild(c);
			c = next;
		}
	},
	props(e, props) {
		Object.assign(e, props);
	},
	events(e, events) {
		for (let key in events)
			e.addEventListener(key, (<any>events)[key]);
	},
	children(e, children, cache, options) {
		for (let child of children) {
			/** @type {Node} */
			let node;

			if (child instanceof ElementInit) {
				node = createElement(e.ownerDocument, child.tagName, child.init);
			} else if (child instanceof Node) {
				node = child;
			} else if (child instanceof HTML) {
				node = child.element;
			} else {
				let factory = cache.tf ??= createTextFactory(options);
				node = factory.call(e.ownerDocument, child);
			}

			e.appendChild(node);
		}
	}
}

function createElement(tagName: string, options?: HTMLElementCreationOptions): HTMLElement;
function createElement<K extends HTMLTagName>(tagName: K, options?: OptionsType<K>): ElementType<K>;
function createElement(document: Document, tagName: string, options?: HTMLElementCreationOptions): HTMLElement;
function createElement(arg0: any, arg1?: any, arg2?: any) {
	let document = window.document;
	let tagName: string;
	let options: any;
	if (typeof arg0 === "string") {
		tagName = arg0;
		options = arg1;
	} else {
		document = arg0;
		tagName = arg1;
		options = arg2;
	}

	let e = document.createElement(tagName, options);
	if (options != null) {
		let cache: any = {};

		for (let key in options) {
			let value = options[key];
			if (value == null)
				continue;

			let handler = initHandlers[key as keyof InitHandlers];
			if (handler)
				handler(e, value, cache, options);
		}
	}

	return e;
}

export interface ElementInit<K extends string = string> {
	tagName: K;
	init: undefined | OptionsType<K>;
}

export interface ElementInitConstructor {
	readonly prototype: ElementInit<string>;
	new <K extends HTMLTagName>(tagName: K, init?: HTMLElementCreationOptions<HTMLElementTagNameMap[K]>): ElementInit<K>;
	new(tagName: string, init?: HTMLElementCreationOptions): ElementInit<string>;
}

export interface HTML<T extends Element = Element> {
	readonly element: T;

	append<K extends HTMLTagName>(tagName: K, options?: OptionsType<K>): HTML<ElementType<K>>;
	append<N extends Element>(node: N): HTML<N>;

	removeAll(): void;

	on<K extends string & keyof HTMLElementEventMap>(type: K, listener: (this: this, event: HTMLElementEventMap[K]) => any): this;
	once<K extends string & keyof HTMLElementEventMap>(type: K, listener: (this: this, event: HTMLElementEventMap[K]) => any): this;
	off<K extends string & keyof HTMLElementEventMap>(type: K, listener: (this: this, event: HTMLElementEventMap[K]) => any): this;
}

export var ElementInit: ElementInitConstructor = <any>function (this: ElementInit, tagName: string, init?: HTMLElementCreationOptions) {
	this.tagName = tagName;
	this.init = init;
}

interface HTMLFunction {
	readonly prototype: HTML;
	<T extends Element>(element: T): HTML<T>;
	<K extends HTMLTagName>(tagName: K, options?: OptionsType<K>): HTML<ElementType<K>>;
}

export interface HTMLConstructor extends HTMLFunction {
	createElement<K extends HTMLTagName>(tagName: K, options?: OptionsType<K>): ElementType<K>;
}

const onceArg = { once: true };
const html: HTMLFunction = function HTML(element: string | Element, options?: HTMLElementCreationOptions): HTML {
	if (typeof element == "string")
		element = createElement(document, element, options);

	return createHtml(element);
}

function def<T, K extends keyof T>(self: T, key: K, func: T[K] extends Fn<infer A, infer R> ? Fn<A, R, T> : never): void {
	Object.defineProperty(func, 'name', {
		configurable: true,
		value: key.toString()
	});

	Object.defineProperty(self, key, {
		configurable: true,
		writable: true,
		value: func
	});
}

function createHtml(e: Element) {
	const result = Object.create(html.prototype);

	Object.defineProperty(result, "element", {
		enumerable: true,
		value: e
	});

	return result;
}

export var HTML: HTMLConstructor = <any>html;
export default HTML;

def(HTML, 'createElement', createElement);

def(html.prototype, 'append', function(arg0: any, arg1?: any) {
	const e = createElement(document, arg0, arg1);
	this.element.appendChild(e);
	return createHtml(e);
})

def(html.prototype, 'removeAll', function() {
	this.element.innerHTML = "";
})

def(html.prototype, 'on', function(type, listener) {
	this.element.addEventListener(type, listener);
	return this;
})

def(html.prototype, 'once', function(type, listener) {
	this.element.addEventListener(type, listener, onceArg);
	return this;
})

def(html.prototype, 'off', function(type, listener) {
	this.element.removeEventListener(type, listener);
	return this;
})