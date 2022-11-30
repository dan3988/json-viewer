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
        grid-template-columns: 1fr 30rem;
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

    @media only screen and (max-width: 900px) {
        .root {
            grid-template-columns: 1fr;
            grid-template-rows: 20rem 1fr auto;
        }

        .w-menu {
            grid-area: 1 / 1 / span 1 / -1;
        }

        .w-prop {
            grid-area: 2 / 1 / span 1 / -1;
        }

        .w-path {
            grid-area: 3 / 1 / span 1 / -1;
        }
    }
</style>

<div class="root">
    <div class="w-prop">
        <JsonProperty model={model} prop={model.root} indent={0}/>
    </div>
    <div class="w-path">
        <JsonBreadcrumb model={model}/>
    </div>
    <div class="w-menu">
        <JsonMenu model={model}/>
    </div>
</div>