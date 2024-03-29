<script lang="ts" context="module">
	export interface ClickEventDetail {
		suggestion: string;
		index: number;
	}

	export interface Events {
		click: ClickEventDetail;
	}
</script>
<script lang="ts">
	import Linq from "@daniel.pickett/linq-js";
	import { createEventDispatcher } from "svelte";

	export let source: Iterable<number | string> = Linq.empty();
	export let filter: string = "";
	export let index = 0;

	let filterLw: string;
	let results: string[];

	$: {
		filterLw = filter?.toLowerCase();
		results = source ? Linq(source).where((v) => String(v).toLowerCase().includes(filterLw)).toArray() : Array.prototype;
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
		e.textContent = content;
		parent.append(e);
		return e;
	}

	const dispatch = createEventDispatcher<Events>();

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
					last !== suggestion.length && appendE(target, "span", "", suggestion.substring(last));
					break;
				} else if (ix > last) {
					appendE(target, "span", "", suggestion.substring(last, ix));
				}

				appendE(target, "span", "match", suggestion.substring(ix, ix + filter.length));
				ix = lw.indexOf(filter, last = ix + filter.length);
			}
		}
		
		update(arg);

		const unsub = target.subscribe({
			mousedown(evt) {
				evt.preventDefault()
			},
			click() {
				const { suggestion, index } = arg;
				dispatch("click", { suggestion, index });
			}
		})

		return {
			update,
			destroy() {
				unsub();
				target.innerHTML = "";
			}
		}
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.list {
		&:empty {
			&::before {
				content: "No Matching properties";
				display: block;
				margin: $pad-small $pad-med;
				font-style: italic;
				color: var(--bs-tertiary-color);
			}
		}

		> li {
			text-overflow: ellipsis;
			overflow: hidden;
			white-space: nowrap;
			padding: $pad-small $pad-med;
			cursor: pointer;

			&.selected {
				background-color: var(--bs-link-color);
				color: var(--bs-white);

				&:hover {
					color: var(--bs-white);
					background-color: var(--bs-link-hover-color);
				}
			}

			&:hover {
				color: var(--bs-gray-300);
				background-color: rgba(var(--bs-link-color-rgb), 0.5);
			}

			> :global(.match) {
				background-color: var(--col-match-bg);
				color: var(--col-match-fg);
			}
		}
	}
</style>
<template>
	<ul class="list bg-body-tertiary text-body-emphasis border" bind:this={list} contenteditable="false">
		{#each results as suggestion, i}
			<li class:selected={i == index} use:renderListItem={{ suggestion, filter: filterLw, index: i }}></li>
		{/each}
	</ul>
</template>