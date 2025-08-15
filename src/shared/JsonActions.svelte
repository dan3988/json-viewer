<script lang="ts" context="module">
	type Callback<A extends any[]> = (...args: A) => void;
	type CallbackArg<A extends any[] = []> = Callback<A> | '' | 0 | false | null | undefined;

	export type InsertSiblingMode = 'before' | 'after';
	export type InsertChildMode = 'first' | 'last';
</script>
<script lang="ts">
	import type json from "../json";
	import type ViewerModel from "../viewer-model";

	let expanded = false;

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let rename: CallbackArg = undefined;
	export let edit: CallbackArg = undefined;
	export let remove: CallbackArg = undefined;
	export let sort: CallbackArg<[desc: boolean]> = undefined;
	export let insertSibling: CallbackArg<[type: json.AddType, mode: InsertSiblingMode]> | undefined = undefined;
	export let insertChild: CallbackArg<[type: json.AddType, mode: InsertChildMode]> | undefined = undefined;

	function copyKey() {
		return navigator.clipboard.writeText(String(prop.key));
	}

	function copyValue(minify: boolean, escape?: boolean) {
		const text = model.formatValue(prop.value, minify, escape);
		return navigator.clipboard.writeText(text);
	}

	function callback<A extends any[]>(fn: (...args: A) => void, ...args: A): VoidFunction {
		return () => {
			expanded = false;
			fn.apply(undefined, args);
		}
	}
</script>
<div class="root" class:expanded>
	<button class="expander btn btn-base bi" on:click={() => expanded = !expanded}></button>
	{#if expanded}
		<div class="menu menu-col bg-body-tertiary rounded border">
			<button class="btn btn-base bi-plus-square-fill" on:click={callback(() => prop.setExpanded(true, true))}>Expand (Recursive)</button>
			{#if typeof prop.key === 'string'}
				<button class="btn btn-base bi-key-fill" on:click={callback(copyKey)}>Copy Key</button>
			{/if}
			{#if prop.value.is('container')}
				<button class="btn btn-base bi-braces" on:click={callback(copyValue, true)}>Copy JSON</button>
				<button class="btn btn-base bi-braces-asterisk" on:click={callback(copyValue, false)}>Copy Formatted JSON</button>
			{:else if prop.value.is('string')}
				<button class="btn btn-base bi-fonts" on:click={callback(copyValue, true)}>Copy Text</button>
				<button class="btn btn-base bi-braces" on:click={callback(copyValue, true, true)}>Copy JSON</button>
			{:else}
				<button class="btn btn-base bi-clipboard" on:click={callback(copyKey)}>Copy Value</button>
			{/if}
			{#if rename}
				<button class="btn btn-base bi-input-cursor-text" on:click={callback(rename)}>Rename</button>
			{/if}
			{#if edit}
				<button class="btn btn-base bi-pencil-fill" on:click={callback(edit)}>Edit Value</button>
			{/if}
			{#if remove}
				<button class="btn btn-base bi-trash-fill" on:click={callback(remove)}>Delete</button>
			{/if}
			{#if sort}
				<div class="menu-row">
					<div class="menu-row">
						<button class="btn btn-base bi-sort-alpha-down" title="Sort A-Z" on:click={callback(sort, false)}></button>
						<button class="btn btn-base bi-sort-alpha-up" title="Sort Z-A" on:click={callback(sort, true)}></button>
					</div>
					<span>Sort</span>
				</div>
			{/if}
			{#if insertSibling}
				<div class="menu-row">
					<div class="menu-row">
						<button class="btn btn-base bi-arrow-bar-up" title="Insert Before" on:click={callback(insertSibling, 'value', 'before')}></button>
						<button class="btn btn-base bi-arrow-bar-down" title="Insert After" on:click={callback(insertSibling, 'value', 'after')}></button>
					</div>
					<span>Insert Sibling</span>
				</div>
			{/if}
			{#if insertChild}
				<div class="menu-row">
					<div class="menu-row">
						<button class="btn btn-base bi-align-top" title="Insert First" on:click={callback(insertChild, 'value', 'first')}></button>
						<button class="btn btn-base bi-align-bottom" title="Insert Last" on:click={callback(insertChild, 'value', 'last')}></button>
					</div>
					<span>Insert Child</span>
				</div>
			{/if}
		</div>
	{/if}
</div>
<style lang="scss">
	.root {
		--expander-icon: "\F64D";
		--line-color: var(--jv-tertiary-border);

		position: relative;
		margin-bottom: -1px;
		height: 1px;
		z-index: 5;

		&.expanded {
			--expander-icon: "\F63B";
		}
	}

	.expander {
		--bs-btn-padding-x: 0.1rem;
		--bs-btn-padding-y: 0.1rem;

		font-size: 0.75rem;

		&::before {
			content: var(--expander-icon);
		}
	}

	.menu-col, .menu-row {
		display: flex;
		border: 0 solid var(--jv-tertiary-border);
	}

	.menu-col {
		flex-direction: column;

		> :not(:last-child) {
			border-bottom-width: var(--bs-border-width) !important;
		}
	}

	.menu-row {
		flex-direction: row;

		> :not(:last-child) {
			border-right-width: var(--bs-border-width) !important;
		}
	}

	.menu {
		font-family: var(--bs-body-font-family);
		font-size: 0.9rem;
		position: absolute;
		overflow: hidden;
		margin-left: 2px;
		left: 100%;
		top: 0;
		width: 13rem;

		.btn, span {
			padding: 0.25rem 0.5rem;
		}

		.btn {
			font-size: inherit;
			display: flex;
			gap: 0.5rem;
			align-items: center;
			border-width: 0;
			border-radius: 0;
			border-color: var(--jv-tertiary-border);
		}
	}
</style>