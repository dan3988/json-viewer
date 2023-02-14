const nodeIterateUp = ['firstChild', 'nextSibling'] as const;
const nodeIterateDown = ['lastChild', 'previousSibling'] as const;

function findCaretPos(range: Range, node: Node, index: number, keys: typeof nodeIterateUp | typeof nodeIterateDown): boolean {
	const [kStart, kMove] = keys;
	for (let n = node[kStart]; n != null; n = n[kMove]) {
		if (n instanceof Text) {
			const data = n.data;
			if ((index -= data.length) <= 0) {
				index = -index;
				range.setStart(n, index);
				range.setEnd(n, index);
				return true;
			}
		} else if (findCaretPos(range, n, index, keys)) {
			return true;
		}
	}

	return false;
}

export function getSelectionFor(element: HTMLElement): null | Selection {
	const selection = window.getSelection();
	if (selection != null)
		for (let node = selection.focusNode; node != null; node = node.parentNode)
			if (node == element)
				return selection;

	return null;
}

export function setCaret(node: Node, index: number, fromEnd?: boolean): Range
export function setCaret(selection: Selection, node: Node, index: number, fromEnd?: boolean): Range
export function setCaret(...args: any[]) {
	let selection: Selection = args[0] instanceof Selection ? args.shift() : window.getSelection();
	let [node, index, fromEnd]: [Node, number, boolean?] = args as any;
	if (fromEnd) {
		let n = node.lastChild;
		while (n != null) {
			n = n.previousSibling;
		}
	}

	const range = document.createRange();
	const keys = fromEnd ? nodeIterateDown : nodeIterateUp;
	findCaretPos(range, node, index, keys);
	selection.removeAllRanges();
	selection.addRange(range);
	return range;
}