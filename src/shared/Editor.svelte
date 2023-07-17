<script lang="ts">
    import type { PopupEvents } from "../types";
    import { createEventDispatcher } from "svelte";

	export let value: string = "";

	const dispatcher = createEventDispatcher<PopupEvents<string>>();

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
		grid-area: 1 / 1 / span 1 / -1;
	}

	#cancel {
		grid-column: 2 / span 1;
	}

	#confirm {
		grid-column: 3 / span 1;
	}

	.root {
		width: min(50vh, 15rem);
		display: grid;
		gap: 5px;
		grid-template-columns: 1fr auto auto;
		grid-template-rows: auto auto;

		> .btn {
			grid-row: -2 / -1;
		}
	}
</style>
<div class="root bg-body border rounded p-1">
	<input id="value" class="form-control" bind:value={value} />
	<button id="cancel" class="btn btn-danger" on:click={onCancel}>Cancel</button>
	<button id="confirm" class="btn btn-success" on:click={onConfirm}>OK</button>
</div>