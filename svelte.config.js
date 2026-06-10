export default {
	onwarn(warning, handler) {
		warning.code !== "css-unused-selector" && handler(warning);
	},
}