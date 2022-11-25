<script lang="ts">
	import type { ViewerModel } from "./viewer-model";
	import JsonBreadcrumb from "./JsonBreadcrumb.svelte";
	import JsonProperty from "./JsonProperty.svelte";
    import JsonMenu from "./JsonMenu.svelte";

	export let model: ViewerModel;
</script>
<style lang="scss">
    .root {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-columns: 1fr 20rem;
        grid-template-rows: 1fr auto;
        overflow: hidden;

        > div {
            position: relative;
        }
    }

    .w-prop {
        grid-area: 1 / 1 / -2 / span 1;
        overflow: scroll;
    }

    .w-path {
        grid-area: -2 / 1 / -1 / span 1;
    }

    .w-menu {
        grid-area: 1 / -2 / -1 / -1;
    }
</style>

<div class="root">
    <div class="w-prop">
        <JsonProperty model={model} key="$root" value={model.root} expanded={true}/>
    </div>
    <div class="w-path">
        <JsonBreadcrumb model={model}/>
    </div>
    <div class="w-menu">
        <JsonMenu model={model}/>
    </div>
</div>