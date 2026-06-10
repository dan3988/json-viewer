<script lang="ts">
	import type { Snippet } from "svelte";
	import type { ButtonStyle } from "../button.js";
	import ButtonThemeData from './theme';

	interface Props {
		style: ButtonStyle;
		children?: Snippet;
	}

	const { style, children }: Props = $props();
	const store = ButtonThemeData.createContext();

	$effect.pre(() => void ($store = new ButtonThemeData(style)));
</script>
{@render children?.()}