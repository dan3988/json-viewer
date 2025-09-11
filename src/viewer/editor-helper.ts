import { EditAction } from "../edit-stack.js";
import json from "../json.js";
import Linq from "@daniel.pickett/linq-js";
import { noop } from "../util.js";

export namespace edits {
	export function clearProp(value: json.JContainer): EditAction {
		const props = [...value];
		return new EditAction(commit, revert, value.owner);

		function commit() {
				value.clear();
				value.owner.isExpanded = false;
		}

		function revert() {
				for (const prop of props)
					value.setProperty(prop);

				value.owner.isExpanded = true;
		}
	}

	export function setValue(token: json.JValue, newValue: json.JValueType): EditAction {
		let oldValue: any;
		return new EditAction(commit, revert, token.owner);

		function commit() {
			oldValue = token.value;
			token.value = newValue;
		}

		function revert() {
			token.value = oldValue;
			oldValue = undefined;
		}
	}

	export function replace(prop: json.JProperty, newProp: json.JProperty): EditAction {
		return new EditAction(commit, revert, {
			commitTarget: newProp,
			revertTarget: prop,
		});

		function commit() {
			prop.replace(newProp.value);
		}

		function revert() {
			newProp.replace(prop.value);
		}
	}

	function createDeleteRevert(prop: json.JProperty): VoidFunction {
		const { parent } = prop;
		if (parent!.is("object")) {
			const p = prop as json.JProperty<string>;
			const obj = parent;
			if (p.previous === null) {
				return () => obj.first === null ? obj.setProperty(p) : obj.insertBefore(p, obj.first);
			} else {
				return json.JObject.prototype.insertAfter.bind(obj, p, p.previous);
			}
		} else if (parent!.is('array')) {
			return json.JArray.prototype.insertProperty.bind(parent, prop as json.JProperty<number>);
		} else {
			return noop;
		}
	}

	export function remove(prop: json.JProperty): EditAction;
	export function remove(props: Iterable<json.JProperty>): EditAction;
	export function remove(arg: json.JProperty | Iterable<json.JProperty>): EditAction {
		if (Symbol.iterator in arg) {
			const props = Linq(arg)
				.select(v => [v, createDeleteRevert(v)] as const)
				.toArray();

			function commit() {
				for (const [prop] of props) {
					prop.remove();
				}
			}

			function revert() {
				for (const [, revert] of props) {
					revert();
				}
			}

			return new EditAction(commit, revert);
		} else {
			const prop = arg;
			const revert = createDeleteRevert(prop);

			return new EditAction(commit, revert, {
				commitTarget: prop.parent?.owner,
				revertTarget: prop,
			});

			function commit() {
				prop.remove();
			}
		}
	}

	function resetExisting(parent: json.JObject, key: string) {
		const existing = parent.getProperty(key);
		const existingSibling = existing?.next;
		if (existing) {
			if (existingSibling) {
				return json.JObject.prototype.insertBefore.bind(parent, existing, existingSibling);
			} else {
				return json.JObject.prototype.setProperty.bind(parent, existing);
			}
		}
	}

	export function rename(parent: json.JObject, oldName: string, newName: string): EditAction {
		const target = parent.getProperty(oldName);
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

	export function sort(obj: json.JObject, desc?: boolean): EditAction {
		const old = [...obj];
		return new EditAction(commit, revert, obj.owner);

		function commit() {
			obj.sort(desc);
		}

		function revert() {
			obj.reset(old);
		}
	}

	export function objectAdd(parent: json.JObject, mode: json.AddType, key: string, sibling?: null | json.JProperty<string>): EditAction {
		const prop = new json.JProperty(key, mode);
		const reset = resetExisting(parent, key);
		let commit: () => void;

		if (!sibling) {
			commit = json.JObject.prototype.insertAfter.bind(parent, prop);
		} else {
			commit = json.JObject.prototype.insertBefore.bind(parent, prop, sibling);
		}

		return new EditAction(commit, revert, {
			commitTarget: prop,
			revertTarget: sibling ?? parent.last
		});

		function revert() {
			prop.remove();
			reset?.();
		}
	}

	export function arrayAdd(parent: json.JArray, mode: json.AddType, index?: number) {
		const prop = new json.JProperty(index ?? parent.count, mode);
		return new EditAction(commit, revert, {
			commitTarget: prop,
			revertTarget: parent.getProperty(prop.key),
		});

		function commit() {
			parent.insertProperty(prop);
			parent.owner.isExpanded = true;
		}

		function revert() {
			prop.remove();
		}
	}
}

export default edits;