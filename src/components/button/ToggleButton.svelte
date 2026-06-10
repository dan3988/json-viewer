<script lang="ts">
	import type { ButtonStyle } from "../button.js";
	import type { Snippet } from "svelte";
	import ButtonThemeData from "./theme";
	import Icon from "../Icon.svelte";

	interface Props {
		style?: ButtonStyle | undefined;
		icon?: BootstrapIconKey | "";
		title?: boolean | string
		checked?: boolean;
		disabled?: boolean;
		text?: string;
		onchange?: Consumer<boolean>;
		children?: Snippet;
	}

	let {
		style,
		icon = '',
		title = true,
		checked = $bindable(false),
		disabled = false,
		text,
		onchange,
		children,
	}: Props = $props();

	const theme = ButtonThemeData.current;
	const tooltip = $derived((typeof title === "boolean" ? (title ? text : undefined) : title) ?? "");
	const clazz = $derived(style ?? $theme.style);

	function onClick() {
		checked = !checked;
		onchange?.(checked);
	}
</script>
<button
	class="btn btn-{clazz} d-flex gap-2"
	class:disabled
	class:active={checked}
	title={tooltip}
	aria-label={tooltip}
	onclick={onClick}>
	{#if icon}
		<Icon {icon} />
	{/if}
	{#if children}
		{@render children()}
	{:else if text}
		{text}
	{/if}
</button>
