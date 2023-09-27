import type { KeyCode } from "../keyboard.d.ts";
import { delegate } from "../util";

interface CaretFinder {
	start(node: Node): Node | null;
	next(node: Node): Node | null;
	match(text: Text, range: Range, current: number, target: number): number;
}

type FlagsAsString<T extends any[]> = Join<"|", Combinations<T>>;

type Join<S extends string, T extends string[]> = T extends [infer X, ...infer Y] ? (X extends string ? (Y extends string[] ? __Join<S, Y, `${X}`> : never) : never) : '';
type __Join<S extends string, T extends string[], Prev extends string> = T extends [infer X, ...infer Y] ? (X extends string ? (Y extends string[] ? __Join<S, Y, `${Prev}${S}${X}`> : never) : never) : Prev;

type Combinations<T extends any[]> = Exclude<__Combinations<T>, []>;
type __Combinations<T extends any[]> = T extends [infer Head, ...infer Tail] ? [Head, ...__Combinations<Tail>] | __Combinations<Tail> : [];

function resolve(finder: CaretFinder, range: Range, node: Node, index: number, target: number): boolean {
	if (node instanceof Text) {
		return finder.match(node, range, index, target) < 0
	} else {
		for (let n = finder.start(node); n != null; n = finder.next(n))
			if (resolve(finder, range, n, index, target))
				return true;
	
		return false;
	}
}

const cfForward: CaretFinder = {
	start(node) {
		return node.firstChild;
	},
	next(node) {
		return node.nextSibling;
	},
	match(text, range, current, target) {
		const data = text.data;
		const next = current + data.length
		if (next < target)
			return next;

		const pos = current - target;
		range.setStart(text, pos);
		range.setEnd(text, pos);
		return -1;
	}
}

const cfBackward: CaretFinder = {
	start(node) {
		return node.lastChild;
	},
	next(node) {
		return node.previousSibling;
	},
	match(text, range, current, target) {
		const data = text.data;
		if ((current -= data.length) <= 0) {
			current = -current;
			range.setStart(text, current);
			range.setEnd(text, current);
			return -1;
		}

		return current;
	}
}

function isDescendantImpl<T extends { [P in K]: T | null }, K extends string>(self: T, parent: T, key: K) {
	while (true) {
		const next = self[key];
		if (next == null)
			return false;

		if (next == parent)
			return true;

		self = next;
	}
}

enum KeyModifiers {
	None	= 0,
	Ctrl	= 1 << 0,
	Shift	= 1 << 1,
	Alt		= 1 << 2,
	Meta	= 1 << 3
}

type InternalKeyMappingHandler<T> = (this: T, modif: KeyModifiers, evt: KeyboardEvent) => void | boolean;

function getModifier(evt: KeyboardEvent) {
	let modif = KeyModifiers.None;
	if (evt.ctrlKey)
		modif |= KeyModifiers.Ctrl;

	if (evt.shiftKey)
		modif |= KeyModifiers.Shift;

	if (evt.altKey)
		modif |= KeyModifiers.Alt;

	if (evt.metaKey)
		modif |= KeyModifiers.Meta;

	return modif;
}

function wrapHandler<T>(modif: KeyModifiers, handler: dom.KeyMappingHandler<T>): InternalKeyMappingHandler<T> {
	return function(evtModif, evt) {
		return (evtModif === modif) && handler.call(this, evt);
	}
}

function parseModifiers(modif: string): KeyModifiers {
	let flags = KeyModifiers.None;

	for (const text of modif.split("|")) {
		switch (text.toLowerCase()) {
			case "ctrl":
				flags |= KeyModifiers.Ctrl;
				break;
			case "shift":
				flags |= KeyModifiers.Shift;
				break;
			case "alt":
				flags |= KeyModifiers.Alt;
				break;
			case "meta":
				flags |= KeyModifiers.Meta;
				break;
			default:
				throw new TypeError(`Unknown key modifier: ${text}`);
		}
	}

	return flags;
}

export namespace dom {
	export function getSelectionFor(element: HTMLElement): null | Selection {
		const selection = window.getSelection();
		if (selection && selection.focusNode && isDescendantNode(selection.focusNode, element))
			return selection;
	
		return null;
	}
	
	export function setCaret(node: Node, index: number, fromEnd?: boolean): Range | undefined
	export function setCaret(selection: Selection, node: Node, index: number, fromEnd?: boolean): Range | undefined
	export function setCaret(...args: any[]) {
		const selection: Selection = args[0] instanceof Selection ? args.shift() : window.getSelection();
		const [node, index, fromEnd]: [Node, number, boolean?] = args as any;
		const range = document.createRange();
		const finder = fromEnd ? cfBackward : cfForward;
		if (!resolve(finder, range, node, index, index))
			return undefined;
	
		selection.removeAllRanges();
		selection.addRange(range);
		return range;
	}

	export function isDescendantNode(self: Node, parent: Node) {
		return isDescendantImpl(self, parent, "parentNode");
	}

	export function isDescendant(self: Element, parent: Element) {
		return isDescendantImpl(self, parent, "parentElement");
	}

	export type KeyMappingHandler<T> = (this: T, evt: KeyboardEvent) => void | boolean;
	export type KeyMappingHandlerObject<T> = { [K in KeyMofifierText]?: KeyMappingHandler<T> };
	export type KeyMappingInit<T> = { [P in Uncapitalize<KeyCode>]?: KeyMappingHandler<T> | KeyMappingHandlerObject<T> };

	export type KeyMofifierText = "none" | FlagsAsString<["ctrl", "shift", "alt", "meta"]>;

	export function keymap<T extends HTMLElement>(target: T, mapping: KeyMappingInit<T>): Action {
		const ac = new AbortController();
		const { signal } = ac;
		const opts = { signal };
		const map = new Map<string, InternalKeyMappingHandler<T>[]>();

		for (const [key, handler] of Object.entries(mapping)) {
			const lw = key.toLowerCase();
			let list = map.get(lw);
			if (list == null)
				map.set(lw, list = []);

			if (typeof handler === "function") {
				list.push(wrapHandler(0, handler));
			} else {
				for (const [modifText, value] of Object.entries(handler!)) {
					const modif = parseModifiers(modifText);
					const handler = wrapHandler(modif, value);
					list.push(handler);
				}
			}
		}

		function handler(this: T, evt: KeyboardEvent) {
			const key = evt.code.toLowerCase();
			const handlers = map.get(key);
			if (handlers == null)
				return;

			const modif = getModifier(evt);
			for (const handler of handlers) {
				if (handler.call(this, modif, evt)) {
					evt.preventDefault();
					break;
				}
			}
		}

		target.addEventListener("keydown", handler, opts);
		return delegate(ac, "abort");
	}
}

export default dom;