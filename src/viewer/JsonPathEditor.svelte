<script lang="ts">
	import SuggestionList from "./SuggestionList.svelte";
	import type { JsonProperty } from "./json";
	import type { ViewerModel } from "./viewer-model";
    import type { KeyCode } from "../keyboard";

	export let model: ViewerModel;

	interface InputEventHelper extends InputEvent {
		target: HTMLElement;
		inputType: "insertText";
	}

	let dollar: HTMLLIElement;

	const selected = model.bag.readables.selected;

	function getSelectionFor(element: HTMLElement): null | Selection {
		const selection = window.getSelection();
		if (selection != null)
			for (let node = selection.focusNode; node != null; node = node.parentNode)
				if (node == element)
					return selection;

		return null;
	}

	function createPartNode(part: string | number) {
		const str = String(part);
		const e = document.createElement("span");
		e.innerText = str;
		e.classList.add(dollar.className, "content");
		e.contentEditable = "true";

		const slash = document.createTextNode("/");
		const li = document.createElement("li");

		li.contentEditable = "false";
		li.className = dollar.className;
		li.appendChild(slash);
		li.appendChild(e);
		return li;
	}

	function getPath(e: HTMLSpanElement) {
		const list: string[] = [];
		let parent = e.parentElement;
		while ((parent = parent?.previousElementSibling as any) != null) {
			const span = parent.querySelector("span")!;
			list.unshift(span.innerText);
		}

		return list;
	}

	interface AutocompleteHelper {
		next(): void;
		prev(): void;

		complete(): boolean;
		destroy(): void;
	}

	interface AutocompleteHelperClass extends AutocompleteHelper {
		readonly _list: SuggestionList;
		readonly _target: HTMLElement;
	}

	function AutocompleteHelper(target: HTMLElement, suggestions: readonly string[]) {
		this._target = target;
		this._list = new SuggestionList({
			target, props: { suggestions }
		});
	}

	AutocompleteHelper.prototype.next = function next(this: AutocompleteHelperClass) {
		this._list.next();
	}

	AutocompleteHelper.prototype.prev = function prev(this: AutocompleteHelperClass) {
		this._list.prev();
	}

	AutocompleteHelper.prototype.destroy = function destroy(this: AutocompleteHelperClass) {
		this._list.$destroy();
	}

	AutocompleteHelper.prototype.complete = function complete(this: AutocompleteHelperClass) {
		const selected = this._list.getSelected();
		this.destroy();
		if (selected == null) {
			return false;
		} else {
			const el = this._target;
			const span = el.querySelector("span")!;
			span.innerText = selected;
			const range = document.createRange();
			range.selectNode(span);
			range.collapse(false);
			const selection = getSelection()!;
			selection.removeAllRanges();
			selection.addRange(range);
			return true;
		}
	}

	function render(target: HTMLElement, selected: null | JsonProperty) {
		let autocomplete: undefined | AutocompleteHelper = undefined;

		function destroyAutocomplete() {
			if (autocomplete) {
				autocomplete.destroy();
				autocomplete = undefined;
			}
		}

		function showAutocomplete(target: HTMLElement) {
			const suggestions: string[] = [];
			const path = getPath(target);
			const prop = model.resolve(path);
			if (prop == null || !prop.value.is("container")) {
				autocomplete?.destroy();
				autocomplete = undefined;
				return false;
			}

			const search = target.innerText.toLowerCase();
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
			
			autocomplete?.destroy();
			autocomplete = new AutocompleteHelper(target.parentElement!, suggestions);
			return true;
		}

		type KeyHandler = Fn<[selction: Selection, range: Range, parent: HTMLLIElement, target: HTMLSpanElement], void | boolean, HTMLElement>;
		type KeyLookup = { [P in KeyCode]?: KeyHandler };

		const ctrlHandlers: Record<string, KeyHandler> = {
			KeyA(selection, range, li, span) {
				range = document.createRange();
				range.selectNode(this);
				selection.removeAllRanges();
				selection.addRange(range);
			}
		} satisfies KeyLookup;

		const handlers: Record<string, KeyHandler> = {
			Enter() {
				if (autocomplete != null) {
					autocomplete.complete();
					autocomplete = undefined;
				} else {
					let parts: string[] = [];
					for (let child of this.childNodes)
						parts.push(child.textContent!);

					if (!model.select(parts, true))
						update(selected)
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

				if (start && end || li.nextSibling == null) {
					span.innerText = start;
					const sibling = createPartNode(end);
					const content = sibling.firstElementChild as HTMLSpanElement;
					target.insertBefore(sibling, li.nextSibling);
					//setTimeout(() => range.setStart(sibling.firstChild!, 0), 10);
					
					const newRange = document.createRange();
					newRange.selectNodeContents(content);
					newRange.collapse(true);
					selection.removeRange(range);
					selection.addRange(newRange);

					if (newRange.startOffset == 0)
						showAutocomplete(content);

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
			const handler = (evt.ctrlKey ? ctrlHandlers : handlers)[evt.code];
			if (handler == null)
				return;

			const selection = getSelectionFor(this);
			if (selection == null)
				return evt.preventDefault();

			const range = selection.getRangeAt(0);
			if (range.commonAncestorContainer === this)
				return;

			let span: HTMLSpanElement;
			for (let e: Node = range.commonAncestorContainer; ;) {
				if (e instanceof HTMLSpanElement && e.classList.contains(dollar.className) && e.classList.contains("content")) {
					span = e;
					break;
				}

				if ((e = e.parentNode!) == this)
					return evt.preventDefault();
			}

			const result = handler.call(this, selection, range, span.parentElement as HTMLLIElement, span);
			if (!result)
				evt.preventDefault();
		}

		function onInput(this: HTMLElement, evt: InputEventHelper) {
			console.debug(evt.inputType);

			const { target, inputType } = evt;
			switch (inputType) {
				case "insertText": 
					showAutocomplete(target);
					break;
			}
		}

		function update(selected: null | JsonProperty) {
			dollar ??= target.firstElementChild as HTMLLIElement;
			target.innerHTML = "";
			target.appendChild(dollar);

			if (selected) {
				const { path } = selected;
				for (var i = 1; i < path.length; i++) {
					const e = createPartNode(path[i]);
					target.appendChild(e);
				}
			}
		}

		update(selected);

		target.addEventListener("keydown", onKeyDown);
		target.addEventListener("input", onInput);

		return {
			update,
			destroy() {
				target.innerHTML = "";
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
			position: relative;
			display: flex;
			flex-direction: row;
			align-items: center;

			> span.content {
				margin: 0 $pad-med;
				display: block;
				outline: none;
				min-width: 1em;
			}
		}
	}
</style>
<ul class="list" contenteditable="true" use:render={$selected}>
	<li contenteditable="false">
		<span class="content">$</span>
	</li>
</ul>