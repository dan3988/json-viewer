<script lang="ts">
	import { ButtonTheme, type ButtonStyle } from './button';

	export let style: ButtonStyle;

	const store = ButtonTheme.createContext();

	$: $store = new ButtonTheme(style);
</script>
<slot/>