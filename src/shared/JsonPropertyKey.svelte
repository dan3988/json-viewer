<script lang="ts">
	import type ViewerModel from "../viewer-model.js";
	import { renderKey } from "../renderer.js";
	import json from '../json';
	import edits from "../viewer/editor-helper.js";

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let editing = false;

	$: ({ isSelected } = prop.state.props);

	let element: HTMLElement;

	function onClick(evt: MouseEvent) {
		evt.preventDefault();
		if (evt.shiftKey) {
			//evt.preventDefault();
			model.selected[evt.ctrlKey ? "add" : "reset"](prop, true);
		} else {
			model.selected[evt.ctrlKey ? "toggle" : "reset"](prop);
		}

		window.getSelection()?.removeAllRanges();
	}

	function renderEditor(target: HTMLElement) {
		function finish() {
			editing = false;
			if (prop.key !== value) {
				edits.renameProperty(model, prop.parent as json.JObject, prop as json.JProperty<string>, value);
			}
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
				}
			},
			focusout: finish,
			beforeinput(evt) {
				if (evt.inputType === 'insertParagraph') {
					finish();
				}
			}
		});

		let value = prop.key as string;
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
<span bind:this={element} class="root" class:editing class:selected={$isSelected} on:mousedown|preventDefault on:click={onClick}>
	{#if editing}
		<span class="text" role="textbox" tabindex="-1" contenteditable="true" use:renderEditor></span>
	{:else}
		<span class="text" use:renderKey={prop.key} on:dblclick={() => editing = true}></span>
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