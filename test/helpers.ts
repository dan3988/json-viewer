import json from "../src/json.js";

export namespace helpers {
	export namespace object {
		export function add(self: json.Object, key: string, value: any) {
			if (value === null || typeof value !== "object") {
				return addValue(self, key, value);
			} else if (Array.isArray(value)) {
				return addArray(self, key, value);
			} else {
				return addObject(self, key, value);
			}
		}

		export function addValue(self: json.Object, key: string, value: json.ValueType) {
			const node = new json.Value(value);
			self.set(key, node);
			return node;
		}

		export function addArray(self: json.Object, key: string, values?: Iterable<any>) {
			const node = new json.Array(values && [...values]);
			self.set(key, node);
			return node;
		}

		export function addObject(self: json.Object, key: string, values?: object) {
			const node = new json.Object(values);
			self.set(key, node);
			return node;
		}
	}

	export namespace array {
		export function add(self: json.Array, value: any) {
			if (value === null || typeof value !== "object") {
				return addValue(self, value);
			} else if (Array.isArray(value)) {
				return addArray(self, value);
			} else {
				return addObject(self, value);
			}
		}

		export function addValue(self: json.Array, value: json.ValueType) {
			const node = new json.Value(value);
			self.add(node);
			return node;
		}

		export function addArray(self: json.Array, values?: Iterable<any>) {
			const node = new json.Array(values && [...values]);
			self.add(node);
			return node;
		}

		export function addObject(self: json.Array, values?: object) {
			const node = new json.Object(values);
			self.add(node);
			return node;
		}
	}
}

export default helpers;