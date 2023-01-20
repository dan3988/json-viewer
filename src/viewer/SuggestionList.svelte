<script lang="ts">
	export let suggestions: readonly string[];
	export let index = -1;

	let list: HTMLUListElement;

	export function getSelected() {
		return suggestions[index];
	}

	export function next() {
		var next = index + 1;
		if (next >= suggestions.length)
			next = 0;

		index = next;
		list.children[next]?.scrollIntoView({ block: 'nearest' });
	}

	export function prev() {
		var prev = index - 1;
		if (prev < 0)
			prev = suggestions.length - 1;

		index = prev;
		list.children[prev]?.scrollIntoView({ block: 'nearest' });
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.list {
		@include font-elem;

		position: absolute;
		left: 0;
		right: 0;
		min-width: 10rem;
		min-height: 1rem;
		max-height: 50vh;
		bottom: calc(100% + $pad-med);
		overflow-y: hidden;

		background-color: var(--col-bg-dk);
		border: solid $border-w var(--col-border);

		> li {
			padding: $pad-small $pad-med;
		}
	}

	.selected {
		background-color: slateblue;
	}
</style>
<template>
	<ul class="list" bind:this={list}>
		{#each suggestions as text, i}
			<li class:selected={i == index}>{text}</li>
		{/each}
	</ul>
</template>