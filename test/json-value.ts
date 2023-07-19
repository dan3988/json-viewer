import json from "../src/json.js";
import { conversionTestValue } from "./json-shared.js";

describe("JValue", () => {
	describe("string value", () => {
		const prop = json("text");
		conversionTestValue(prop.value, "string", "text");
	});

	describe("number value", () => {
		const prop = json(5);
		conversionTestValue(prop.value, "number", 5);
	});
		
	describe("boolean value", () => {
		const prop = json(true);
		conversionTestValue(prop.value, "boolean", true);
	});
	
	describe("null value", () => {
		const prop = json(null);
		conversionTestValue(prop.value, "null", null);
	});
});