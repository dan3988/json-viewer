<script lang="ts">
	import type { PopupEvents } from "../types";
	import { createEventDispatcher } from "svelte";
	import { fade } from "svelte/transition";

	export let title: string = "";
	export let confirmText = "OK";
	export let width: undefined | number = undefined;
	export let height: undefined | number = undefined;

	const dispatcher = createEventDispatcher<PopupEvents<void>>();

	function onBgClick(evt: MouseEvent) {
		if (evt.target === evt.currentTarget)
			cancel();
	}

	function confirm() {
		dispatcher("confirmed");
	}

	function cancel() {
		dispatcher("canceled");
	}
</script>
<style lang="scss">
	@use "src/core.scss" as *;

	.modal {
		--bs-modal-width: ;

		background-color: rgba(var(--blur-bg-rgb), 0.25);
		backdrop-filter: blur(1px);
		z-index: 10;
		position: fixed;
		inset: 0;
		display: flex;
	}

	.modal-dialog {
		margin: auto;
	}

	.modal-content {
		height: 100%;
	}

	.close {
		@include bs-icon-btn("x-circle");
		width: 1.5rem;
		aspect-ratio: 1;

		&:hover {
			--img-btn-src: #{bs-icon("x-circle-fill")};
		}
	}
</style>
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="modal" transition:fade tabindex="-1" role="dialog" on:mousedown={onBgClick}>
	<div class="modal-dialog" role="document" style:width={width && width + "vw"} style:height={height && height + "vh"}>
		<div class="modal-content">
			<div class="modal-header">
				<span id="title" class="h4 modal-title">{title}</span>
				<span role="button" class="close btn-danger" data-dismiss="modal" aria-label="Close" on:click={cancel}></span>
			</div>
			<div class="modal-body">
				<slot/>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-success" on:click={confirm}>{confirmText}</button>
			</div>
		</div>
	</div>
</div>