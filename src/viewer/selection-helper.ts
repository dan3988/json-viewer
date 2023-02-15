const nodeIterateUp = ['firstChild', 'nextSibling'] as const;
const nodeIterateDown = ['lastChild', 'previousSibling'] as const;

abstract class CaretFinder {
	resolve(range: Range, node: Node, index: number, target: number): boolean {
		if (node instanceof Text) {
			return this.__match(node, range, index, target) < 0
		} else {
			for (let n = this.__start(node); n != null; n = this.__next(n))
				if (this.resolve(range, n, index, target))
					return true;
		
			return false;
		}
	}

	protected abstract __start(node: Node): Node | null;
	protected abstract __next(node: Node): Node | null;
	protected abstract __match(text: Text, range: Range, current: number, target: number): number;
}

class CaretFinderForward extends CaretFinder {
	protected __start(node: Node): Node | null {
		return node.firstChild;
	}

	protected __next(node: Node): Node | null {
		return node.nextSibling;
	}

	protected __match(text: Text, range: Range, current: number, target: number): number {
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

class CaretFinderBackward extends CaretFinder {
	protected __start(node: Node): Node | null {
		return node.lastChild;
	}

	protected __next(node: Node): Node | null {
		return node.previousSibling;
	}

	protected __match(text: Text, range: Range, current: number, target: number): number {
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
	const finder = (fromEnd ? CaretFinderBackward : CaretFinderForward).prototype;
	if (!finder.resolve(range, node, index, index))
		return undefined;

	selection.removeAllRanges();
	selection.addRange(range);
	return range;
}