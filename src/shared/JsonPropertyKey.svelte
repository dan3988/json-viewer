<script lang="ts">
	import type json from "../json";
	import type { ViewerModel, ViewerCommandEvent } from "../viewer-model";
	import edits from "../viewer/editor-helper.js";
	import { onDestroy } from "svelte";
	import { renderKey } from "../renderer";
	import Border from "./Border.svelte";
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

	let border: Border;

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	function onModelCommand({ command, args: [arg0] }: ViewerCommandEvent) {
		if (arg0 === prop) {
			switch (command) {
				case "scrollTo":
					border.scrollTo();
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
<Border bind:this={border} editable {editing} selected={$isSelected} onclick={onClick}>
	<div class="root" slot="default" let:focus>
		<span class="key-text">
			{#if typeof key === 'number'}
				{key}
			{:else}
				<JsonValueEditor value={key} parse={String} {readonly} autoSelect bind:editing renderer={renderKey} onfinish={onrename} onclose={focus} />
			{/if}
		</span>
		<slot />
	</div>
</Border>
<style lang="scss">
	@use "src/core.scss" as *;

	.root {
		position: relative;
		display: flex;
		align-items: center;
		gap: $pad-small;
	}
</style>