<script lang="ts">
    import type { JsonToken } from "./json";
	import type { ViewerModel } from "./viewer-model";

	export let model: ViewerModel;

	let path: (number | string)[];
	let editing = false;
	let pathText = "";

	function onClick(index: number) {
		if (index === 0) {
			model.selected = model.root;
		} else {
			const slice = path.slice(0, index + 1);
			model.select(slice);
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
			} else if (model.select(path)) {
				//unfocus the input
				this.disabled = true;
				this.disabled = false;
			}
		}
	}

	$: {
		model.addListener(e => {
			if (e.property === "selected") {
				path = e.newValue?.path;
				pathText = path ? path.join("/") : "";
				//pathText = path?.join("/");
			}
		})
	}
</script>
<style lang="scss">
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
		display: flex;
		flex-direction: row;
		user-select: none;

		> li {
			&:not(:last-child)::after {
				content: ">";
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
		flex: 0px 1 1;
		padding: 10px 5px;
		margin: 0;
		outline: none;
		border: none;
		background-color: var(--col-bg-dk)
	}
</style>
{#if model}
<div class="root{editing ? " editing" : ""}">
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