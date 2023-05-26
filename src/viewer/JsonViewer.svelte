<script lang="ts">
	import type { ViewerCommandEvent, ViewerModel } from "../viewer-model";
	import type { JsonToken, JsonProperty } from "../json";
	import JsonPropertyComp from "../JsonProperty.svelte";
	import JsonMenu from "./JsonMenu.svelte";
	import { onDestroy, onMount } from "svelte";
	import JsonPathEditor from "./JsonPathEditor.svelte";
	import ContextMenu, { type Coords, type MenuItem, createMenu, addMenuItems } from "./ContextMenu.svelte";

	export let model: ViewerModel;
	export let indent: string;
	export let indentStyle: readonly [url: string, count: number];
	export let jsonStyle: string;

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	let contextMenu: [Coords, MenuItem[]] | undefined;

	function copyKey(property: JsonProperty) {
		return navigator.clipboard.writeText(String(property.key));
	}

	function copyValue(token: JsonToken, minify?: boolean) {
		let text: string;
		if (token.is("value")) {
			text = String(token.value);
		} else {
			text = JSON.stringify(token, undefined, minify ? undefined : indent);
		}
		
		return navigator.clipboard.writeText(text);
	}

	function onModelCommand(evt: ViewerCommandEvent) {
		if (evt.command === "context") {
			const [prop, x, y] = evt.args;
			openContextMenu(prop, x, y);
		}
	}

	function openContextMenu(selected: JsonProperty, x: number, y: number) {
		let items: MenuItem[];
		if (selected.value.is("container")) {
			items = [];
			if (selected.expanded) {
				addMenuItems(items, [
					["Collapse", () => selected.setExpanded(false, true)],
					["Expand All", () => selected.setExpanded(true, true)]
				]);
			} else {
				addMenuItems(items, [
					["Expand", () => selected.setExpanded(true)],
					["Expand All", () => selected.setExpanded(true, true)]
				]);
			}

			addMenuItems(items, [
				["Copy Key", () => copyKey(selected)],
				["Copy Value", [
					["Formatted", () => copyValue(selected.value)],
					["Minified", () => copyValue(selected.value, true)],
				]],
			]);
		} else {
			items = createMenu([
				["Copy Key", () => copyKey(selected)],
				["Copy Value", () => copyValue(selected.value)],
			]);
		}

		contextMenu = [[x, y], items];
	}

	function onKeyDown(e: KeyboardEvent) {
		switch (e.code) {
			case "Escape":
				model.selected = null;
				e.preventDefault();
				break;
			case "Space":
				model.selected?.toggleExpanded();
				e.preventDefault();
				break;
			case "KeyF":
				if (e.ctrlKey) {
					e.preventDefault();
					menuC.focusSearch();
				}
				break;
			case "KeyC":
				if (e.ctrlKey) {
					const selection = window.getSelection();
					if (selection != null && selection.type !== "Caret")
						break;

					const value = model.selected?.value;
					if (value != null) {
						e.preventDefault();
						copyValue(value);
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
	let menuC: JsonMenu;

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

	.w-prop,
	.w-path {
		font-family: monospace;
		font-size: 12px;
	}

	.w-prop {
		padding: $pad-small;
		grid-area: 1 / 1 / -2 / span 1;
		overflow: scroll;

		&:focus-visible {
			outline: none;
			backdrop-filter: var(--flt-bright-hv);
		}
	}

	.w-path {
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
			grid-area: 2 / 1 / span 1 / -1;
			margin: 0 $pad-med;
		}

		.w-path {
			grid-area: 3 / 1 / span 1 / -1;
		}
	}
</style>
<svelte:head>
	<link rel="stylesheet" href={jsonStyle} />
	<link rel="stylesheet" href={indentStyle[0]} />
</svelte:head>
<div class="root bg-body text-body">
	{#if contextMenu}
		<ContextMenu pos={contextMenu[0]} items={contextMenu[1]} on:closed={() => contextMenu = undefined}/>
	{/if}
	<div class="w-prop" tabindex="0" bind:this={prop} on:keydown={onKeyDown}>
		<JsonPropertyComp model={model} prop={model.root} indent={0} maxIndentClass={indentStyle[1]}/>
	</div>
	<div class="gripper" on:mousedown={onMouseDown}/>
	<div class="w-path">
		<JsonPathEditor model={model}/>
	</div>
	<div class="w-menu" bind:this={menu}>
		<JsonMenu {model} bind:this={menuC}/>
	</div>
</div>