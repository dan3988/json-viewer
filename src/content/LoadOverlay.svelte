<script lang="ts" >
    import type messaging from "../messaging";
	import { SvelteComponent, onDestroy, onMount } from "svelte";
	import ThemeTracker from "../theme-tracker";

	let elem: HTMLElement;
	let tracker: ThemeTracker;
	let remember = false;

	const self: SvelteComponent = arguments[0];

	onMount(() => tracker = new ThemeTracker(elem));
	onDestroy(() => tracker.destroy());

	async function action(load: boolean) {
		if (remember)
			await chrome.runtime.sendMessage<messaging.WorkerMessage>({ type: "remember", autoload: load })

		if (load)
			await chrome.runtime.sendMessage<messaging.WorkerMessage>({ type: "loadme" }).then(v => v && alert(v));

		self.$destroy();
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../../node_modules/bootstrap/scss/bootstrap.scss";
	@import "../globals.scss";

	.root {
		@extend body;

		position: absolute;
		top: 1rem;
		left: 50%;
		translate: -50% 0;
		padding: $pad-med;
		background-color: var(--bs-body-bg);
		display: grid;

		grid-template-rows: repeat(3, auto);
		grid-template-columns: auto 5rem 5rem auto;

		> .full-row {
			grid-column: 1 / -1;
		}
		
		> .btn-danger {
			grid-area: -2 / 2 / -1 / span 1;
		}
		
		> .btn-success {
			grid-area: -2 / 3 / -1 / span 1;
		}

		> span {
			padding: 0 $pad-med;
		}
	}
</style>
<template>
	<div class="root border rounded gap-1 text-center px-5" bind:this={elem} data-bs-theme="">
		<span class="full-row">Load JSON viewer?</span>
		<label class="full-row d-flex justify-content-center gap-1">
			<input type="checkbox" class="form-check-input" bind:checked={remember}/>
			Remember for this host
		</label>
		<button class="btn btn-success" on:click={() => action(true)}>Yes</button>
		<button class="btn btn-danger" on:click={() => action(false)}>No</button>
	</div>
</template>