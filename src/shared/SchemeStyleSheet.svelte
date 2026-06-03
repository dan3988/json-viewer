<script lang="ts">
	import schemes from "../schemes";

	export let scheme: schemes.ColorScheme;
	export let darkMode: boolean;
	export let fontSize: number | undefined = undefined;
	export let fontFamily: string | undefined = undefined;

	let schemeStyle: undefined | HTMLStyleElement;
	let fontStyle: undefined | HTMLStyleElement;

	$: schemeStyle && (schemeStyle.textContent = schemes.compileCss(scheme));

	$: fontCss = ['.jv-font {', (fontSize && `font-size:${fontSize}pt;`) || '', (fontFamily && `font-family:${fontFamily},monospace;`) || '', '}'].join('');
	$: fontStyle && (fontStyle.textContent = fontCss);

	$: document.documentElement.dataset.bsTheme = darkMode ? 'dark' : 'light';
</script>
<svelte:head>
	<style bind:this={schemeStyle}></style>
	<style bind:this={fontStyle}></style>
</svelte:head>
