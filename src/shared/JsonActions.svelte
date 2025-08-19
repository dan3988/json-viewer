<script lang="ts" context="module">
	type Callback<A extends any[]> = (...args: A) => void;
	type CallbackArg<A extends any[] = []> = Callback<A> | Falsy;

	export type InsertSiblingMode = 'before' | 'after';
	export type InsertChildMode = 'first' | 'last';
</script>
<script lang="ts">
	import type json from "../json";
	import type ViewerModel from "../viewer-model";
	import Menu from "./Menu.svelte";
	import MenuAction from "./MenuAction.svelte";
	import MenuSub from "./MenuList.svelte";

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

	function copyValue(format?: boolean) {
		const text = model.formatValue(prop.value, !format, true);
		return navigator.clipboard.writeText(text);
	}

	function copyText() {
		const text = model.formatValue(prop.value);
		return navigator.clipboard.writeText(text);
	}
</script>
<div class="root" class:expanded>
	<button class="expander btn btn-base bi" on:click={() => expanded = !expanded}></button>
	{#if expanded}
		<div class="menu-wrapper">
			<Menu title="Menu" close={() => expanded = false}>
				{#if prop.value.is('container')}
					<MenuAction title="Expand (Recursive)" icon="node-plus-fill" action={() => prop.setExpanded(true, true)} />
				{/if}
				<MenuSub title="Copy" icon="clipboard-fill">
					{#if typeof prop.key === 'string'}
						<MenuAction title="Copy Key" icon="key-fill" action={copyKey} />
					{/if}
					<MenuAction title="Copy JSON" icon="braces" action={copyValue} />
					{#if prop.value.is('container')}
						<MenuAction title="Copy JSON (Formatted)" icon="braces-asterisk" action={() => copyValue(true)} />
					{:else if prop.value.is('string')}
						<MenuAction title="Copy Text" icon="fonts" action={copyText} />
					{/if}
				</MenuSub>
				{#if rename}
					<MenuAction title="Rename" icon="input-cursor-text" action={rename} />
				{/if}
				{#if remove}
					<MenuAction title="Delete" icon="trash-fill" action={remove} />
				{/if}
				{#if edit}
					<MenuAction title="Edit Value" icon="pencil-fill" action={edit} />
				{/if}
				{#if sort}
					<MenuSub title="Sort" icon="funnel-fill">
						<MenuAction title="Sort (A-Z)" icon="sort-alpha-down" action={() => sort(false)} />
						<MenuAction title="Sort (Z-A)" icon="sort-alpha-up" action={() => sort(true)} />
					</MenuSub>
				{/if}
				{#if insertSibling || insertChild}
					<MenuSub title="Insert" icon="plus-lg">
						{#if insertChild}
							<MenuAction title="Insert First" icon="align-top" action={() => insertChild('value', 'first')} />
							<MenuAction title="Insert Last" icon="align-bottom" action={() => insertChild('value', 'last')} />
						{/if}
						{#if insertSibling}
							<MenuAction title="Insert Before" icon="arrow-bar-up" action={() => insertSibling('value', 'before')} />
							<MenuAction title="Insert After" icon="arrow-bar-down" action={() => insertSibling('value', 'after')} />
						{/if}
					</MenuSub>
				{/if}
			</Menu>
		</div>
	{/if}
</div>
<style lang="scss">
	@use "src/core.scss" as *;

	.root {
		--expander-icon: "\F64D";
		--line-color: var(--jv-tertiary-border);

		z-index: 5;

		&.expanded {
			--expander-icon: "\F63B";
		}
	}

	.expander {
		--bs-btn-padding-x: 0.1rem;
		--bs-btn-padding-y: 0.1rem;

		font-size: 0.7rem;
		border: none;
		border-radius: calc(var(--bs-border-radius) - $pad-small);

		&::before {
			content: var(--expander-icon);
		}
	}

	.menu-wrapper {
		font-family: var(--bs-body-font-family);
		position: absolute;
		margin-top: calc(var(--bs-border-width) * -1);
		margin-left: calc(var(--bs-border-width) + ($pad-small * 2));
		top: 0;
		left: 100%;
	}
</style>