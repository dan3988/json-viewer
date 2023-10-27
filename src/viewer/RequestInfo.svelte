<script lang="ts" context="module">
	import type { DocumentRequestInfo, DocumentHeader } from "../types.d.ts"

	function wrapHeaders(info: undefined | DocumentRequestInfo): [title: string, headers: DocumentHeader[]][] {
		return info ? [["Request Headers", info.requestHeaders], ["Response Headers", info.responseHeaders]] : [];
	}

	function copyHeader(key: string, value: string) {
		return navigator.clipboard.writeText(`${key}: ${value}`);
	}
</script>
<script lang="ts">
	import type ViewerModel from "../viewer-model";
	import time from "../time";

	export let model: ViewerModel;

	$: info = model.requestInfo;
</script>
<style lang="scss">
	@use "src/core.scss" as *;

	.root {
		grid-template-columns: 1.5rem min(33%, 20rem) 1fr;
		grid-auto-flow: row;
		grid-column-gap: .5rem;

		> * {
			grid-column: 1 / -1;
		}
	}

	.mono {
		font-family: monospace;
	}

	.list span {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}

	.pairs {
		display: contents;
	}

	.row-key {
		grid-column: 1 / span 2;
		text-align: right;
		color: var(--col-json-key-fg);
	}

	.row-val {
		grid-column: 3 / span 1;
		color: var(--col-json-str-fg);
	}

	.header {
		> .row-key {
			grid-column: 2 / span 1;
		}

		&:hover > .copy-btn {
			opacity: 0.25;
		}

		> .copy-btn:hover {
			opacity: 1;
		}
	}
	
	.header > .row-key {
		grid-column: 2 / span 1;
	}

	.copy-btn {
		@include bs-icon-btn("clipboard", 25%);
		padding: 0.2rem;
		transition: none;
		opacity: 0;
	}
</style>
{#if info}
	<div class="root d-grid">
		<div class="mono status pairs flex-column">
			<span class="row-key">Status</span>
			<span class="row-val">{info.statusText}</span>
			<span class="row-key">Initiated</span>
			<span class="row-val">{new Date(info.startTime)}</span>
			<span class="row-key">Duration</span>
			<span class="row-val">{time.durationToString(info.endTime - info.startTime)}</span>
		</div>
		{#each wrapHeaders(info) as [title, values]}
			<span class="h5 title border-bottom py-2">{title}</span>
			<ul class="list pairs mono">
				{#each values as [key, value]}
					<li class="header pairs">
						<span class="copy-btn btn btn-cust-light" role="button" title="Cop Header" on:click={() => copyHeader(key, value)}></span>
						<span class="row-key" title={key}>{key}</span>
						<span class="row-val" title={value}>{value}</span>
					</li>
				{/each}
			</ul>
		{/each}
	</div>
{/if}