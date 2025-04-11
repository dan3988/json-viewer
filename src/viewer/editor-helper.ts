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
					value.addProperty(prop);

				value.owner.isExpanded = true;
			}
		})
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
				undo = () => obj.first === null ? obj.addProperty(p) : obj.insertBefore(p, obj.first);
			} else {
				const prev = p.previous;
				undo = () => obj.insertAfter(p, prev);
			}
		} else {
			undo = () => (parent as json.JContainer).addProperty(prop);
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

	export function renameProperty(model: ViewerModel, obj: json.JObject, oldName: string, name: string) {
		const prop = obj.getProperty(oldName);
		if (!prop)
			throw new TypeError(`Property "${oldName}" not found.`);
		
		const existing = obj.getProperty(name);
		const existingSibling = existing?.next;

		model.edits.push({
			commit() {
				obj.rename(oldName, name);
			},
			undo() {
				obj.rename(name, oldName);
				if (existing) {
					if (existingSibling) {
						obj.insertBefore(existing, existingSibling);
					} else {
						obj.addProperty(existing);
					}
				}
			}
		});
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

	export function addToObject(model: ViewerModel, obj: json.JObject, mode: json.AddType, name: string, sibling?: json.JProperty<string>, insertBefore = false) {
		const prop = new json.JProperty(name, mode);
		const existing = obj.getProperty(name);
		const existingSibling = existing?.next;

		let commit: VoidFunction;

		if (!sibling) {
			commit = function() {
				obj.addProperty(prop);
			}
		} else if (insertBefore) {
			commit = function() {
				obj.insertBefore(prop, sibling);
			}
		} else {
			commit = function() {
				obj.insertAfter(prop, sibling);
			}
		}

		model.edits.push({
			commit,
			undo() {
				prop.remove();
				if (existing) {
					if (existingSibling) {
						obj.insertBefore(existing, existingSibling);
					} else {
						obj.addProperty(existing);
					}
				}
			}
		});
	}

	export async function addToArray(model: ViewerModel, arr: json.JArray, mode: json.AddType, index?: number) {
		const prop = new json.JProperty(index ?? arr.count, mode);
		model.edits.push({
			commit() {
				arr.addProperty(prop);
				arr.owner.isExpanded = true;
			},
			undo() {
				prop.remove();
			},
		});
	}
}

export default edits;