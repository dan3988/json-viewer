//fix for json5 creating an unsafe function and violating CSP if window and self are undefined
var self = globalThis;