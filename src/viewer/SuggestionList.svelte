<script lang="ts">
    import { createEventDispatcher } from "svelte";

	export let source: Iterable<number | string>;
	export let filter: string;
	export let index = 0;


	let filterLw: string;
	let results: string[];

	$: {
		filterLw = filter?.toLowerCase();
		results = source ? [...source].filter((v) => String(v).toLowerCase().includes(filterLw)) : Array.prototype;
	}
	
	let list: HTMLUListElement;

	export function getSelected() {
		return results[index];
	}

	export function next() {
		var next = index + 1;
		if (next >= results.length)
			next = 0;

		index = next;
		list.children[next]?.scrollIntoView({ block: 'nearest' });
	}

	export function prev() {
		var prev = index - 1;
		if (prev < 0)
			prev = results.length - 1;

		index = prev;
		list.children[prev]?.scrollIntoView({ block: 'nearest' });
	}

	function appendE<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, className: string, content: string): HTMLElementTagNameMap[K] {
		const e = document.createElement(tag);
		e.className = className;
		e.innerText = content;
		parent.append(e);
		return e;
	}

	const dispatch = createEventDispatcher();

	interface RenderArg {
		suggestion: string;
		filter: string;
		index: number;
	};

	function renderListItem(target: HTMLElement, arg: RenderArg) {
		function update(a: RenderArg) {
			let { suggestion } = arg = a;
			if (!filter) {
				target.innerText = suggestion;
				return;
			}

			target.innerHTML = "";
			let lw = suggestion.toLowerCase();
			let ix = lw.indexOf(filter);
			if (ix < 0)
				return;

			let last = 0;

			while (true) {
				if (ix < 0) {
					appendE(target, "span", "", suggestion.substring(last));
					break;
				} else if (ix > last) {
					appendE(target, "span", "", suggestion.substring(last, ix));
				}

				appendE(target, "span", "match", suggestion.substring(ix, ix + filter.length));
				ix = lw.indexOf(filter, last = ix + filter.length);
			}
		}
		
		update(arg);

		function onClick() {
			const { suggestion, index } = arg;
			dispatch("click", { suggestion, index });
		}

		target.addEventListener('click', onClick);

		return {
			update,
			destroy() {
				target.removeEventListener('click', onClick);
				target.innerHTML = "";
			}
		}
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
			cursor: pointer;

			&:hover {
				background-color: #44AAFF44;
			}

			> :global(.match) {
				background-color: var(--col-match-bg);
				color: var(--col-match-fg);
			}
		}
	}

	.selected {
		background-color: #44AAFF88;

		&:hover {
			background-color: #44AAFFCC;
		}
	}
</style>
<template>
	<ul class="list" bind:this={list} contenteditable="false">
		{#each results as suggestion, i}
			<li class:selected={i == index} use:renderListItem={{ suggestion, filter: filterLw, index: i }}></li>
		{/each}
	</ul>
</template>