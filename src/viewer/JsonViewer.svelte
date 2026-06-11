<script lang="ts" module>
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
	import Button, { ToggleButton } from "../components/button";
	import JsonProperty from "../shared/JsonProperty.svelte";
	import JsonPathViewer from "./JsonPathViewer.svelte";
	import MenuView from "./MenuView.svelte";
	import SchemeStyleSheet from "../shared/SchemeStyleSheet.svelte";
	import Overlay, { OverlayController } from "../components/Overlay.svelte";
	import PopupPanel from "../components/PopupPanel.svelte";
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

	interface Props {
		model: ViewerModel;
		menuAlign: string;
		customSchemes: Dict<schemes.ColorScheme>;
		schemeDark: string;
		schemeLight: string;
		background: string;
		fontSize: number;
		fontFamily: string;
		darkMode: null | boolean;
	}

	const {
		model,
		menuAlign,
		customSchemes,
		schemeDark,
		schemeLight,
		background,
		fontSize,
		fontFamily,
		darkMode,
	}: Props = $props();

	const tracker = new ThemeTracker(false);

	InserterManager.createScope();

	model.command.addListener(onModelCommand);

	$effect.pre(() => void (tracker.preferDark = darkMode));

	const { requestInfo } = $derived(model.state.props);
	const { canUndo, canRedo } = $derived(model.edits.state.props);
	const scheme = $derived($tracker ? schemeDark : schemeLight);
	const currentScheme = $derived(customSchemes[scheme] ?? schemes.loadPreset(scheme));
	const rootIndent = $derived(new Indent(currentScheme.indents.length));

	let bindings: KeyBindingListener;
	let prop: HTMLElement;

	let jpathOpen = $state(false);

	let searchInput: HTMLInputElement;
	let searchOpen = $state(false);

	const search = $derived(new JsonSearch(model.root));
	const searchResults = $derived([...$search]);

	let searchIndex = $state(0);

	$effect.pre(() => void (searchResults, searchIndex = 0));

	const overlay = new OverlayController();

	function showRequestInfo() {
		overlay.show(PopupPanel, {
			component: RequestInfo,
			title: "HTTP Request Details",
			height: 80,
			width: 80,
			props: { model }
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


		:global(.btn) {
			--bs-btn-font-size: inherit;
			--bs-btn-padding-x: .5rem;
			--bs-btn-padding-y: .25rem;
		}

		.input-group-text, .form-control {
			font-size: inherit;
			padding: .25rem .5rem;
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
		flex: 1 1 0;
		max-width: 30em;
		position: relative;
		width: unset;

		&.open {
			--search-visbility: visible;
		}
	}

	.search-options {
		visibility: var(--search-visbility, hidden);
		margin-top: -1px;
		z-index: 2;
		position: absolute;
		top: 100%;

		:global(.btn) {
			--bs-btn-padding-x: .25rem;
			--bs-btn-padding-y: .25rem;
		}
	}
	
	.search-wrapper {
		flex: 1 1 0;
		z-index: 3;
		position: relative;
	}

	.search-input {
		padding-right: calc(5rem + 20px);
	}

	.search-overlay {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		display: flex;
		flex-wrap: wrap;
		gap: $pad-med;
		margin: $pad-med;
		align-items: center;
		background-color: var(--bs-body-bg);

		> :global(.btn) {
			--bs-btn-padding-x: 0.25em;
			--bs-btn-padding-y: 0.25em;
		}
	}
</style>
<svelte:window on:beforeunload={onUnload} />
<svelte:head>
	{#each css as href}
		<link rel="stylesheet" {href} onload={onStyleLoaded} />
	{/each}
</svelte:head>
<SchemeStyleSheet scheme={currentScheme} darkMode={$tracker} {fontSize} {fontFamily} />
<Overlay controller={overlay}>
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
			<div class="search" class:open={searchOpen} onfocusin={onSearchFocusIn} onfocusout={onSearchFocusOut}>
				<div class="input-group">
					<span class="input-group-text flex-fit">Search</span>
					<div class="search-wrapper">
						<input
							class="search-input form-control rounded-0"
							type="text"
							bind:value={$search.text}
							bind:this={searchInput}/>
						{#if $search.text}
							<div class="search-overlay">
								<span class="search-count">{searchResults.length && searchIndex + 1} / {searchResults.length}</span>
								<Button title="Previous" style="faded" icon="chevron-up" action={searchResults.length && prevSearch} />
								<Button title="Next" style="faded" icon="chevron-down" action={searchResults.length && nextSearch} />
							</div>
						{/if}
						<div class="search-options p-1 gap-1 d-flex flex-column border rounded-bottom bg-body">
							<div class="d-flex gap-1">
								<div class="btn-group">
									<ToggleButton icon="key-fill" title="Search Keys" checked={!!($search.mode & JsonSearch.Mode.Keys)} onchange={toggleFilterMode.bind(undefined, JsonSearch.Mode.Keys)}/>
									<ToggleButton icon="braces" title="Search Values" checked={!!($search.mode & JsonSearch.Mode.Values)} onchange={toggleFilterMode.bind(undefined, JsonSearch.Mode.Values)}/>
								</div>
								<ToggleButton icon="type" title="Match Case" bind:checked={$search.isCaseSensitive}/>
								<ToggleButton icon="quote" title="Exact Match" bind:checked={$search.isExactMatch}/>
								<ToggleButton icon="regex" title="Regex" bind:checked={$search.isRegex}/>
							</div>
							{#if $search.error}
								<span class="text-danger">Invalid Regex: {$search.error}</span>
							{/if}
						</div>
					</div>
					<Button title="Clear" icon="x-lg" action={clearFilter} />
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
				alignment={menuAlign === "l" ? 'left' : 'right'}>
				{#snippet menu()}
					<div class="slot">
						<JsonMenu {model} />
					</div>
				{/snippet}
				<div class="slot">
					<div class="jv-font w-prop border rounded overflow-hidden" tabindex="0" bind:this={prop} use:keyMappings>
						<div class="editor-bg h-100 w-100"></div>
						<div class="prop-scroll overflow-scroll h-100 w-100">
							<div class="prop-panel">
								<JsonProperty {model} {search} node={model.root} indent={rootIndent} />
							</div>
						</div>
					</div>
				</div>
			</MenuView>
		</div>
		<div class="jv-font w-path pt-1">
			<JsonPathViewer {model}/>
		</div>
	</div>
</Overlay>