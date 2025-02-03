<script lang="ts" context="module">
	type ThemeInfo = [label: string, className: string, value: boolean | null];

	const themeModes: ThemeInfo[] = [
		['Auto', 'bi-circle-half', null],
		['Light', 'bi-brightness-high-fill', false],
		['Dark', 'bi-moon-stars-fill', true],
	];
</script>
<script lang="ts">
	import type { Writable } from "svelte/store";
	import ThemeTracker from "../theme-tracker";
	import Radio from "../shared/Radio.svelte";
	import SchemeStyleSheet from "../shared/SchemeStyleSheet.svelte";
	import schemes from "../schemes";

	const tracker = new ThemeTracker();

	export let schemeLight: Writable<string>;
	export let schemeDark: Writable<string>;
	export let darkMode: Writable<boolean | null>;
	export let enabled: Writable<boolean>;
	export let customSchemes: Writable<Dict<schemes.ColorScheme>>;

	$: tracker.preferDark = $darkMode;
	$: [presets, scheme] = $tracker ? [schemes.entries.dark, schemeDark] : [schemes.entries.light, schemeLight];
	$: customSchemeList = schemes.getCustomEntries($customSchemes, $tracker);
	$: currentScheme = $customSchemes[$scheme] ?? schemes.presets[$scheme];
</script>
<SchemeStyleSheet scheme={currentScheme} darkMode={$tracker} />
<div class="root scheme bg-body d-flex flex-column justify-items-center p-1 gap-1">
	<img class="m-auto" src="../res/icon256.png" alt="icon" height="64" width="64" />
	<span class="h4 text-center">Quick Settngs</span>
	<div class="input-group">
		<label class="input-group-text flex-fill align-items-start gap-1">
			<input id="chkEnabled" class="form-check-input" type="checkbox" bind:checked={$enabled} />
			Enabled
		</label>
	</div>
	<div class="input-group hoverable-radio grp-theme" role="group">
		<span class="input-group-text">Theme</span>
		<Radio items={themeModes} converter={i => i[2]} bind:value={$darkMode}>
			<label slot="label" let:id let:item={[title, clazz]} for={id} class="flex-fill btn btn-base {clazz}" {title}></label>
		</Radio>
	</div>
	<div class="input-group grp-json-style">
		<span class="input-group-text">Colour Scheme</span>
		<select class="form-select flex-fill" bind:value={$scheme}>
			<optgroup label="Presets">
				{#each presets as { id, name }}
					<option value={id}>{name}</option>
				{/each}
			</optgroup>
			{#if customSchemeList.length}
				<optgroup label="Custom">
					{#each customSchemeList as { id, name }}
						<option value={id}>{name}</option>
					{/each}
				</optgroup>
			{/if}
		</select>
	</div>
	<a class="btn btn-primary" href="options.html" target="_blank" title="Settings">
		<span class="bi-gear-fill"></span>
		<span>More Settings</span>
	</a>
</div>
<style lang="scss">
	.root {
		width: 20rem;
		user-select: none;
	}

	.input-group > .input-group-text:first-child {
		flex: 0 0 10rem;
	}
</style>