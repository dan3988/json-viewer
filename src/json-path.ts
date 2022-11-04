/// <amd-module name="json-path"/>
/// <reference path="../node_modules/jsonpath-plus/src/jsonpath.d.ts"/>
// @ts-ignore
import * as jp from "jsonpath-plus";

export var {  JSONPath, JSONPathClass }: typeof import("jsonpath-plus") = jp;
