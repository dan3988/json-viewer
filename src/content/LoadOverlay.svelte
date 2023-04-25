<script lang="ts" >
	import { onDestroy, onMount } from "svelte";
	import ThemeTracker from "../theme-tracker";

	let elem: HTMLElement;
	let tracker: ThemeTracker;

	onMount(() => tracker = new ThemeTracker(elem));
	onDestroy(() => tracker.destroy());

	async function onYes() {
		const res = await chrome.runtime.sendMessage({ type: "loadme" });
		if (res != null)
			alert(res);

		elem.remove();
	}

	function onNo() {
		elem.remove();
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../../node_modules/bootstrap/scss/bootstrap.scss";
	@import "../globals.scss";

	.root {
		@extend body, .border, .rounded;

		position: absolute;
		top: 1rem;
		left: 50%;
		translate: -50% 0;
		padding: $pad-med;
		background-color: var(--bs-body-bg);

		> span {
			padding: 0 $pad-med;
		}
	}
</style>
<template>
	<div class="root" bind:this={elem} data-bs-theme="">
		<span>Load JSON viewer?</span>
		<button class="btn btn-success" on:click={onYes}>Yes</button>
		<button class="btn btn-danger" on:click={onNo}>No</button>
	</div>
</template>