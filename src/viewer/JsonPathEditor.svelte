<script lang="ts">
	import type { JsonProperty } from "./json";
	import type { ViewerModel } from "./viewer-model";
    import type { KeyCode } from "../keyboard";
	import * as sh from "./selection-helper";
    import AutocompleteHelper from "./autocomplete-helper";

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
			node.data = data.substring(1);
		} else if (data.endsWith(zws)) {
			node.data = data.substring(0, data.length - 1);
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

	function render(target: HTMLElement, selected: null | JsonProperty) {
		let autocomplete: undefined | AutocompleteHelper = undefined;

		function* getParts(end?: HTMLLIElement) {
			const first = target.firstElementChild;	
			if (first == null)
				return;

			for (let e = first.nextElementSibling; e != null && e != end; e = e.nextElementSibling) {
				const span = e.querySelector("span.content");
				if (span != null)
					yield getContent(span);
			}
		}

		function tryResolve(end?: HTMLLIElement): null | JsonProperty {
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
			const suggestions: string[] = [];
			const prop = tryResolve(end);
			if (prop == null || !prop.value.is("container")) {
				autocomplete?.destroy();
				autocomplete = undefined;
				return false;
			}

			const search = getContent(content).toLowerCase();
			if (search) {
				for (const key of prop.value.keys()) {
					const str = String(key);
					if (str.toLowerCase().includes(search))
						suggestions.push(str);
				}
			} else {
				for (const key of prop.value.keys())
					suggestions.push(String(key));
			}

			if (autocomplete) {
				autocomplete.update(target, suggestions)
			} else {
				autocomplete = new AutocompleteHelper(target, suggestions);
			}
			
			return true;
		}

		type KeyHandler = Fn<[selction: Selection, range: Range, parent: HTMLLIElement, target: HTMLSpanElement], void | boolean, HTMLElement>;
		type KeyLookup = { [P in KeyCode]?: KeyHandler };

		const ctrlHandlers: Record<string, KeyHandler> = {
			KeyA(selection, range) {
				range = document.createRange();
				range.selectNode(this);
				selection.removeAllRanges();
				selection.addRange(range);
			}
		} satisfies KeyLookup;

		const handlers: Record<string, KeyHandler> = {
			Backspace(selection, range, li, span) {
				const txt = getContent(span);
				if (txt)
					return true;

				const prev = li.previousElementSibling;
				li.remove();
				if (prev)
					sh.setCaret(prev, 0, true);
			},
			Enter() {
				if (autocomplete != null) {
					autocomplete.complete();
					autocomplete = undefined;
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
			Slash(selection, range, li, span) {
				const text = span.innerText;
				const start = text.substring(0, range.startOffset);
				const end = text.substring(range.endOffset);

				destroyAutocomplete();

				const next = li.nextSibling;
				if (start && end || next == null) {
					span.innerText = start;
					const [sibling, wrapper, content, text] = createPartNode(end, true);
					target.insertBefore(sibling, next);
					//setTimeout(() => range.setStart(sibling.firstChild!, 0), 10);
					
					sh.setCaret(selection, text, 0, true);
					if (!end)
						showAutocomplete(wrapper, content, sibling);

				} else if (start) {
					if (span.innerText !== start)
						span.innerText = start;
				} else if (end) {
					if (span.innerText !== end)
						span.innerText = end;
				}
			}
		} satisfies KeyLookup;

		function onKeyDown(this: HTMLElement, evt: KeyboardEvent) {
			const selection = sh.getSelectionFor(this);
			if (selection == null)
				return evt.preventDefault();

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
				const cancel = handler && !handler.call(this, selection, range, span.parentElement as HTMLLIElement, span);
				if (cancel)
					evt.preventDefault();
			} else if (evt.key.length === 1 || evt.key === "Delete" || evt.key === "Backspace") {
				evt.preventDefault();
			}

		}

		function onInput(this: HTMLElement, evt: InputEventHelper) {
			console.debug(evt.inputType);

			const selection = sh.getSelectionFor(this);
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
			const { inputType } = evt;
			switch (inputType) {
				case "insertText": 
					showAutocomplete(wrapper, e, wrapper.parentElement as any);
					break;
			}
		}

		function update(selected: null | JsonProperty) {
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

		update(selected);

		target.addEventListener("keydown", onKeyDown);
		target.addEventListener("input", onInput);

		return {
			update,
			destroy() {
				target.innerHTML = "";
				target.appendChild(dollar);
				target.removeEventListener("keydown", onKeyDown);
				target.removeEventListener("input", onInput);
			},
		};
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.list {
		@include font-elem;

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