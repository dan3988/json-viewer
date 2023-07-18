import json from "../src/json.js";

describe("JSON", () => {
	it("Should return a JsonValue instance when calling with a string", () => {
		const prop = json("text");
		const { value } = prop;
		expect(value).instanceOf(json.JsonValue);
		expect(value.type).eq("value");
		expect(value.subtype).eq("string");
		expect(value.is("value")).to.be.true;
		expect((value as json.JsonValue).value).eq("text")
	});
})