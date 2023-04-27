<script lang="ts">
	import type { JsonProperty } from "../json";
	import type { ViewerModel } from "../viewer-model";
	import type { KeyCode } from "../keyboard";
	import * as dom from "./dom-helper";
	import AutocompleteHelper from "./autocomplete-helper";
	import Linq from "@daniel.pickett/linq-js";
	import { def } from "../util";

	export let model: ViewerModel;

	interface InputEventHelper extends InputEvent {
		target: HTMLElement;
		inputType: "insertText" | "deleteContentBackward" | "deleteContentForward" | "deleteWordBackward" | "deleteWordForward" | "historyUndo" | "historyRedo";
	}

	/** zero-width space */
	const zws = "\u200B";

	let dollar: HTMLLIElement;

	const selected = model.bag.readables.selected;

	function trimZws(node: Text) {
		let data = node.data;
		if (data.startsWith(zws)) {
			node.deleteData(0, 1);
		} else if (data.endsWith(zws)) {
			node.deleteData(data.length - 1, 1);
		}
	}

	function getContent(content: Element) {
		let text = content.textContent;
		return (!text || text === "\n" || text === zws) ? "" : text;
	}

	function appendPartNode(parent: Node, part: string | number) {
		const node = createPartNode(part);
		parent.appendChild(node);
		return node;
	}

	function createPartNode(part: string | number, array?: false): HTMLLIElement
	function createPartNode(part: string | number, array: true): [HTMLLIElement, HTMLDivElement, HTMLSpanElement, Text];
	function createPartNode(part: string | number, array?: boolean): any {
		const node = document.createTextNode(String(part));
		const span = document.createElement("span");
		span.classList.add(dollar.className, "content");
		span.appendChild(node);

		if (node.data === "") {
			node.data = zws;
			span.setAttribute("placeholder", "");
		}

		const wrapper = document.createElement("div");
		wrapper.classList.add(dollar.className, "wrapper");
		wrapper.appendChild(span)

		const slash = document.createElement("span");
		slash.innerText = "/";
		slash.className = dollar.className;

		const li = document.createElement("li");

		li.className = dollar.className;
		li.appendChild(slash);
		li.appendChild(wrapper);

		return array ? [li, wrapper, span, node] : li;
	}

	function getPartRoot(node: Node): null | HTMLLIElement {
		let e: Element;
		if (node instanceof Element) {
			e = node;
		} else if (node.parentElement == null) {
			return null;
		} else {
			e = node.parentElement;
		}
		
		if (e.tagName === "SPAN" && (e = e.parentElement!) == null)
			return null;
		
		if (e.tagName === "DIV" && (e = e.parentElement!) == null)
			return null;

		return e.tagName !== "LI" ? null : e as HTMLLIElement;
	}

	interface SelectionDetailsItem {
		text: Text;
		content: HTMLSpanElement;
		li: HTMLLIElement;
		start: number;
		length: number;

		toString(): string;
	}

	interface SelectionDetailsItemConstructor {
		readonly prototype: SelectionDetailsItem;
		new(text: Text, content: HTMLSpanElement, li: HTMLLIElement, start: number, length: number): SelectionDetailsItem;
	}

	const SelectionDetailsItem: SelectionDetailsItemConstructor = <any>function(text, content, li, start, length) {
		this.text = text;
		this.content =  content;
		this.li = li;
		this.start = start;
		this.length = length;
	}

	SelectionDetailsItem.prototype.toString = function toString(this: SelectionDetailsItem) {
		const { text, start, length } = this;
		return text.substringData(start, length);
	}

	interface SelectionDetails extends Iterable<SelectionDetailsItem> {
		readonly count: number;
		at(index: number): undefined | SelectionDetailsItem;
		toPath(): string[];
		toString(): string;
	}

	interface SelectionDetailsConstructor {
		(selection?: Selection): null | SelectionDetails;
		readonly prototype: SelectionDetails;
		new(): never;
	}

	const SelectionDetails: SelectionDetailsConstructor = <any>function(selection?: null | Selection) {
		if (selection == null) {
			selection = window.getSelection();

			if (selection == null)
				return null;
		}

		if (selection.rangeCount !== 1)
			return;
		
		const range = selection.getRangeAt(0);

		let start = range.startContainer;
		let end = range.endContainer;
		let startI = range.startOffset;
		let endI: number | undefined = range.endOffset;

		let startReal: null | HTMLLIElement = null;
		if (start instanceof Element && start.tagName === "UL") {
			startReal = start.children.item(startI) as HTMLLIElement;
			startI = 0;
		} else {
			startReal = getPartRoot(start);
		}

		let endReal: null | Element = null;
		if (end instanceof Element && end.tagName === "UL") {
			endReal = end.children.item(endI - 1) as HTMLLIElement;
			endI = undefined;
		} else {
			endReal = getPartRoot(end);
		}

		if (startReal == null || endReal == null)
			return;

		let details: SelectionDetailsItem[] = [];
		let current = startReal;

		while (current !== endReal) {
			const content = current.querySelector("span.content") as HTMLSpanElement;
			if (content == null)
				return;

			const text = content.firstChild as Text;

			details.push(new SelectionDetailsItem(text, content, current, startI, text.length - startI));

			if (current.nextElementSibling == null)
				return;
			
			startI = 0;
			current = current.nextElementSibling as HTMLLIElement;
		}

		const content = current.querySelector("span.content") as HTMLSpanElement;
		if (content == null)
			return;

		const text = content.firstChild as Text;

		details.push(new SelectionDetailsItem(text, content, current, startI, endI == undefined ? text.length : (endI - startI)));

		return Object.create(SelectionDetails.prototype, {
			_arr: { value: details }
		});
	}

	def(SelectionDetails, {
		accessors: {
			count: {
				get() {
					return (this as any)._arr.length;
				}
			}
		},
		functions: {
			at(index) {
				return (this as any)._arr.at(index);
			},
			toPath() {
				return Linq<SelectionDetailsItem>(this).select(v => v.toString()).toArray();
			},
			toString() {
				return this.toPath().join("/");
			},
			[Symbol.iterator]() {
				return (this as any)._arr[Symbol.iterator]();
			}
		}
	})

	function render(target: HTMLElement, selected: null | JsonProperty) {
		let autocomplete: undefined | AutocompleteHelper = undefined;

		function* getParts(end?: null | HTMLElement) {
			const first = target.firstElementChild;	
			if (first == null)
				return;

			for (let e = first.nextElementSibling; e != null && e != end; e = e.nextElementSibling) {
				const span = e.querySelector("span.content");
				if (span != null)
					yield getContent(span);
			}
		}

		function tryResolve(end?: null | HTMLElement): null | JsonProperty {
			let e = model.root;
			for (let part of getParts(end)) {
				const prop = e.value.getProperty(part);
				if (prop == null)
					return null;

				e = prop;
			}

			return e;
		}

		function destroyAutocomplete() {
			if (autocomplete) {
				autocomplete.destroy();
				autocomplete = undefined;
			}
		}

		function showAutocomplete(target: HTMLElement, content: Element, end?: HTMLLIElement) {
			const prop = tryResolve(end);
			if (prop == null || !prop.value.is("container")) {
				autocomplete?.destroy();
				autocomplete = undefined;
				return false;
			}

			const search = getContent(content).toLowerCase();
			const source = {
				[Symbol.iterator]: () => prop.value.keys()
			}

			if (autocomplete) {
				autocomplete.update(target, source, search)
			} else {
				autocomplete = new AutocompleteHelper(target, source, search);
			}
			
			return true;
		}

		type KeyHandler = Fn<[selction: Selection, range: Range, parent: HTMLLIElement, target: HTMLSpanElement], void | boolean, HTMLElement>;
		type KeyLookup = { [P in KeyCode]?: KeyHandler };

		function insertSectionAfter(selection: Selection, value: string, li: HTMLLIElement, span: HTMLSpanElement) {
			const [sibling, wrapper, content] = createPartNode(value, true);
			li.insertAdjacentElement("afterend", sibling)
			showAutocomplete(wrapper, content, sibling);	
			dom.setCaret(selection, content, 0, false);
		}

		const common: KeyLookup = {
			Backspace(selection, range, li, span) {
				if (range.endOffset > 0)
					return true;

				const prev = li.previousElementSibling;
				if (!prev || prev == dollar)
					return true;

				const txt = getContent(span);
				li.remove();
				if (txt) {
					const span = prev.querySelector("span.content") as HTMLSpanElement;
					const content = span.firstChild as Text;
					content.appendData(txt);
				}
				dom.setCaret(selection, prev, txt.length, true);
			},
			Delete(selection, range, li, span) {
				if (range.startOffset < span.innerText.length) 
					return true;

				const next = li.nextElementSibling;
				if (!next)
					return true;

				let end = 0;
				const txt = getContent(span);
				li.remove();
				if (txt) {
					const span = next.querySelector("span.content") as HTMLSpanElement;
					const content = span.firstChild as Text;
					end = content.data.length;
					content.insertData(0, txt);
				}
				dom.setCaret(selection, next, end, true);
			}
		}

		const ctrlHandlers: Record<string, KeyHandler> = {
			KeyA(selection, range) {
				range = document.createRange();
				range.setStartAfter(this.firstChild!);
				range.setEndAfter(this.lastChild!);

				selection.removeAllRanges();
				selection.addRange(range);
			}
		} satisfies KeyLookup;

		const handlers: Record<string, KeyHandler> = {
			Enter(selection, range, li, span) {
				if (autocomplete != null) {
					const target = autocomplete.target;
					if (autocomplete.complete()) {
						autocomplete = undefined;
						const prop = tryResolve(target);
						if (prop && prop.value.is("container"))
							insertSectionAfter(selection, "", li, span);
					}
				} else {
					const prop = tryResolve();
					if (prop)
						model.setSelected(prop, true, true);
				}
			},
			ArrowUp() {
				if (autocomplete == null)
					return true;

				autocomplete.prev();
			},
			ArrowDown() {
				if (autocomplete == null)
					return true;

				autocomplete.next();
			},
			Tab() {
				if (autocomplete != null) {
					autocomplete.complete();
					autocomplete = undefined;
				}
			},
			Slash(selection, range, li, span) {
				const text = getContent(span);
				const start = text.substring(0, range.startOffset);
				const end = text.substring(range.endOffset);

				destroyAutocomplete();

				if (!(start || end))
					return;

				const next = li.nextSibling;
				if (start && end || next == null) {
					span.innerText = start;
					insertSectionAfter(selection, end, li, span);
				} else if (start) {
					if (span.innerText !== start)
						span.innerText = start;
				} else if (end) {
					if (span.innerText !== end)
						span.innerText = end;
				}
			}
		} satisfies KeyLookup;

		Object.setPrototypeOf(ctrlHandlers, common);
		Object.setPrototypeOf(handlers, common);

		function update(newValue: null | JsonProperty) {
			selected = newValue;
			dollar ??= target.firstElementChild as HTMLLIElement;
			target.innerHTML = "";
			target.appendChild(dollar);

			if (selected) {
				const { path } = selected;
				for (var i = 1; i < path.length; i++)
					appendPartNode(target, path[i]);
			} else {
				appendPartNode(target, "");
			}
		}

		function onCopy(e: HTMLElement, data: DataTransfer, cut: boolean) {
			const selection = dom.getSelectionFor(e);
			if (selection == null)
				return;

			const det = SelectionDetails(selection);
			if (det == null)
				return;

			const path = det.toPath();

			data.setData("application/jsonpath", JSON.stringify(path));
			data.setData("text/plain", path.join("/"))

			if (cut)
				selection.deleteFromDocument();
		}

		const unsub = dom.subscribe(target, {
			keydown(evt) {
				if (evt.keyCode === 17 || evt.keyCode === 16)
					return;

				const selection = dom.getSelectionFor(this);
				if (selection == null)
					return evt.ctrlKey ? undefined : evt.preventDefault();

				const range = selection.getRangeAt(0);
				if (range.commonAncestorContainer === this)
					return;

				let span: HTMLSpanElement;
				for (let e: Node = range.commonAncestorContainer; ;) {
					if (e instanceof HTMLSpanElement && e.classList.contains(dollar.className)) {
						span = e;
						break;
					}

					if ((e = e.parentNode!) == this)
						return evt.preventDefault();
				}

				if (span.classList.contains("content")) {
					const handler = (evt.ctrlKey ? ctrlHandlers : handlers)[evt.code];
					const cancel = handler && !handler.call(this, selection, range, span.closest("li"), span);
					if (cancel)
						evt.preventDefault();
				} else if (evt.key.length === 1 || evt.key === "Delete" || evt.key === "Backspace") {
					evt.preventDefault();
				}
			},
			input(evt: InputEventHelper) {
				console.debug(evt.inputType);
				const selection = dom.getSelectionFor(this);
				if (selection == null)
					return;

				let range = selection.getRangeAt(0);
				let e: null | Node = range.commonAncestorContainer;
				while (!(e instanceof HTMLElement))
					if ((e = e.parentElement) == null)
						return;

				if (e.hasAttribute("placeholder")) {
					const node = e.firstChild;
					if (node instanceof Text) {
						e.removeAttribute("placeholder");
						trimZws(node);
					}
				}

				const wrapper = e.parentElement as HTMLDivElement;
				showAutocomplete(wrapper, e, wrapper.parentElement as any);
			},
			focusout() {
				if (!(window as any).ignorefocus)
					update(selected);
			},
			copy(evt) {
				evt.clipboardData && onCopy(this, evt.clipboardData, false);
				evt.preventDefault();
			},
			cut(evt) {
				evt.clipboardData && onCopy(this, evt.clipboardData, true);
				evt.preventDefault();
			}
		})

		update(selected);

		return {
			update,
			destroy() {
				target.innerHTML = "";
				target.appendChild(dollar);
				unsub();
			},
		};
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.list {
		outline: none;
		grid-area: 1 / 1 / span 1 / span 1;
		display: flex;
		flex-direction: row;
		user-select: none;

		> li {
			display: flex;
			flex-direction: row;
			align-items: center;

			> .wrapper {
				position: relative;
				
				> span.content {
					margin: 0 $pad-med;
					display: block;
					outline: none;
					min-width: 1em;
				}
			}
		}
	}
</style>
<ul class="list" contenteditable="true" use:render={$selected}>
	<li contenteditable="false">
		<div class="wrapper">
			<span class="content">$</span>
		</div>
	</li>
</ul>