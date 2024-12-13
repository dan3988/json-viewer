<script lang="ts">
	import schemes from "../schemes";

	export let scheme: schemes.ColorScheme;

	let element: HTMLStyleElement;

	$: element && (element.textContent = schemes.compileCss(scheme));
</script>
<svelte:head>
	<style bind:this={element}></style>
</svelte:head>
