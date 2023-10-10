import type { EditAction } from "../edit-stack";
import type json from "../json";
import type ViewerModel from "../viewer-model";
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
			if (p.previous !== null) {
				const prev = p.previous;
				undo = () => obj.insertAfter(p, prev);
			} else if (p.next !== null) {
				const next = p.next;
				undo = () => obj.insertBefore(p, next);
			} else {
				undo = () => obj.addProperty(p);
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

	export async function renameProperty(model: ViewerModel, obj: json.JObject, prop: json.JProperty<string>, name: string) {
		const oldName = prop.key;
		model.edits.push({
			commit() {
				obj.rename(oldName, name);
				model.execute("scrollTo", prop);
			},
			undo() {
				obj.rename(name, oldName);
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

	export async function addToObject(model: ViewerModel, obj: json.JObject, mode: keyof json.JContainerAddMap, name: string) {
		model.edits.push({
			commit() {
				const prop = obj.add(name, mode);
				obj.owner.isExpanded = true;
				model.setSelected(prop, false, true);
			},
			undo() {
				const prop = obj.remove(name);
				if (prop?.isSelected)
					model.selected.remove(prop);
			},
		});
	}

	export async function addToArray(model: ViewerModel, arr: json.JArray, mode: keyof json.JContainerAddMap) {
		const index = arr.count;
		model.edits.push({
			commit() {
				const prop = arr.add(mode);
				arr.owner.isExpanded = true;
				model.setSelected(prop, false, true);
			},
			undo() {
				const prop = arr.remove(index);
				if (prop?.isSelected)
					model.selected.remove(prop);
			},
		});
	}
}

export default edits;