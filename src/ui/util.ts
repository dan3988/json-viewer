interface Renderer<T = any> {
	update(value: T): void;
	destroy?(): void;
}

abstract class AbstractRenderer<T> implements Renderer<T> {
	#target: null | HTMLElement;
	#value: any;

	constructor(target: HTMLElement, value: T) {
		this.#target = target;
		this.#value = value;
		this.onUpdate(target, value);
	}

	protected abstract onUpdate(target: HTMLElement, value: T): void;

	update(value: any): void {
		if (this.#value !== value && this.#target != null) {
			this.#value = value;
			this.#target.innerHTML = "";
			this.onUpdate(this.#target, value);
		}
	}

	destroy(): void {
		if (this.#target) {
			this.#target.innerHTML = "";
			this.#target = null;
		}
	}
}

const jsIdentifier = /^[$A-Z_][0-9A-Z_$]*$/igm;

class JsonValueRenderer extends AbstractRenderer<any> {
	protected onUpdate(target: HTMLElement, value: any): void {
		if (value === null || typeof value !== "string") {
			target.innerText = String(value);
		} else {
			if (value.startsWith("http://") || value.startsWith("https://")) {
				const a = document.createElement("a");
				const text = JSON.stringify(value);
				a.href = value;
				a.textContent = text;
				a.target = "_blank";
				target.append(a);
			} else if (jsIdentifier.test(value)) {
				target.innerText = JSON.stringify(value);
			} else {
				renderEscapedText(target, value);
			}
		}
	}
}

export function renderValue(target: HTMLElement, value: any): Renderer {
	return new JsonValueRenderer(target, value);
}

function appendSpan(parent: HTMLElement, className: string, text: string, start?: number, end?: number) {
	const span = document.createElement("span");
	span.textContent = start == null ? text : text.substring(start, end);
	span.className = className;
	parent.appendChild(span);
	return span;
}

function renderEscapedText(target: HTMLElement, value: string) {
	const json = JSON.stringify(value);

	let last = 1;
	let i = 1;

	appendSpan(target, "quot", "\"");

	while (true) {
		let next = json.indexOf("\\", i);
		if (next < 0) {
			appendSpan(target, "", json, last, json.length - 1);
			appendSpan(target, "quot", "\"");
			break;
		} else {
			if (last < next)
				appendSpan(target, "", json, last, last = next);

			let char = json.charAt(++last);
			if (char !== "u") {
				appendSpan(target, "esc", "\\" + char);
				last++;
			} else {
				appendSpan(target, "esc", json, next, last += 5);
			}

			i = last;
		}
	}
}

class JsonKeyRenderer extends AbstractRenderer<string | number> {
	protected onUpdate(target: HTMLElement, value: string | number): void {
		if (typeof value !== "string" || jsIdentifier.test(value)) {
			target.innerText = value.toString();
		} else {
			renderEscapedText(target, value);
		}
	}
}

export function renderKey(target: HTMLElement, key: string | number): Renderer<string | number> {
	return new JsonKeyRenderer(target, key);
}