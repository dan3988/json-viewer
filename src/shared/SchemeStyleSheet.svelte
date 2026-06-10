<script lang="ts">
	import schemes from "../schemes";

	interface Props {
		scheme: schemes.ColorScheme;
		darkMode: boolean;
		fontSize?: number;
		fontFamily?: string;
	}

	const {
		scheme,
		darkMode,
		fontSize,
		fontFamily
	}: Props = $props();

	let schemeStyle: undefined | HTMLStyleElement;
	let fontStyle: undefined | HTMLStyleElement;

	const fontCss = $derived(['.jv-font {', (fontSize && `font-size:${fontSize}pt;`) || '', (fontFamily && `font-family:${fontFamily},monospace;`) || '', '}'].join(''));

	$effect(() => void (schemeStyle && (schemeStyle.textContent = schemes.compileCss(scheme))));
	$effect(() => void (fontStyle && (fontStyle.textContent = fontCss)));
	$effect(() => void (document.documentElement.dataset.bsTheme = darkMode ? 'dark' : 'light'));
</script>
<svelte:head>
	<style bind:this={schemeStyle}></style>
	<style bind:this={fontStyle}></style>
</svelte:head>
