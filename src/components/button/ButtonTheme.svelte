<script lang="ts">
	import type Button from "../button.js";
	import ButtonThemeData from './theme';

	export let style: Button.Style;

	const store = ButtonThemeData.createContext();

	$: $store = new ButtonThemeData(style);
</script>
<slot/>