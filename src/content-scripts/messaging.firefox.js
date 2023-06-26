window.addEventListener("message", ({ data }) => {
	if (data.type === "globalSet") {
		const { key, value } = data;
		window.wrappedJSObject[key] = value;
	}
});