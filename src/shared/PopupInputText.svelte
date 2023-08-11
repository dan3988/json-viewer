<script lang="ts">
	import { scale } from "svelte/transition";
	import { backOut } from "svelte/easing";
	import type { PopupEvents } from "../types";
	import { createEventDispatcher, onMount } from "svelte";
	import PopupFrame from "./PopupFrame.svelte";

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
<PopupFrame>
	<div class="root bg-body border rounded p-2" style:width={width && width + "vw"} style:height={height && height + "vh"} class:title transition:scale={{ easing: backOut }}>
		{#if title}
			<span id="title" class="h4 m-0">{title}</span>
		{/if}
		{#if multiLine}
			<textarea id="value" class="form-control" bind:value={value} bind:this={field}/>
		{:else}
			<input id="value" class="form-control" bind:value={value} bind:this={field}/>
		{/if}
		<button id="cancel" class="btn btn-danger" on:click={onCancel}>Cancel</button>
		<button id="confirm" class="btn btn-success" disabled={!value} on:click={onConfirm}>OK</button>
	</div>
</PopupFrame>