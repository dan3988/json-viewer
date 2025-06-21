<script lang="ts">
	import { renderKey } from "../renderer.js";
	import JsonPropertyKeyBase from "./JsonPropertyKeyBase.svelte";
	import JsonValueEditor from "./JsonValueEditor.svelte";

	export let name: string | null = null;
	export let selected = false;
	export let editing = false;
	export let onrename: ((name: string) => void) | undefined = undefined;
	export let cleanup: (() => void) | undefined = undefined;
	export let onclick: ((evt: MouseEvent) => void) | undefined = undefined;

	let base: JsonPropertyKeyBase;

	export function scrollTo(behavior?: ScrollBehavior) {
		base.scrollTo(behavior);
	}
</script>
<JsonPropertyKeyBase bind:this={base} bind:selected bind:editing editable {onclick}>
	<JsonValueEditor value={String(name ?? '')} parse={String} checkEqual={name != null} autoSelect bind:editing renderer={renderKey} onfinish={onrename} {cleanup} />
</JsonPropertyKeyBase>
