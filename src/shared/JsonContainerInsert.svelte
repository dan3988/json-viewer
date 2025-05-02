<script lang="ts" context="module">
	import { writable, type Writable } from "svelte/store";
	import type json from "../json";

	const locked = writable(false);
</script>
<script lang="ts">
	export let name: Writable<string> | undefined = undefined;
	export let insert: (type: json.AddType) => void;

	function focusChange(evt: FocusEvent) {
		$locked = evt.type === 'focusin';
	}
</script>
<div class="root">
	<div class="hitbox" class:hoverable={!$locked}>
		<div class="content input-group border rounded">
			{#if name}
				<input type="text" class="form-control" placeholder="Name" on:focusin={focusChange} on:focusout={focusChange} bind:value={$name} />
			{/if}
			<span class="btn btn-base bi-braces" title="Insert Object" role="button" on:click={insert.bind(undefined, 'object')}></span>
			<span class="btn btn-base bi-0-circle" title="Insert Array" role="button" on:click={insert.bind(undefined, 'array')}></span>
			<span class="btn btn-base bi-hash" title="Insert Value" role="button" on:click={insert.bind(undefined, 'value')}></span>
		</div>
	</div>
</div>
<style lang="scss">
	.root {
		z-index: 1;
		position: relative;
		height: 1px;
	}

	.hitbox {
		--content-visibility: hidden;
		--line-color: var(--jv-tertiary-border);
		display: flex;
		align-items: center;
		position: absolute;
		inset: 0;
		margin: -0.5rem 0;

		&:focus-within {
			--line-color: var(--jv-tertiary-hover-border);
		}

		&.hoverable:hover, &:focus-within {
			--content-visibility: visible;
		}

		&::before {
			content: "";
			visibility: var(--content-visibility);
			//display: var(--content-display);
			position: absolute;
			width: 15rem;
			left: 1rem;
			top: 50%;
			bottom: 50%;
			margin: -0.5px 0;
			background-color: var(--line-color);
		}
	}

	.content {
		width: auto;
		visibility: var(--content-visibility);
		display: flex;
		position: absolute;
		left: 15rem;

		> * {
			margin: -1px;
		}
	}

	.form-control {
		font-size: 0.8rem;
		padding: 0 0.25rem;
	}

	.btn {
		--bs-btn-padding-x: 0.25rem;
		--bs-btn-padding-y: 0;
	}
</style>