export class Indent {
	get indent() {
		return this.depth % this.limit;
	}

	#next?: Indent;
	get next() {
		return this.#next ??= new Indent(this.limit, this.depth + 1);
	}

	constructor(readonly limit: number, readonly depth: number = 0) {
		console.log(`Indent(${limit}, ${depth})`);
	}
}

export default Indent;