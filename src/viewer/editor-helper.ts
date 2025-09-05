import { EditAction } from "../edit-stack.js";
import json from "../json.js";
import Linq from "@daniel.pickett/linq-js";

export namespace edits {
	export function clearProp(value: json.JContainer): EditAction {
		const props = [...value];
		return new EditAction(commit, revert);

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
		return new EditAction(commit, revert);

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
		return new EditAction(commit, revert);

		function commit() {
			prop.replace(newProp.value);
		}

		function revert() {
			newProp.replace(prop.value);
		}
	}

	function createDeleteRevert(prop: json.JProperty) {
		const { parent } = prop;
		if (parent!.is("object")) {
			const p = prop as json.JProperty<string>;
			const obj = parent;
			if (p.previous === null) {
				return () => obj.first === null ? obj.setProperty(p) : obj.insertBefore(p, obj.first);
			} else {
				const prev = p.previous;
				return () => obj.insertAfter(p, prev);
			}
		} else {
			return () => (parent as json.JContainer).setProperty(prop);
		}
	}

	export function remove(prop: json.JProperty): EditAction;
	export function remove(props: Iterable<json.JProperty>): EditAction;
	export function remove(arg: json.JProperty | Iterable<json.JProperty>): EditAction {
		let props: (readonly [prop: json.JProperty, remove: VoidFunction])[];

		if (Symbol.iterator in arg) {
			props = Linq(arg)
				.select(v => [v, createDeleteRevert(v)] as const)
				.toArray();
		} else {
			props = [
				[arg, createDeleteRevert(arg)],
			];
		}

		return new EditAction(commit, revert);

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
	}

	export function rename(parent: json.JObject, oldName: string, newName: string): EditAction {
		return modifyStructure(parent, newName, obj => obj.rename(oldName, newName), obj => obj.rename(newName, oldName));
	}

	export function sort(obj: json.JObject, desc?: boolean): EditAction {
		const old = [...obj];
		return new EditAction(commit, revert);

		function commit() {
			obj.sort(desc);
		}

		function revert() {
			obj.reset(old);
		}
	}

	export function objectAdd(parent: json.JObject, mode: json.AddType, key: string, sibling?: json.JProperty<string>, insertBefore = false): EditAction {
		const prop = new json.JProperty(key, mode);
		let commit: (obj: json.JObject) => void;

		if (!sibling) {
			commit = obj => obj.setProperty(prop);
		} else if (insertBefore) {
			commit = obj => obj.insertBefore(prop, sibling);
		} else {
			commit = obj => obj.insertAfter(prop, sibling);
		}

		return modifyStructure(parent, key, commit, () => prop.remove());
	}

	export function arrayAdd(parent: json.JArray, mode: json.AddType, index?: number) {
		const prop = new json.JProperty(index ?? parent.count, mode);
		return new EditAction(commit, revert);

		function commit() {
			parent.insertProperty(prop);
			parent.owner.isExpanded = true;
		}

		function revert() {
			prop.remove();
		}
	}

	function modifyStructure(parent: json.JObject, key: string, run: (obj: json.JObject) => void, remove: (obj: json.JObject) => void): EditAction {
		let existing: undefined | json.JProperty<string>;
		let existingSibling: undefined | null | json.JProperty<string>;
		return new EditAction(commit, revert);

		function commit() {
			existing = parent.getProperty(key);
			existingSibling = existing?.next;
			run(parent);
		}

		function revert() {
			remove(parent);
			if (existing) {
				if (existingSibling) {
					parent.insertBefore(existing, existingSibling);
				} else {
					parent.setProperty(existing);
				}
			}
		}
	}
}

export default edits;