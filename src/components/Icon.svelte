<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		icon: BootstrapIconKey;
		children?: Snippet;
	}

	const { icon, children }: Props = $props();
</script>
<i class="bi bi-{icon}">
	{@render children?.()}
</i>
