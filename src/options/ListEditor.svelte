<script lang="ts">
	export let title: string;
	export let items: string[];
	export let help: string = "";

	function onPlaceholderFocusOut(target: HTMLInputElement) {
		const text = target.value;
		if (text) {
			target.value = "";
			items = [...items, text];
		}
	}

	function onPlaceholderKeyDown(this: HTMLInputElement, e: KeyboardEvent) {
		if (e.key === "Enter") {
			onPlaceholderFocusOut(this);
		} else if (e.key === "Escape") {
			this.value = "";
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
		@include img-btn-url("delete.svg", $pad-med);

		--bs-btn-border-color: #a52834;
		--bs-btn-hover-border-color: #b02a37;
		--bs-btn-active-border-color: #dc3545;
		--bs-btn-disabled-border-color: #dc3545;
	}

	.btn-help {
		@include img-btn-url("info.svg", 2px, var(--bs-blue));
	}

	.root {
		display: flex;
		flex-direction: column;

		> .head {
			padding: $pad-med;
			display: flex;
			gap: 5px;

			> span.button {
				flex: 0 0 auto;
			}

			> span {
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
<div class="root flex-fill border rounded overflow-hidden">
	<div class="head nav-header border-bottom bg-body-tertiary">
		{#if help}
			<span class="button btn-help" title={help}></span>
		{/if}
		<span class="title">{title}</span>
	</div>
	<ul class="list list-group list-group-flush overflow-y-scroll">
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
</div>