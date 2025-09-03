import type { EditAction } from "../edit-stack.js";
import type ViewerModel from "../viewer-model.js";
import json from "../json.js";
import Linq from "@daniel.pickett/linq-js";

export namespace edits {
	export function clearProp(model: ViewerModel, value: json.JContainer) {
		const props = [...value];
		model.edits.push({
			commit() {
				value.clear();
				value.owner.isExpanded = false;
			},
			undo() {
				for (const prop of props)
					value.setProperty(prop);

				value.owner.isExpanded = true;
			}
		})
	}

	export function setValue(model: ViewerModel, token: json.JValue, newValue: json.JValueType) {
		const oldValue = token.value;
		model.edits.push({
			commit: () => token.value = newValue,
			undo: () => token.value = oldValue,
		});
	}

	export function replace(model: ViewerModel, prop: json.JProperty, newProp: json.JProperty) {
		model.edits.push({
			commit: () => prop.replace(newProp.value),
			undo: () => newProp.replace(prop.value)
		});
	}

	function createDeleteAction(prop: json.JProperty): EditAction {
		const { parent } = prop;
		let undo: Action;
		if (parent!.is("object")) {
			const p = prop as json.JProperty<string>;
			const obj = parent;
			if (p.previous === null) {
				undo = () => obj.first === null ? obj.setProperty(p) : obj.insertBefore(p, obj.first);
			} else {
				const prev = p.previous;
				undo = () => obj.insertAfter(p, prev);
			}
		} else {
			undo = () => (parent as json.JContainer).setProperty(prop);
		}

		return {
			undo,
			commit() {
				prop.remove();
			}
		};
	}

	export function deleteProp(model: ViewerModel, prop: json.JProperty, selectNext?: boolean) {
		const { parent, next, previous } = prop;
		if (parent == null)
			return;
		
		const action = createDeleteAction(prop);
		model.edits.push(action);
		if (parent && parent.first == null)
			parent.owner.isExpanded = false;

		const p  = (next ?? previous);
		selectNext && p && model.setSelected(p, false, true);
	}

	export function deleteProps(model: ViewerModel, props: Iterable<json.JProperty>) {
		model.edits.push(...Linq(props).select(createDeleteAction));
	}

	export function renameProperty(model: ViewerModel, obj: json.JObject, oldName: string, newName: string) {
		modifyStructure(model, obj, null, newName, obj => obj.rename(oldName, newName), obj => obj.rename(newName, oldName));
	}

	export function sortObject(model: ViewerModel, obj: json.JObject, desc?: boolean) {
		const old = [...obj];
		model.edits.push({
			commit() {
				obj.sort(desc);
			},
			undo() {
				obj.reset(old);
			}
		});
	}

	export function addToObject(model: ViewerModel, obj: json.JObject, mode: json.AddType, key: string, sibling?: json.JProperty<string>, insertBefore = false) {
		const prop = new json.JProperty(key, mode);
		let commit: (obj: json.JObject) => void;

		if (!sibling) {
			commit = obj => obj.setProperty(prop);
		} else if (insertBefore) {
			commit = obj => obj.insertBefore(prop, sibling);
		} else {
			commit = obj => obj.insertAfter(prop, sibling);
		}

		modifyStructure(model, obj, prop, key, commit, () => prop.remove());
	}

	export async function addToArray(model: ViewerModel, arr: json.JArray, mode: json.AddType, index?: number) {
		const prop = new json.JProperty(index ?? arr.count, mode);
		model.edits.push({
			commit() {
				arr.insertProperty(prop);
				arr.owner.isExpanded = true;
				model.selected.reset(prop);
			},
			undo() {
				prop.remove();
			},
		});
	}

	function modifyStructure(model: ViewerModel, obj: json.JObject, prop: null | json.JProperty, key: string, commit: (obj: json.JObject) => void, undo: (obj: json.JObject) => void) {
		let existing: undefined | json.JProperty<string>;
		let existingSibling: undefined | null | json.JProperty<string>;
		model.edits.push({
			commit() {
				existing = obj.getProperty(key);
				existingSibling = existing?.next;
				commit(obj);
				if (prop) {
					model.selected.reset(prop);
				}
			},
			undo() {
				undo(obj);
				if (existing) {
					if (existingSibling) {
						obj.insertBefore(existing, existingSibling);
					} else {
						obj.setProperty(existing);
					}
				}
			}
		})
	}
}

export default edits;