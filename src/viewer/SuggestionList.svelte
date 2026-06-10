<script lang="ts" module>
	interface RenderArg {
		suggestion: string | number;
		filter: string;
		index: number;
		onselection?: (suggestion: string | number, index: number) => void;
	}

	function renderListItem(target: HTMLElement, arg: RenderArg) {
		let { suggestion, filter, index, onselection } = arg;

		function update(a: RenderArg) {
			({ suggestion, filter, index, onselection } = a);
			suggestion = String(suggestion);

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
			mousedown: 'preventDefault',
			click() {
				onselection?.(suggestion, index);
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

	function appendE<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, className: string, content: string): HTMLElementTagNameMap[K] {
		const e = document.createElement(tag);
		e.className = className;
		e.textContent = content;
		parent.append(e);
		return e;
	}
</script>
<script lang="ts">
	import Linq from "@daniel.pickett/linq-js";

	interface Props {
		source?: Iterable<number | string>;
		filter?: string;
		index?: number;
	}

	let {
		source = Linq.empty(),
		filter = $bindable(""),
		index = $bindable(0),
	}: Props = $props();

	const filterLw = $derived(filter?.toLowerCase());
	const results = $derived(Linq(source).where((v) => String(v).toLowerCase().includes(filterLw)).toArray());
	
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