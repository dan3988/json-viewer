import json from "../src/json.js";
import { conversionTestValue } from "./json-shared.js";

describe("JValue", () => {
	describe("string value", () => {
		const prop = json("text");
		conversionTestValue(prop, "string", "text");
	});

	describe("number value", () => {
		const prop = json(5);
		conversionTestValue(prop, "number", 5);
	});
		
	describe("boolean value", () => {
		const prop = json(true);
		conversionTestValue(prop, "boolean", true);
	});
	
	describe("null value", () => {
		const prop = json(null);
		conversionTestValue(prop, "null", null);
	});
});