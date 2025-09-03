<script lang="ts">
	import type json from "../json";
	import type { ViewerModel, ViewerCommandEvent } from "../viewer-model";
	import edits from "../viewer/editor-helper.js";
	import { onDestroy } from "svelte";
	import { renderKey } from "../renderer";
	import JsonValueEditor from "./JsonValueEditor.svelte";

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let readonly = false;
	export let editing: boolean;

	$: ({ key, state: { props: { isSelected } } } = prop);
	$: onrename = ((prop) => {
		const { parent } = prop;
		if (parent?.is('object')) {
			return (name: string) => {
				edits.renameProperty(model, parent, prop.key as string, name);
				model.execute('scrollTo', prop);
			}
		}
	})(prop);

	let element: HTMLElement;

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	function focus() {
		element.focus();
	}

	function onModelCommand({ command, args: [arg0] }: ViewerCommandEvent) {
		if (arg0 === prop) {
			switch (command) {
				case "scrollTo":
					element.scrollIntoView({ block: 'nearest' });
					break;
				case "rename":
					editing = true;
					break;
			}
		}
	}

	function onClick(evt: MouseEvent) {
		evt.preventDefault();
		if (evt.shiftKey) {
			//evt.preventDefault();
			model.selected[evt.ctrlKey ? "add" : "reset"](prop, true);
		} else {
			model.selected[evt.ctrlKey ? "toggle" : "reset"](prop);
		}

		window.getSelection()?.removeAllRanges();
	}
</script>
<div bind:this={element} class="root" class:selected={$isSelected} on:click={onClick}>
	<span class="key-text">
		{#if typeof key === 'number'}
			{key}
		{:else}
			<JsonValueEditor value={key} parse={String} {readonly} autoSelect bind:editing renderer={renderKey} onfinish={onrename} onclose={focus} />
		{/if}
	</span>
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

		&.selected {
			cursor: text;
		}
	}
</style>