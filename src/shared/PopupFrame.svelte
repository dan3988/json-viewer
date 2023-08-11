<script lang="ts">
	import { fade } from "svelte/transition";
</script>
<style lang="scss">
	.base {
		background-color: rgba(var(--blur-bg-rgb), 0.25);
		backdrop-filter: blur(1px);
		z-index: 10;
		position: fixed;
		inset: 0;
		display: flex;

		> .popup-display {
			z-index: 11;
			margin: auto;
		}
	}
</style>

<div class="base" transition:fade>
	<div class="popup-display">
		<slot/>
	</div>
</div>