<script lang="ts">
	export let selected = false;
	export let editable = false;
	export let editing = false;
	export let onclick: ((evt: MouseEvent) => void) | undefined = undefined;

	let element: HTMLElement;

	export function scrollTo(behavior?: ScrollBehavior) {
		element.scrollIntoView({ behavior, block: 'start' });
	}
</script>
<span bind:this={element} class="root" class:editable class:editing class:selected on:mousedown|preventDefault on:click={onclick}>
	<slot />
</span>
<style lang="scss">
	@use "src/core.scss" as *;

	.root {
		scroll-margin-top: $pad-med;
		cursor: pointer;
		white-space: nowrap;
		user-select: text;
		color: var(--jv-key-fg);
		padding: 2px;
		border-radius: var(--bs-border-radius);
		border: 1px solid transparent;

		&.selected {
			background-color: var(--jv-tertiary-bg);
			color: var(--jv-tertiary-text);
			border-color: var(--jv-tertiary-border);

			&.editable {
				cursor: text;
			}
		}

		&.editing {
			background-color: var(--jv-tertiary-active-bg);
			color: var(--jv-tertiary-active-text);
			border-color: var(--jv-tertiary-active-border);
		}
	}
</style>