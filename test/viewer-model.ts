import json from '../src/json.js';
import ViewerModel from '../src/viewer-model.js';

describe('SelectedPropertyList', () => {
	let model: ViewerModel;

	beforeEach(() => {
		const prop = json({
			name: "John",
			age: 30
		});

		model = new ViewerModel(prop)
	});

	it('should have a size of 0 when empty', () => {
		expect(model.selected.size).to.equal(0);
		expect(model.selected.last).to.be.equal(null);
		expect([...model.selected]).to.be.deep.equal([]);
	});

	it('should correctly add and remove items', () => {
		const property = model.root.get("name");

		model.selected.add(property);
		expect(model.selected.size).to.equal(1);
		expect(model.selected.has(property)).to.be.true;
		expect(model.selected.last).to.be.equal(property);
		expect([...model.selected]).to.be.deep.equal([property]);

		model.selected.remove(property);
		expect(model.selected.size).to.equal(0);
		expect(model.selected.has(property)).to.be.false;
		expect(model.selected.last).to.be.equal(null);
		expect([...model.selected]).to.be.deep.equal([]);
	});

	it('should toggle items correctly', () => {
		const property = model.root.get("name");

		model.selected.toggle(property);
		expect(model.selected.size).to.equal(1);
		expect(model.selected.has(property)).to.be.true;
		expect(model.selected.last).to.be.equal(property);
		expect([...model.selected]).to.be.deep.equal([property]);

		model.selected.toggle(property);
		expect(model.selected.size).to.equal(0);
		expect(model.selected.has(property)).to.be.false;
		expect(model.selected.last).to.be.equal(null);
		expect([...model.selected]).to.be.deep.equal([]);
	});

	it("should update the state property", () => {
		const property1 = model.root.get("name");
		const property2 = model.root.get("age");

		let callCount = 0;
		let eventValue;
		
		model.selected.subscribe(v => {
			callCount++;
			eventValue = [...v];
		})

		expect(callCount).to.be.equal(1);
		expect(eventValue).to.be.deep.equal([]);

		model.selected.add(property1);
		expect(callCount).to.be.equal(2);
		expect(eventValue).to.be.deep.equal([property1]);

		model.selected.add(property2);
		expect(callCount).to.be.equal(3);
		expect(eventValue).to.be.deep.equal([property1, property2]);

		model.selected.add(property2);
		expect(callCount).to.be.equal(3);

		model.selected.remove(property1);
		expect(callCount).to.be.equal(4);
		expect(eventValue).to.be.deep.equal([property2]);

		model.selected.remove(property1);
		expect(callCount).to.be.equal(4);

		model.selected.clear();
		expect(callCount).to.be.equal(5);
		expect(eventValue).to.be.deep.equal([]);

	})
});