{
	let require = function() {
		throw new Error("not implemented.");
	}

	let modules = new Map<string, any>();

	function define(name: any, deps: any, fn: any) {
		if (fn == undefined) {
			fn = deps;
			deps = name;
			name = undefined;
		}

		let args: any[] = [];
		let exports: any = undefined;

		for (let dep of deps) {
			let value: any;
			switch (dep) {
				case "require":
					value = require;
					break;
				case "exports":
					value = exports = {};
					break;
				default:
					value = modules.get(dep);
					break;
			}

			args.push(value);
		}

		if (exports === undefined) {
			exports = fn.apply(undefined, args);
		} else {
			exports[Symbol.toStringTag] = "Module";
			fn.apply(undefined, args);
		}

		if (name == null) {
			if ("JSONPath" in exports) {
				name = "jsonpath-plus";
			} else if ("Syntax" in exports) {
				name = "esprima";
			} else {
				console.error("Failed to resolve name of module.");
				return;
			}
		}

		modules.set(name, exports);
	}

	define.amd = true;

	Object.defineProperty(globalThis, "define", { value: define });
}
