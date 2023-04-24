<script lang="ts">
	import type { ViewerModel } from "./viewer-model";
	import JsonProperty from "./JsonProperty.svelte";
	import JsonMenu from "./JsonMenu.svelte";
    import { onDestroy, onMount } from "svelte";
	import settings from "../settings";
    import type { JsonToken } from "./json";
    import JsonPathEditor from "./JsonPathEditor.svelte";

	export let model: ViewerModel;

	const getter = settings.get().then((v) => {
		indentChar = v.indentChar;
		indentCount = v.indentCount;
		indent = indentChar.repeat(indentCount);
	});

	settings.addListener(({ changes }) => {
		let change = false;
		if (changes.indentChar) {
			change = true;
			indentChar = changes.indentChar.newValue;
		}

		if (changes.indentCount) {
			change = true;
			indentCount = changes.indentCount.newValue;
		}

		if (change)
			indent = indentChar.repeat(indentCount);
	})

	let indentChar = "\t";
	let indentCount = 1;
	let indent = indentChar;

	async function copy(token: JsonToken) {
		let text: string;
		if (token.is("value")) {
			text = String(token.value);
		} else {
			await getter;
			text = JSON.stringify(token, undefined, indent);
		}
		
		await navigator.clipboard.writeText(text);
	}

	function onKeyDown(e: KeyboardEvent) {
		switch (e.key) {
			case "Escape":
				model.selected = null;
				e.preventDefault();
				break;
			case " ":
				model.selected?.toggleExpanded();
				e.preventDefault();
				break;
			case "C":
			case "c":
				if (e.ctrlKey) {
					const selection = window.getSelection();
					if (selection != null && selection.type !== "Caret")
						break;

					const value = model.selected?.value;
					if (value != null) {
						e.preventDefault();
						copy(value);
					}
				}
				break;
			case "ArrowDown":
				if (!e.shiftKey) {
					const selected = model.selected;
					if (selected != null) {
						let v = selected.next;
						if (v != null || (v = selected.parent?.first ?? null) != null)
							model.setSelected(v, false, true);
					} else {
						model.setSelected(model.root, false, true);
					}

					e.preventDefault();
				}
				break;
			case "ArrowUp":
				if (!e.shiftKey) {
					const selected = model.selected;
					if (selected != null) {
						let v = selected.previous;
						if (v != null || (v = selected.parent?.last ?? null) != null)
							model.setSelected(v, false, true);
					} else {
						model.setSelected(model.root, false, true);
					}

					e.preventDefault();
				}
				break;
			case "ArrowRight": {
				if (!e.shiftKey) {
					const selected = model.selected;
					if (selected && selected.value.is("container") && selected.value.first != null) {
						selected.expanded = true;
						model.setSelected(selected.value.first, false, true);
						e.preventDefault();
					}
				}
				break;
			}
			case "ArrowLeft": {
				if (!e.shiftKey) {
					const selected = model.selected;
					if (selected && selected.parent)
						model.setSelected(selected.parent.parentProperty, true, true);

					e.preventDefault();
				}
				break;
			}
		}
	}

	let prop: HTMLElement;
	let menu: HTMLElement;

	// function safeSubscribe<T>(v: Readable<T>, s: Subscriber<T>) {
	// 	onDestroy(v.subscribe(s));
	// }

	onMount(() => prop.focus());

	let dragStart: undefined | { x: number, w: number };

	function onMouseDown(evt: MouseEvent) {
		dragStart = { x: evt.x, w: menu.clientWidth };
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	}

	function onMouseMove(evt: MouseEvent) {
		if (dragStart) {
			const pos = Math.max(0, dragStart.w + dragStart.x - evt.x);
			menu.style.width = pos + "px";
		}
	}

	function onMouseUp() {
		dragStart = undefined;
		document.removeEventListener("mousemove", onMouseMove);
		document.removeEventListener("mouseup", onMouseUp);
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

	.root {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: 1fr 5px auto;
		grid-template-rows: 1fr auto;
		overflow: hidden;

		> div {
			position: relative;
		}
	}

	.gripper {
		grid-area: 1 / 2 / -1 / 3;
		user-select: none;
		cursor: ew-resize;
	}

	.w-prop {
		font-family: monospace;
		font-size: 12px;

		padding: $pad-small;
		grid-area: 1 / 1 / -2 / span 1;
		overflow: scroll;

		&:focus-visible {
			outline: none;
			backdrop-filter: var(--flt-bright-hv);
		}
	}

	.w-path {
		--font-family: monospace;
		grid-area: -2 / 1 / -1 / -1;
		padding: $pad-med;
	}

	.w-menu {
		grid-area: 1 / -2 / -2 / -1;
		min-width: 30rem;
		max-width: 80vw;
		margin: $pad-med $pad-med 0 0;
	}

	@media only screen and (max-width: 900px) {
		.root {
			grid-template-columns: 1fr;
			grid-template-rows: 20rem 1fr auto;
		}

		.w-menu {
			grid-area: 1 / 1 / span 1 / -1;
			width: unset !important;
			max-width: unset;
			margin: $pad-med;
		}

		.w-prop {
			@include border-rnd;
			grid-area: 2 / 1 / span 1 / -1;
			margin: 0 $pad-med;
		}

		.w-path {
			grid-area: 3 / 1 / span 1 / -1;
		}
	}
</style>

<div class="root">
	<div class="w-prop" tabindex="0" bind:this={prop} on:keydown={onKeyDown}>
		<JsonProperty model={model} prop={model.root} indent={0}/>
	</div>
	<div class="gripper" on:mousedown={onMouseDown}/>
	<div class="w-path">
		<JsonPathEditor model={model}/>
	</div>
	<div class="w-menu" bind:this={menu}>
		<JsonMenu model={model}/>
	</div>
</div>