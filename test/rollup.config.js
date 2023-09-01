import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import fs from "node:fs";
import json from "@rollup/plugin-json";
import onwarn from "../rollup-typescript-log.js";

if (fs.existsSync("lib"))
	fs.rmSync("lib", { recursive: true });

export default defineConfig({
	input: "./test/main.ts",
	output: {
		format: "esm",
		inlineDynamicImports: true,
		dir: "lib",
		sourcemap: true
	},
	external: [
		"@daniel.pickett/linq-js",
		"chai",
		"espree"
	],
	onwarn,
	plugins: [
		typescript({
			tsconfig: "./test/tsconfig.json",
		}),
		json(),
		resolve({
			browser: false
		}),
		commonjs({
			include: "./node_modules/",
			requireReturnsDefault: "auto"
		})
	]
});
