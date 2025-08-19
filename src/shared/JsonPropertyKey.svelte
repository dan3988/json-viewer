<script lang="ts">
	import type json from "../json";
	import type { ViewerModel, ViewerCommandEvent } from "../viewer-model";
	import { onDestroy } from "svelte";
	import { renderKey } from "../renderer";
	import Border from "./Border.svelte";
	import JsonValueEditor from "./JsonValueEditor.svelte";

	export let prop: json.JProperty;
	export let model: ViewerModel;
	export let editing = false;
	export let onrename: ((name: string) => void) | undefined = undefined;

	$: ({ key, state: { props: { isSelected } } } = prop);

	let border: Border;

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	function onModelCommand({ command, args: [arg0] }: ViewerCommandEvent) {
		if (command === "scrollTo" && arg0 === prop) {
			border.scrollTo();
		}
	}

	function onPropertyClick(evt: MouseEvent) {
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
<Border bind:this={border} editable {editing} selected={$isSelected} onclick={onPropertyClick}>
	{#if typeof key === 'number'}
		{key}
	{:else}
		<JsonValueEditor value={key} parse={String} checkEqual autoSelect bind:editing renderer={renderKey} onfinish={onrename} />
	{/if}
</Border>