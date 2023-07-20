<script lang="ts" context="module">
	import lib from "../lib.json";

	const css = [
		chrome.runtime.getURL(lib.bootstrap),
		chrome.runtime.getURL("/lib/viewer.css")
	];
</script>
<script lang="ts">
	import type { ViewerCommandEvent, ViewerModel } from "../viewer-model.js";
	import type json from "../json.js";
	import type { PopupCustomEvents } from "../types";
	import type { ComponentConstructorOptions, SvelteComponent } from "svelte";
	import JsonPropertyComp from "../shared/JsonProperty.svelte";
	import JsonPathViewer from "./JsonPathViewer.svelte";
	import ContextMenu, { type Coords, type MenuItem, menuBuilder } from "./ContextMenu.svelte";
	import JsonMenu from "./JsonMenu.svelte";
	import { onDestroy, onMount } from "svelte";
	import Editor from "../shared/Editor.svelte";

	export let model: ViewerModel;
	export let indent: string;
	export let indentCount: number;
	export let menuAlign: string;
	export let scheme: string;
	export let background: string;

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	let showningPopup = 0;
	let contextMenu: [Coords, MenuItem[]] | undefined;
	let menuShown = true;
	let menuC: JsonMenu;
	let menu: HTMLElement;
	let prop: HTMLElement;
	let popups: HTMLElement;

	function copyKey(property: json.JProperty) {
		return navigator.clipboard.writeText(String(property.key));
	}

	function copyValue(token: json.JToken, minify?: boolean) {
		let text: string;
		if (token.is("value")) {
			text = String(token.value);
		} else {
			text = JSON.stringify(token, undefined, minify ? undefined : indent);
		}
		
		return navigator.clipboard.writeText(text);
	}

	type PopupConstructor<TProps extends Dict, TResult> = new(props: ComponentConstructorOptions<TProps>) => SvelteComponent<TProps, PopupCustomEvents<TResult>>;

	function showPopup<TProps extends Dict, TResult>(target: HTMLElement, popup: PopupConstructor<TProps, TResult>, props: TProps) {
		return new Promise<TResult | void>(resolve => {
			function complete(result: CustomEvent<TResult | void>) {
				showningPopup--;
				component.$destroy();
				resolve(result.detail);
			}

			const component = new popup({ target, props });
			component.$on("canceled", complete);
			component.$on("confirmed", complete);

			showningPopup++;
		});
	}

	function promptText(value: string = "", title: string = "") {
		return showPopup(popups, Editor, { value, title });
	}

	function onModelCommand(evt: ViewerCommandEvent) {
		if (evt.command === "context") {
			const [prop, x, y] = evt.args;
			openContextMenu(prop, x, y);
		}
	}

	function clearProp(value: json.JContainer) {
		value.clear();
		value.owner.isExpanded = false;
	}

	function deleteProp(prop: json.JProperty) {
		const { parent, next, previous } = prop;
		prop.remove();
		if (parent && parent.first == null)
			parent.owner.isExpanded = false;

		const p  = (next ?? previous);
		model.setSelected(p, false, true);
	}

	async function addToObject(obj: json.JObject, mode: keyof json.JContainerAddMap) {
		const key = await promptText("", "Property Name");
		if (key) {
			const prop = obj.add(key, mode);
			obj.owner.isExpanded = true;
			model.setSelected(prop, false, true);
		}
	}

	async function addToArray(arr: json.JArray, mode: keyof json.JContainerAddMap) {
		const prop = arr.add(mode);
		arr.owner.isExpanded = true;
		model.setSelected(prop, false, true);
	}

	function openContextMenu(selected: json.JProperty, x: number, y: number) {
		const builder = menuBuilder();
		if (selected.value.is("container")) {
			if (selected.isExpanded) {
				builder
					.item("Collapse", () => selected.setExpanded(false, true))
					.item("Expand All", () => selected.setExpanded(true, true));
			} else {
				builder
					.item("Expand", () => selected.setExpanded(true))
					.item("Expand All", () => selected.setExpanded(true, true));
			}

			builder
				.menu("Modify", builder => {
					builder
						.item("Clear", clearProp.bind(undefined, selected.value))
						.item("Delete", deleteProp.bind(undefined, selected));

					if (selected.value.is("object")) {
						const { value } = selected;
						builder.menu("Sort")
							.item("A-Z", () => value.sort())
							.item("Z-A", () => value.sort(true));

						builder.menu("Add")
							.item("Object", () => addToObject(value, "object"))
							.item("Array", () => addToObject(value, "array"))
							.item("Value", () => addToObject(value, "value"))
					} else if (selected.value.is("array")) {
						const { value } = selected;
						builder.menu("Add")
							.item("Object", () => addToArray(value, "object"))
							.item("Array", () => addToArray(value, "array"))
							.item("Value", () => addToArray(value, "value"))
					}
				})
				.item("Copy Key", () => copyKey(selected))
				.menu("Copy Value")
					.item("Formatted", () => copyValue(selected.value))
					.item("Minified", () => copyValue(selected.value, true))
					.end();
		} else {
			builder
				.item("Copy Key", () => copyKey(selected))
				.item("Copy Value", () => copyValue(selected.value))
				.item("Delete", () => deleteProp(selected));
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
			case "Delete":
				model.selected && deleteProp(model.selected);
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
						selected.isExpanded = true;
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
						model.setSelected(selected.parent.owner, true, true);

					e.preventDefault();
				}
				break;
			}
		}
	}

	onMount(() => prop.focus());

	function resizeBegin(startPos: number, startSize: number, evtProp: "x" | "y", styleProp: string, direction: number = 1) {
		function onMove(evt: MouseEvent) {
			const pos = Math.max(0, startSize + (startPos - evt[evtProp]) * -direction);
			menuShown = pos >= 150;
			menu.style[styleProp] = pos + "px";
		}

		function onEnd(evt: MouseEvent) {
			document.off("mousemove", onMove);

			let size: string | number = Math.max(0, startSize + (startPos - evt[evtProp]) * -direction);
			if (size < 150) {
				const v = menu.getAttribute("data-remember-" + evtProp);
				if (v != null)
					menu.style[styleProp] = v + "px";
			} else {
				menu.setAttribute("data-remember-" + evtProp, String(size));
				menu.style[styleProp] = size + "px";
			}
		}

		document.on("mousemove", onMove);
		document.once("mouseup", onEnd);
	}

	function onGrabberHMouseDown(evt: MouseEvent) {
		resizeBegin(evt.x, menu.clientWidth, "x", "width", menuAlign === "l" ? 1 : -1);
	}

	function onGrabberVMouseDown(evt: MouseEvent) {
		resizeBegin(evt.y, menu.clientHeight, "y", "height");
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
			grid-template-areas: "menu" "resize" "prop" "path";

			> .w-menu {
				width: unset !important;
				height: 30rem;
				min-height: 350px;
				max-height: 80vh;
			}

			> .gripper-h {
				display: none;
			}
		}
		
		@media only screen and (min-width: $break) {
			grid-template-rows: 1fr auto;
			max-height: 100vh;

			&[data-menu-align="l"] {
				grid-template-columns: auto auto 1fr;
				grid-template-areas:
					"menu resize prop"
					"path path path";

				> .gripper-v {
					display: none;
				}
			}

			&[data-menu-align="r"] {
				grid-template-columns: 1fr auto auto;
				grid-template-areas:
					"prop resize menu"
					"path path path";
			}

			> .w-menu {
				width: 30rem;
				height: unset !important;
				min-width: 350px;
				max-width: 80vw;
			}

			> .gripper-v {
				display: none;
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
		grid-area: resize;
		user-select: none;
	}

	.gripper-v {
		cursor: ns-resize;
		height: 5px;
	}

	.gripper-h {
		cursor: ew-resize;
		width: 5px;
	}

	.w-prop,
	.w-path {
		font-family: monospace;
		font-size: 12px;
	}

	.w-prop {
		display: grid;
		grid-area: prop;
		grid-template-areas: "main";
		grid-template-rows: 1fr;
		grid-template-columns: 1fr;
		position: relative;

		> * {
			grid-area: main;
		}

		> .prop-scroll {
			padding: $pad-small;
		}


		&:focus-visible {
			outline: none;
			backdrop-filter: var(--flt-bright-hv);
		}
	}

	.w-path {
		grid-area: path;
		margin-top: $pad-small;
		padding: $pad-med;
	}

	.w-menu {
		grid-area: menu;
		display: grid;
		overflow: hidden;
	}

	.prop-scroll {
		z-index: 1;
	}

	.editor-bg {
		pointer-events: none;
	}

	.popups {
		background-color: #fff4;
		z-index: 10;
		position: absolute;
		inset: 0;
		display: none;

		&.showning {
			display: flex;
		}

		> .popup-display {
			z-index: 11;
			margin: auto;
		}
	}

	.menu-btn {
		@include bs-icon-btn("list", 5px, "color");

		position: absolute;
		padding: 5px;
		right: 2rem;
		top: 1rem;
		width: 2.5rem;
		height: 2.5rem;
		z-index: 1;
	}
</style>
<svelte:head>
	{#each css as href}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>
<div class="root bg-body p-1" data-scheme={scheme} data-menu-shown={menuShown} data-menu-align={menuAlign} data-editor-bg={background}>
	{#if contextMenu}
		<ContextMenu pos={contextMenu[0]} items={contextMenu[1]} on:closed={() => contextMenu = undefined}/>
	{/if}
	<div class="w-prop border rounded overflow-hidden" tabindex="0" bind:this={prop} on:keydown={onKeyDown}>
		<div class="editor-bg h-100 w-100"></div>
		<div class="prop-scroll overflow-scroll h-100 w-100">
			<JsonPropertyComp model={model} prop={model.root} indent={0} maxIndentClass={indentCount}/>
		</div>
	</div>
	<div class="w-path">
		<JsonPathViewer {model}/>
	</div>
	<div class="gripper gripper-h" on:mousedown={onGrabberHMouseDown}/>
	<div class="gripper gripper-v" on:mousedown={onGrabberVMouseDown}/>
	<div class="w-menu" bind:this={menu}>
		<JsonMenu {model} bind:this={menuC}/>
	</div>
	<button class="menu-btn btn btn-primary rounded-circle" title="Open Menu" on:click={() => menuShown = true}></button>
	<div class="popups" class:showning={showningPopup}>
		<div class="popup-display" bind:this={popups}/>
	</div>
</div>