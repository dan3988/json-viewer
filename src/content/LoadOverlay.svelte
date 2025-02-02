<script lang="ts" context="module">
	const css = chrome.runtime.getURL("/lib/content.css");
</script>
<script lang="ts" >
	import type { WorkerMessage } from "../types.d.ts";
	import { SvelteComponent, onDestroy, onMount } from "svelte";
	import ThemeTracker from "../theme-tracker";

	let tracker: ThemeTracker;
	let remember = false;

	const self: SvelteComponent = arguments[0];

	onMount(() => tracker = new ThemeTracker());
	onDestroy(() => tracker.dispose());

	async function action(load: boolean) {
		if (remember)
			await chrome.runtime.sendMessage<WorkerMessage>({ type: "remember", autoload: load })

		if (load)
			await chrome.runtime.sendMessage<WorkerMessage>({ type: "loadme" });

		self.$destroy();
	}
</script>
<svelte:head>
	<link rel="stylesheet" href={css}/>
</svelte:head>
<template>
	<div class="root">
		<div class="content">
			<span class="full-row">Load JSON viewer?</span>
			<label class="full-row">
				<input type="checkbox" class="form-check-input" bind:checked={remember}/>
				Remember for this host
			</label>
			<button class="btn btn-success" on:click={() => action(true)}>Yes</button>
			<button class="btn btn-danger" on:click={() => action(false)}>No</button>
		</div>
	</div>
</template>
<style lang="scss">
	@use "../core.scss" as *;
	@import "./bootstrap.scss";
	@import "../globals.scss";

	:global(body) {
		position: relative;
	}

	.root {
		font-family: var(--bs-body-font-family);

		display: block;
		position: absolute;
		inset: 0;
	}

	.content {
		position: sticky;
		width: max-content;
		margin: 0 auto;
		top: 1rem;
		padding: $pad-med 3rem;
		background-color: var(--bs-body-bg);
		border-radius: var(--bs-border-radius);
		border: var(--bs-border-width) var(--bs-border-style) var(--bs-border-color);
		display: grid;
		gap: 0.25rem;
		text-align: center;

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

	label {
		display: flex;
		justify-content: center;
		gap: 0.25rem;
	}
</style>