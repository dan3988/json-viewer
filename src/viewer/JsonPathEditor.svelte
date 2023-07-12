<script lang="ts" context="module">
	import type { JsonProperty } from "../json";

	export interface EventMap {
		"finished": JsonProperty | null;
		"cancelled": void;
	}
</script>
<script lang="ts">
	import type { ViewerModel } from "../viewer-model";
	import { createEventDispatcher, onMount, tick } from "svelte";
	import dom from "./dom-helper";

	export let model: ViewerModel;

	$: ({ selected } = model.bag.readables);
	$: prop = $selected ?? model.root;

	const dispatcher = createEventDispatcher<EventMap>();

	let target: HTMLElement;

	function update() {
		target.innerText = prop.path.join("/");
	}

	function unfocus() {
		getSelection()?.removeAllRanges();
		update();
	}

	export function focus() {
		tick().then(() => dom.setCaret(target, 0, true));
	}

	function onFocusOut() {
		update();
		dispatcher("cancelled");
	}

	function onInput(evt: Event) {

	}

	function onKeyDown(evt: KeyboardEvent) {
		if (evt.key === "Escape") {
			if (dispatcher("cancelled"))
				unfocus();
		} else if (evt.key === "Enter") {
			evt.preventDefault();
			const path = target.innerText;
			const resolved = model.resolve(path);
			if (dispatcher("finished", resolved, { cancelable: true }))
				unfocus();
		}
	}

	onMount(update);
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.root {
		outline: none;
	}
</style>
<svelte:window on:selectionchange={e => e}/>
<div class="root"
	tabindex="-1"
	role="textbox"
	contenteditable="true"
	bind:this={target}
	on:input={onInput}
	on:focusout={onFocusOut}
	on:keydown={onKeyDown}/>