<script lang="ts">
	import type { ViewerModel } from "../viewer-model";
	import { onMount, tick } from "svelte";
	import json from "../json";
	import dom from "./dom-helper";
	import AutocompleteHelper from "./autocomplete-helper";
	import JsonPath from "../json-path";

	interface Props {
		model: ViewerModel;
		onfinished?: (node: json.Node | null) => void | boolean;
		oncancel?: () => void | boolean;
	}

	const {
		model,
		onfinished,
		oncancel
	}: Props = $props();

	const selectedNodes = $derived(model.selected);

	let acWrapper: HTMLElement;
	let acHelper: undefined | AutocompleteHelper;

	let target: HTMLElement;
	let x = $state(0);
	let ignoreSelectionEvents = 0;

	const node = $derived($selectedNodes.last ?? model.root);

	$effect(() => update(node));

	onMount(() => update(node));

	export function focus() {
		tick().then(() => dom.setCaret(target, 0, true));
	}

	function unfocus() {
		getSelection()?.removeAllRanges();
		update(node);
	}

	function update(node: json.Node) {
		target && (target.innerText = node.path.toString());
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
			const middle = text.slice(before.length + 1, start);
			return [before, middle]
		} else {
			const middle = text.slice(before.length + 1, start);
			const after = text.slice(i + 1);
			return [before, middle, after];
		}
	}

	function onFocusIn() {
		ignoreSelectionEvents = 1;
	}

	function onFocusOut() {
		update(node);
		destroyAutoComplete();
		oncancel?.();
	}

	function tryEnd<A extends any[]>(fn: undefined | ((...args: A) => void | boolean), ...args: A) {
		(fn && fn.apply(undefined, args)) && unfocus();
	}

	function onAutoCompleteFinish(value?: string) {
		destroyAutoComplete();

		if (value == null)
			return;

		const selection = dom.getSelectionFor(target);
		if (!selection)
			return;

		const range = selection.getRangeAt(0);
		const [start] = splitSelection(range);
		target.innerText = start + "/" + JsonPath.escape(value);
		ignoreSelectionEvents = 2;
		dom.setCaret(selection, target, 0, true);
	}
	
	function destroyAutoComplete() {
		if (acHelper) {
			acHelper.destroy();
			acHelper = undefined;
		}
	}

	function parsePathSection(value: string) {
		if (!value.startsWith("'"))
			return value;

		const regex = /'(?!\\)/g;
		regex.lastIndex = 1;
		const results = regex.exec(value);
		//the user has opened a json string but has not closed it, so try to parse the incomplete value to use to filter the suggesions
		if (results == null) {
			//ignore incomplete escape sequence
			if (value.endsWith("\\"))
				value = value.slice(0, -1);

			value += "'";
		}

		try {
			return JSON5.parse(value);
		} catch (e) {
			return "";
		}
	}

	function updateAutoComplete(selection: Selection) {
		const range = selection.getRangeAt(0);
		const [start, mid] = splitSelection(range);
		const previous = model.resolve(start);
		if (!previous)
			return;

		const filter = parsePathSection(mid);

		acHelper ??= new AutocompleteHelper(acWrapper, onAutoCompleteFinish);
		acHelper.update(previous, filter, true);
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
			tryEnd(oncancel);
		} else if (evt.key === "Enter") {
			evt.preventDefault();
			const path = target.innerText;
			const resolved = model.resolve(path) ?? null;
			tryEnd(onfinished, resolved);
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
		overflow: hidden;
		white-space: nowrap;
	}

	.root {
		position: relative;
		padding: 0 $pad-med;
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
<svelte:document onselectionchange={onSelectionChange} />
<div class="root">
	<span
		class="path-text"
		tabindex="-1"
		role="textbox"
		contenteditable="plaintext-only"
		oninput={onInput}
		onfocusin={onFocusIn}
		onfocusout={onFocusOut}
		onkeydown={onKeyDown}
		onkeypress={onKeyPress}
		bind:this={target}>
	</span>
	<div class="ac-wrapper" style:left={x && (x + "px")} bind:this={acWrapper}>
	</div>
</div>
