import * as http from "node:http"
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import * as ws from "ws";
import path from "node:path";

/** @type {http.RequestListener} */
function onServerRequest(req, res) {
	const url = new URL(req.url, "http://localhost");
	if (url.pathname !== "/hotreload.js") {
		res.writeHead(404);
		res.end();
	} else {
		const stream = fs.createReadStream("./rollup-plugin-hotreload-client.js");
		res.writeHead(200, { 
			"content-type": "text/javascript",
			"access-control-allow-origin": "*"
		});
		stream.pipe(res, { end: true });
	}
}

/** @typedef {(socket: ws.WebSocket, req: http.IncomingMessage) => void} UpgradeHandler */

/** @type {Map<number, ReturnType<openServer>>} */
const servers = new Map();

/**
 * @param {number} port 
 * @returns {Promise<Map<string, UpgradeHandler>>}
 */
function openServer(port) {
	return new Promise((resolve, reject) => {
		const handlers = new Map();

		function onUpgrade(req, socket, head) {
			const url = new URL(req.url, "http://localhost");
			const id = url.searchParams.get("id");
			if (url.pathname !== "/hotreload" || !id)
				return;

			const handler = handlers.get(id);
			if (handler)
				wss.handleUpgrade(req, socket, head, handler);
		}

		const wss = new ws.WebSocketServer({ noServer: true });
		const server = http.createServer();
		server.on("request", onServerRequest);
		server.on("upgrade", onUpgrade);
		server.on("error", reject)
		server.listen(port, () => {
			console.log("hotreload: listening on port %d", port);
			resolve(handlers);
		});
	});
}

async function listen(port, guid) {
	let promise = servers.get(port);
	if (promise == null)
		servers.set(port, promise = openServer(port));

	return promise.then(handlers => {
		const sockets = [];
		let files;
	
		/**
		 * @param {ws.WebSocket} socket 
		 */
		function onConnection(socket) {
			sockets.push(socket);
			socket.send(JSON.stringify({ type: "init", files }));
			socket.on("close", () => {
				const ix = sockets.indexOf(socket);
				ix >= 0 && sockets.splice(ix, 1);
			});
		}
	
		function push(_files) {
			files = _files;
			const data = JSON.stringify({ type: "update", files });
			sockets.forEach(v => v.send(data));
		}

		handlers.set(guid, onConnection);
		return push;
	});
}

function checksum(data) {
	return crypto.createHash("md5").update(data).digest("base64");
}

/**
 * @param {Options} options
 * @returns {import("rollup").Plugin}
 */
export async function hotreload(options = {}) {
	const { port = 58997, baseDir = ".", prefix } = options;
	const guid = crypto.randomUUID();
	const push = await listen(port, guid);

	return {
		footer() {
			return `(() => {const script = document.createElement("script");script.src="http://localhost:${port}/hotreload.js?id=${guid}&prefix=${prefix}";script.type="module";document.head.appendChild(script);})();`
		},
		writeBundle(options, output) {
			const files = {};
			for (const file in output) {
				const full = path.join(options.dir, file);
				const relative = '/' + path.relative(baseDir, full).replaceAll('\\', '/');
				const val = output[file];
				files[relative] = checksum(val.type === "chunk" ? val.code : val.source);
			}

			push(files);
		}
	}
}

export default hotreload;

/**
 * @typedef {object} Options
 * @prop {string} prefix
 * @prop {number} [port]
 * @prop {string} [baseDir]
 */