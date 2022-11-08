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
	readonly #prog: es.Program;
	readonly #body: estree.Directive;

	constructor(script: string) {
		this.#script = script;
		this.#prog = es.parseScript(script, { tolerant: true });
		this.#body = this.#prog.body[0] as any;
	}

	runInNewContext(context: any) {
		return evaluate(context, this.#body.expression);
	}
}

/**
 * Evaluates a basic javascript expression
 */
function evaluate(context: any, token: estree.BaseNode) {
	const handler = (handlers as any)[token.type];
	if (handler == null)
		throw new TypeError("Cannot evaluate token of type \"" + token.type + "\".");
	
	return handler(context, token);
}

type Handler<N extends estree.BaseNode = estree.BaseExpression> = (context: any, token: N) => any;
type HandlerLookup = { [P in keyof estree.ExpressionMap]?: Handler<estree.ExpressionMap[P]> }

type UnaryLookup = { [P in estree.UnaryOperator]?: Fn<[v: any], any> };
type BinaryLookup = { [P in estree.BinaryOperator]: Fn<[x: any, y: any], any> };
type LogicalLookup = { [P in estree.LogicalOperator]: Fn<[x: any, y: any], any> };

const unary: UnaryLookup = {
	"!":		v => !v,
	"+":		v => +v,
	"-":		v => -v,
	"~":		v => ~v,
	"void":		<any>Function.prototype,
	"typeof":	v => typeof v
}

const logical: LogicalLookup = {
	"&&": (x, y) => x && y,
	"||": (x, y) => x || y,
	"??": (x, y) => x ?? y
}

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
}

const handlers: HandlerLookup = {
	MemberExpression(context, token) {
		const object = evaluate(context, token.object);
		const property = token.computed ? evaluate(context, token.property) : (token.property as estree.Identifier).name;
		return object[property];
	},
	Literal(context, token) {
		return token.value;
	},
	Identifier(context, token) {
		const desc = token.name;
		if (desc in context)
			return context[desc];

		throw new TypeError(`${token.name} is not defined.`);
	},
	UnaryExpression(context, token) {
		let argument = evaluate(context, token.argument);
		let handler = unary[token.operator];
		if (handler == null)
			throw new TypeError("Unsupported operator: " + token.operator);

		return handler(argument);
	},
	BinaryExpression(context, token) {
		let left = evaluate(context, token.left);
		let right = evaluate(context, token.right);
		let handler = binary[token.operator];
		if (handler == null)
			throw new TypeError("Unsupported operator: " + token.operator);

		return handler(left, right);
	},
	LogicalExpression(context, token) {
		let left = evaluate(context, token.left);
		let right = evaluate(context, token.right);
		let handler = logical[token.operator];
		if (handler == null)
			throw new TypeError("Unsupported operator: " + token.operator);

		return handler(left, right);
	},
	ArrayExpression(context, token) {
		let result = Array(token.elements.length);
		for (let i = 0; i < result.length; i++)
			result[i] = evaluate(context, token.elements[i]!);

		return result;
	}
}

export var { JSONPath } = jp;
export default JSONPath;
