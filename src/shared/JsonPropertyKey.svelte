<script lang="ts">
	import type { ViewerModel, ViewerCommandEvent } from "../viewer-model";
	import type json from "../json";
	import JsonSearch from "../search";
	import edits from "../viewer/editor-helper.js";
	import { onDestroy } from "svelte";
	import { renderKey } from "../renderer";
	import JsonValueEditor from "./JsonValueEditor.svelte";

	const searchType = JsonSearch.Mode.Keys;

	export let model: ViewerModel;
	export let search: undefined | JsonSearch = undefined;
	export let node: json.Node;
	export let selected: boolean;
	export let readonly = false;
	export let editing: boolean;

	$: isNumber = typeof key === 'number';
	$: key = node.key ?? '$';
	$: onrename = ((node) => {
		const { parent } = node;
		if (parent?.isObject()) {
			return (name: string) => {
				model.edits.push(edits.rename(parent, node.key as string, name));
				model.execute('scrollTo', node);
			}
		}
	})(node);

	let element: HTMLElement;

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	function focus() {
		element.focus();
	}

	function onModelCommand({ command, args: [arg0] }: ViewerCommandEvent) {
		if (arg0 === node) {
			switch (command) {
				case "scrollTo":
					//element.scrollIntoView({ block: 'nearest' });
					break;
				case "rename":
					editing = true;
					break;
			}
		}
	}
</script>
<div bind:this={element} class="root" class:number={isNumber} class:selected>
	{#if typeof key === 'number'}
		<span class="key-text" use:renderKey={{ value: key, search, searchType }} />
	{:else}
		<span class="key-text">
			<JsonValueEditor value={key} parse={String} {search} {searchType} {readonly} autoSelect bind:editing renderer={renderKey} onfinish={onrename} onclose={focus} />
		</span>
	{/if}
	<slot />
</div>
<style lang="scss">
	@use "src/core.scss" as *;

	.root {
		color: var(--jv-key-fg);
		position: relative;
		display: inline-flex;
		align-items: center;
		user-select: text;
		white-space: nowrap;
		gap: $pad-small;
		cursor: pointer;

		&.number {
			color: var(--jv-num-fg);
		}

		&.selected {
			cursor: text;
		}
	}
</style>