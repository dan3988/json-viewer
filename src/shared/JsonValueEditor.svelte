<script lang="ts" module>
	function stopPropagation(evt: Event) {
		evt.stopPropagation();
	}
</script>
<script lang="ts">
	import type { JsonRendererParam, Renderer } from "../renderer";
	import "../dom-extensions";
	import JsonSearch from "../search.svelte";
	import Button, { ButtonTheme } from "../components/button";
	import { InserterManager } from "./JsonInsert.svelte";
	import { renderText } from "../renderer";

	type T = $$Generic<any>;

	interface Props {
		value: T;
		search?: undefined | JsonSearch;
		searchType?: JsonSearch.Mode;
		parse: (text: string) => T;
		serialize?: (value: T) => string;
		renderer?: (target: HTMLElement, value: JsonRendererParam<T>) => Renderer;
		readonly?: boolean;
		editing?: boolean;
		onfinish?: ((value: T, group: boolean) => void) | Falsy;
		oncancel?: VoidFunction | Falsy;
		onclose?: VoidFunction | Falsy;
		onediting?: VoidFunction | Falsy;
		allowUnchanged?: boolean;
		autoSelect?: boolean;
	}

	let {
		value,
		search,
		searchType = JsonSearch.Mode.None,
		parse,
		serialize = String,
		renderer = renderText,
		readonly = false,
		editing = $bindable(false),
		onfinish,
		oncancel,
		onclose,
		onediting,
		allowUnchanged = false,
		autoSelect = false,
	}: Props = $props();

	const { blocker } = InserterManager.current;

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

	function focus(target: HTMLElement) {
		target.focus();
		const range = document.createRange();
		let selection: null | Selection;
		if (autoSelect && (selection = window.getSelection())) {
			range.selectNodeContents(target);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}

	function renderEditor(target: HTMLElement, originalValue: T) {
		function finish() {
			if (!editing) {
				return;
			}

			const text = getText(target);
			const result = parse(text);
			editing = false;
			if (allowUnchanged || result !== originalValue) {
				onfinish && onfinish(result, false);
			} else {
				oncancel && oncancel();
			}

			onclose && onclose();
		}

		const destroy = target.subscribe({
			mousedown: 'stopPropagation',
			click: 'stopPropagation',
			keydown: 'stopPropagation',
			keyup(evt) {
				if (evt.key === "Escape") {
					editing = false;
					oncancel && oncancel();
					onclose && onclose();
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

		const lines = serialize(originalValue).split('\n');
		for (let i = 0; i < lines.length; i++) {
			target.appendChild(document.createTextNode(lines[i]));
			target.appendChild(document.createElement('br'));
		}

		setTimeout(() => focus(target), 0);
		onediting && onediting();
		return { destroy };
	}

	function onCheckboxInput(this: HTMLInputElement) {
		readonly || (onfinish && onfinish(this.checked as any, false));
	}

	function increment(evt: MouseEvent) {
		const mod = evt.ctrlKey ? 10 : 1;
		onfinish && onfinish((+value + mod) as any, true);
	}

	function decrement(evt: MouseEvent) {
		const mod = evt.ctrlKey ? 10 : 1;
		onfinish && onfinish((+value - mod) as any, true);
	}
</script>
<span class="root gap-1" ondblclick={() => editing = !readonly}>
	{#if editing}
		<div class="editor" role="textbox" tabindex="-1" contenteditable="plaintext-only" use:renderEditor={value}></div>
	{:else}
		{#if typeof value === 'boolean'}
			<input type="checkbox" class:readonly use:blocker class="bool-editor form-check-input" checked={value} onclick={stopPropagation} ondblclick={stopPropagation} onchange={onCheckboxInput} />
		{/if}
		<span class="preview" use:renderer={{ value, search, searchType }}></span>
		{#if typeof value === 'number' && !readonly}
			<div class="btn-grop d-flex number-steps" use:blocker onclick={stopPropagation} ondblclick={stopPropagation}>
				<ButtonTheme style="faded">
					<Button icon="dash" title="Decrement" repeat action={decrement} />
					<Button icon="plus" title="Increment" repeat action={increment} />
				</ButtonTheme>
			</div>
		{/if}
	{/if}
</span>
<style lang="scss">
	.root {
		--hover-visibility: collapse;
		flex: 1 1 0;
		align-items: center;
		z-index: 2;
		display: inline-flex;
		position: relative;

		&:hover {
		--hover-visibility: visible;
		}
	}

	.number-steps {
		visibility: var(--hover-visibility);
		
		> :global(.btn) {
			--bs-btn-padding-x: 0;
			--bs-btn-padding-y: 0;
			--bs-btn-font-size: 1.25em;
			//padding-bottom: 1px;
		}
	}

	.bool-editor {
		--checkbox-bg-color: var(--jv-keywd-fg);
		--checkbox-border-color: var(--jv-keywd-fg);
		--checkbox-shadow-color: var(--jv-keywd-fg);
		--focus-shadow-color: rgba(var(--jv-keywd-fg-rgb), 0.5);
		height: 1.2em;
		width: 1.2em;
		margin: 0;

		&.readonly {
			pointer-events: none;
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
		min-width: 1rem;
	}
</style>