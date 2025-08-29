<script lang="ts">
	import { ButtonTheme } from "./ButtonStyle.svelte";
	import Icon from "./Icon.svelte";

	export let style: 'base' | 'primary' | 'faded' | undefined = undefined;
	export let icon: BootstrapIconKey | '' = '';
	export let title: boolean | string = true;
	export let action: VoidFunction | undefined = undefined;
	export let text: string | undefined = undefined;

	const theme = ButtonTheme.current;

	$: tooltip = (typeof title === 'boolean' ? title ? text : undefined : title) ?? '';
	$: clazz = style ?? $theme.style;
</script>
<button class="btn btn-{clazz} d-flex gap-2" title={tooltip} aria-label={tooltip} on:click={action}>
	{#if icon}
		<Icon {icon} />
	{/if}
	<slot>{text ?? ''}</slot>
</button>