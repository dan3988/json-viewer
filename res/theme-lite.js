const rule = matchMedia("(prefers-color-scheme: dark)");
rule.addEventListener("change", e => setDarkMode(e));
setDarkMode(rule);

function setDarkMode(rule) {
	document.documentElement.setAttribute("data-bs-theme", rule.matches ? "dark" : "light");
}
