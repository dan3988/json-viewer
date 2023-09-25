import json from "../src/json.js";
import * as s from "./json-shared.js";
import sample from "../test-data/syntax.json";
import helpers from "./helpers.js";

describe("JObject", () => {
	describe("simple object", () => {
		const og = {
			number: 5,
			string: "text",
			boolean: true,
			null: null
		};

		const prop = json(og);
		s.conversionTestContainer(prop.value, json.JObject, "object", og);
		s.testProp(prop.value, "number", v => s.conversionTestValue(v, "number", 5));
		s.testProp(prop.value, "string", v => s.conversionTestValue(v, "string", "text"));
		s.testProp(prop.value, "boolean", v => s.conversionTestValue(v, "boolean", true));
		s.testProp(prop.value, "null", v => s.conversionTestValue(v, "null", null));
	});
	
	describe("empty object", () => s.conversionTestContainer(json({}).value, json.JObject, "object", {}));

	describe("adding", () => {
		const root = new json.JObject();
		const jValue = root.add("jValue", "value");
		const jArray = root.add("jArray", "array");
		const jObject = root.add("jObject", "object");

		s.testLinks(root);
		s.testProp(root, "jValue", v => {
			it("Is the same as the value returned by add()", () => expect(v.owner).eq(jValue));
			s.conversionTestCommon(v, json.JValue, "value", "null");
		});

		s.testProp(root, "jArray", v => {
			it("Is the same as the value returned by add()", () => expect(v.owner).eq(jArray));
			s.conversionTestCommon(v, json.JArray, "container", "array");
		});

		s.testProp(root, "jObject", v => {
			it("Is the same as the value returned by add()", () => expect(v.owner).eq(jObject));
			s.conversionTestCommon(v, json.JObject, "container", "object");
		});
	});

	describe("insertBefore", () => {
		let obj: json.JObject;

		beforeEach(() => {
			const object = { a: 1, b: 2, c: 3 };
			const root = json(object);
	
			obj = root.value;
		});

		it("Should insert before the first property", () => {
			const sibling = obj.getProperty("a");
			const prop = json("value", "new");

			obj.insertBefore(prop, sibling);

			s.validateLinks(obj);
			expect(sibling.previous).to.be.eq(prop);
			expect(prop.next).to.be.eq(sibling);
			expect(obj.first).to.eq(prop);
			expect(obj.getProperty("new")).to.be.eq(prop);
			expect([...obj.keys()]).to.be.deep.eq(["new", "a", "b", "c"]);
		});

		it("Should insert before the second property", () => {
			const sibling = obj.getProperty("b");
			const prop = json("value", "new");

			obj.insertBefore(prop, sibling);

			s.validateLinks(obj);
			expect(sibling.previous).to.be.eq(prop);
			expect(prop.next).to.be.eq(sibling);
			expect(obj.getProperty("new")).to.be.eq(prop);
			expect([...obj.keys()]).to.be.deep.eq(["a", "new", "b", "c"]);
		});

		it("Should insert before the last property", () => {
			const sibling = obj.getProperty("c");
			const prop = json("value", "new");

			obj.insertBefore(prop, sibling);

			s.validateLinks(obj);
			expect(sibling.previous).to.be.eq(prop);
			expect(prop.next).to.be.eq(sibling);
			expect(obj.getProperty("new")).to.be.eq(prop);
			expect([...obj.keys()]).to.be.deep.eq(["a", "b", "new", "c"]);
		});
	})

	describe("insertAfter", () => {
		let obj: json.JObject;

		beforeEach(() => {
			const object = { a: 1, b: 2, c: 3 };
			const root = json(object);
	
			obj = root.value;
		});

		it("Should insert after the first property", () => {
			const sibling = obj.getProperty("a");
			const prop = json("value", "new");

			obj.insertAfter(prop, sibling);

			s.validateLinks(obj);
			expect(sibling.next).to.be.eq(prop);
			expect(prop.previous).to.be.eq(sibling);
			expect(obj.getProperty("new")).to.be.eq(prop);
			expect([...obj.keys()]).to.be.deep.eq(["a", "new", "b", "c"]);
		});

		it("Should insert after the second property", () => {
			const sibling = obj.getProperty("b");
			const prop = json("value", "new");

			obj.insertAfter(prop, sibling);

			s.validateLinks(obj);
			expect(sibling.next).to.be.eq(prop);
			expect(prop.previous).to.be.eq(sibling);
			expect(obj.getProperty("new")).to.be.eq(prop);
			expect([...obj.keys()]).to.be.deep.eq(["a", "b", "new", "c"]);
		});

		it("Should insert after the last property", () => {
			const sibling = obj.getProperty("c");
			const prop = json("value", "new");

			obj.insertAfter(prop, sibling);

			s.validateLinks(obj);
			expect(sibling.next).to.be.eq(prop);
			expect(prop.previous).to.be.eq(sibling);
			expect(obj.last).to.eq(prop);
			expect(obj.getProperty("new")).to.be.eq(prop);
			expect([...obj.keys()]).to.be.deep.eq(["a", "b", "c", "new"]);
		});
	})

	describe("replace", () => {
		const object = { a: 1, b: 2, c: 3 };

		function testReplace(key: string, value: any) {
			describe("Replace property " + JSON.stringify(key), () => {
				const { value: tkn } = json(object);
				const old = tkn.getProperty(key);
				const val = tkn.add(key, "value");
				val.value.value = value;

				const expected = { ...object };
				expected[key] = value;

				it("has removed the parent of the old property", () => expect(old.parent).to.be.null);
				s.testLinks(tkn);
				it("returns the updated value when calling toJSON()", () => expect(tkn.toJSON()).to.be.deep.equal(expected));
			});
		}
		
		testReplace("a", "replaced a");
		testReplace("b", "replaced b");
		testReplace("c", "replaced c");
	});

	describe("equal", () => {
		const sample: any = { string: "text", number: 5, boolean: true, null: null };
		sample.object = { ...sample };
		sample.array = Linq.range(1, 10).toArray();

		function add(obj: json.JObject) {
			helpers.object.addValue(obj, "string", "text");
			helpers.object.addValue(obj, "number", 5);
			helpers.object.addValue(obj, "boolean", true);
			helpers.object.addValue(obj, "null", null);
		}

		function create() {
			const prop = json(sample);
			const manual = new json.JObject();

			add(manual);
			const nested = manual.add("object", "object");
			add(nested.value);
			const arr = manual.add("array", "array");
			for (let i = 0; i < 10; )
				helpers.array.addValue(arr.value, ++i);
		
			return [prop.value, manual] as const;
		}

		it("returns true when calling equal() with the same instance", () => {
			const { value } = json(sample);
			expect(value.equals(value)).to.be.true;
		});

		it("returns true when calling equal() with an identical value", () => {
			const [x, y] = create();
			expect(x.equals(y)).to.be.true;
		});

		it("returns false when calling equal() with a non-identical value", () => {
			const [x, y] = create();
			helpers.object.addValue(y, "string", "different text");
			expect(x.equals(y)).to.be.false;
		});
	});

	describe("clone", () => {
		const prop = json(sample);
		const copy = prop.clone();

		const x = prop.value.toJSON();
		const y = copy.value.toJSON();

		it("Copies the object exactly", () => expect(x).to.be.deep.equal(y));
		it("Doesn't break the structure of the original object", () => s.validateLinks(prop.value));
		s.testLinks(copy.value);
	});
});