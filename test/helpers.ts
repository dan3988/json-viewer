import json from "../src/json.js";

export namespace helpers {
	export namespace object {
		export function add(self: json.JObject, key: string, value: any) {
			if (value === null || typeof value !== "object") {
				return addValue(self, key, value);
			} else if (Array.isArray(value)) {
				return addArray(self, key, value);
			} else {
				return addObject(self, key, value);
			}
		}

		export function addValue(self: json.JObject, key: string, value: json.JValueType) {
			const v = self.add(key, "value");
			v.value.value = value;
			return v;
		}

		export function addArray(self: json.JObject, key: string, values: Iterable<any>) {
			const v = self.add(key, "array");
			for (const value of values)
				array.add(v.value, value);

			return v;
		}

		export function addObject(self: json.JObject, key: string, values: object) {
			const v = self.add(key, "object");
			for (const [key, value] of Object.entries(values))
				add(v.value, key, value);

			return v;
		}
	}

	export namespace array {
		export function add(self: json.JArray, value: any) {
			if (value === null || typeof value !== "object") {
				return addValue(self, value);
			} else if (Array.isArray(value)) {
				return addArray(self, value);
			} else {
				return addObject(self, value);
			}
		}

		export function addValue(self: json.JArray, value: json.JValueType) {
			const v = self.add("value");
			v.value.value = value;
			return v;
		}

		export function addArray(self: json.JArray, values: Iterable<any>) {
			const v = self.add("array");
			for (const value of values)
				add(v.value, value);

			return v;
		}

		export function addObject(self: json.JArray, values: object) {
			const v = self.add("object");
			for (const [key, value] of Object.entries(values))
				object.add(v.value, key, value);

			return v;
		}
	}
}

export default helpers;