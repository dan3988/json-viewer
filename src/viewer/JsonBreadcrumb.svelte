<script lang="ts">
	import { onDestroy } from "svelte";
	import type { ViewerModel } from "./viewer-model";

	export let model: ViewerModel;

	let pathText = "";
	let path: readonly (number | string)[] = [];
	let editing = false;


	const selected = model.bag.readables.selected;
	const unsub = selected.subscribe(v => {
		path = v?.path ?? [];
		pathText = path.join("/");
	})

	onDestroy(unsub);

	function onClick(index: number) {
		if (index === 0) {
			model.select(["$"], true);
		} else {
			const slice = path.slice(0, index + 1);
			model.select(slice, true);
		}
	}

	function focusIn(this: HTMLInputElement) {
		this.setSelectionRange(0, this.value.length);
		editing = true;
	}

	function focusOut(this: HTMLInputElement) {
		this.value = pathText;
		editing = false;
	}

	function onKeyDown(this: HTMLInputElement, e: KeyboardEvent) {
		if (e.key === "Enter") {
			let path = this.value.split("/").filter(v => v.length);
			if (path.length === 0) {
				model.selected = null;
			} else if (model.select(path, true)) {
				//unfocus the input
				this.disabled = true;
				this.disabled = false;
			}
		}
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.root {
		display: grid;
		grid-template-areas: 1fr;
		align-items: center;

		> .editor {
			opacity: 0;
		}

		&.editing {
			> .editor {
				opacity: unset;
			}

			> .list {
				display: none;
			}
		}
	}

	.list {
		@include font-elem;

		grid-area: 1 / 1 / span 1 / span 1;
		display: flex;
		flex-direction: row;
		user-select: none;

		> li {
			display: flex;
			flex-direction: row;
			align-items: center;

			&:not(:last-child)::after {
				content: "/";
			}
		}
	}

	.path-part {
		z-index: 1;
		cursor: pointer;
		padding: 2px;
		margin: 0 5px;
		border-radius: 5px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 50rem;

		&:hover {
			color: var(--col-match-fg);
			background-color: var(--col-match-bg);
		}
	}

	.editor {
		@include control;

		grid-area: 1 / 1 / span 1 / span 1;
		flex: 0px 1 1;
		margin: 0;
		outline: none;
		border: none;
		background-color: var(--col-bg-dk)
	}
</style>
{#if model}
<div class="root" class:editing>
	<input class="editor" on:focusin={focusIn} on:focusout={focusOut} on:keydown={onKeyDown} value={pathText}/>
	<ul class="list">
		{#if path}
			{#each path as part, index}
				<li>
					<span class="path-part" title={String(part)} on:click={() => onClick(index)}>{part}</span>
				</li>
			{/each}
		{/if}
	</ul>
</div>
{/if}