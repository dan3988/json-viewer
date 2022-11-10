/// <amd-module name="vm"/>
/// <reference path="../../node_modules/jsonpath-plus/src/jsonpath.d.ts"/>
import * as es from "esprima";
import type * as estree from "estree";

/**
 * Override for the default jsonpath-plus script class, which uses eval(), as it is forbidden in extensions using manifest V3.
 */
export class Script {
	readonly #script: string;
	readonly #instructions: InstructionList;

	constructor(script: string) {
		this.#script = script;
		this.#instructions = compile(script);
	}

	runInNewContext(context: any) {
		return this.#instructions.execute(context);
	}
}

export default Script;

class InstructionList {
	readonly #values: any[];
	#length: number;

	get length() {
		return this.#length;
	}

	constructor() {
		this.#values = [];
		this.#length = 0;
	}

	execute(context: any) {
		const v = this.#values;
		const stack = new EvaluatorStack(context);
		for (let i = 0; i < v.length;) {
			const [code, arg]: Instruction = [v[i++], v[i++]]
			const handler = instructionHandlers[code];
			handler(stack, arg);
		}
	
		const result = stack.pop();
		return result;
	}

	push(code: InstructionCode, arg?: any) {
		this.#values.push(code, arg);
		this.#length++;
	}

	debug() {
		console.debug(this.debugInfo());
	}
	
	debugInfo() {
		const v = this.#values;
		const values: any[] = [];

		for (let i = 0; i < v.length;) {
			const [code, arg]: Instruction = [v[i++], v[i++]]
			values.push({ arg, code: InstructionCode[code] });
		}

		return values;
	}
}

type InstructionHandler = (stack: EvaluatorStack, arg: any) => void;
type Instruction = [code: InstructionCode, arg: any];

enum InstructionCode {
	Nil = 0,
	Dup,
	Literal,
	Identifier,
	Member,
	Container,
	ArraySpread,
	Array,
	ObjectSpread,
	Object,
	Call,
	Unary,
	Logical,
	Binary
}

class EvaluatorStack {
	readonly context: any;
	readonly #stacks: any[][];
	#stack: any[];

	constructor(context: any) {
		const stack: any[] = [];
		this.context = context;
		this.#stack = stack;
		this.#stacks = [stack];
	}

	startContainer() {
		const arr: any[] = [];
		this.#stacks.unshift(arr)
		this.#stack = arr;
	}

	endContainer(): any[] {
		const arr = this.#stacks.shift();
		this.#stack = this.#stacks[0];
		return arr!;
	}

	dupe(count: number) {
		const value = this.#stack[0];
		for (let i = 0; i < count; i++)
			this.#stack.unshift(value);
	}

	push(...values: any[]) {
		Array.prototype.push.apply(this.#stack, values);
	}

	pop(): any {
		return this.#stack.pop();
	}
}

const instructionHandlers: InstructionHandler[] = [];

instructionHandlers[InstructionCode.Dup] = (stack, arg) => {
	stack.dupe(arg);
}

instructionHandlers[InstructionCode.Literal] = (stack, arg) => stack.push(arg);
instructionHandlers[InstructionCode.Identifier] = (stack, arg) => {
	if (!(arg in stack.context))
		throw new ReferenceError(`${arg} is not defined.`);

	stack.push(stack.context[arg])
}

instructionHandlers[InstructionCode.Member] = (stack, arg) => {
	const obj = stack.pop();
	const key = arg ?? stack.pop();
	stack.push(obj[key]);
}

instructionHandlers[InstructionCode.ArraySpread] = (stack) => {
	const arr = stack.pop();
	for (let value of arr)
		stack.push(value);
}

instructionHandlers[InstructionCode.Container] = (stack) => {
	stack.startContainer();
}

instructionHandlers[InstructionCode.Array] = (stack) => {
	const arr = stack.endContainer();
	stack.push(arr);
}

instructionHandlers[InstructionCode.ObjectSpread] = (stack) => {
	const obj = stack.pop();
	for (let key in obj)
		stack.push(key, obj[key]);
}

instructionHandlers[InstructionCode.Object] = (stack) => {
	const res: any = {};
	const props = stack.endContainer();
	for (let i = 0; i < props.length; ) {
		const key = props[i++];
		const value = props[i++];
		res[key] = value;
	}

	stack.push(res);
}

instructionHandlers[InstructionCode.Call] = (stack, arg) => {
	let args = stack.endContainer();
	let fn = stack.pop();
	let member: any = undefined;
	if (arg)
		member = stack.pop();

	const result = Function.prototype.apply.call(fn, member, args);
	stack.push(result);
}

instructionHandlers[InstructionCode.Unary] = (stack, arg) => {
	const handler = unary[arg];
	if (handler == null)
		throw new TypeError("Unsupported operator: " + arg);

	const argument = stack.pop();
	const result = handler(argument);
	stack.push(result);
}

instructionHandlers[InstructionCode.Logical] = (stack, arg) => {
	const handler = logical[arg];
	if (handler == null)
		throw new TypeError("Unsupported operator: " + arg);

	const right = stack.pop();
	const left = stack.pop();
	const result = handler(left, right);
	stack.push(result);
}

instructionHandlers[InstructionCode.Binary] = (stack, arg) => {
	const handler = binary[arg];
	if (handler == null)
		throw new TypeError("Unsupported operator: " + arg);

	const right = stack.pop();
	const left = stack.pop();
	const result = handler(left, right);
	stack.push(result);
}

function test(expr: string) {
	const compiled = compile(expr);
	const value = compiled.execute(globalThis);
	return value;
}

function compile(scriptText: string): InstructionList {
	const script = es.parseScript(scriptText, { tolerant: true });
	const instructions = new InstructionList();
	const body = script.body as estree.Directive[];
	if (body.length !== 1)
		throw new Error("JSON path expression must have one statement.");

	build(instructions, body[0].expression);
	return instructions;
}

type Handler<N extends estree.BaseNode = estree.BaseExpression> = (builder: InstructionList, token: N) => void;
type HandlerLookup = { [P in keyof estree.ExpressionMap]?: Handler<estree.ExpressionMap[P]> }

type UnaryFn = Fn<[v: any]>;
type BinaryFn = Fn<[x: any, y: any]>;

type UnaryLookup = Record<string, UnaryFn>;
type UnaryObj = { [P in estree.UnaryOperator]?: UnaryFn };
type BinaryLookup = Record<string, BinaryFn>;
type BinaryObj = { [P in estree.BinaryOperator]: BinaryFn };
type LogicalLookup = Record<string, BinaryFn>;
type LogicalObj = { [P in estree.LogicalOperator]: BinaryFn };

const unary: UnaryLookup = {
	"!":		v => !v,
	"+":		v => +v,
	"-":		v => -v,
	"~":		v => ~v,
	"void":		<any>Function.prototype,
	"typeof":	v => typeof v
} satisfies UnaryObj

const logical: LogicalLookup = {
	"&&": (x, y) => x && y,
	"||": (x, y) => x || y,
	"??": (x, y) => x ?? y
} satisfies LogicalObj

const binary: BinaryLookup = {
	"==":			(x, y) => x == y,
	"===":			(x, y) => x === y,
	"!=":			(x, y) => x != y,
	"!==":			(x, y) => x !== y,
	"<":			(x, y) => x < y,
	"<=":			(x, y) => x <= y,
	">":			(x, y) => x > y,
	">=":			(x, y) => x >= y,
	"+":			(x, y) => x + y,
	"-":			(x, y) => x - y,
	"*":			(x, y) => x * y,
	"/":			(x, y) => x / y,
	"%":			(x, y) => x % y,
	"**":			(x, y) => x ** y,
	"|":			(x, y) => x | y,
	"&":			(x, y) => x & y,
	"^":			(x, y) => x ^ y,
	"<<":			(x, y) => x << y,
	">>":			(x, y) => x >> y,
	">>>":			(x, y) => x >>> y,
	"in":			(x, y) => Array.prototype.includes.call(y, x),
	"instanceof":	(x, y) => x instanceof y
} satisfies BinaryObj

const build: Handler = (b, token) => {
	const handler = (handlers as any)[token.type];
	if (handler == null)
		throw new TypeError("Cannot evaluate token of type \"" + token.type + "\".");
	
	return handler(b, token);
}

const handlers: HandlerLookup = {
	CallExpression(b, token) {
		let member = false;
		if (token.callee.type === "MemberExpression") {
			member = true;
			build(b, token.callee.object);
			b.push(InstructionCode.Dup);

			if (token.callee.property.type === "Identifier") {
				b.push(InstructionCode.Member, token.callee.property.name);
			} else {
				build(b, token.callee.property);
			}
		} else {
			build(b, token.callee);
		}
		
		b.push(InstructionCode.Container);
		for (let arg of token.arguments) {
			if (arg.type === "SpreadElement") {
				build(b, arg.argument);
				b.push(InstructionCode.ArraySpread);
			} else {
				build(b, arg);
			}
		}

		b.push(InstructionCode.Call, member);
	},
	MemberExpression(b, token) {
		build(b, token.object);
		if (token.computed) {
			build(b, token.property);
			b.push(InstructionCode.Member);
		} else if (token.property.type === "Identifier") {
			b.push(InstructionCode.Member, token.property.name);
		} else {
			build(b, token.property);
		}
	},
	Literal(b, token) {
		b.push(InstructionCode.Literal, token.value);
	},
	Identifier(b, token) {
		b.push(InstructionCode.Identifier, token.name);
	},
	UnaryExpression(b, token) {
		build(b, token.argument);
		b.push(InstructionCode.Unary, token.operator);
	},
	BinaryExpression(b, token) {
		build(b, token.left);
		build(b, token.right);
		b.push(InstructionCode.Binary, token.operator);
	},
	LogicalExpression(b, token) {
		build(b, token.left);
		build(b, token.right);
		b.push(InstructionCode.Logical, token.operator);
	},
	ArrayExpression(b, token) {
		b.push(InstructionCode.Container);
		const { elements } = token;
		for (let i = 0; i < elements.length; i++) {
			const e = elements[i]!;
			if (e.type === "SpreadElement") {
				build(b, e.argument);
				b.push(InstructionCode.ArraySpread);
			} else {
				build(b, e);
			}
		}

		b.push(InstructionCode.Array);
	},
	ObjectExpression(b, token) {
		const { properties } = token;
		b.push(InstructionCode.Container);
		for (let i = 0; i < properties.length; i++) {
			const prop = properties[i];
			if (prop.type === "SpreadElement") {
				build(b, prop.argument);
				b.push(InstructionCode.ObjectSpread);
			} else {
				if (!prop.computed && prop.key.type === "Identifier") {
					b.push(InstructionCode.Literal, prop.key.name);
				} else {
					build(b, prop.key);
				}

				build(b, prop.value);
			}
		}

		b.push(InstructionCode.Object);
	}
}

for (let i = 0; i < instructionHandlers.length; i++) {
	const handler = instructionHandlers[i];
	if (handler != null)
		Object.defineProperty(handler, "name", { configurable: true, value: InstructionCode[i] });
}
