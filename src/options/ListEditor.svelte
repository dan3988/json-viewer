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

	function deleteAt(index: number) {
		let copy = Array(items.length - 1);
		let i = 0;

		while (i < index)
			copy[i] = items[i++];

		while (i < copy.length)
			copy[i] = items[++i];

		items = copy;
	}

	function onKeyDown(this: HTMLInputElement, e: KeyboardEvent) {
		if (e.key === "Enter") {
			const evt = new Event("focusout");
			this.dispatchEvent(evt);
		}
	}

	function onFocusOut(e: HTMLInputElement, index: number) {
		const newValue = e.value;
		if (newValue === items[index])
			return;

		let copy = Array(items.length);
		let i = 0;

		while (i < index)
			copy[i] = items[i++];

		copy[i++] = newValue;

		while (i < items.length)
			copy[i] = items[i++];

		items = copy;
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
		@include img-btn-url("delete.svg");

		&::before {
			inset: $pad-med;
			background-color: var(--col-bg-err);
		}
	}

	.btn-help {
		@include hv-b4;
		@include img-btn-url("info.svg", var(--col-blue));
	}

	.root {
		@include border-rnd;
		@include font-elem;

		display: flex;
		flex-direction: column;

		> .head {
			padding: $pad-med;
			display: flex;
			gap: 5px;

			> span.button {
				@include hv;

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
			overflow-y: scroll;

			> li {
				display: flex;
				
				> .btn-rm {
					@include anim-short(opacity);

					opacity: 0;
				}

				&:hover {
					> .btn-rm {
						opacity: 1;
					}
				}

				> .button {
					@include hv;

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
<div class="root flex-fill border rounded">
	<div class="head nav-header border-bottom bg-body-tertiary">
		{#if help}
		<span class="button btn-help" title={help}></span>
		{/if}
		<span class="title">{title}</span>
	</div>
	<ul class="list">
		{#each items as item, i}
		<li>
			<input class="value" type="text" placeholder="Empty" on:focusout={evt => onFocusOut(evt.currentTarget, i)} value={item}/>
			<span class="button btn-rm" title="Delete" on:click={() => deleteAt(i)}></span>
		</li>
		{/each}
		<li class="pc">
			<input class="value" type="text" placeholder="Add" on:focusout={evt => onPlaceholderFocusOut(evt.currentTarget)} on:keydown={onKeyDown}/>
		</li>
	</ul>
</div>