<script lang="ts">
	import type { PopupProps } from "../types";
	import { onMount } from "svelte";
	import Popup from "./Popup.svelte";

	interface Props extends PopupProps<string> {
		value?: string;
		title?: string;
		multiLine?: boolean;
		width?: number;
		height?: number;
	}

	let {
		value = $bindable(""),
		title = "",
		multiLine = false,
		width,
		height,
		oncancel,
		onconfirm,
	}: Props = $props();

	let field: HTMLInputElement | HTMLTextAreaElement;

	onMount(() => field.focus());
</script>
<style lang="scss">
	#value {
		resize: none;
		height: 100%;
		grid-area: text;
	}
</style>
<Popup {title} {width} {height} {oncancel} {onconfirm}>
	{#if multiLine}
		<textarea id="value" class="form-control" bind:value={value} bind:this={field}></textarea>
	{:else}
		<input id="value" class="form-control" bind:value={value} bind:this={field}/>
	{/if}
</Popup>