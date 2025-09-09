<script lang="ts" context="module">
	type Callback<A extends any[]> = (...args: A) => void;
	type CallbackArg<A extends any[] = []> = Callback<A> | Falsy;
</script>
<script lang="ts">
	import type json from "../json";
	import type ViewerModel from "../viewer-model";
	import { scale } from "svelte/transition";
	import Button from "../components/button";
	import Icon from "../components/Icon.svelte";

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let rename: CallbackArg = undefined;
	export let edit: CallbackArg = undefined;
	export let remove: CallbackArg = undefined;
	export let sort: CallbackArg<[desc: boolean]> = undefined;
	export let close: VoidFunction;

	function wrap<A extends any[]>(fn: (...args: A) => void, ...args: A): VoidFunction {
		return () => {
			close();
			fn.apply(undefined, args);
		}
	}

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
<div class="menu-root border rounded bg-body-tertiary" transition:scale={{ duration: 150 }}>
	<Button.Theme style="faded">
		{#if prop.value.is('container')}
			<Button text="Expand All" icon="node-plus-fill" action={wrap(() => prop.setExpanded(true, true))} />
		{/if}
		<div class="menu-row menu-choice">
			<span class="row-text">
				<Icon icon="clipboard-fill" />
				Copy
			</span>
			{#if typeof prop.key === 'string'}
				<Button title="Copy Key" icon="key-fill" action={wrap(copyKey)} />
			{/if}
			<Button title="Copy JSON" icon="braces" action={wrap(copyValue)} />
			{#if prop.value.is('container')}
				<Button title="Copy JSON (Formatted)" icon="braces-asterisk" action={wrap(copyValue, true)} />
			{:else if prop.value.is('string')}
				<Button title="Copy Text" icon="fonts" action={wrap(copyText)} />
			{/if}
		</div>
		{#if rename}
			<Button text="Rename" icon="input-cursor-text" action={wrap(rename)} />
		{/if}
		{#if remove}
			<Button text="Delete" icon="trash-fill" action={wrap(remove)} />
		{/if}
		{#if edit}
			<Button text="Edit Value" icon="pencil-fill" action={wrap(edit)} />
		{/if}
		{#if sort}
			<div class="menu-row menu-choice">
				<span class="row-text">
					<Icon icon="sort-down" />
					Sort
				</span>
				<Button title="Sort (A-Z)" icon="sort-alpha-down" action={() => sort(false)} />
				<Button title="Sort (Z-A)" icon="sort-alpha-up" action={() => sort(true)} />
			</div>
		{/if}
	</Button.Theme>
</div>
<style lang="scss">
	@use "src/core.scss" as *;

	.menu-root,
	.menu-row,
	.row-text {
		display: flex;

		> :global(.btn) {
			--bs-btn-padding-x: #{$pad-med};
			--bs-btn-padding-y: #{$pad-med};
			font-size: inherit;
		}
	}

	.menu-choice > :global(.btn) {
		--bs-btn-padding-x: calc(#{$pad-med} + 0.25rem);
	}

	.menu-root {
		outline: none;
		transform-origin: top left;
		--bs-bg-opacity: 0.5;
		font-size: 0.85rem;
		padding: $pad-small;
		flex-direction: column;
		backdrop-filter: blur(5px);
		font-family: var(--bs-body-font-family);
		position: absolute;
		margin-top: calc(var(--bs-border-width) * -1);
		margin-left: calc(var(--bs-border-width) + ($pad-small * 2));
		top: 0;
		left: 100%;
	}

	.menu-row {
		flex-direction: row;

		> :global(*) {
			flex: 0 0 auto;
		}
	}

	.row-text {
		color: rgba(var(--bs-tertiary-color-rgb), 0.75);
		gap: .5rem;
		padding: $pad-med;
		border: 1px solid transparent;
		flex: 1 1 0;
		align-items: center;
		font-weight: 400;
	}
</style>