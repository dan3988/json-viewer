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
	export let menuAlign: string;
	export let scheme: string;

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	let contextMenu: [Coords, MenuItem[]] | undefined;
	let menuShown = false;
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

	function onGrabberMouseDown(evt: MouseEvent) {
		const startX = evt.x;
		const startW = menu.clientWidth;
		const direction = menuAlign === "r" ? 1 : -1;
		const handler = function(evt: MouseEvent) {
			const pos = Math.max(0, startW + (startX - evt.x) * direction);
			menuShown = pos >= 150;
			menu.style.width = pos + "px";
		}

		document.addEventListener("mousemove", handler);
		document.addEventListener("mouseup", () => document.removeEventListener("mousemove", handler), { once: true });
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

	.root {
		position: absolute;
		inset: 0;
		display: grid;
		overflow: hidden;

		$break: 900px;
		$gap-h: 5rem;
		
		@media only screen and (max-width: $break) {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto 1fr auto;
			grid-template-areas: "menu" "grab" "prop" "path";

			> .w-prop {
			}

			> .w-menu {
				width: unset !important;
				min-height: 20rem;
				padding: $pad-med;
			}

			> .gripper {
				cursor: ns-resize;
				height: 5px;
			}
		}
		
		@media only screen and (min-width: $break) {
			grid-template-rows: 1fr auto;
			max-height: 100vh;

			&[data-menu-align="l"] {
				grid-template-columns: auto auto 1fr;
				grid-template-areas:
					"menu grab prop"
					"path path path";
				
				> .w-menu {
					margin-left: $pad-med;
				}
			}

			&[data-menu-align="r"] {
				grid-template-columns: 1fr auto auto;
				grid-template-areas:
					"prop grab menu"
					"path path path";
				
				> .w-menu {
					margin-right: $pad-med;
				}
			}

			> .w-menu {
				height: 100%;
				width: 30rem;
				min-width: 350px;
				max-width: 80vw;
				margin-top: $pad-med;
			}

			> .gripper {
				cursor: ew-resize;
				width: 5px;
			}
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

		cursor: pointer;
		border: none;
		width: .5rem;
	}

	.gripper {
		grid-area: grab;
		user-select: none;
	}

	.w-prop,
	.w-path {
		font-family: monospace;
		font-size: 12px;
	}

	.w-prop {
		grid-area: prop;
		position: relative;
		padding: $pad-small;
		overflow: scroll;

		&:focus-visible {
			outline: none;
			backdrop-filter: var(--flt-bright-hv);
		}
	}

	.w-path {
		grid-area: path;
		padding: $pad-med;
	}

	.w-menu {
		grid-area: menu;
		display: grid;
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
</style>
<svelte:head>
	{#each css as href}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>
<div class="root bg-body" data-scheme={scheme} data-menu-shown={menuShown} data-menu-align={menuAlign}>
	{#if contextMenu}
		<ContextMenu pos={contextMenu[0]} items={contextMenu[1]} on:closed={() => contextMenu = undefined}/>
	{/if}
	<div class="w-prop" tabindex="0" bind:this={prop} on:keydown={onKeyDown}>
		<JsonPropertyComp model={model} prop={model.root} indent={0} maxIndentClass={indentCount}/>
	</div>
	<div class="w-path">
		<JsonPathEditor model={model}/>
	</div>
	<div class="gripper" on:mousedown={onGrabberMouseDown}/>
	<div class="w-menu" bind:this={menu}>
		<JsonMenu {model} bind:this={menuC}/>
	</div>
	<button class="menu-btn btn btn-primary rounded-circle" on:click={() => menuShown = true}></button>
</div>