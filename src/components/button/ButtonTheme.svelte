<script lang="ts">
	import type { ButtonStyle } from "../button.js";
	import ButtonThemeData from './theme';

	export let style: ButtonStyle;

	const store = ButtonThemeData.createContext();

	$: $store = new ButtonThemeData(style);
</script>
<slot/>