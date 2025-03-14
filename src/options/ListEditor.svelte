<script lang="ts" context="module">
	export interface ListValidator {
		validate(items: ImmutableArray<string>, index: number, item: string): undefined | string;
	}
</script>
<script lang="ts">
	import ImmutableArray from "../immutable-array";

	export let title: string;
	export let items: ImmutableArray<string>;
	export let help: string = "";
	export let validator: null | ListValidator = null;

	function onPlaceholderFocusOut(target: HTMLInputElement) {
		const text = target.value;
		if (text) {
			const validation = validator?.validate(items, -1, text);
			if (validation == null) {
				target.value = "";
				target.setCustomValidity("");
				items = ImmutableArray.append(items, text);
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
		items = ImmutableArray.splice(items, index, 1);
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
		items = ImmutableArray.set(items, index, newValue);
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

	.bi {
		color: var(--bi-color);

		&:hover {
			color: var(--bi-hover-color);
		}
	}

	.btn-rm {
		--bi-color: #b02a3799;
		--bi-hover-color: #b02a37;
	}

	.btn-help {
		--bi-color: var(--bs-link-color);
		--bi-hover-color: var(--bs-link-hover-color);
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
<div class="root flex-fill border rounded overflow-hidden">
	<div class="head nav-header border bg-body-tertiary">
		{#if help}
			<span class="button btn-help bi bi-info-circle-fill" title={help}></span>
		{/if}
		<span class="title">{title}</span>
	</div>
	<ul class="list list-group list-group-flush flex-fill overflow-y-scroll">
		{#each items as item, i}
			<li class="list-group-item">
				<input class="value" type="text" placeholder="Empty" on:focusout={evt => tryEdit(evt.currentTarget, i)} on:keydown={e => onKeyDown(e.currentTarget, e, i)} value={item}/>
				<span class="button btn-rm bi bi-trash-fill" role="button" title="Delete" on:click={() => deleteAt(i)}></span>
			</li>
		{/each}
		<li class="list-group-item pc">
			<input class="value" type="text" placeholder="Add" on:focusout={evt => onPlaceholderFocusOut(evt.currentTarget)} on:keydown={onPlaceholderKeyDown}/>
		</li>
	</ul>
</div>