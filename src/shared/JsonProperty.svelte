<script lang="ts" context="module">
	import { isIdentifier } from "../util.js";

	interface Renderer<T = any> {
		update(value: T): void;
		destroy?(): void;
	}

	abstract class AbstractRenderer<T> implements Renderer<T> {
		#target: null | HTMLElement;
		#value: any;

		constructor(target: HTMLElement, value: T) {
			this.#target = target;
			this.#value = value;
			this.onUpdate(target, value);
			this.update = this.update.bind(this);
			this.destroy = this.destroy.bind(this);
		}

		protected abstract onUpdate(target: HTMLElement, value: T): void;

		update(value: any): void {
			if (this.#value !== value && this.#target != null) {
				this.#value = value;
				this.#target.innerHTML = "";
				this.onUpdate(this.#target, value);
			}
		}

		destroy(): void {
			if (this.#target) {
				this.#target.innerHTML = "";
				this.#target = null;
			}
		}
	}

	class JsonValueRenderer extends AbstractRenderer<any> {
		protected onUpdate(target: HTMLElement, value: any): void {
			if (value === null || typeof value !== "string") {
				target.innerText = String(value);
			} else {
				if (value.startsWith("http://") || value.startsWith("https://")) {
					const a = document.createElement("a");
					const text = JSON.stringify(value).slice(1, -1);
					a.href = value;
					a.textContent = text;
					a.target = "_blank";
					target.append(a);
				} else {
					renderEscapedText(target, value);
				}
			}
		}
	}

	export function renderValue(target: HTMLElement, value: any): Renderer {
		return new JsonValueRenderer(target, value);
	}

	function appendSpan(parent: HTMLElement, className: string, text: string, start?: number, end?: number) {
		const span = document.createElement("span");
		span.textContent = start == null ? text : text.slice(start, end);
		span.className = className;
		parent.appendChild(span);
		return span;
	}

	function renderEscapedText(target: HTMLElement, value: string) {
		const json = JSON.stringify(value);

		let last = 1;
		let i = 1;

		appendSpan(target, "quot", "\"");

		while (true) {
			let next = json.indexOf("\\", i);
			if (next < 0) {
				appendSpan(target, "", json, last, -1);
				appendSpan(target, "quot", "\"");
				break;
			} else {
				if (last < next)
					appendSpan(target, "", json, last, last = next);

				let char = json.charAt(++last);
				if (char !== "u") {
					appendSpan(target, "esc", "\\" + char);
					last++;
				} else {
					appendSpan(target, "esc", json, next, last += 5);
				}

				i = last;
			}
		}
	}

	class JsonKeyRenderer extends AbstractRenderer<string | number> {
		protected onUpdate(target: HTMLElement, value: string | number): void {
			if (typeof value !== "string" || isIdentifier(value)) {
				target.textContent = value.toString();
			} else {
				renderEscapedText(target, value);
			}
		}
	}

	function renderKey(target: HTMLElement, key: string | number): Renderer<string | number> {
		return new JsonKeyRenderer(target, key);
	}

</script>
<script lang="ts">
	import type json from "../json.js";
	import type { ViewerCommandEvent, ViewerModel } from "../viewer-model.js";
	import { onDestroy } from "svelte";
	import { writable } from "svelte/store";

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let indent = -1;
	export let maxIndentClass: number;

	$: ({ isExpanded, isHidden, isSelected } = prop.state.props);

	const isPreviousSelected = writable(false);
	const isNextSelected = writable(false);
	
	prop.previous?.state.props.isSelected.subscribe(v => $isPreviousSelected = v);
	prop.next?.state.props.isSelected.subscribe(v => $isNextSelected = v);

	let props: json.JProperty[] = [];

	function update() {
		props = [...prop.value];
	}

	if (prop.value.is("container")) {
		const container = prop.value;
		update();
		container.changed.addListener(update);
		onDestroy(() => container.changed.removeListener(update));
	}

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	function onModelCommand({ command, args: [arg0] }: ViewerCommandEvent) {
		if (command === "scrollTo" && arg0 === prop) {
			keyElement.scrollIntoView({ block: "center" });
		}
	}

	function onExpanderClicked() {
		if (prop.isExpanded) {
			prop.isExpanded = false;
			model.selected.reset(prop);
		} else {
			prop.isExpanded = true;
		}
	}

	function onGutterClicked() {
		model.selected.reset(prop);
		keyElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

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

	function onContextMenu(evt: MouseEvent) {
		if (evt.shiftKey)
			return;

		evt.preventDefault();
		model.selected.reset(prop);
		model.execute("context", prop, evt.clientX, evt.clientY);
	}

	let keyElement: HTMLElement;
</script>
<style lang="scss">
	@use "src/core.scss" as *;

	.json-key {
		scroll-margin-top: $pad-med;
		grid-area: 1 / 2 / span 1 / span 1;
		cursor: pointer;
		white-space: nowrap;
		padding-right: 5px;
		user-select: text;
		color: var(--jv-key-fg);

		&:after {
			color: var(--bs-body-color);
			content: ":";
		}
	}

	:global(.esc) {
		color: var(--jv-num-fg);
	}

	.json-prop {
		--expander-rotate: 0deg;
		display: grid;
		grid-template-columns: 1em auto auto auto 1fr;
		grid-template-rows: auto auto auto;
		border-width: var(--bs-border-width);
		border-color: transparent;
		border-style: solid;

		&[hidden] {
			display: none !important;
		}

		&.selected {
			background-color: rgba(var(--jv-tertiary-bg-rgb), 0.5);
			border-color: transparent var(--bs-border-color);
		}

		&.selected-first {
			border-top-left-radius: var(--bs-border-radius);
			border-top-right-radius: var(--bs-border-radius);
			border-top-color: var(--bs-border-color);
		}

		&.selected-last {
			border-bottom-left-radius: var(--bs-border-radius);
			border-bottom-right-radius: var(--bs-border-radius);
			border-bottom-color: var(--bs-border-color);
		}

		&.for-container {
			&:before,
			&:after {
				color: rgb(var(--jv-indent));
			}

			&:before {
				grid-area: 1 / 3 / span 1 / span 1;
			}

			&:after {
				grid-area: 1 / 5 / span 1 / span 1;
			}

			&.expanded {
				--expander-rotate: 90deg;

				>.prop-count {
					display: none;
				}

				&:after {
					grid-area: 3 / 2 / span 1 / span 1;
				}
			}
		}

		&.for-object {
			&:before {
				content: "{";
			}

			&:after {
				content: "}"
			}
		}

		&.for-array {
			&:before {
				content: "[";
			}

			&:after {
				content: "]"
			}

			> .json-container > :global(li > .json-prop > .json-key) {
				color: var(--jv-num-fg);
			}
		}

		> .prop-count, >.empty-container {
			padding: 0 5px;
			grid-area: 1 / 4 / span 1 / span 1;
		}

		> .prop-count {
			color: var(--jv-num-fg);
		}

		> .empty-container {
			font-style: italic;
			color: var(--col-shadow);
		}

		> .expander {
			grid-area: 1 / 1 / span 1 / span 1;
		}

		> .gutter {
			grid-area: 2 / 1 / span 1 / span 1;
		}
		
		> .json-value {
			grid-area: 1 / 3 / span 1 / span 1;
		}

		> .json-container {
			grid-area: 2 / 2 / span 1 / -1;
		}
	}

	.expander {
		cursor: pointer;
		color: rgba(var(--jv-body-text-rgb), 0.5);
		font-size: x-small;
		rotate: var(--expander-rotate);
		transition: rotate .15s ease-in-out;


		&:hover {
			color: rgb(var(--jv-body-text-rgb));
		}

		&:active {
			color: var(--bs-emphasis-color);
		}
	}

	.gutter {
		cursor: pointer;
		position: relative;

		--indent-bg: rgb(var(--jv-indent), 0.33);

		&:hover {
			--indent-bg: rgb(var(--jv-indent));
		}

		&:before {
			content: "";
			background-color: var(--indent-bg);
			position: absolute;
			inset: 0 50%;
			transform: translateX(-50%);
			width: 2px;
			border-radius: 1px;
		}
	}

	.json-value {
		user-select: text;
		white-space: nowrap;

		&.json-string {
			color: var(--jv-str-fg);
		}

		&.json-number {
			color: var(--jv-num-fg);
		}

		&.json-boolean,
		&.json-null {
			color: var(--jv-keywd-fg);
		}
	}
</style>
{#if prop}
<div
	hidden={$isHidden}
	data-indent={indent % maxIndentClass}
	class="json-prop for-{prop.value.type} for-{prop.value.subtype} json-indent"
	class:expanded={$isExpanded}
	class:selected={$isSelected}
	class:selected-first={$isSelected && !$isPreviousSelected}
	class:selected-last={$isSelected && !$isNextSelected}>
	<span bind:this={keyElement} class="json-key" on:mousedown|preventDefault on:click={onClick} on:contextmenu={onContextMenu} use:renderKey={prop.key}/>
	{#if prop.value.is("container")}
		{#if prop.value.count === 0}
			<span class="empty-container">empty</span>
		{:else}
			<span class="expander bi bi-caret-right-fill" on:click={onExpanderClicked} title={($isExpanded ? "Collapse" : "Expand") + " " + JSON.stringify(prop.key)}></span>
			<span class="prop-count">{prop.value.count}</span>
			{#if $isExpanded}
				<span class="gutter" on:click={onGutterClicked}></span>
				<ul class="json-container json-{prop.value.subtype} p-0 m-0">
					{#each props as prop (prop)}
						<li>
							<svelte:self {model} {prop} {maxIndentClass} indent={indent + 1} />
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	{:else if prop.value.is("value")}
		<span class="json-value json-{prop.value.subtype}" use:renderValue={prop.value.value}/>
	{/if}
</div>
{/if}