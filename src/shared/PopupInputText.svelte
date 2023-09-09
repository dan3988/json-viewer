<script lang="ts">
	import type { PopupEvents } from "../types";
	import { scale } from "svelte/transition";
	import { backOut } from "svelte/easing";
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
	#title {
		text-align: center;
		grid-area: title;
	}

	#value {
		resize: none;
		height: 100%;
		grid-area: text;
	}

	#cancel {
		grid-area: cancel;
	}

	#confirm {
		grid-area: confirm;
	}

	.root {
		display: grid;
		gap: 5px;
		grid-template-columns: [title-start text-start] minmax(5rem, 1fr) [cancel] 5rem [confirm] 5rem [title-end text-end];
		grid-template-rows: [text] 1fr [cancel confirm] auto;

		&.title {
			grid-template-rows: [title] auto [text] 1fr [cancel confirm] auto;
		}
	}
</style>
<Popup {title} {width} {height} on:canceled={onCancel} on:confirmed={onConfirm}>
	{#if multiLine}
		<textarea id="value" class="form-control" bind:value={value} bind:this={field}/>
	{:else}
		<input id="value" class="form-control" bind:value={value} bind:this={field}/>
	{/if}
</Popup>