/**
 * @typedef KeyBinding
 * @prop {string} name
 * @prop {string} code
 * @prop {string} keyName
 * @prop {string} [keyDisplay]
 * @prop {boolean} ctrl
 */

function binding(name, code, keyName, keyDisplay = undefined, ctrl = false) {
	return { name, code, keyName, keyDisplay, ctrl }
}

/** @type {KeyBinding[]} */
const bindings = [
	binding("Previous Sibling", "ArrowUp", "Up", "↑"),
	binding("Next Sibling", "ArrowDown", "Down", "↓"),
	binding("Go to parent", "ArrowLeft", "Left", "←"),
	binding("Go to children", "ArrowRight", "Right", "→"),
	binding("Expand / collapse current property", "Space", "Space", "␣"),
	binding("Copy selected value (formatted)", "KeyC", "C", undefined, true)
];

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {HTMLElement} parent 
 * @param {K} tagName 
 * @param {string | any[]} className 
 * @param {string} [content]
 */
function append(parent, tagName, className, content = null) {
	const e = document.createElement(tagName);
	e.textContent = content;

	if (Array.isArray(className)) {
		for (const name of className)
			if (name)
				e.classList.add(name);
	} else {
		e.className = className;
	}

	parent.appendChild(e);
	return e;
}

/**
 * @param {HTMLElement} parent 
 * @param {KeyBinding} binding 
 */
function renderBinding(parent, binding) {
	const root = append(parent, "div", "binding");
	const eCtrl = append(root, "span", ["key", "key-modif", !binding.ctrl && "inactive"], "Ctrl");
	const eMain = append(root, "span", "key key-main", binding.keyDisplay ?? binding.keyName);
	eMain.title = binding.keyName;

	/**
	 * @param {KeyboardEvent} evt
	 */
	function handleEvent(evt) {
		if (evt.code === binding.code) {
			eMain.classList.toggle("active", evt.type === "keydown");
		} else if (binding.ctrl && evt.key === "Control") {
			eCtrl.classList.toggle("active", evt.type === "keydown");
		}
	}

	addEventListener("keydown", handleEvent);
	addEventListener("keyup", handleEvent);

	append(root, "span", "desc", binding.name);
}

const e = document.getElementById("key-binds");
for (const binding of bindings)
	renderBinding(e, binding);