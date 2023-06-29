interface CaretFinder {
	start(node: Node): Node | null;
	next(node: Node): Node | null;
	match(text: Text, range: Range, current: number, target: number): number;
}

function resolve(finder: CaretFinder, range: Range, node: Node, index: number, target: number): boolean {
	if (node instanceof Text) {
		return finder.match(node, range, index, target) < 0
	} else {
		for (let n = finder.start(node); n != null; n = finder.next(n))
			if (resolve(finder, range, n, index, target))
				return true;
	
		return false;
	}
}

const cfForward: CaretFinder = {
	start(node) {
		return node.firstChild;
	},
	next(node) {
		return node.nextSibling;
	},
	match(text, range, current, target) {
		const data = text.data;
		const next = current + data.length
		if (next < target)
			return next;

		const pos = current - target;
		range.setStart(text, pos);
		range.setEnd(text, pos);
		return -1;
	}
}

const cfBackward: CaretFinder = {
	start(node) {
		return node.lastChild;
	},
	next(node) {
		return node.previousSibling;
	},
	match(text, range, current, target) {
		const data = text.data;
		if ((current -= data.length) <= 0) {
			current = -current;
			range.setStart(text, current);
			range.setEnd(text, current);
			return -1;
		}

		return current;
	}
}

export namespace dom {
	export function getSelectionFor(element: HTMLElement): null | Selection {
		const selection = window.getSelection();
		if (selection != null)
			for (let node = selection.focusNode; node != null; node = node.parentNode)
				if (node == element)
					return selection;
	
		return null;
	}
	
	export function setCaret(node: Node, index: number, fromEnd?: boolean): Range | undefined
	export function setCaret(selection: Selection, node: Node, index: number, fromEnd?: boolean): Range | undefined
	export function setCaret(...args: any[]) {
		const selection: Selection = args[0] instanceof Selection ? args.shift() : window.getSelection();
		const [node, index, fromEnd]: [Node, number, boolean?] = args as any;
		const range = document.createRange();
		const finder = fromEnd ? cfBackward : cfForward;
		if (!resolve(finder, range, node, index, index))
			return undefined;
	
		selection.removeAllRanges();
		selection.addRange(range);
		return range;
	}

	export function isDescendant(self: Element, parent: Element) {
		while (true) {
			const next = self.parentElement;
			if (next == null)
				return false;
	
			if (next == parent)
				return true;
	
			self = next;
		}
	}
}

export default dom;