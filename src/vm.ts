/// <reference path="../node_modules/jsonpath-plus/src/jsonpath.d.ts"/>
import * as es from "espree";
import type * as estree from "estree";

export interface JPathExpression extends Script {
	readonly expression: string;
	readonly usesPath: boolean;
}

const identifier = "_$_";

/**
 * Override for the default jsonpath-plus script class, which uses eval(), as it is forbidden in extensions using manifest V3.
 */
export class Script {
	/**
	 * Replaces all '@' identifiers, since they will result in an illegal syntax error, then searches all literal expressions and replaces the replacement identifier with '@' to match the original script
	 */
	static readonly JPath = class JPathExpression extends Script {
		static #fixJPath(list: InstructionList, args: [usesPath: boolean]) {
			for (let i = 0; i < list.count; i++) {
				let [code, arg] = list.get(i)!;
				switch (code) {
					case InstructionCode.Literal:
						if (typeof arg === "string") {
							if (arg.includes(identifier)) {
								arg = arg.replace(identifier, "@");
								list.setArg(i, arg);
							}
						}

						break;
					case InstructionCode.Identifier:
						if (typeof arg === "string" && arg.includes(identifier)) {
							arg = arg.replace(identifier, "@");
							args[0] ||= arg === "@path";
							list.setArg(i, arg);
						}
						break;
					case InstructionCode.LogicalAnd:
					case InstructionCode.LogicalOr:
					case InstructionCode.LogicalCoalesce:
						this.#fixJPath(arg, args);
						break;
				}
			}
		}

		readonly expression: string;
		readonly usesPath: boolean;

		constructor(script: string) {
			let text = script.replaceAll("@", identifier);
			super(text);

			const args: [boolean] = [false];
			JPathExpression.#fixJPath(this.#instructions, args);
			this.expression = script;
			this.usesPath = args[0];
		}

		toString() {
			return this.expression;
		}
	}

	static jpath(script: string): JPathExpression {
		return new Script.JPath(script);
	}

	readonly #script: string;
	readonly #instructions: InstructionList;

	constructor(script: string) {
		this.#script = script;
		this.#instructions = compile(script);
	}

	runInNewContext(context: any) {
		const stack = new EvaluatorStack(context);
		return this.#instructions.execute(stack);
	}

	toString() {
		return this.#script;
	}
}

export default Script;

class FunctionDefinition {
	readonly args: FunctionParameter[];
	readonly body: InstructionList;

	constructor(args: FunctionParameter[], body: InstructionList) {
		this.args = args;
		this.body = body;
	}

	build(baseScope: any) {
		const { args, body } = this;
		return function() {
			const context = Object.create(null);
			Object.setPrototypeOf(context, baseScope);
			context.arguments = arguments;
			for (let i = 0; i < args.length; i++)
				args[i].getValues(context, arguments, i);

			const stack = new EvaluatorStack(context);
			return body.execute(stack)
		}
	}
}

interface ParameterPatternMap {
	Identifier: estree.Identifier;
	ObjectPattern: estree.ObjectPattern;
	ArrayPattern: estree.ArrayPattern;
	AssignmentPattern: estree.AssignmentPattern;
	RestElement: estree.RestElement;
	MemberExpression: estree.MemberExpression;
}

//type ParameterLookup = Record<string, (token: estree.BasePattern) => FunctionParameter>;
type ParameterObj = { [P in keyof ParameterPatternMap]: (token: ParameterPatternMap[P]) => FunctionParameter };
type LiteralValue = estree.Literal["value"];

function notNull<T>(v: T): v is Exclude<T, null | undefined> {
	return v != null;
}

//type FunctionParameterResolvers = { [P in estree.Pattern["type"] }

abstract class FunctionParameter {
	static readonly #Identifier = class IdentifierParameter extends FunctionParameter {
		constructor(readonly name: string) {
			super();
		}

		debugInfo() {
			return {
				type: "Identifier",
				name: this.name
			}
		}

		getValues(scope: Record<string, any>, args: ArrayLike<any>, index: number) {
			scope[this.name] = args[index];
		}
	}

	static readonly #Rest = class RestParameter extends FunctionParameter {
		constructor(readonly argument: FunctionParameter) {
			super();
		}

		debugInfo() {
			return {
				type: "Rest",
				argument: this.argument.debugInfo()
			};
		}

		getValues(scope: Record<string, any>, args: ArrayLike<any>, index: number) {
			const remaining = Math.max(0, args.length - index);
			const value = Array(remaining);
			for (var i = 0; i < value.length; i++)
				value[i] = args[i + index];

			this.argument.getValues(scope, [value], 0);
		}
	}

	static readonly #Array = class ArrayParameter extends FunctionParameter {
		constructor(readonly elements: (FunctionParameter | null)[]) {
			super();
		}

		debugInfo() {
			return {
				type: "Array",
				elements: Array.from(this.elements, v => v && v.debugInfo())
			};
		}

		getValues(scope: Record<string, any>, args: ArrayLike<any>, index: number) {
			const array = args[index];
			const fn = array[Symbol.iterator];
			if (typeof fn !== "function")
				throw new TypeError(typeof array + " is not iterable.");

			const { elements } = this;
			const iter: Iterator<any> = fn.call(array);
			const values = Array(elements.length);
			for (let i = 0; i < values.length; i++) {
				const { value, done } = iter.next();
				if (done)
					break;
				
				values[i] = value;
			}

			for (let i = 0; i < elements.length; i++) {
				const element = elements[i];
				if (element == null) {
					values[i] = undefined;
				} else {
					element.getValues(scope, values, i);
				}
			}
		}
	}

	static readonly #Object = class ObjectParameter extends FunctionParameter {
		constructor(readonly properties: [key: string | InstructionList, value: FunctionParameter][]) {
			super();
		}

		debugInfo() {
			return {
				type: "Object",
				properties: this.properties.map(([k, v]) => ({ key: typeof k === "string" ? k : k.debugInfo(), value: v.debugInfo() }))
			};
		}

		getValues(scope: Record<string, any>, args: ArrayLike<any>, index: number) {
			const obj = args[index];
			for (const [key, value] of this.properties) {
				let resolvedKey: PropertyKey;
				if (typeof key === "string") {
					resolvedKey = key;
				} else {
					const stack = new EvaluatorStack(scope);
					resolvedKey = key.execute(stack);
				}

				const v = obj[resolvedKey];
				value.getValues(scope, [v], index);
			}
		}
	}

	static readonly #Assignment = class AssignmentParameter extends FunctionParameter {
		constructor(readonly left: FunctionParameter, readonly def: LiteralValue | InstructionList) {
			super();
		}

		#resolveDefault(scope: any): any {
			let { def } = this;
			if (def instanceof InstructionList) {
				const stack = new EvaluatorStack(scope);
				def = def.execute(stack);
			}

			return def;
		}

		debugInfo() {
			return {
				type: "Assignment",
				left: this.left.debugInfo(),
				def: this.def instanceof InstructionList ? this.def.debugInfo() : this.def
			}
		}

		getValues(scope: Record<string, any>, args: ArrayLike<any>, index: number) {
			let arg = args[index];
			if (arg === undefined)
				arg = this.#resolveDefault(scope);

			this.left.getValues(scope, [arg], 0);
		}
	}

	static readonly #lookup: ParameterObj = {
		Identifier(token) {
			return new FunctionParameter.#Identifier(token.name);
		},
		RestElement(token) {
			const argument = FunctionParameter.create(token.argument);
			return new FunctionParameter.#Rest(argument);
		},
		ArrayPattern(token) {
			const elements = token.elements.map(v => v && FunctionParameter.create(v));
			return new FunctionParameter.#Array(elements);
		},
		ObjectPattern(token) {
			const props: [key: string | InstructionList, value: FunctionParameter][] = [];
			for (const prop of token.properties) {
				if (prop.type !== "Property")
					throw new TypeError("Unsupported object pattern property type: " + prop.type);

				let key: string | InstructionList;

				if (prop.computed) {
					key = new InstructionList();
					build(key, prop.key);
				} else {
					key = (prop.key as estree.Identifier).name;
				}

				let value = FunctionParameter.create(prop.value);
				props.push([key, value]);
			}

			return new FunctionParameter.#Object(props)
		},
		AssignmentPattern({ left, right }) {
			let param = FunctionParameter.create(left);
			let value: LiteralValue | InstructionList;

			if (right.type === "Literal") {
				value = right.value;
			} else {
				value = new InstructionList();
				build(value, right);
			}

			return new FunctionParameter.#Assignment(param, value);
		},
		MemberExpression: undefined!
	}

	static create(token: estree.Pattern) {
		const fn = FunctionParameter.#lookup[token.type];
		if (fn === undefined)
			throw new TypeError("Unsupported parameter pattern: " + token.type);
		
		return fn(token as any);
	}

	abstract getValues(scope: Record<string, any>, args: ArrayLike<any>, index: number): void;
	abstract debugInfo(): { type: string };
}

class InstructionList {
	readonly #values: any[];
	#count: number;

	get count() {
		return this.#count;
	}

	constructor() {
		this.#values = [];
		this.#count = 0;
	}

	execute(stack: EvaluatorStack) {
		const v = this.#values;
		for (let i = 0; i < v.length;) {
			const [code, arg]: Instruction = [v[i++], v[i++]]
			const handler = instructionHandlers[code]!;
			handler(stack, arg);
		}
	
		const result = stack.pop();
		return result;
	}

	get(index: number): Instruction | undefined {
		const v = this.#values;
		const i = index * 2;
		return i < v.length ? [v[i], v[i + 1]] : undefined;
	}

	setArg(index: number, arg: any) {
		this.#values[(index * 2) + 1] = arg;
	}

	push<C extends ArglessInstruction>(code: C, arg?: InstructionArg[C]): void
	push<C extends InstructionCode>(code: C, arg: InstructionArg[C]): void
	push(code: InstructionCode, arg?: any) {
		this.#values.push(code, arg);
		this.#count++;
	}

	debug() {
		console.debug(this.debugInfo());
	}
	
	debugInfo() {
		const v = this.#values;
		const values: any[] = [];

		for (let i = 0; i < v.length;) {
			let [code, arg]: Instruction = [v[i++], v[i++]];
			if (arg instanceof InstructionList)
				arg = arg.debugInfo();
			else if (arg instanceof FunctionDefinition) {
				arg = {
					args: arg.args.map(v => v.debugInfo()),
					body: arg.body.debugInfo()
				}
			}

			values.push({ arg, code: InstructionCode[code] });
		}

		return values;
	}
}

type InstructionHandler<A = any> = (stack: EvaluatorStack, arg: A) => void;
type Instruction = [code: InstructionCode, arg: any];

enum InstructionCode {
	Nil = 0,
	Dup,
	Literal,
	Identifier,
	Member,
	OptionalMember,
	Container,
	ArraySpread,
	Array,
	ObjectSpread,
	Object,
	Call,
	OptionalCall,
	Unary,
	Binary,
	LogicalAnd,
	LogicalOr,
	LogicalCoalesce,
	Conditional,
	Function
}

interface InstructionArg {
	[InstructionCode.Nil]: never;
	[InstructionCode.Dup]: number;
	[InstructionCode.Literal]: number | string | boolean | bigint | RegExp | null | undefined;
	[InstructionCode.Identifier]: string;
	[InstructionCode.Member]: string | undefined;
	[InstructionCode.OptionalMember]: string | undefined;
	[InstructionCode.Container]: undefined;
	[InstructionCode.ArraySpread]: undefined;
	[InstructionCode.Array]: undefined;
	[InstructionCode.ObjectSpread]: undefined;
	[InstructionCode.Object]: undefined;
	[InstructionCode.Call]: boolean;
	[InstructionCode.OptionalCall]: boolean;
	[InstructionCode.Unary]: estree.UnaryOperator;
	[InstructionCode.Binary]: estree.BinaryOperator;
	[InstructionCode.LogicalAnd]: InstructionList;
	[InstructionCode.LogicalOr]: InstructionList;
	[InstructionCode.LogicalCoalesce]: InstructionList;
	[InstructionCode.Conditional]: [x: InstructionList, y: InstructionList]
	[InstructionCode.Function]: FunctionDefinition
}

type ArglessInstruction = keyof { [K in keyof InstructionArg as undefined extends InstructionArg[K] ? K : never]: any };

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

function execMember(stack: EvaluatorStack, arg: undefined | string, optional: boolean) {
	const key = arg ?? stack.pop();
	const obj = stack.pop();
	if (obj != null) {
		stack.push(obj[key]);
	} else if (optional) {
		stack.push(undefined);
	} else {
		throw new TypeError("Attempted to access property " + JSON.stringify(key) + " on " + obj);
	}
}

function execCall(stack: EvaluatorStack, arg: any, optional: boolean) {
	let args = stack.endContainer();
	let fn = stack.pop();
	let member: any = undefined;
	if (arg)
		member = stack.pop();

	if (fn != null) {
		const result = Function.prototype.apply.call(fn, member, args);
		stack.push(result);
	} else if (optional) {
		stack.push(undefined);
	} else {
		throw new TypeError("Attempted to invoke " + typeof fn);
	}
}

type InstructionHandlers = ArrayLike<undefined | InstructionHandler> & { [K in keyof InstructionArg]: InstructionArg[K] extends never ? undefined : InstructionHandler<InstructionArg[K]> }

const instructionHandlers: (undefined | InstructionHandler)[] = [
	// InstructionCode.Nil
	undefined,
	// InstructionCode.Dup
	(stack, arg) => stack.dupe(arg),
	// InstructionCode.Literal
	(stack, arg) => stack.push(arg),
	// InstructionCode.Identifier
	(stack, arg) => {
		if (!(arg in stack.context))
			throw new ReferenceError(`${arg} is not defined.`);
	
		stack.push(stack.context[arg])
	},
	// InstructionCode.Member
	(stack, arg) => execMember(stack, arg, false),
	// InstructionCode.OptionalMember
	(stack, arg) => execMember(stack, arg, true),
	// InstructionCode.Container
	(stack) => stack.startContainer(),
	// InstructionCode.ArraySpread
	(stack) => {
		const arr = stack.pop();
		for (let value of arr)
			stack.push(value);
	},
	// InstructionCode.Array
	(stack) => {
		const arr = stack.endContainer();
		stack.push(arr);
	},
	// InstructionCode.ObjectSpread
	(stack) => {
		const obj = stack.pop();
		for (let key in obj)
			stack.push(key, obj[key]);
	},
	// InstructionCode.Object
	(stack) => {
		const res: any = {};
		const props = stack.endContainer();
		for (let i = 0; i < props.length; ) {
			const key = props[i++];
			const value = props[i++];
			res[key] = value;
		}
	
		stack.push(res);
	},
	// InstructionCode.Call
	(stack, arg) => execCall(stack, arg, false),
	// InstructionCode.OptionalCall
	(stack, arg) => execCall(stack, arg, true),
	// InstructionCode.Unary
	(stack, arg) => {
		const handler = unary[arg]!;
		const argument = stack.pop();
		const result = handler(argument);
		stack.push(result);
	},
	// InstructionCode.Binary
	(stack, arg) => {
		const handler = binary[arg]!;
		const right = stack.pop();
		const left = stack.pop();
		const result = handler(left, right);
		stack.push(result);
	},
	// InstructionCode.LogicalAnd
	(stack, arg) => {
		const first = stack.pop();
		if (!first) {
			stack.push(first);
		} else {
			const result = arg.execute(stack);
			stack.push(result);
		}
	},
	// InstructionCode.LogicalOr
	(stack, arg) => {
		const first = stack.pop();
		if (first) {
			stack.push(first);
		} else {
			const result = arg.execute(stack);
			stack.push(result);
		}
	},
	// InstructionCode.LogicalCoalesce
	(stack, arg) => {
		const first = stack.pop();
		if (first != null) {
			stack.push(first);
		} else {
			const result = arg.execute(stack);
			stack.push(result);
		}
	},
	// InstructionCode.Conditional,
	(stack, [x, y]) => {
		const condition = stack.pop();
		const result = (condition ? x : y).execute(stack);
		stack.push(result);
	},
	// InstructionCode.Function
	(stack, def) => {
		const fn = def.build(stack.context);
		stack.push(fn);
	}
] satisfies InstructionHandlers;

function test(expr: string) {
	const compiled = compile(expr);
	const stack = new EvaluatorStack(globalThis);
	const value = compiled.execute(stack);
	return value;
}

function compile(scriptText: string): InstructionList {
	const script = es.parse(scriptText, { ecmaVersion: 13 });
	const instructions = new InstructionList();
	const body = script.body;
	if (body.length !== 1)
		throw new Error("JSON path expression must have one statement.");

	if (body[0].type !== "ExpressionStatement")
		throw new Error("Invalid JSON path expression.");

	build(instructions, body[0].expression);
	return instructions;
}

type Handler<N extends estree.BaseNode = estree.BaseExpression> = (builder: InstructionList, token: N) => void;
type HandlerLookup = { [P in keyof estree.ExpressionMap]?: Handler<estree.ExpressionMap[P]> }

type UnaryFn = Fn<[v: any]>;
type BinaryFn = Fn<[x: any, y: any]>;

type UnaryLookup = Record<string, undefined | UnaryFn>;
type UnaryObj = { [P in estree.UnaryOperator]?: UnaryFn };
type BinaryLookup = Record<string, undefined | BinaryFn>;
type BinaryObj = { [P in estree.BinaryOperator]: BinaryFn };
type LogicalLookup = Record<string, undefined | InstructionCode>;
type LogicalObj = { [P in estree.LogicalOperator]: InstructionCode };

const unary: UnaryLookup = {
	"!":		v => !v,
	"+":		v => +v,
	"-":		v => -v,
	"~":		v => ~v,
	"void":		<any>Function.prototype,
	"typeof":	v => typeof v
} satisfies UnaryObj

const logical: LogicalLookup = {
	"&&": InstructionCode.LogicalAnd,
	"||": InstructionCode.LogicalOr,
	"??": InstructionCode.LogicalCoalesce
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
	"in":			(x, y) => x in y,
	"instanceof":	(x, y) => x instanceof y
} satisfies BinaryObj

const build: Handler = (b, token) => {
	const handler = (handlers as any)[token.type];
	if (handler == null)
		throw new TypeError("Cannot evaluate token of type \"" + token.type + "\".");
	
	return handler(b, token);
}

const handlers = {
	CallExpression(b, token) {
		let member = false;
		if (token.callee.type === "MemberExpression") {
			member = true;
			build(b, token.callee.object);
			b.push(InstructionCode.Dup, 1);

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

		const code = (token as any).optional ? InstructionCode.OptionalCall : InstructionCode.Call;
		b.push(code, member);
	},
	MemberExpression(b, token) {
		build(b, token.object);
		const code = token.optional ? InstructionCode.OptionalMember : InstructionCode.Member;
		if (token.computed) {
			build(b, token.property);
			b.push(code);
		} else if (token.property.type === "Identifier") {
			b.push(code, token.property.name);
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
		if (!(token.operator in unary))
			throw new TypeError("Unsupported unary operator: " + token.operator);

		build(b, token.argument);
		b.push(InstructionCode.Unary, token.operator);
	},
	BinaryExpression(b, token) {
		if (!(token.operator in binary))
			throw new TypeError("Unsupported binary operator: " + token.operator);

		build(b, token.left);
		build(b, token.right);
		b.push(InstructionCode.Binary, token.operator);
	},
	LogicalExpression(b, token) {
		const code = logical[token.operator];
		if (code == null)
			throw new TypeError("Unsupported logical operator: " + token.operator);
		
		const block = new InstructionList();
		build(b, token.left);
		build(block, token.right);
		b.push(code, block);
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
	},
	ConditionalExpression(b, token) {
		const x = new InstructionList();
		const y = new InstructionList();
		build(x, token.consequent);
		build(y, token.alternate);
		build(b, token.test);
		b.push(InstructionCode.Conditional, [x, y]);
	},
	ChainExpression(b, token) {
		build(b, token.expression);
	},
	ArrowFunctionExpression(b, { expression, async, generator, params, body }) {
		if (!expression || async || generator)
			throw new TypeError("Cannot use complex arrow functions.");

		const instructions = new InstructionList();
		const args = Array.from(params, FunctionParameter.create);

		build(instructions, body);
		b.push(InstructionCode.Function, new FunctionDefinition(args, instructions))
	}
} satisfies HandlerLookup;

for (let i = 0; i < instructionHandlers.length; i++) {
	const handler = instructionHandlers[i];
	if (handler != null)
		Object.defineProperty(handler, "name", { configurable: true, value: InstructionCode[i] });
}

// const fn = test("(a = 5) => console.log(a)");
// fn("azb");
// fn();