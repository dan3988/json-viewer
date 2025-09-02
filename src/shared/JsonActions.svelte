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

	let expanded = false;

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let rename: CallbackArg = undefined;
	export let edit: CallbackArg = undefined;
	export let remove: CallbackArg = undefined;
	export let sort: CallbackArg<[desc: boolean]> = undefined;

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

	function focusHelper(target: HTMLElement) {
		function onFocusOut(evt: FocusEvent) {
			if (!target.contains(evt.relatedTarget as Node | null)) {
				expanded = false;
			}
		}

		let timeout = window.setTimeout(() => {
			timeout = 0;
			target.focus();
			target.addEventListener('focusout', onFocusOut);
		});

		return {
			destroy() {
				if (timeout) {
					window.clearTimeout(timeout);
				} else {
					target.removeEventListener('focusout', onFocusOut);
				}
			}
		}
	}
</script>
<div class="root" class:expanded>
	<button class="expander btn btn-base bi" on:click={() => expanded = true}></button>
	{#if expanded}
		<div class="menu-root border rounded bg-body-tertiary" tabindex="0" use:focusHelper transition:scale={{ duration: 250 }}>
			<Button.Style style="faded">
				{#if prop.value.is('container')}
					<Button text="Expand All" icon="node-plus-fill" action={() => prop.setExpanded(true, true)} />
				{/if}
				<div class="menu-row menu-choice">
					<span class="row-text">
						<Icon icon="clipboard-fill" />
						Copy
					</span>
					{#if typeof prop.key === 'string'}
						<Button title="Copy Key" icon="key-fill" action={copyKey} />
					{/if}
					<Button title="Copy JSON" icon="braces" action={copyValue} />
					{#if prop.value.is('container')}
						<Button title="Copy JSON (Formatted)" icon="braces-asterisk" action={() => copyValue(true)} />
					{:else if prop.value.is('string')}
						<Button title="Copy Text" icon="fonts" action={copyText} />
					{/if}
				</div>
				{#if rename}
					<Button text="Rename" icon="input-cursor-text" action={rename} />
				{/if}
				{#if remove}
					<Button text="Delete" icon="trash-fill" action={remove} />
				{/if}
				{#if edit}
					<Button text="Edit Value" icon="pencil-fill" action={edit} />
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
			</Button.Style>
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