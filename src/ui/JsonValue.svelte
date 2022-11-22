<script lang="ts">
	import type { JsonValue } from "./json";

	export let token: JsonValue;
</script>
{#if token}
<span class="json-value json-{token.subtype}">{token.value}</span>
{/if}