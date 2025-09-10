<script lang="ts" context="module">
	import lib from "../lib.json";

	const css = [
		chrome.runtime.getURL(lib.bootstrap),
		chrome.runtime.getURL(lib.bootstrapIcons),
		chrome.runtime.getURL("/lib/viewer.css"),
		chrome.runtime.getURL("/lib/schemes.css")
	];
</script>
<script lang="ts">
	import type { ViewerCommandEvent, ViewerModel } from "../viewer-model.js";
	import type { PopupCustomEvents } from "../types";
	import type { ComponentConstructorOptions, ComponentProps, SvelteComponent } from "svelte";
	import Button from "../components/button";
	import JsonProperty from "../shared/JsonProperty.svelte";
	import JsonPathViewer from "./JsonPathViewer.svelte";
	import MenuView, { MenuAlign } from "./MenuView.svelte";
	import SchemeStyleSheet from "../shared/SchemeStyleSheet.svelte";
	import PopupPanel from "../shared/PopupPanel.svelte";
	import { InserterManager } from "../shared/JsonInsert.svelte";
	import RequestInfo from "./RequestInfo.svelte";
	import JsonMenu from "./JsonMenu.svelte";
	import { onDestroy, onMount } from "svelte";
	import { KeyBindingListener } from "../keyboard";
	import { commands } from "../commands";
	import json from "../json.js";
	import ThemeTracker from "../theme-tracker.js";
	import Linq from "@daniel.pickett/linq-js";
	import fs from "../fs";
	import schemes from "../schemes.js";
	import Indent from "../indent";

	export let model: ViewerModel;
	export let menuAlign: string;
	export let customSchemes: Dict<schemes.ColorScheme>;
	export let schemeDark: string;
	export let schemeLight: string;
	export let background: string;
	export let darkMode: null | boolean;

	const tracker = new ThemeTracker(darkMode);

	InserterManager.createScope();

	model.command.addListener(onModelCommand);

	$: ({ requestInfo } = model.state.props);
	$: ({ canUndo, canRedo } = model.edits.state.props);
	$: tracker.preferDark = darkMode;
	$: model.filter(filter, filterMode);
	$: scheme = $tracker ? schemeDark : schemeLight;
	$: currentScheme = customSchemes[scheme] ?? schemes.presets[scheme];
	$: rootIndent = new Indent(currentScheme.indents.length);

	let bindings: KeyBindingListener;
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

	function onModelCommand(evt: ViewerCommandEvent) {
		switch (evt.command) {
			case "focusSearch":
				filterInput.focus();
				break;
			case "saveAs":
				saveAs();
				break;
		}
	}

	async function saveAs() {
		const pathName = window.location.pathname;
		const i = pathName.lastIndexOf("/");
		const suggestedName = pathName.slice(i + 1);
		const data = model.root.value.toString(model.formatIndent);
		await fs.saveFile(data, suggestedName, 'json');
	}

	function keyMappings(target: HTMLElement) {
		bindings?.dispose();
		bindings = new KeyBindingListener(model, target, Linq(commands).selectMany(v => v.defaultBindings));
	}

	function clearFilter() {
		filter = "";
		filterInput.focus();
	}

	function setExpanded(expanded: boolean) {
		model.root.setExpanded(expanded, true);
	}

	function onUnload(evt: BeforeUnloadEvent) {
		if (model.edits.canUndo) {
			evt.returnValue = true;
			evt.preventDefault();
		}
	}

	let cssLoaded = 0;

	function onStyleLoaded() {
		if (++cssLoaded === css.length) {
			const selected = model.selected.last;
			if (selected) {
				model.execute("scrollTo", selected);
			}
		}
	}

	onMount(() => prop.focus());
	onDestroy(() => {
		model.command.removeListener(onModelCommand);
		bindings?.dispose();
	});
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@forward "../globals.scss";

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
		display: flex;
		flex-direction: column;
	}

	.prop-panel {
		min-width: 100%;
		width: max-content;
		position: relative;
		padding: $pad-small;
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
			flex: 0 0 7em !important;
		}
	}
</style>
<svelte:window on:beforeunload={onUnload} />
<svelte:head>
	{#each css as href}
		<link rel="stylesheet" {href} on:load={onStyleLoaded} />
	{/each}
</svelte:head>
<SchemeStyleSheet scheme={currentScheme} darkMode={$tracker} />
<div class="root bg-body p-1 scheme" data-editor-bg={background}>
	<div class="w-bar pb-1 gap-1">
		<div class="btn-group">
			<Button title="Save" icon="floppy" action={saveAs} />
			<Button title="Expand All" icon="arrows-expand" action={() => setExpanded(true)} />
			<Button title="Collapse All" icon="arrows-collapse" action={() => setExpanded(false)} />
			<Button title="Undo" icon="arrow-counterclockwise" action={$canUndo && (() => model.edits.undo())} />
			<Button title="Redo" icon="arrow-clockwise" action={$canRedo && (() => model.edits.redo())} />
			{#if model.useWebRequest}
				<Button title="Request Info" icon="activity" action={$requestInfo && showRequestInfo} />
			{/if}
		</div>
		<div class="input-group search flex-fit">
			<span class="input-group-text flex-fit">Filter</span>
			<input class="filter-input form-control" type="text" bind:value={filter} bind:this={filterInput}/>
			<Button title="Clear" icon="x-lg" action={clearFilter} />
			<select class="filter-type form-select flex-fit" bind:value={filterMode}>
				<option value={json.JTokenFilterFlags.Both}>All</option>
				<option value={json.JTokenFilterFlags.Keys}>Keys</option>
				<option value={json.JTokenFilterFlags.Values}>Values</option>
			</select>
		</div>
		<input type="checkbox" class="btn-check" id="chk-jpath" bind:checked={jpathOpen} autocomplete="off" />
		<label class="btn btn-base" for="chk-jpath">JPath</label>
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
						<div class="prop-panel">
							<JsonProperty {model} prop={model.root} indent={rootIndent} />
						</div>
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