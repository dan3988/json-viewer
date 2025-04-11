<script lang="ts">
	import { renderKey } from "../renderer.js";

	export let key: string | number;
	export let selected = false;
	export let editing = false;
	export let onrename: ((name: string) => void) | undefined = undefined;
	export let oncancel: (() => void) | undefined = undefined;
	export let onclick: ((evt: MouseEvent) => void) | undefined = undefined;

	let element: HTMLElement;

	function renderEditor(target: HTMLElement) {
		function finish() {
			if (!editing) {
				return;
			}

			editing = false;
			key = value;
			onrename?.(value);
		}

		const destroy = target.subscribe({
			input(evt) {
				value = target.innerText;
				if ((evt as InputEvent).inputType === 'insertFromPaste') {
					target.innerHTML = value;
				}
			},
			keydown(evt) {
				evt.stopPropagation();
			},
			keyup(evt) {
				if (evt.key === "Escape") {
					editing = false;
					oncancel?.();
				}
			},
			focusout: finish,
			beforeinput(evt) {
				if (evt.inputType === 'insertParagraph') {
					finish();
				}
			}
		});

		let value = String(key);
		target.textContent = value;
		target.focus();
		const range = document.createRange();
		const selection = window.getSelection();
		if (selection) {
			range.selectNodeContents(target);
			selection.removeAllRanges();
			selection.addRange(range);
		}

		return { destroy };
	}


	export function scrollTo(behavior?: ScrollBehavior) {
		element.scrollIntoView({ behavior, block: 'start' });
	}
</script>
<span bind:this={element} class="root" class:editing class:selected on:mousedown|preventDefault on:click={onclick}>
	{#if editing}
		<span class="text" role="textbox" tabindex="-1" contenteditable="true" use:renderEditor></span>
	{:else}
		<span class="text" use:renderKey={key} on:dblclick={() => editing = true}></span>
	{/if}
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
		}

		&.editing {
			background-color: var(--jv-tertiary-active-bg);
			color: var(--jv-tertiary-active-text);
			border-color: var(--jv-tertiary-active-border);
		}
	}

	.text {
		user-select: contain;
		max-lines: 1;
		outline: none;
	}
</style>