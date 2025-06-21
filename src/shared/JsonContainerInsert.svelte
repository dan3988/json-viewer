<script lang="ts" context="module">
	import type json from "../json";
</script>
<script lang="ts">
	export let insert: (type: json.AddType) => void;

	let shown = false;
	let hitbox: HTMLElement;

	function onMouseEnter() {
		shown = true;
	}

	function onMouseLeave() {
		shown = false;
	}
</script>
<div class="root" class:shown>
	<div class="hitbox"
		bind:this={hitbox}
		on:mouseenter={onMouseEnter}
		on:mouseleave={onMouseLeave}>
		{#if shown}
			<div class="content input-group border rounded">
				<span class="btn btn-base bi-braces" title="Insert Object" role="button" on:click={insert.bind(undefined, 'object')}></span>
				<span class="btn btn-base bi-0-circle" title="Insert Array" role="button" on:click={insert.bind(undefined, 'array')}></span>
				<span class="btn btn-base bi-hash" title="Insert Value" role="button" on:click={insert.bind(undefined, 'value')}></span>
			</div>
		{/if}
	</div>
</div>
<style lang="scss">
	.root {
		--hitbox-content: unset;
		z-index: 1;
		position: relative;
		height: 1px;

		&.shown {
			--hitbox-content: "";
			z-index: 5;
		}
	}

	.hitbox {
		--line-color: var(--jv-tertiary-border);
		display: flex;
		align-items: center;
		position: absolute;
		inset: 0;
		margin: -0.5rem 0;

		&:focus-within {
			--line-color: var(--jv-tertiary-hover-border);
		}

		&::before {
			content: var(--hitbox-content);
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

	.btn {
		--bs-btn-padding-x: 0.25rem;
		--bs-btn-padding-y: 0;
	}
</style>