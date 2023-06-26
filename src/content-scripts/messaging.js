window.addEventListener("message", ({ data }) => {
	if (data.type === "globalSet") {
		const { key, value } = data;
		globalThis[key] = value;
	}
});