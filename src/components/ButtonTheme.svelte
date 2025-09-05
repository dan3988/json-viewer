<script lang="ts">
	import Button from './button';

	export let style: Button.Style;

	const store = Button.ThemeData.createContext();

	$: $store = new Button.ThemeData(style);
</script>
<slot/>