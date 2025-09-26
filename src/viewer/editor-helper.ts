import { EditAction } from "../edit-stack.js";
import json from "../json.js";
import Linq from "@daniel.pickett/linq-js";
import { noop } from "../util.js";

export namespace edits {
	export function clearProp(node: json.Container): EditAction {
		const empty = new (node.isObject() ? json.Object : json.Array);
		return new EditAction(commit, revert, node);

		function commit() {
			node.replace(empty);
		}

		function revert() {
			empty.replace(node);
		}
	}

	export function setValue(node: json.Value, newValue: json.ValueType): EditAction {
		let oldValue: any;
		return new EditAction(commit, revert, node);

		function commit() {
			oldValue = node.value;
			node.value = newValue;
		}

		function revert() {
			node.value = oldValue;
			oldValue = undefined;
		}
	}

	export function replace(node: json.Node, newProp: json.Node): EditAction {
		return new EditAction(commit, revert, {
			commitTarget: newProp,
			revertTarget: node,
		});

		function commit() {
			node.replace(newProp);
		}

		function revert() {
			newProp.replace(node);
		}
	}

	function createDeleteRevert(node: json.Node): VoidFunction {
		const { parent } = node;
		if (parent!.isObject()) {
			const key = node.key as string;
			const obj = parent;
			if (node.next) {
				return json.Object.prototype.insertBefore.bind(obj, key, node, node.next);
			} else {
				return json.Object.prototype.insertAfter.bind(obj, key, node, node.previous);
			}
		} else if (parent!.isArray()) {
			const key = node.key as number;
			return json.Array.prototype.add.bind(parent, node, key);
		} else {
			return noop;
		}
	}

	export function remove(node: json.Node): EditAction;
	export function remove(nodes: Iterable<json.Node>): EditAction;
	export function remove(arg: json.Node | Iterable<json.Node>): EditAction {
		if (arg instanceof json.Node)
			arg = Linq.repeat(arg, 1);

		const nodes = Linq(arg)
			.select(v => [v, createDeleteRevert(v)] as const)
			.toArray();

		const [last] = nodes.at(-1) ?? [];

		function commit() {
			for (const [node] of nodes) {
				node.remove();
			}
		}

		function revert() {
			for (const [, revert] of nodes) {
				revert();
			}
		}

		return new EditAction(commit, revert, {
			commitTarget: last && (last.previous ?? last.next ?? last.parent),
			revertTarget: last,
		});
	}

	function resetExisting(parent: json.Object, key: string) {
		const existing = parent.get(key);
		const existingSibling = existing?.next;
		if (existing) {
			if (existingSibling) {
				return json.Object.prototype.insertBefore.bind(parent, key, existing, existingSibling);
			} else {
				return json.Object.prototype.set.bind(parent, key, existing);
			}
		}
	}

	export function rename(parent: json.Object, oldName: string, newName: string): EditAction {
		const target = parent.get(oldName);
		const reset = resetExisting(parent, newName);
		return new EditAction(commit, revert, target);

		function commit() {
			parent.rename(oldName, newName);
		}

		function revert() {
			parent.rename(newName, oldName);
			reset?.();
		}
	}

	function sortAsc(x: string, y: string) {
		return x.localeCompare(y);
	}

	function sortDesc(x: string, y: string) {
		return y.localeCompare(x);
	}

	export function sort(obj: json.Object, desc?: boolean): EditAction {
		const compare = desc ? sortDesc : sortAsc;
		const keys = [...obj.getKeys()];
		return new EditAction(commit, revert, obj);

		function commit() {
			obj.sort(compare);
		}

		function revert() {
			obj.sort((x, y) => keys.indexOf(x) - keys.indexOf(y));
		}
	}

	export function objectAdd(parent: json.Object, key: string, value: any, sibling?: null | json.Node): EditAction {
		const node = json(value);
		const reset = resetExisting(parent, key);
		let commit: () => void;

		if (!sibling) {
			commit = json.Object.prototype.insertAfter.bind(parent, key, node);
		} else {
			commit = json.Object.prototype.insertBefore.bind(parent, key, node, sibling);
		}

		return new EditAction(commit, revert, {
			commitTarget: node,
			revertTarget: sibling ?? parent.last
		});

		function revert() {
			node.remove();
			reset?.();
		}
	}

	export function arrayAdd(parent: json.Array, value: any, index?: number) {
		//const node = new json.Node(index ?? parent.count, mode);
		index ??= parent.count;
		const node = json(value);
		return new EditAction(commit, revert, {
			commitTarget: node,
			revertTarget: parent.get(index ? index - 1 : 0),
		});

		function commit() {
			parent.add(node, index);
			parent.isExpanded = true;
		}

		function revert() {
			node.remove();
		}
	}
}

export default edits;