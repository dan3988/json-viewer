<script lang="ts">
	import JsonPropertyKeyBase from "./JsonPropertyKeyBase.svelte";

	export let index: number;
	export let selected = false;
	export let onclick: ((evt: MouseEvent) => void) | undefined = undefined;

	let base: JsonPropertyKeyBase;

	export function scrollTo(behavior?: ScrollBehavior) {
		base.scrollTo(behavior);
	}
</script>
<JsonPropertyKeyBase bind:this={base} bind:selected {onclick}>
	<span>{index}</span>
</JsonPropertyKeyBase>
