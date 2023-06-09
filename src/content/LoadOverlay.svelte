<script lang="ts" context="module">
	const css = chrome.runtime.getURL("/lib/content.css");
</script>
<script lang="ts" >
	import type { WorkerMessage } from "../types.d.ts";
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
			await chrome.runtime.sendMessage<WorkerMessage>({ type: "remember", autoload: load })

		if (load)
			await chrome.runtime.sendMessage<WorkerMessage>({ type: "loadme" }).then(v => v && alert(v));

		self.$destroy();
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../../node_modules/bootstrap/scss/bootstrap.scss";
	@import "../globals.scss";

	.root {
		display: block;
		position: absolute;
		inset: 0;
	}

	.content {
		@extend body;

		position: sticky;
		width: max-content;
		margin: 0 auto;
		top: 1rem;
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
<svelte:head>
	<link rel="stylesheet" href={css}/>
	<style>
		:global(body) {
			position: relative;
		}
	</style>
</svelte:head>
<template>
	<div class="root">
		<div class="content border rounded gap-1 text-center px-5" bind:this={elem} data-bs-theme="">
			<span class="full-row">Load JSON viewer?</span>
			<label class="full-row d-flex justify-content-center gap-1">
				<input type="checkbox" class="form-check-input" bind:checked={remember}/>
				Remember for this host
			</label>
			<button class="btn btn-success" on:click={() => action(true)}>Yes</button>
			<button class="btn btn-danger" on:click={() => action(false)}>No</button>
		</div>
	</div>
</template>