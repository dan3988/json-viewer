<script lang="ts">
	import { onDestroy } from "svelte";
	import { MenuController } from "./Menu.svelte";

	export let title: string;
	export let icon: BootstrapIconKey | '' = '';

	const controller = MenuController.ofContext().addList();

	MenuController.setContext(controller);

	$: controller.title = title;
	$: controller.icon = icon;

	onDestroy(controller.onDestroyed);
</script>
<slot/>
