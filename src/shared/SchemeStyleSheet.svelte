<script lang="ts">
	import schemes from "../schemes";

	export let scheme: schemes.ColorScheme;
	export let darkMode: boolean;
	export let fontSize: number;
	export let fontFamily: string;

	let schemeStyle: undefined | HTMLStyleElement;
	let fontStyle: undefined | HTMLStyleElement;

	$: schemeStyle && (schemeStyle.textContent = schemes.compileCss(scheme));

	$: fontCss = `.jv-font {font-size:${fontSize}pt;font-family:${fontFamily},monospace}`;
	$: fontStyle && (fontStyle.textContent = fontCss);

	$: document.documentElement.dataset.bsTheme = darkMode ? 'dark' : 'light';
</script>
<svelte:head>
	<style bind:this={schemeStyle}></style>
	<style bind:this={fontStyle}></style>
</svelte:head>
