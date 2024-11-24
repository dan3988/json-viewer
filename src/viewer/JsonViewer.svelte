<script lang="ts" context="module">
	import lib from "../lib.json";

	const css = [
		chrome.runtime.getURL(lib.bootstrap),
		chrome.runtime.getURL(lib.bootstrapIcons),
		chrome.runtime.getURL("/lib/viewer.css")
	];
</script>
<script lang="ts">
	import type { ViewerCommandEvent, ViewerModel } from "../viewer-model.js";
	import type { PopupCustomEvents } from "../types";
	import type { ComponentConstructorOptions, ComponentProps, SvelteComponent } from "svelte";
	import JsonProperty from "../shared/JsonProperty.svelte";
	import JsonPathViewer from "./JsonPathViewer.svelte";
	import MenuView, { MenuAlign } from "./MenuView.svelte";
	import ContextMenu, { type Coords, type MenuItem, menuBuilder } from "./ContextMenu.svelte";
	import PopupInputText from "../shared/PopupInputText.svelte";
	import PopupPanel from "../shared/PopupPanel.svelte";
	import RequestInfo from "./RequestInfo.svelte";
	import JsonMenu from "./JsonMenu.svelte";
	import { onDestroy, onMount } from "svelte";
	import { KeyBindingListener } from "../keyboard";
	import { commands } from "../commands";
	import json from "../json.js";
	import edits from "./editor-helper";
	import Linq from "@daniel.pickett/linq-js";

	export let model: ViewerModel;
	export let indentCount: number;
	export let menuAlign: string;
	export let scheme: string;
	export let background: string;

	model.command.addListener(onModelCommand);

	$: ({ requestInfo } = model.state.props);
	$: ({ canUndo, canRedo } = model.edits.state.props);
	$: model.filter(filter, filterMode);

	let bindings: KeyBindingListener;

	let contextMenu: [Coords, MenuItem[]] | undefined;
	let prop: HTMLElement;

	let jpathOpen = false;

	let filterInput: HTMLInputElement;
	let filter = "";
	let filterMode = json.JTokenFilterFlags.Both;

	type PopupInfo<C extends SvelteComponent<any, PopupCustomEvents<R>> = any, R = any> = [clazz: PopupConstructor<C, R>, props: ComponentProps<C>, completion: (result: CustomEvent<R | void> ) => void];

	const popupStack: PopupInfo[] = [];
	let popup: undefined | PopupInfo;

	function showRequestInfo() {
		showPopup(PopupPanel, {
			component: RequestInfo,
			title: "HTTP Request Details",
			height: 80,
			width: 80,
			props: { model }
		});
	}

	function copyKey(property: json.JProperty) {
		return navigator.clipboard.writeText(String(property.key));
	}

	function copyValue(value: json.JToken<any>, minify?: boolean) {
		const text = model.formatValue(value, minify);
		return navigator.clipboard.writeText(text);
	}

	type PopupConstructor<TComp extends SvelteComponent<any, PopupCustomEvents<TResult>>, TResult> = new(props: ComponentConstructorOptions<ComponentProps<TComp>>) => SvelteComponent<ComponentProps<TComp>, PopupCustomEvents<TResult>>;

	function showPopup<TComp extends SvelteComponent<any, PopupCustomEvents<TResult>>, TResult>(comp: PopupConstructor<TComp, TResult>, props: ComponentProps<TComp>): Promise<TResult>
	function showPopup<TComp extends SvelteComponent<any, PopupCustomEvents<TResult>>, TResult>(comp: PopupConstructor<TComp, TResult>, props: ComponentProps<TComp>, confirm: (result: TResult) => boolean): Promise<void>
	function showPopup<TResult>(comp: PopupConstructor<any, any>, props: Dict, confirm?: (result: TResult) => boolean) {
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
		switch (evt.command) {
			case "context": {
				const [prop, x, y] = evt.args;
				openContextMenu(prop, x, y);
				break;
			}
			case "focusSearch":
				filterInput.focus();
				break;
			case "saveAs":
				saveAs();
				break;
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
			const data = model.formatValue(model.root.value);
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
		const text = model.formatValue(prop.value);
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
		bindings?.dispose();
		bindings = new KeyBindingListener(model, target, Linq(commands).selectMany(v => v.defaultBindings));
	}

	function clearFilter(this: HTMLElement) {
		filter = "";
		filterInput.focus();
	}

	function setExpanded(expanded: boolean) {
		model.root.setExpanded(expanded, true);
	}

	onMount(() => prop.focus());
	onDestroy(() => {
		model.command.removeListener(onModelCommand);
		bindings?.dispose();
	});
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

	.root {
		user-select: none;
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
			<button type="button" class="btn btn-cust-light bi bi-floppy" title="Save" on:click={saveAs} />
			<button type="button" class="btn btn-cust-light bi bi-plus-square-fill" title="Expand All" on:click={() => setExpanded(true)} />
			<button type="button" class="btn btn-cust-light bi bi-dash-square-fill" title="Collapse All" on:click={() => setExpanded(false)} />
			<button type="button" class="btn btn-cust-light bi bi-arrow-counterclockwise" title="Undo" disabled={!$canUndo} on:click={() => model.edits.undo()} />
			<button type="button" class="btn btn-cust-light bi bi-arrow-clockwise" title="Redo" disabled={!$canRedo} on:click={() => model.edits.redo()} />
			{#if model.useWebRequest}
				<button type="button" class="btn btn-cust-light bi bi-activity" title="Request Info" disabled={!$requestInfo} on:click={showRequestInfo} />
			{/if}
		</div>
		<div class="input-group search flex-fit">
			<span class="input-group-text flex-fit">Filter</span>
			<input class="filter-input form-control" type="text" bind:value={filter} bind:this={filterInput}/>
			<button type="button" class="btn btn-cust-light bi bi-x-lg" on:click={clearFilter} />
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
						<JsonProperty {model} prop={model.root} indent={0} maxIndentClass={indentCount}/>
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