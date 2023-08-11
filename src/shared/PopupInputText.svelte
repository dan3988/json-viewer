<script lang="ts">
	import { scale } from "svelte/transition";
	import type { PopupEvents } from "../types";
	import { createEventDispatcher } from "svelte";

	export let value: string = "";
	export let title: string = "";
	export let multiLine = false;

	const dispatcher = createEventDispatcher<PopupEvents<string>>();

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
		grid-area: text;
	}

	#cancel {
		grid-area: cancel;
	}

	#confirm {
		grid-area: confirm;
	}

	.root {
		width: min(50vh, 20rem);
		display: grid;
		gap: 5px;
		grid-template-columns: [title-start text-start] 1fr [cancel] 1fr [confirm] 1fr [title-end text-end];
		grid-template-rows: [text] auto [cancel confirm] auto;

		&.title {
			grid-template-rows: [title] auto [text] auto [cancel confirm] auto;
		}
	}
</style>
<div class="root bg-body border rounded p-2" class:title transition:scale>
	{#if title}
		<span id="title" class="h4 m-0">{title}</span>
	{/if}
	{#if multiLine}
		<textarea id="value" class="form-control" bind:value={value}/>
	{:else}
		<input id="value" class="form-control" bind:value={value}/>
	{/if}
	<button id="cancel" class="btn btn-danger" on:click={onCancel}>Cancel</button>
	<button id="confirm" class="btn btn-success" disabled={!value} on:click={onConfirm}>OK</button>
</div>