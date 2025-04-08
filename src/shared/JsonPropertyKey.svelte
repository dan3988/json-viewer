<script lang="ts" context="module">
	function * getAllParents(prop: json.JProperty) {
		let p: null | json.JProperty = prop;
		while (true) {
			if ((p = p.parentProperty) == null)
				break;

			yield p;
		}
	}

	/**
	 * Checks if a property follows or preceeds another. This function assumes that both properties have the same parent
	 * @param origin The beginning property
	 * @param other The property to look for
	 * @param ifTrue The value to return if the property appears after the origin
	 * @param ifFalse The value to return if the property appears before the origin
	 */
	function isFollowing<const V>(origin: json.JProperty, other: json.JProperty, ifTrue: V, ifFalse: V): V;
	function isFollowing(origin: json.JProperty, other: json.JProperty): boolean;
	function isFollowing(origin: json.JProperty, other: json.JProperty, ifTrue: any = true, ifFalse: any = false): any {
		let p: null | json.JProperty = origin;
		while (true) {
			if ((p = p.next) == null)
				return ifFalse;

			if (p === other)
				return ifTrue;
		}
	}

	function getSharedParentIndex(a: json.JProperty[], b: json.JProperty[]): number {
		let result = -1;

		for (let i = 0, l = Math.min(a.length, b.length); i < l; i++) {
			const x = a[i];
			const y = b[i];

			if (x !== y)
				break;

			result = i;
		}

		return result;
	}

	/**
	 * Iterate the properties between 2 given properties.
	 * @param origin
	 * @param other
	 */
	 function * getPropertiesBetween(origin: json.JProperty, other: json.JProperty) {
		if (origin === other)
			return;

		//if the properties have the same parent, we can just yield the properties between the two and return.
		if (origin.parent == other.parent) {
			const key = isFollowing(origin, other, "next", "previous");
			let p = origin;
			do {
				yield p = p[key]!;
			} while (p !== other)

			return;
		}

		const originParents = [...getAllParents(origin)].reverse();
		const otherParents = [...getAllParents(other)].reverse();

		let sharedParentIndex = getSharedParentIndex(originParents, otherParents);
		if (sharedParentIndex < 0)
			return;

		originParents.push(origin);
		otherParents.push(other);
		sharedParentIndex++;

		const originParent = originParents[sharedParentIndex];
		const otherParent = otherParents[sharedParentIndex];
		const [begin, moveNext] = isFollowing(originParent, otherParent, ["first", "next"], ["last", "previous"]);

		//for each parent between the origin and the shared parent, yield all properties until the start / end of the container
		for (let i = originParents.length; ; ) {
			let p = originParents[--i];
			yield p;
			if (i === sharedParentIndex)
				break;

			while (true) {
				if ((p = p[moveNext]!) == null)
					break;

				yield p;
			}
		}

		//now do the opposite, yield all properties from the start / end of each container from the shared parent to the target property
		let p = originParent;
		while (true) {
			let target = otherParents[sharedParentIndex];
			if (p !== target) {
				while (true) {
					let sibling = p[moveNext];
					if (sibling == null)
						return;

					yield (p = sibling);

					if (p === target)
						break;
				}
			}

			if (++sharedParentIndex === otherParents.length)
				break;

			yield p = (target.value as json.JContainer)[begin]!;
		}
	}
</script>
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
		let { last } = model.selected;
		if (evt.shiftKey && last) {
			evt.preventDefault();
			const props = getPropertiesBetween(last, prop);
			if (evt.ctrlKey) {
				model.selected.add(...props)
			} else {
				model.selected.reset(last, ...props);
			}
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