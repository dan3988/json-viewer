<script lang="ts" context="module">
	export interface ListValidator {
		validate(items: readonly string[], index: number, item: string): undefined | string;
	}
</script>
<script lang="ts">
	import { slide } from "svelte/transition";

	export let title: string;
	export let items: string[];
	export let help: string = "";
	export let validator: null | ListValidator = null;
	export let expanded = false;

	function onPlaceholderFocusOut(target: HTMLInputElement) {
		const text = target.value;
		if (text) {
			const validation = validator?.validate(items, -1, text);
			if (validation == null) {
				target.value = "";
				target.setCustomValidity("");
				items = [...items, text];
			} else {
				target.setCustomValidity(validation);
				target.reportValidity();
			}
		} else {
			target.setCustomValidity("");
		}
	}

	function onPlaceholderKeyDown(this: HTMLInputElement, e: KeyboardEvent) {
		if (e.key === "Enter") {
			onPlaceholderFocusOut(this);
		} else if (e.key === "Escape") {
			this.value = "";
			this.setCustomValidity("");
			this.blur();
		}
	}

	function deleteAt(index: number) {
		let copy = Array(items.length - 1);
		let i = 0;

		while (i < index)
			copy[i] = items[i++];

		while (i < copy.length)
			copy[i] = items[++i];

		items = copy;
	}

	function tryEdit(e: HTMLInputElement, index: number) {
		const newValue = e.value;
		if (newValue === items[index])
			return;

		if (newValue === "") {
			e.value = items[index];
			e.blur();
			return;
		}

		const validation = validator?.validate(items, index, newValue);
		if (validation) {
			e.setCustomValidity(validation);
			e.reportValidity();
			return;
		}

		e.setCustomValidity("");
		const copy = Array.from(items);
		copy[index] = newValue;
		items = copy;
	}

	function onKeyDown(e: HTMLInputElement, evt: KeyboardEvent, index: number) {
		if (evt.key === "Enter") {
			tryEdit(e, index);
			e.blur();
		} else if (evt.key === "Escape") {
			e.value = items[index];
			e.setCustomValidity("");
			e.blur();
		}
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.value {
		background-color: transparent;
		outline: none;
		color: var(--bs-body-color);
		border: none;
	}

	.button {
		aspect-ratio: 1;
		height: 100%;
		width: min-content;

		&::before {
			background-color: var(--col-border);
		}
	}

	.btn-rm {
		@include bs-icon-btn("trash-fill", $pad-med);

		--bs-btn-border-color: #a52834;
		--bs-btn-hover-border-color: #b02a37;
		--bs-btn-active-border-color: #dc3545;
		--bs-btn-disabled-border-color: #dc3545;
	}

	.btn-help {
		@include bs-icon-btn("info-circle-fill", 2px, ("default": var(--bs-link-color), "hover": var(--bs-link-hover-color)));
	}

	.root {
		display: flex;
		flex-direction: column;

		> .head {
			z-index: 1;
			padding: $pad-med;
			display: flex;
			margin: -1px;
			gap: 5px;

			> span.button {
				flex: 0 0 auto;
			}

			> .title {
				flex: 1 1 auto;
			}
		}

		> .list {
			margin: 0;
			padding: 0;
			max-height: 15rem;
			flex: 1 1 auto;

			> li {
				display: flex;
				padding: 0;

				&:not(:hover) > .btn-rm {
					opacity: 0;
				}

				> .button {
					flex: 0 0 2rem;
				}

				> .value {
					flex: 1 1 0px;
					padding: $pad-med;

					&:focus {
						outline: none;
					}
				}
			}
		}
	}
</style>
<div class="root flex-fill border rounded overflow-hidden expandable" class:expanded>
	<div class="head nav-header border bg-body-tertiary">
		{#if help}
			<span class="button btn-help" title={help}></span>
		{/if}
		<span class="title">{title}</span>
		<span role="button" class="expander btn btn-cust-light border-0" on:click={() => expanded = !expanded}></span>
	</div>
	{#if expanded}
		<ul transition:slide|global class="list list-group list-group-flush overflow-y-scroll">
			{#each items as item, i}
				<li class="list-group-item">
					<input class="value" type="text" placeholder="Empty" on:focusout={evt => tryEdit(evt.currentTarget, i)} on:keydown={e => onKeyDown(e.currentTarget, e, i)} value={item}/>
					<span class="button btn-rm" role="button" title="Delete" on:click={() => deleteAt(i)}></span>
				</li>
			{/each}
			<li class="list-group-item pc">
				<input class="value" type="text" placeholder="Add" on:focusout={evt => onPlaceholderFocusOut(evt.currentTarget)} on:keydown={onPlaceholderKeyDown}/>
			</li>
		</ul>
	{/if}
</div>