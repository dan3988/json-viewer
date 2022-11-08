/// <amd-module name="json-path"/>
/// <reference path="../../node_modules/jsonpath-plus/src/jsonpath.d.ts"/>
import * as jp from "jsonpath-plus";
import * as es from "esprima";
import type * as estree from "estree";

/**
 * Override for the default script class, which uses eval(), as it is forbidden in extensions using manifest V3.
 */
jp.JSONPath.prototype.vm.Script = class Script {
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

	push(value: any) {
		this.#stack.push(value);
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

instructionHandlers[Instruction.ArrayMarker] = (stack, arg) => {
	stack.startContainer();
}

instructionHandlers[Instruction.Array] = (stack, arg) => {
	const arr = stack.endContainer();
	stack.push(arr);
}

instructionHandlers[Instruction.Object] = (stack, arg) => {
	const res: any = {};
	for (let i = 0; i < arg; i++) {
		const value = stack.pop();
		const key = stack.pop();
		res[key] = value;
	}

	stack.push(res);
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
	ArrayMarker,
	Array,
	Object,
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
		b.push(Instruction.ArrayMarker, undefined);
		const { elements } = token;
		for (let i = 0; i < elements.length; i++)
			build(b, elements[i]!);

		b.push(Instruction.Array, undefined);
	},
	ObjectExpression(b, token) {
		const { properties } = token;
		for (let i = 0; i < properties.length; i++) {
			const prop = properties[i];
			if (prop.type === "Property") {
				if (prop.computed) {
					build(b, prop.key);
				} else {
					b.push(Instruction.Literal, (prop.key as estree.Identifier).name)
				}

				build(b, prop.value);
			}
		}

		b.push(Instruction.Object, properties.length);
	}
}

export var { JSONPath } = jp;
export default JSONPath;
