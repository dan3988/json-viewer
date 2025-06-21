<script lang="ts">
	import "../dom-extensions";
	import { renderText, type Renderer } from "../renderer";

	type T = $$Generic<any>;

	export let value: T;
	export let parse: (text: string) => T;
	export let serialize: (value: T) => string = String;
	export let renderer: (target: HTMLElement, value: T) => Renderer = renderText;
	export let disabled = false;
	export let editing = false;
	export let onchange: undefined | ((value: T) => void) = undefined;
	export let oncancel: undefined | VoidFunction = undefined;
	export let autoSelect = false;

	/**
	 * If a span is empty 
	 * @param value
	 */
	function getText(target: HTMLElement) {
		const parts = [];
		for (const child of target.childNodes) {
			if (child.nodeName === 'BR') {
				parts.push('\n');
			} else {
				parts.push(child.textContent ?? '');
			}
		}

		if (parts.at(-1) === '\n')
			parts.pop();

		return parts.join('');
	}

	function renderEditor(target: HTMLElement, originalValue: T) {
		function finish() {
			if (!editing) {
				return;
			}

			const text = getText(target);
			const result = parse(text);
			editing = false;
			if (onchange && originalValue !== result)
				onchange(result);
		}

		const destroy = target.subscribe({
			keydown(evt) {
				evt.stopPropagation();
			},
			keyup(evt) {
				if (evt.key === "Escape") {
					editing = false;
					oncancel?.();
				}
			},
			keypress(evt) {
				if (evt.key === "Enter" && !evt.shiftKey) {
					evt.preventDefault();
					finish();
				}
			},
			focusout: finish,
			beforeinput(evt) {
				if (evt.inputType === 'insertLineBreak') {
					const selection = getSelection(), range = selection?.getRangeAt(0);
					if (range) {
						evt.preventDefault();
						const br = document.createElement('br');
						range.deleteContents();
						range.insertNode(br);
						range.setStartAfter(br);
						range.setEndAfter(br);
						range.collapse(false);
						selection!.removeAllRanges();
						selection!.addRange(range);
					}
				}
			}
		});

		const text = serialize(originalValue).split('\n');
		for (let i = 0; i < text.length; i++) {
			target.appendChild(document.createTextNode(text[i]));
			target.appendChild(document.createElement('br'));
		}

		target.focus();
		const range = document.createRange();
		let selection: null | Selection;
		if (autoSelect && (selection = window.getSelection())) {
			range.selectNodeContents(target);
			selection.removeAllRanges();
			selection.addRange(range);
		}

		return { destroy };
	}
</script>
<span class="root">
	{#if editing}
		<div class="editor" role="textbox" tabindex="-1" contenteditable="plaintext-only" use:renderEditor={value} />
	{:else}
		<span class="preview" use:renderer={value} on:dblclick={() => editing = !disabled}></span>
	{/if}
</span>
<style lang="scss">
	.root {
		z-index: 2;
		display: inline-flex;
		position: relative;
		
		> span {
			flex: 1 1 0;
		}
	}

	.editor {
		display: inline-block;
		z-index: 1;
		flex: 1 1 0;
		overflow-x: hidden;
		overflow-y: auto;
		outline: none;
		white-space: pre-wrap;
		max-height: 10rem;
	}
</style>