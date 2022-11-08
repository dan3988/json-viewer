/// <amd-module name="vm"/>
/// <reference path="../../node_modules/jsonpath-plus/src/jsonpath.d.ts"/>
import * as es from "esprima";
import type * as estree from "estree";

/**
 * Override for the default jsonpath-plus script class, which uses eval(), as it is forbidden in extensions using manifest V3.
 */
export class Script {
	readonly #script: string;
	readonly #instructions: [...InstructionToken[]];

	constructor(script: string) {
		this.#script = script;
		this.#instructions = compile(script);
	}

	runInNewContext(context: any) {
		return execute(this.#instructions, context);
	}
}

export default Script;

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

type InstructionHandler = (stack: EvaluatorStack, arg: any) => void;

const instructionHandlers: InstructionHandler[] = [];

instructionHandlers[Instruction.Dup] = (stack, arg) => {
	stack.dupe(arg);
}

instructionHandlers[Instruction.Literal] = (stack, arg) => stack.push(arg);
instructionHandlers[Instruction.Identifier] = (stack, arg) => {
	if (!(arg in stack.context))
		throw new ReferenceError(`${arg} is not defined.`);

	stack.push(stack.context[arg])
}

instructionHandlers[Instruction.Member] = (stack, arg) => {
	const obj = stack.pop();
	const key = arg ?? stack.pop();
	stack.push(obj[key]);
}

instructionHandlers[Instruction.ArraySpread] = (stack) => {
	const arr = stack.pop();
	for (let value of arr)
		stack.push(value);
}

instructionHandlers[Instruction.Container] = (stack) => {
	stack.startContainer();
}

instructionHandlers[Instruction.Array] = (stack) => {
	const arr = stack.endContainer();
	stack.push(arr);
}

instructionHandlers[Instruction.ObjectSpread] = (stack) => {
	const obj = stack.pop();
	for (let key in obj)
		stack.push(key, obj[key]);
}

instructionHandlers[Instruction.Object] = (stack) => {
	const res: any = {};
	const props = stack.endContainer();
	for (let i = 0; i < props.length; ) {
		const key = props[i++];
		const value = props[i++];
		res[key] = value;
	}

	stack.push(res);
}

instructionHandlers[Instruction.Call] = (stack, arg) => {
	let args = stack.endContainer();
	let fn = stack.pop();
	let member: any = undefined;
	if (arg)
		member = stack.pop();

	const result = Function.prototype.apply.call(fn, member, args);
	stack.push(result);
}

instructionHandlers[Instruction.Unary] = (stack, arg) => {
	const handler = unary[arg];
	if (handler == null)
		throw new TypeError("Unsupported operator: " + arg);

	const argument = stack.pop();
	const result = handler(argument);
	stack.push(result);
}

instructionHandlers[Instruction.Logical] = (stack, arg) => {
	const handler = logical[arg];
	if (handler == null)
		throw new TypeError("Unsupported operator: " + arg);

	const right = stack.pop();
	const left = stack.pop();
	const result = handler(left, right);
	stack.push(result);
}

instructionHandlers[Instruction.Binary] = (stack, arg) => {
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
	const value = execute(compiled, globalThis);
	return value;
}

function compile(scriptText: string): InstructionList {
	const script = es.parseScript(scriptText);
	const instructions: any[] = [];
	build(instructions, (script.body as estree.Directive[])[0].expression);
	return instructions;
}

function execute(instructions: InstructionList, context: any) {
	const stack = new EvaluatorStack(context);
	let inst = instructions.slice(0, 2);
	let i = 2;

	while (inst.length > 0) {
		const [code, arg]: InstructionToken = inst as any;
		const handler = instructionHandlers[code];
		handler(stack, arg);
		inst = instructions.slice(i, i += 2);
	}

	return stack.pop();
}

type Handler<N extends estree.BaseNode = estree.BaseExpression> = (builder: ExpressionBuilder, token: N) => void;
type HandlerLookup = { [P in keyof estree.ExpressionMap]?: Handler<estree.ExpressionMap[P]> }

type UnaryFn = Fn<[v: any]>;
type BinaryFn = Fn<[x: any, y: any]>;

type UnaryLookup = Record<string, UnaryFn>;
type UnaryObj = { [P in estree.UnaryOperator]?: UnaryFn };
type BinaryLookup = Record<string, BinaryFn>;
type BinaryObj = { [P in estree.BinaryOperator]: BinaryFn };
type LogicalLookup = Record<string, BinaryFn>;
type LogicalObj = { [P in estree.LogicalOperator]: BinaryFn };

const enum Instruction {
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

type InstructionToken = [code: Instruction, arg: any];
type InstructionList = InstructionToken[number][];

interface ExpressionBuilder {
	readonly length: number;
	push(...args: InstructionToken): void;
}

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
			b.push(Instruction.Dup, undefined);

			if (token.callee.property.type === "Identifier") {
				b.push(Instruction.Member, token.callee.property.name);
			} else {
				build(b, token.callee.property);
			}
		} else {
			build(b, token.callee);
		}
		
		b.push(Instruction.Container, undefined);
		for (let arg of token.arguments) {
			if (arg.type === "SpreadElement") {
				build(b, arg.argument);
				b.push(Instruction.ArraySpread, undefined);
			} else {
				build(b, arg);
			}
		}

		b.push(Instruction.Call, member);
	},
	MemberExpression(b, token) {
		build(b, token.object);
		if (token.computed) {
			build(b, token.property);
			b.push(Instruction.Member, undefined);
		} else if (token.property.type === "Identifier") {
			b.push(Instruction.Member, token.property.name);
		} else {
			build(b, token.property);
		}
	},
	Literal(b, token) {
		b.push(Instruction.Literal, token.value);
	},
	Identifier(b, token) {
		b.push(Instruction.Identifier, token.name);
	},
	UnaryExpression(b, token) {
		build(b, token.argument);
		b.push(Instruction.Unary, token.operator);
	},
	BinaryExpression(b, token) {
		build(b, token.left);
		build(b, token.right);
		b.push(Instruction.Binary, token.operator);
	},
	LogicalExpression(b, token) {
		build(b, token.left);
		build(b, token.right);
		b.push(Instruction.Logical, token.operator);
	},
	ArrayExpression(b, token) {
		b.push(Instruction.Container, undefined);
		const { elements } = token;
		for (let i = 0; i < elements.length; i++) {
			const e = elements[i]!;
			if (e.type === "SpreadElement") {
				build(b, e.argument);
				b.push(Instruction.ArraySpread, undefined);
			} else {
				build(b, e);
			}
		}

		b.push(Instruction.Array, undefined);
	},
	ObjectExpression(b, token) {
		const { properties } = token;
		b.push(Instruction.Container, undefined);
		for (let i = 0; i < properties.length; i++) {
			const prop = properties[i];
			if (prop.type === "SpreadElement") {
				build(b, prop.argument);
				b.push(Instruction.ObjectSpread, undefined);
			} else {
				if (!prop.computed && prop.key.type === "Identifier") {
					b.push(Instruction.Literal, prop.key.name);
				} else {
					build(b, prop.key);
				}

				build(b, prop.value);
			}
		}

		b.push(Instruction.Object, undefined);
	}
}

Reflect.set(window, "a", "a-property-key");
const a = test("({ a: 5, ['b']: 6, [a]: 'a-property-value' })");
Reflect.set(window, "a", a);
const b = test("Object.keys(a)");
