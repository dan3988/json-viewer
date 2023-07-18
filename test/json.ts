import json from "../src/json.js";

describe("JSON", () => {
	it("Should return a JsonValue instance when calling with a string", () => {
		const prop = json("text");
		const { value } = prop;
		expect(value).instanceOf(json.JsonValue);
		expect(value.type).eq("value");
		expect(value.subtype).eq("string");
		expect(value.is("value")).to.be.true;
		expect((value as json.JsonValue).value).eq("text");
		expect(value.proxy).eq("text");
		expect(value.toJSON()).eq("text");
	});
	
	it("Should return a JsonValue instance when calling with a number", () => {
		const prop = json(5);
		const { value } = prop;
		expect(value).instanceOf(json.JsonValue);
		expect(value.type).eq("value");
		expect(value.subtype).eq("number");
		expect(value.is("value")).to.be.true;
		expect((value as json.JsonValue).value).eq(5);
		expect(value.proxy).eq(5);
		expect(value.toJSON()).eq(5);
	});
	
	it("Should return a JsonValue instance when calling with a boolean", () => {
		const prop = json(true);
		const { value } = prop;
		expect(value).instanceOf(json.JsonValue);
		expect(value.type).eq("value");
		expect(value.subtype).eq("boolean");
		expect(value.is("value")).to.be.true;
		expect((value as json.JsonValue).value).eq(true);
		expect(value.proxy).eq(true);
		expect(value.toJSON()).eq(true);
	});
	
	it("Should return a JsonValue instance when calling with a null value", () => {
		const prop = json(null);
		const { value } = prop;
		expect(value).instanceOf(json.JsonValue);
		expect(value.type).eq("value");
		expect(value.subtype).eq("null");
		expect(value.is("value")).to.be.true;
		expect((value as json.JsonValue).value).eq(null);
		expect(value.proxy).eq(null);
		expect(value.toJSON()).eq(null);
	});
})