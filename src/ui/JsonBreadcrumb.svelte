<script lang="ts">
    import { PropertyBag, type PropertyChangeEventType } from "./prop";
	import type { ViewerModel } from "./viewer-model";

	export let model: ViewerModel;

	const props = new PropertyBag({ model });

	let pathText = "";
	let path: readonly (number | string)[] = [];
	let isEditing = false;

	props.bag.model.propertyChange.addListener(onModelPropertyChange);
	props.propertyChange.addListener(evt => {
		if (evt.property === "model") {
			evt.oldValue.propertyChange.removeListener(onModelPropertyChange);
			evt.newValue.propertyChange.addListener(onModelPropertyChange);
		}
	})

	function onModelPropertyChange(evt: PropertyChangeEventType<ViewerModel>) {
		if (evt.property === "selected") {
			path = evt.newValue?.path ?? [];
			pathText = path.join("/");
		}
	}

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
		isEditing = true;
	}

	function focusOut(this: HTMLInputElement) {
		this.value = pathText;
		isEditing = false;
	}

	function onKeyDown(this: HTMLInputElement, e: KeyboardEvent) {
		if (e.key === "Enter") {
			let path = this.value.split("/").filter(v => v.length);
			if (path.length === 0) {
				model.selected = null;
			} else if (model.select(path)) {
				//unfocus the input
				this.disabled = true;
				this.disabled = false;
			}
		}
	}

	$: props.bag.model = model;
</script>
<style lang="scss">
	@use "./core.scss" as *;

	.root {
		display: flex;
		gap: 0;
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
		cursor: pointer;
		padding: 2px;
		margin: 0 5px;
		border-radius: 5px;

		&:hover {
			color: var(--col-match-fg);
			background-color: var(--col-match-bg);
		}
	}

	.editor {
		@include control;

		flex: 0px 1 1;
		margin: 0;
		outline: none;
		border: none;
		background-color: var(--col-bg-dk)
	}
</style>
{#if model}
<div class="root{isEditing ? " editing" : ""}">
	<ul class="list">
		{#if path}
			{#each path as part, index}
				<li>
					<span class="path-part" on:click={() => onClick(index)}>{part}</span>
				</li>
			{/each}
		{/if}
	</ul>
	<input class="editor" on:focusin={focusIn} on:focusout={focusOut} on:keydown={onKeyDown} value={pathText}/>
</div>
{/if}