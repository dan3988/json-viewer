<script lang="ts" context="module">
	import type json from "../json";

	export interface EventMap {
		finished: json.JProperty | null;
		cancelled: void;
	}
</script>

<script lang="ts">
	import type { ViewerModel } from "../viewer-model";
	import { createEventDispatcher, onMount, tick } from "svelte";
	import dom from "./dom-helper";
	import AutocompleteHelper from "./autocomplete-helper";

	export let model: ViewerModel;

	$: ({ selected } = model.bag.readables);
	$: prop = $selected ?? model.root;
	$: prop && target && update();

	let acWrapper: HTMLElement;
	let acHelper: undefined | AutocompleteHelper;

	const dispatcher = createEventDispatcher<EventMap>();

	let target: HTMLElement;
	let x: number;
	let ignoreSelectionEvents = 0;

	export function focus() {
		tick().then(() => dom.setCaret(target, 0, true));
	}

	function unfocus() {
		getSelection()?.removeAllRanges();
		update();
	}

	function update() {
		target.innerText = prop.path.join("/");
	}

	function getIndexes(range: Range): [number, number] {
		return [range.startOffset, range.endOffset];
	}

	function splitSelection(range: Range): [before: string, current: string, after?: string] {
		const text = target.textContent ?? "";
		const [start, end] = getIndexes(range);

		let i = text.lastIndexOf("/", start - 1);
		const before = text.slice(0, i);

		i = text.indexOf("/", i + 1);
		if (i < 0) {
			const middle = text.slice(before.length + 1);
			return [before, middle]
		} else {
			const middle = text.slice(before.length + 1, i);
			const after = text.slice(i + 1);
			return [before, middle, after];
		}
	}

	function onFocusIn() {
		ignoreSelectionEvents = 1;
	}

	function onFocusOut() {
		update();
		dispatcher("cancelled");
	}

	function tryEnd<K extends keyof EventMap>(key: K, parameter?: EventMap[K]) {
		dispatcher(key as any, parameter, { cancelable: true }) && unfocus();
	}

	function onAutoCompleteFinish(value?: string) {
		acHelper = undefined;

		if (value == null)
			return;

		const selection = dom.getSelectionFor(target);
		if (!selection)
			return;

		const range = selection.getRangeAt(0);
		const [start] = splitSelection(range);
		target.innerText = start + "/" + value;
		ignoreSelectionEvents = 2;
		dom.setCaret(selection, target, 0, true);
	}
	
	function destroyAutoComplete() {
		if (acHelper) {
			acHelper.destroy();
			acHelper = undefined;
		}
	}

	function updateAutoComplete(selection: Selection) {
		const range = selection.getRangeAt(0);
		const [start, mid] = splitSelection(range);
		const previous = model.resolve(start);
		if (!previous)
			return;

		acHelper ??= new AutocompleteHelper(acWrapper, onAutoCompleteFinish);
		acHelper.update(previous.value, mid, true);
		const { x: rangeX } = range.getBoundingClientRect();
		const { x: targetX } = target.getBoundingClientRect();
		x = rangeX - targetX;
	}

	function onInput(this: HTMLElement, evt: Event) {
		const selection = dom.getSelectionFor(this);
		if (selection)
			updateAutoComplete(selection);
	}

	function onKeyDown(evt: KeyboardEvent) {
		if (acHelper && acHelper.handleKeyPress(evt)) {
			evt.preventDefault();
			return;
		}

		if (evt.key === "Escape") {
			tryEnd("cancelled");
		} else if (evt.key === "Enter") {
			evt.preventDefault();
			const path = target.innerText;
			const resolved = model.resolve(path);
			tryEnd("finished", resolved);
		} else if (evt.key === " " && evt.ctrlKey && acHelper == null) {
			const selection = getSelection();
			selection && updateAutoComplete(selection);
			evt.preventDefault();
		}
	}

	function onKeyPress(evt: KeyboardEvent) {
		if (acHelper && acHelper.handleKeyPress(evt)) {
			evt.preventDefault();
			return;
		}

	}

	function onSelectionChange() {
		if (ignoreSelectionEvents) {
			ignoreSelectionEvents--;
			return;
		}

		const selection = dom.getSelectionFor(target);
		if (selection == null) {
			destroyAutoComplete();
		} else if (acHelper) {
			updateAutoComplete(selection);
		}
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.path-text {
		outline: none;
		display: block;
	}

	.root {
		position: relative;
	}

	.ac-wrapper {
		z-index: 1;
		position: absolute;
		overflow-y: auto;
		bottom: 0;
		width: 20rem;
		max-height: 50vh;
		bottom: 100%;
	}
</style>
<svelte:document on:selectionchange={onSelectionChange} />
<div class="root">
	<span
		class="path-text"
		tabindex="-1"
		role="textbox"
		contenteditable="true"
		on:input={onInput}
		on:focusin={onFocusIn}
		on:focusout={onFocusOut}
		on:keydown={onKeyDown}
		on:keypress={onKeyPress}
		bind:this={target}/>
	<div class="ac-wrapper" style:left={x && (x + "px")} bind:this={acWrapper}/>
</div>
