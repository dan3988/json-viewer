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
		return context[token.name];
	},
	UnaryExpression(context, token) {
		let argument = evaluate(context, token.argument);
		switch (token.operator) {
			case "!":
				return !argument;
			case "-":
				return -argument;
			case "+":
				return +argument;
			case "~":
				return ~argument;
			case "void":
				return undefined;
			case "typeof":
				return typeof argument;
		}

		throw new TypeError("Unsupported operator: " + token.operator);
	},
	BinaryExpression(context, token) {
		let left = evaluate(context, token.left);
		let right = evaluate(context, token.right);

		switch (token.operator) {
			case "==":
				return left == right;
			case "===":
				return left === right;
			case "!=":
				return left != right;
			case "!==":
				return left !== right;
			case "+":
				return left + right;
			case "-":
				return left - right;
			case "*":
				return left * right;
			case "/":
				return left / right;
			case "&":
				return left & right;
			case "|":
				return left | right;
			case "<":
				return left < right;
			case "<=":
				return left <= right;
			case ">":
				return left > right;
			case ">=":
				return left >= right;
			case "<<":
				return left << right;
			case ">>":
				return left >> right;
			case ">>>":
				return left >>> right;
			case "instanceof":
				return left instanceof right;
			case "in":
				return Array.prototype.includes.call(right, left);
		}

		throw new TypeError("Unsupported operator: " + token.operator);
	},
	LogicalExpression(context, token) {
		let left = evaluate(context, token.left);
		let right = evaluate(context, token.right);

		switch (token.operator) {
			case "&&":
				return left && right;
			case "||":
				return left || right;
		}

		throw new TypeError("Unsupported operator: " + token.operator);
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
