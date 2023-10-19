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
	import JsonPropertyComp from "../shared/JsonProperty.svelte";
	import JsonPathViewer from "./JsonPathViewer.svelte";
	import MenuView, { MenuAlign } from "./MenuView.svelte";
	import ContextMenu, { type Coords, type MenuItem, menuBuilder } from "./ContextMenu.svelte";
	import JsonMenu from "./JsonMenu.svelte";
	import { onDestroy, onMount } from "svelte";
	import json from "../json.js";
	import PopupInputText from "../shared/PopupInputText.svelte";
	import dom from "./dom-helper";
	import edits from "./editor-helper";

	export let model: ViewerModel;
	export let indent: string;
	export let indentCount: number;
	export let menuAlign: string;
	export let scheme: string;
	export let background: string;

	model.command.addListener(onModelCommand);

	$: ({ canUndo, canRedo } = model.edits.bag.readables);
	$: model.filter(filter, filterMode);

	onDestroy(() => model.command.removeListener(onModelCommand));

	let contextMenu: [Coords, MenuItem[]] | undefined;
	let prop: HTMLElement;

	let jpathOpen = false;

	let filterInput: HTMLInputElement;
	let filter = "";
	let filterMode = json.JTokenFilterFlags.Both;

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

	function getFileName(pathName: string) {
		const i = pathName.lastIndexOf("/");
		return pathName.slice(i + 1);
	}

	async function saveAs() {
		const suggestedName = getFileName(window.location.pathname);
		const types = [
			{
				description: "JSON file",
				accept: {
					"application/json": ".json"
				}
			}
		];
		
		const result = await showSaveFilePicker({ suggestedName, types });
		if (result) {
			const data = model.root.value.toString(indent);
			const w = await result.createWritable();
			try {
				await w.write(data);
			} finally {
				await w.close();
			}
		}
	}

	function clearProp(value: json.JContainer) {
		edits.clearProp(model, value);
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
			edits.replace(model, prop, newProp);
			return true;
		});
	}

	function deleteProp(prop: json.JProperty, selectNext?: boolean) {
		edits.deleteProp(model, prop, selectNext);
	}

	function deleteProps(props: Iterable<json.JProperty>) {
		edits.deleteProps(model, props);
	}

	async function renameProperty(obj: json.JObject, prop: json.JProperty<string>) {
		const result = await promptText(prop.key, "Property Name", { width: 33.33 });
		if (result && result !== prop.key)
			edits.renameProperty(model, obj, prop, result);
	}

	function sortObject(obj: json.JObject, desc?: boolean) {
		edits.sortObject(model, obj, desc);
	}

	async function addToObject(obj: json.JObject, mode: keyof json.JContainerAddMap) {
		const key = await promptText("", "Property Name");
		key && edits.addToObject(model, obj, mode, key);
	}

	async function addToArray(arr: json.JArray, mode: keyof json.JContainerAddMap) {
		edits.addToArray(model, arr, mode);
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
							.item("A-Z", () => sortObject(value))
							.item("Z-A", () => sortObject(value, true));

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
					filterInput.focus();
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

	const windowMappingUnsub = dom.keymap(window, {
		keyZ: {
			"ctrl": () => model.edits.undo(),
			"ctrl|shift": () => model.edits.redo()
		},
		keyY: {
			"ctrl": () => model.edits.redo()
		},
		keyS: {
			"ctrl": () => {
				saveAs();
				return true;
			}
		}
	});

	function clearFilter(this: HTMLElement) {
		filter = "";
		filterInput.focus();
	}

	function setExpanded(expanded: boolean) {
		model.root.setExpanded(expanded, true);
	}

	onDestroy(windowMappingUnsub);
	onMount(() => prop.focus());
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

	.root {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: [bar menu path] 1fr;
		grid-template-rows: [bar] auto [menu] 1fr [path] auto;
		overflow: hidden;
	}

	.w-prop,
	.w-path {
		font-family: monospace;
		font-size: 12px;
	}

	.w-prop {
		display: grid;
		grid-template-areas: "main";
		grid-template-rows: 1fr;
		grid-template-columns: 1fr;
		position: absolute;
		inset: 0;

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

	.w-bar {
		display: flex;
		grid-area: bar;

		&::after {
			content: "";
			flex: 1 1 0px;
		}

		> .btn-group > .btn {
			width: 2.5rem;
		}
	}

	.w-path {
		grid-area: path;
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

	.slot {
		position: absolute;
		inset: 0;
	}

	.slot > :global(*) {
		height: 100%;
	}

	.search {
		width: max-content;

		> select {
			flex: 0 0 7rem !important;
		}
	}

	.btn-clr {
		@include bs-icon-btn("x-lg", 25%);
	}

	.btn-expand-all {
		@include bs-icon-btn("plus-square-fill", 25%);
	}

	.btn-collapse-all {
		@include bs-icon-btn("dash-square-fill", 25%);
	}

	.btn-undo {
		@include bs-icon-btn("arrow-counterclockwise", 25%);
	}

	.btn-redo {
		@include bs-icon-btn("arrow-clockwise", 25%);
	}
</style>
<svelte:head>
	{#each css as href}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>
<div class="root bg-body p-1" data-scheme={scheme} data-editor-bg={background}>
	{#if contextMenu}
		{@const [pos, items] = contextMenu}
		<ContextMenu {pos} {items} on:closed={() => contextMenu = undefined}/>
	{/if}
	<div class="w-bar pb-1 gap-1">
		<div class="btn-group">
			<button type="button" class="btn btn-cust-light btn-expand-all" title="Expand All" on:click={() => setExpanded(true)} />
			<button type="button" class="btn btn-cust-light btn-collapse-all" title="Collapse All" on:click={() => setExpanded(false)} />
			<button type="button" class="btn btn-cust-light btn-undo" title="Undo" disabled={!$canUndo} on:click={() => model.edits.undo()} />
			<button type="button" class="btn btn-cust-light btn-redo" title="Redo" disabled={!$canRedo} on:click={() => model.edits.redo()} />
		</div>
		<div class="input-group search flex-fit">
			<span class="input-group-text flex-fit">Filter</span>
			<input class="filter-input form-control" type="text" bind:value={filter} bind:this={filterInput}/>
			<button type="button" class="btn btn-cust-light btn-clr" on:click={clearFilter} />
			<select class="filter-type form-select flex-fit" bind:value={filterMode}>
				<option value={json.JTokenFilterFlags.Both}>All</option>
				<option value={json.JTokenFilterFlags.Keys}>Keys</option>
				<option value={json.JTokenFilterFlags.Values}>Values</option>
			</select>
		</div>
		<input type="checkbox" class="btn-check" id="chk-jpath" bind:checked={jpathOpen} autocomplete="off" />
		<label class="btn btn-cust-light" for="chk-jpath">JPath</label>
	</div>
	<div class="w-menu">
		<MenuView
			bind:menuShown={jpathOpen}
			minMenuSize={["450px", "300px"]}
			maxMenuSize={["80vw", "80vh"]}
			initialMenuSize="30rem"
			alignment={menuAlign === "l" ? MenuAlign.Left : MenuAlign.Right}>
			<div slot="menu" class="slot">
				<JsonMenu {model} />
			</div>
			<div class="slot">
				<div class="w-prop border rounded overflow-hidden" tabindex="0" bind:this={prop} use:keyMappings>
					<div class="editor-bg h-100 w-100"></div>
					<div class="prop-scroll overflow-scroll h-100 w-100">
						<JsonPropertyComp model={model} prop={model.root} indent={0} maxIndentClass={indentCount}/>
					</div>
				</div>
			</div>
		</MenuView>
	</div>
	<div class="w-path pt-1">
		<JsonPathViewer {model}/>
	</div>
	{#if popup}
		{@const [comp, props, evt] = popup}
		<svelte:component this={comp} {...props} on:confirmed={evt} on:canceled={evt} />
	{/if}
</div>