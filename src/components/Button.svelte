<script lang="ts">
	import Button from "./button";
	import Icon from "./Icon.svelte";

	export let style: Button.Style | undefined = undefined;
	export let icon: BootstrapIconKey | "" = "";
	export let title: boolean | string = true;
	export let action: EventHandler<void, MouseEvent> | Falsy = undefined;
	export let text: string | undefined = undefined;

	const theme = Button.ThemeData.current;

	function onClick(evt: MouseEvent) {
		action && action(evt);
	}

	$: tooltip = (typeof title === "boolean" ? (title ? text : undefined) : title) ?? "";
	$: clazz = style ?? $theme.style;
</script>
<button
	class="btn btn-{clazz} d-flex gap-2"
	class:disabled={!action}
	title={tooltip}
	aria-label={tooltip}
	on:click={onClick}>
	{#if icon}
		<Icon {icon} />
	{/if}
	<slot>{text ?? ""}</slot>
</button>
