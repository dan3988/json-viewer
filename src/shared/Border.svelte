<script lang="ts">
	export let selected = false;
	export let editable = false;
	export let editing = false;
	export let onclick: ((evt: MouseEvent) => void) | undefined = undefined;

	let element: HTMLElement;

	function onClick(this: HTMLElement, evt: MouseEvent) {
		this.focus();
		onclick?.(evt);
	}

	function focus() {
		element.focus();
	}

	export function scrollTo(behavior?: ScrollBehavior) {
		element.scrollIntoView({ behavior, block: 'nearest' });
	}
</script>
<span bind:this={element} tabindex="0" class="root" class:editable class:editing class:selected on:mousedown|preventDefault on:click={onClick}>
	<slot {focus} />
</span>
<style lang="scss">
	@use "src/core.scss" as *;

	.root {
		display: inline-flex;
		padding: 0 $pad-small;
		gap: $pad-small;
		scroll-margin: $pad-med 0;
		align-items: center;
		cursor: pointer;
		outline: none;
		white-space: nowrap;
		user-select: text;
		color: var(--jv-key-fg);
		border-radius: var(--bs-border-radius);
		border: var(--bs-border-width) solid transparent;

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