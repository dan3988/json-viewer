interface Renderer<T = any> {
	update(value: T): void;
	destroy?(): void;
}

abstract class AbstractRenderer<T> implements Renderer<T> {
	#target: null | HTMLElement;
	#value: any;

	constructor(target: HTMLElement, value: T) {
		this.#target = target;
		this.#value = value;
		this.onUpdate(target, value);
		this.update = this.update.bind(this);
		this.destroy = this.destroy.bind(this);
	}

	protected abstract onUpdate(target: HTMLElement, value: T): void;

	update(value: any): void {
		if (this.#value !== value && this.#target != null) {
			this.#value = value;
			this.#target.innerHTML = "";
			this.onUpdate(this.#target, value);
		}
	}

	destroy(): void {
		if (this.#target) {
			this.#target.innerHTML = "";
			this.#target = null;
		}
	}
}

const jsIdentifier = /^[$A-Z_][0-9A-Z_$]*$/igm;

function isIdentifier(text: string) {
	jsIdentifier.lastIndex = 0;
	return jsIdentifier.test(text);
}

class JsonValueRenderer extends AbstractRenderer<any> {
	protected onUpdate(target: HTMLElement, value: any): void {
		if (value === null || typeof value !== "string") {
			target.innerText = String(value);
		} else {
			if (value.startsWith("http://") || value.startsWith("https://")) {
				const a = document.createElement("a");
				const text = JSON.stringify(value);
				a.href = value;
				a.textContent = text;
				a.target = "_blank";
				target.append(a);
			} else {
				renderEscapedText(target, value);
			}
		}
	}
}

export function renderValue(target: HTMLElement, value: any): Renderer {
	return new JsonValueRenderer(target, value);
}

function appendSpan(parent: HTMLElement, className: string, text: string, start?: number, end?: number) {
	const span = document.createElement("span");
	span.textContent = start == null ? text : text.substring(start, end);
	span.className = className;
	parent.appendChild(span);
	return span;
}

function renderEscapedText(target: HTMLElement, value: string) {
	const json = JSON.stringify(value);

	let last = 1;
	let i = 1;

	appendSpan(target, "quot", "\"");

	while (true) {
		let next = json.indexOf("\\", i);
		if (next < 0) {
			appendSpan(target, "", json, last, json.length - 1);
			appendSpan(target, "quot", "\"");
			break;
		} else {
			if (last < next)
				appendSpan(target, "", json, last, last = next);

			let char = json.charAt(++last);
			if (char !== "u") {
				appendSpan(target, "esc", "\\" + char);
				last++;
			} else {
				appendSpan(target, "esc", json, next, last += 5);
			}

			i = last;
		}
	}
}

class JsonKeyRenderer extends AbstractRenderer<string | number> {
	protected onUpdate(target: HTMLElement, value: string | number): void {
		if (typeof value !== "string" || isIdentifier(value)) {
			target.innerText = value.toString();
		} else {
			renderEscapedText(target, value);
		}
	}
}

export function renderKey(target: HTMLElement, key: string | number): Renderer<string | number> {
	return new JsonKeyRenderer(target, key);
}

type ExtractFunctions<TObject extends object> = { [P in keyof TObject as TObject[P] extends Function ? P : never]?: TObject[P] extends (...args: infer A) => infer V ? (this: TObject, ...args: A) => V : never };
type ExtractAccessors<TObject extends object> = { [P in keyof TObject as TObject[P] extends Function ? never : P]?: Accessor<TObject, TObject[P]> };

interface Accessor<T, V> {
	get?(this: T): V;
	set?(this: T, value: V): void;
}

interface ClassDefs<T extends object> {
	accessors?: ExtractAccessors<T>
	functions?: ExtractFunctions<T>
}

function* allKeys(value: object): Iterable<string | symbol> {
	for (const key of Object.getOwnPropertyNames(value))
		yield key;

	for (const key of Object.getOwnPropertySymbols(value))
		yield key;
}

export function defValue<T extends object, K extends keyof T>(object: T, p: K, value: T[K], enumerable?: boolean, writable?: boolean, configurable?: boolean): void
export function defValue(object: object, p: PropertyKey, value: any, enumerable?: boolean, writable?: boolean, configurable?: boolean): void
export function defValue(object: object, p: PropertyKey, value: any, enumerable?: boolean, writable?: boolean, configurable?: boolean): void {
	Object.defineProperty(object, p, { value, enumerable, writable, configurable });
}

export function defFn<T extends object>(clazz: Constructor<T>, functions: ExtractFunctions<T>): void
export function defFn(clazz: Function, functions: any): void {
	for (const key of allKeys(functions)) {
		const fn = functions[key];
		defValue(fn, "name", key, false, false, true);
		defValue(clazz.prototype, key, fn, false, true, true);
	}
}

export function def<T extends object>(clazz: Constructor<T>, defs: ClassDefs<T>): void
export function def(clazz: Constructor<any>, { accessors, functions }: ClassDefs<any>): void {
	if (accessors) {
		for (const key in allKeys(accessors)) {
			const { get, set } = accessors[key]!;
			Object.defineProperty(clazz.prototype, key, { get, set, enumerable: true });
		}
	}

	if (functions)
		defFn(clazz, functions);
}
