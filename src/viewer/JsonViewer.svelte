<script lang="ts" context="module">
	import lib from "../lib.json";

	const css = [
		chrome.runtime.getURL(lib.bootstrap),
		chrome.runtime.getURL("/lib/viewer.css")
	];
</script>
<script lang="ts">
	import type { ViewerCommandEvent, ViewerModel } from "../viewer-model.js";
	import type { PopupCustomEvents } from "../types";
	import type { ComponentConstructorOptions, ComponentProps, SvelteComponent } from "svelte";
	import type { EditAction } from "../edit-stack";
	import JsonPropertyComp from "../shared/JsonProperty.svelte";
	import JsonPathViewer from "./JsonPathViewer.svelte";
	import ContextMenu, { type Coords, type MenuItem, menuBuilder } from "./ContextMenu.svelte";
	import JsonMenu from "./JsonMenu.svelte";
	import { onDestroy, onMount } from "svelte";
	import json from "../json.js";
	import PopupInputText from "../shared/PopupInputText.svelte";
	import Linq from "@daniel.pickett/linq-js";
	import dom from "./dom-helper";

	export let model: ViewerModel;
	export let indent: string;
	export let indentCount: number;
	export let menuAlign: string;
	export let scheme: string;
	export let background: string;

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	let contextMenu: [Coords, MenuItem[]] | undefined;
	let menuShown = true;
	let menuC: JsonMenu;
	let menu: HTMLElement;
	let prop: HTMLElement;

	type PopupInfo<P extends Dict = any, R = any> = [clazz: PopupConstructor<P, R>, props: P, completion: (result: CustomEvent<R | void> ) => void];

	const popupStack: PopupInfo[] = [];
	let popup: undefined | PopupInfo;

	function copyKey(property: json.JProperty) {
		return navigator.clipboard.writeText(String(property.key));
	}

	function serializeForCopy(token: json.JToken, minify?: boolean) {
		if (token.is("value")) {
			return String(token.value);
		} else {
			return JSON.stringify(token, undefined, minify ? undefined : indent);
		}
	}

	function copyValue(token: json.JToken, minify?: boolean) {
		const text = serializeForCopy(token, minify);
		return navigator.clipboard.writeText(text);
	}

	function copyValues(values: Iterable<json.JProperty>, minify?: boolean) {
		const text: string[] = [];
		for (const p of values)
			text.push(serializeForCopy(p.value, minify));

		const value = text.join(minify ? "," : ",\r\n");
		return navigator.clipboard.writeText(value);
	}

	type PopupConstructor<TProps extends Dict, TResult> = new(props: ComponentConstructorOptions<TProps>) => SvelteComponent<TProps, PopupCustomEvents<TResult>>;

	function showPopup<TProps extends Dict, TResult>(comp: PopupConstructor<TProps, TResult>, props: TProps): Promise<TResult>
	function showPopup<TProps extends Dict, TResult>(comp: PopupConstructor<TProps, TResult>, props: TProps, confirm: (result: TResult) => boolean): Promise<void>
	function showPopup<TProps extends Dict, TResult>(comp: PopupConstructor<TProps, TResult>, props: TProps, confirm?: (result: TResult) => boolean) {
		return new Promise<TResult | void>(resolve => {
			function complete(result: NamedCustomEvent<"confirmed", TResult> | NamedCustomEvent<"canceled", void>) {
				if (result.type === "canceled" || confirm == null) {
					popup = popupStack.pop();
					resolve(result.detail);
				} else if (confirm(result.detail)) {
					popup = popupStack.pop();
					resolve();
				}
			}

			popup && popupStack.push(popup);
			popup = [comp, props, complete];
		});
	}

	type TextPopupOptions = ComponentProps<PopupInputText>;

	function promptText(value: string = "", title: string = "", props?: Except<TextPopupOptions, "value" | "title">) {
		return showPopup(PopupInputText, { value, title, ...props });
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

	function editProp(prop: json.JProperty) {
		const text = prop.value.toString(indent);
		const opts: TextPopupOptions = {
			title: "Edit JSON",
			value: text,
			multiLine: true,
			height: 80,
			width: 80
		};

		return showPopup(PopupInputText, opts, text => {
			let parsed: any;
			try {
				parsed = JSON.parse(text);
			} catch (err) {
				alert(err);
				return false;
			}

			const newProp = json(parsed);
			model.edits.push({
				commit: () => prop.replace(newProp.value),
				undo: () => newProp.replace(prop.value)
			});

			return true;
		});
	}

	function createDeleteAction(prop: json.JProperty): EditAction {
		const { parent } = prop;
		let undo: Action;
		if (parent!.is("object")) {
			const p = prop as json.JProperty<string>;
			const obj = parent;
			if (p.previous !== null) {
				const prev = p.previous;
				undo = () => obj.insertAfter(p, prev);
			} else if (p.next !== null) {
				const next = p.next;
				undo = () => obj.insertBefore(p, next);
			} else {
				undo = () => obj.addProperty(p);
			}
		} else {
			undo = () => (parent as json.JContainer).addProperty(prop);
		}

		return {
			undo,
			commit() {
				prop.remove();
			}
		};
	}

	function deleteProp(prop: json.JProperty, selectNext?: boolean) {
		const { parent, next, previous } = prop;
		if (parent == null)
			return;
		
		const action = createDeleteAction(prop);
		model.edits.push(action);
		if (parent && parent.first == null)
			parent.owner.isExpanded = false;

		const p  = (next ?? previous);
		selectNext && p && model.setSelected(p, false, true);
	}

	function deleteProps(props: Iterable<json.JProperty>) {
		model.edits.push(...Linq(props).select(createDeleteAction));
	}

	async function renameProperty(obj: json.JObject, prop: json.JProperty<string>) {
		const result = await promptText(prop.key, "Property Name", { width: 33.33 });
		if (result) {
			const oldName = prop.key;
			model.edits.push({
				commit() {
					obj.rename(oldName, result);
				},
				undo() {
					obj.rename(result, oldName);
				}
			})

			model.execute("scrollTo", prop);
		}
	}

	async function addToObject(obj: json.JObject, mode: keyof json.JContainerAddMap) {
		const key = await promptText("", "Property Name");
		if (key) {
			model.edits.push({
				commit() {
					const prop = obj.add(key, mode);
					obj.owner.isExpanded = true;
					model.setSelected(prop, false, true);
				},
				undo() {
					const prop = obj.remove(key);
					if (prop?.isSelected)
						model.selected.remove(prop);
				},
			});
		}
	}

	async function addToArray(arr: json.JArray, mode: keyof json.JContainerAddMap) {
		const index = arr.count;
		model.edits.push({
			commit() {
				const prop = arr.add(mode);
				arr.owner.isExpanded = true;
				model.setSelected(prop, false, true);
			},
			undo() {
				const prop = arr.remove(index);
				if (prop?.isSelected)
					model.selected.remove(prop);
			},
		});
	}

	function openContextMenu(selected: json.JProperty, x: number, y: number) {
		const builder = menuBuilder();
		if (selected.value.is("container")) {
			const { value } = selected;
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
						.item("Clear", () => clearProp(value))
						.item("Edit", () => editProp(selected))
						.item("Delete", () => deleteProp(selected, true));

					if (selected.parent?.is("object")) {
						const { parent } = selected;
						builder.item("Rename", () => renameProperty(parent, selected as any))
					}

					if (value.is("object")) {
						builder.menu("Sort")
							.item("A-Z", () => value.sort())
							.item("Z-A", () => value.sort(true));

						builder.menu("Add")
							.item("Object", () => addToObject(value, "object"))
							.item("Array", () => addToObject(value, "array"))
							.item("Value", () => addToObject(value, "value"))
					} else if (value.is("array")) {
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
				.item("Edit", () => editProp(selected))
				.item("Delete", () => deleteProp(selected, true));

			if (selected.parent?.is("object")) {
				const { parent } = selected;
				builder.item("Rename", () => renameProperty(parent, selected as any))
			}
		}

		contextMenu = [[x, y], builder.build()];
	}

	function keyMappings(target: HTMLElement) {
		const destroy = dom.keymap(target, {
			escape() {
				model.selected.clear();
				return true;
			},
			space() {
				model.selected.forEach(v => v.toggleExpanded());
				return true;
			},
			delete() {
				if (model.selected.size === 1) {
					deleteProp(model.selected.last!, true)
				} else {
					deleteProps(model.selected);
					model.selected.clear();
				}
			},
			keyF: {
				"ctrl"() {
					menuC.focusSearch();
					return true;
				}
			},
			keyC: {
				"ctrl"() {
					const selection = window.getSelection();
					if (selection != null && selection.type !== "Caret")
						return;

					const values = model.selected;
					if (values.size) {
						copyValues(values);
						return true;
					}
				}
			},
			keyZ: {
				"ctrl": () => model.edits.undo(),
				"ctrl|shift": () => model.edits.redo()
			},
			keyY: {
				"ctrl": () => model.edits.redo()
			},
			arrowDown() {
				const selected = model.selected.last;
				if (selected) {
					let v = selected.next;
					if (v != null || (v = selected.parent?.first ?? null) != null)
						model.setSelected(v, false, true);
				} else {
					model.setSelected(model.root, false, true);
				}

				return true;
			},
			arrowUp() {
				const selected = model.selected.last;
				if (selected != null) {
					let v = selected.previous;
					if (v != null || (v = selected.parent?.last ?? null) != null)
						model.setSelected(v, false, true);
				} else {
					model.setSelected(model.root, false, true);
				}

				return true;
			},
			arrowRight() {
				const selected = model.selected.last;
				if (selected && selected.value.is("container") && selected.value.first != null) {
					selected.isExpanded = true;
					model.setSelected(selected.value.first, false, true);
					return true;
				}
			},
			arrowLeft() {
				const selected = model.selected.last;
				if (selected && selected.parent)
					model.setSelected(selected.parent.owner, true, true);

				return true;
			}
		});

		return { destroy };
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
	<div class="w-prop border rounded overflow-hidden" tabindex="0" bind:this={prop} use:keyMappings>
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

	{#if popup}
		{@const [comp, props, evt] = popup}
		<svelte:component this={comp} {...props} on:confirmed={evt} on:canceled={evt} />
	{/if}
</div>