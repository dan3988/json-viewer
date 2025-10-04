import json from "../src/json.js";
import * as s from "./json-shared.js";
import sample from "../test-data/syntax.json" with { type: "json" };
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
		s.conversionTestObject(prop, og);
		s.testProp(prop, "number", v => s.conversionTestValue(v, "number", 5));
		s.testProp(prop, "string", v => s.conversionTestValue(v, "string", "text"));
		s.testProp(prop, "boolean", v => s.conversionTestValue(v, "boolean", true));
		s.testProp(prop, "null", v => s.conversionTestValue(v, "null", null));
	});
	
	describe("empty object", () => s.conversionTestObject(json({}), {}));

	describe("adding", () => {
		const root = new json.Object();
		const jValue = helpers.object.add(root, "jValue", null);
		const jArray = helpers.object.add(root, "jArray", []);
		const jObject = helpers.object.add(root, "jObject", {});

		s.testLinks(root);
		s.testProp(root, "jValue", v => {
			it("Is the same as the value passed to add()", () => expect(v).eq(jValue));
			s.conversionTestValue(v, 'null', null);
		});

		s.testProp(root, "jArray", v => {
			it("Is the same as the value passed to add()", () => expect(v).eq(jArray));
			s.conversionTestArray(v, []);
		});

		s.testProp(root, "jObject", v => {
			it("Is the same as the value passed to add()", () => expect(v).eq(jObject));
			s.conversionTestObject(v, {});
		});
	});

	describe("insertBefore", () => {
		let obj: json.Object;

		beforeEach(() => {
			const object = { a: 1, b: 2, c: 3 };
			const root = new json.Object(object);
	
			obj = root;
		});

		it("Should insert before the first property", () => {
			const sibling = obj.get("a");
			const node = json("value");

			obj.insertBefore("new", node, sibling);

			s.validateLinks(obj);
			expect(sibling.previous).to.be.eq(node);
			expect(node.next).to.be.eq(sibling);
			expect(obj.first).to.eq(node);
			expect(obj.get("new")).to.be.eq(node);
			expect([...obj.getKeys()]).to.be.deep.eq(["new", "a", "b", "c"]);
		});

		it("Should insert before the second property", () => {
			const sibling = obj.get("b");
			const prop = json("value");

			obj.insertBefore('new', prop, sibling);

			s.validateLinks(obj);
			expect(sibling.previous).to.be.eq(prop);
			expect(prop.next).to.be.eq(sibling);
			expect(obj.get("new")).to.be.eq(prop);
			expect([...obj.getKeys()]).to.be.deep.eq(["a", "new", "b", "c"]);
		});

		it("Should insert before the last property", () => {
			const sibling = obj.get("c");
			const prop = json("value");

			obj.insertBefore("new", prop, sibling);

			s.validateLinks(obj);
			expect(sibling.previous).to.be.eq(prop);
			expect(prop.next).to.be.eq(sibling);
			expect(obj.get("new")).to.be.eq(prop);
			expect([...obj.getKeys()]).to.be.deep.eq(["a", "b", "new", "c"]);
		});
	})

	describe("insertAfter", () => {
		let obj: json.Object;

		beforeEach(() => {
			const object = { a: 1, b: 2, c: 3 };
			const root = new json.Object(object);
	
			obj = root;
		});

		it("Should insert after the first property", () => {
			const sibling = obj.get("a");
			const prop = json("value");

			obj.insertAfter("new", prop, sibling);

			s.validateLinks(obj);
			expect(sibling.next).to.be.eq(prop);
			expect(prop.previous).to.be.eq(sibling);
			expect(obj.get("new")).to.be.eq(prop);
			expect([...obj.getKeys()]).to.be.deep.eq(["a", "new", "b", "c"]);
		});

		it("Should insert after the second property", () => {
			const sibling = obj.get("b");
			const prop = json("value");

			obj.insertAfter("new", prop, sibling);

			s.validateLinks(obj);
			expect(sibling.next).to.be.eq(prop);
			expect(prop.previous).to.be.eq(sibling);
			expect(obj.get("new")).to.be.eq(prop);
			expect([...obj.getKeys()]).to.be.deep.eq(["a", "b", "new", "c"]);
		});

		it("Should insert after the last property", () => {
			const sibling = obj.get("c");
			const prop = json("value");

			obj.insertAfter("new", prop, sibling);

			s.validateLinks(obj);
			expect(sibling.next).to.be.eq(prop);
			expect(prop.previous).to.be.eq(sibling);
			expect(obj.last).to.eq(prop);
			expect(obj.get("new")).to.be.eq(prop);
			expect([...obj.getKeys()]).to.be.deep.eq(["a", "b", "c", "new"]);
		});
	})

	describe("replace", () => {
		const object = { a: 1, b: 2, c: 3 };

		function testReplace(key: string, value: any) {
			describe("Replace property " + JSON.stringify(key), () => {
				const node = new json.Object(object);
				const old = node.get(key);
				const val = json(value);
				node.set(key, val);

				const expected = { ...object };
				expected[key] = value;

				it("has removed the parent of the old property", () => expect(old.parent).to.be.null);
				s.testLinks(node);
				it("returns the updated value when calling toJSON()", () => expect(node.toJSON()).to.be.deep.equal(expected));
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

		function add(obj: json.Object) {
			helpers.object.addValue(obj, "string", "text");
			helpers.object.addValue(obj, "number", 5);
			helpers.object.addValue(obj, "boolean", true);
			helpers.object.addValue(obj, "null", null);
		}

		function create() {
			const prop = json(sample);
			const manual = new json.Object();

			add(manual);
			const nested = helpers.object.addObject(manual, 'object');
			add(nested);
			const arr = helpers.object.addArray(manual, 'array');
			for (let i = 0; i < 10; )
				helpers.array.addValue(arr, ++i);
		
			return [prop, manual] as const;
		}

		it("returns true when calling equal() with the same instance", () => {
			const node = json(sample);
			expect(node.equals(node)).to.be.true;
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
		const node = json(sample);
		const copy = node.clone();

		const x = node.toJSON();
		const y = copy.toJSON();

		it("Copies the object exactly", () => expect(x).to.be.deep.equal(y));
		s.testLinks(copy);
		it("Doesn't break the structure of the original object", () => s.validateLinks(node));
	});
});