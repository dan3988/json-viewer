<script lang="ts" context="module">
	import lib from "../lib.json";

	const css = [
		chrome.runtime.getURL(lib.bootstrap),
		chrome.runtime.getURL("/lib/viewer.css")
	];
</script>
<script lang="ts">
	import type { ViewerCommandEvent, ViewerModel } from "../viewer-model";
	import type { JsonToken, JsonProperty } from "../json";
	import JsonPropertyComp from "../shared/JsonProperty.svelte";
	import JsonMenu from "./JsonMenu.svelte";
	import { onDestroy, onMount } from "svelte";
	import JsonPathEditor from "./JsonPathEditor.svelte";
	import ContextMenu, { type Coords, type MenuItem, menuBuilder } from "./ContextMenu.svelte";

	export let model: ViewerModel;
	export let indent: string;
	export let indentCount: number;
	export let scheme: string;

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	let contextMenu: [Coords, MenuItem[]] | undefined;
	let menuShown = true;
	let menuC: JsonMenu;
	let menu: HTMLElement;
	let prop: HTMLElement;

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
		const builder = menuBuilder();
		if (selected.value.is("container")) {
			if (selected.expanded) {
				builder
					.item("Collapse", () => selected.setExpanded(false, true))
					.item("Expand All", () => selected.setExpanded(true, true));
			} else {
				builder
					.item("Expand", () => selected.setExpanded(true))
					.item("Expand All", () => selected.setExpanded(true, true));
			}

			builder
				.item("Copy Key", () => copyKey(selected))
				.menu("Copy Value")
					.item("Formatted", () => copyValue(selected.value))
					.item("Minified", () => copyValue(selected.value, true));
		} else {
			builder
				.item("Copy Key", () => copyKey(selected))
				.item("Copy Value", () => copyValue(selected.value));
		}

		contextMenu = [[x, y], builder.build()];
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
			menuShown = pos >= 250;
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
		grid-template-columns: 1fr auto auto;
		grid-template-rows: 1fr auto;
		overflow: hidden;

		> div {
			position: relative;
		}

		&[data-menu-shown="false"] {
			> .gripper,
			> .w-menu {
				display: none;
			}
		}

		&[data-menu-shown="true"] {
			> .menu-btn {
				display: none;
			}
		}
	}
	
	.menu-toggle {
		@include bs-icon-btn("chevron-bar-left", 2px, "color");

		border: none;
		cursor: pointer;
		grid-area: 1 / 2 / span 1 / 3;
		width: .5rem;
	}

	.gripper {
		grid-area: 1 / 2 / span 1 / 3;
		user-select: none;
		cursor: ew-resize;
		width: 5px;
	}

	.w-prop,
	.w-path {
		font-family: monospace;
		font-size: 12px;
	}

	.w-prop {
		position: relative;
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
		width: 30rem;
		min-width: 300px;
		max-width: 80vw;
		margin: $pad-med $pad-med 0 0;
	}

	.menu-btn {
		@include bs-icon-btn("list", 5px, "color");

		position: absolute;
		padding: 5px;
		right: 2rem;
		top: 1rem;
		width: 2.5rem;
		height: 2.5rem;
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
	{#each css as href}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>
<div class="root bg-body text-body" data-scheme={scheme} data-menu-shown={menuShown}>
	{#if contextMenu}
		<ContextMenu pos={contextMenu[0]} items={contextMenu[1]} on:closed={() => contextMenu = undefined}/>
	{/if}
	<div class="w-prop" tabindex="0" bind:this={prop} on:keydown={onKeyDown}>
		<JsonPropertyComp model={model} prop={model.root} indent={0} maxIndentClass={indentCount}/>
	</div>
	<div class="w-path">
		<JsonPathEditor model={model}/>
	</div>
	<div class="gripper" on:mousedown={onMouseDown}/>
	<div class="w-menu" bind:this={menu}>
		<JsonMenu {model} bind:this={menuC}/>
	</div>
	<button class="menu-btn btn btn-primary rounded-circle" on:click={() => menuShown = true}></button>
</div>