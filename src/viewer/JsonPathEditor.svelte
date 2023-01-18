<script lang="ts">
	export let path: undefined | readonly (number | string)[] = undefined;

	function updatePath(value: undefined | readonly (number | string)[]) {
		path = value;
	}

	function render(target: HTMLElement, path: undefined | readonly (number | string)[]) {
		function validateSelection(s: null | Selection, element: HTMLElement): s is Selection {
			const selection = window.getSelection();
			if (selection != null)
				for (let node = selection.focusNode; node != null; node = node.parentNode)
					if (node == element)
						return true;

			return false;
		}

		function createPartNode(part: string | number) {
			const e = document.createElement("span");
			e.innerText = String(part);
			e.contentEditable = "true";
			const li = document.createElement("li");

			li.contentEditable = "false";
			li.appendChild(e);
			return li;
		}

		function onKeyDown(this: HTMLElement, evt: KeyboardEvent) {
			switch (evt.code) {
				default:
					return;
				case "Enter": {
					let parts: string[] = [];
					for (let child of this.childNodes)
						parts.push(child.textContent!);
						
					updatePath(parts);
					break;
				}
				case "Slash": {
					const selection = window.getSelection();
					if (!validateSelection(selection, this))
						break;

					const range = selection.getRangeAt(0);
					const span = range.commonAncestorContainer.parentElement!;
					if (span.tagName !== "SPAN")
						break;

					const text = span.innerText;
					const start = text.substring(0, range.startOffset);
					const end = text.substring(range.endOffset);
					const li = span.parentElement!;
					if (start && end || li.nextSibling == null) {
						span.innerText = start;
						const sibling = createPartNode(end);
						const content = sibling.firstElementChild!;
						target.insertBefore(sibling, li.nextSibling);
						//setTimeout(() => range.setStart(sibling.firstChild!, 0), 10);
						
						const newRange = document.createRange();
						newRange.setStart(content, 0);
						newRange.setEnd(content, 0);
						selection.removeRange(range);
						selection.addRange(newRange);
					} else if (start) {
						if (span.innerText !== start)
							span.innerText = start;
					} else if (end) {
						if (span.innerText !== end)
							span.innerText = end;
					}
					break;
				}
			}

			evt.preventDefault();
		}

		function onInput(this: HTMLElement) {}

		function update(path: undefined | readonly (number | string)[]) {
			target.innerHTML = "";

			path?.forEach(v => {
				const e = createPartNode(v);
				target.appendChild(e);
			});
		}

		target.addEventListener("keydown", onKeyDown);
		target.addEventListener("input", onInput);

		return {
			update,
			destroy() {
				target.innerHTML = "";
			},
		};
	}
</script>

<ul class="list" contenteditable="true" use:render={path} />

<style lang="scss">
	@use "../core.scss" as *;

	.list {
		@include font-elem;

		outline: none;
		grid-area: 1 / 1 / span 1 / span 1;
		display: flex;
		flex-direction: row;
		user-select: none;

		> :global(li) {
			display: flex;
			flex-direction: row;
			align-items: center;

			&:not(:last-child)::after {
				content: "/";
				padding: 0 0.5rem;
			}

			> :global(span) {
				display: block;
				outline: none;
				min-width: 1em;
			}
		}
	}
</style>
