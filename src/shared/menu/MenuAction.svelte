<script lang="ts">
	import { onDestroy } from "svelte";
	import { MenuController } from "./Menu.svelte";

	export let title: string;
	export let icon: BootstrapIconKey | '' = '';
	export let action: VoidFunction;

	const controller = MenuController.ofContext().addItem();

	$: controller.title = title;
	$: controller.icon = icon;
	$: controller.action = action;

	onDestroy(controller.onDestroyed);
</script>
<slot/>
