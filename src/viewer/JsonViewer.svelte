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
	import JsonSearch from "../search";
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
	export let fontSize: number;
	export let fontFamily: string;
	export let darkMode: null | boolean;

	const tracker = new ThemeTracker(darkMode);

	InserterManager.createScope();

	model.command.addListener(onModelCommand);

	$: ({ requestInfo } = model.state.props);
	$: ({ canUndo, canRedo } = model.edits.state.props);
	$: tracker.preferDark = darkMode;
	$: scheme = $tracker ? schemeDark : schemeLight;
	$: currentScheme = customSchemes[scheme] ?? schemes.presets[scheme];
	$: rootIndent = new Indent(currentScheme.indents.length);

	let bindings: KeyBindingListener;
	let prop: HTMLElement;

	let jpathOpen = false;

	let searchInput: HTMLInputElement;
	let searchOpen = false;

	$: search = new JsonSearch(model.root);

	$: searchResults = [...$search];
	$: searchResults, searchIndex = 0;

	let searchIndex = 0;

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
				searchInput.focus();
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
		const data = model.root.toString(model.formatIndent);
		await fs.saveFile(data, suggestedName, 'json');
	}

	function keyMappings(target: HTMLElement) {
		bindings?.dispose();
		bindings = new KeyBindingListener(model, target, Linq(commands).selectMany(v => v.defaultBindings));
	}

	function clearFilter() {
		search.text = '';
		searchInput.focus();
	}

	function setSearchIndex(index: number) {
		searchIndex = index;
		model.setSelected(searchResults[index], true, true);
	}

	function prevSearch() {
		setSearchIndex((searchIndex ? searchIndex : searchResults.length) - 1);
	}

	function onSearchFocusIn(evt: FocusEvent) {
		if (!(evt.target as HTMLElement).parentElement?.classList.contains('search-overlay'))
			searchOpen = true;
	}

	function onSearchFocusOut(evt: FocusEvent & { currentTarget: HTMLElement }) {
		if (!evt.currentTarget.contains(evt.relatedTarget as Node | null))
			searchOpen = false;
	}

	function nextSearch() {
		setSearchIndex((searchIndex + 1) % searchResults.length);
	}

	function toggleFilterMode(mode: JsonSearch.Mode, value: boolean) {
		if (value) {
			search.mode |= mode;
		} else {
			let base = search.mode;
			if (base === mode)
				base = JsonSearch.Mode.Both;

			search.mode = base & ~mode;
		}
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
		flex: 1 1 0;
		position: relative;
		max-width: 24rem;
		width: unset;

		&.open {
			--search-visbility: visible;

			> .input-group {
				> :first-child {
					border-bottom-left-radius: 0;
				}

				> :global(:last-child) {
					border-bottom-right-radius: 0;
				}
			}
		}
	}

	.search-options {
		visibility: var(--search-visbility, collapse);
		margin-top: -1px;
		z-index: 2;
		position: absolute;
		display: flex;
		gap: $pad-med;
		top: 100%;
		left: 0;
		right: 0;
		padding: $pad-med;
	}
	
	.search-wrapper {
		flex: 1 1 0;
		z-index: 3;
		position: relative;
	}

	.search-overlay {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		display: flex;
		gap: 0.25em;
		margin: $pad-med;
		align-items: center;

		> :global(.btn) {
			--bs-btn-padding-x: 0.25em;
			--bs-btn-padding-y: 0.25em;
		}
	}
</style>
<svelte:window on:beforeunload={onUnload} />
<svelte:head>
	{#each css as href}
		<link rel="stylesheet" {href} on:load={onStyleLoaded} />
	{/each}
</svelte:head>
<SchemeStyleSheet scheme={currentScheme} darkMode={$tracker} {fontSize} {fontFamily} />
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
		<div class="search" class:open={searchOpen} on:focusin={onSearchFocusIn} on:focusout={onSearchFocusOut}>
			<div class="input-group">
				<span class="input-group-text flex-fit">Search</span>
				<div class="search-wrapper">
					<input
						class="search-input form-control rounded-0"
						type="text"
						bind:value={search.text}
						bind:this={searchInput}/>
					{#if $search.text}
						<div class="search-overlay">
							<span class="search-count">{searchResults.length && searchIndex + 1} / {searchResults.length}</span>
							<Button title="Clear" style="faded" icon="chevron-up" action={searchResults.length && prevSearch} />
							<Button title="Clear" style="faded" icon="chevron-down" action={searchResults.length && nextSearch} />
						</div>
					{/if}
				</div>
				<Button title="Clear" icon="x-lg" action={clearFilter} />
			</div>
			<div class="search-options border rounded-bottom bg-body">
				<div class="btn-group">
					<Button.Toggle text="Keys" checked={!!($search.mode & JsonSearch.Mode.Keys)} onchange={toggleFilterMode.bind(undefined, JsonSearch.Mode.Keys)}/>
					<Button.Toggle text="Values" checked={!!($search.mode & JsonSearch.Mode.Values)} onchange={toggleFilterMode.bind(undefined, JsonSearch.Mode.Values)}/>
				</div>
				<label class="input-group-text align-items-start gap-1" tabindex="0">
					<input type="checkbox" class="form-check-input" bind:checked={$search.caseSensitive} />
					Match Case
				</label>
			</div>
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
				<div class="jv-font w-prop border rounded overflow-hidden" tabindex="0" bind:this={prop} use:keyMappings>
					<div class="editor-bg h-100 w-100"></div>
					<div class="prop-scroll overflow-scroll h-100 w-100">
						<div class="prop-panel">
							<JsonProperty {model} node={model.root} indent={rootIndent} />
						</div>
					</div>
				</div>
			</div>
		</MenuView>
	</div>
	<div class="jv-font w-path pt-1">
		<JsonPathViewer {model}/>
	</div>
	{#if popup}
		{@const [comp, props, evt] = popup}
		<svelte:component this={comp} {...props} on:confirmed={evt} on:canceled={evt} />
	{/if}
</div>