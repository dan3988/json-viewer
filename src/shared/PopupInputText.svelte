<script lang="ts">
	import type { PopupEvents } from "../types";
	import { createEventDispatcher, onMount } from "svelte";
	import Popup from "./Popup.svelte";

	export let value: string = "";
	export let title: string = "";
	export let multiLine = false;
	export let width: undefined | number = undefined;
	export let height: undefined | number = undefined;

	let field: HTMLInputElement | HTMLTextAreaElement;

	const dispatcher = createEventDispatcher<PopupEvents<string>>();

	onMount(() => field.focus());

	function onCancel() {
		dispatcher("canceled");
	}

	function onConfirm() {
		dispatcher("confirmed", value);
	}
</script>
<style lang="scss">
	#value {
		resize: none;
		height: 100%;
		grid-area: text;
	}
</style>
<Popup {title} {width} {height} on:canceled={onCancel} on:confirmed={onConfirm}>
	{#if multiLine}
		<textarea id="value" class="form-control" bind:value={value} bind:this={field}/>
	{:else}
		<input id="value" class="form-control" bind:value={value} bind:this={field}/>
	{/if}
</Popup>