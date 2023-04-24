<script lang="ts" >
    let elem: HTMLElement;
	let err: string;

	async function onYes() {
		const res = await chrome.runtime.sendMessage({ type: "loadme" });
		if (res != null)
			alert(res);

		elem.remove();
	}

	function onNo() {
		elem.remove();
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

    .root {
        @include border-rnd;
        @include font-elem;

        background-color: var(--col-bg-dk);
        position: absolute;
        bottom: 1rem;
        left: 50%;
        translate: -50% 0;
        padding: $pad-med;

        > span {
            padding: 0 $pad-med;
        }
    }

    .positive {
        background-color: #00AA00;
        border-color: #008800;
    }

    .negative {
        background-color: #AA0000;
        border-color: #880000;
    }
</style>
<template>
    <div class="root" bind:this={elem}>
        <span>Load JSON viewer?</span>
        <button class="btn positive" on:click={onYes}>Yes</button>
        <button class="btn negative" on:click={onNo}>No</button>
    </div>
</template>