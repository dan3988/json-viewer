<script lang="ts">
	import schemes from "../schemes";

	export let scheme: schemes.ColorScheme;
	export let darkMode: boolean;

	let element: undefined | HTMLStyleElement;

	$: element && (element.textContent = schemes.compileCss(scheme));
	$: document.body.dataset.bsTheme = darkMode ? 'dark' : 'light';
</script>
<svelte:head>
	<style bind:this={element}></style>
</svelte:head>
