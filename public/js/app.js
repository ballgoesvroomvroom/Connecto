async function connectToServer() {
	const ws = new WebSocket("ws://192.168.1.32:7071/ws")
	return new Promise((res, rej) => {
		const timer = setInterval(() => {
			if (ws.readyState == 1) {
				clearInterval(timer);
				res(ws);
			}
		}, 10)
	})
}

class Client {
	constructor (ws) {
		// ws being the websocket client instance
		this.ws = ws;

		this.connections = {}; // stores mapping of callback functions to their id

		this.ws.onmessage = e => {
			// params sent by the server should always be an array/dict
			var data = e.data;
			var [id, params] = JSON.parse(data);
			this.connections[id](params); // fire callback binded to id
		}
	}

	send(id, data) {
		// data should always be an array/dict
		var payload = [id, data];
		this.ws.send(JSON.stringify(payload));
	}

	on(id, callback) {
		this.connections[id] = callback;
	}
}

$(document).ready(async function(e) {
	const $selectors = {
		"main-viewer-img": $("#main-viewer-img"),
		"full-hint": $("#full-hint"),

		"create-room": $("#create-room"),
		"join-room": $("#join-room"),
		"room-info-id": $("#room-info-id"),

		"input-modal": $("#input-modal"),
		"input-modal-out": $("#input-modal-out"),
		"join-room-input": $("#join-room-input"),
		"join-room-confirm": $("#join-room-confirm"),

		"file-upload": $("#file-upload"),
		"upload-button": $("#upload-button")
	}

	const ws = await connectToServer();
	const client = new Client(ws);

	function joinRoom(roomid) {
		// close any modals
		$selectors["input-modal"].css("display", "none");

		// update visuals
		$selectors["room-info-id"].text(`Current room: ${roomid}`);
	}

	client.on("room-id", data => {
		console.log("roomid!", data.payload);

		joinRoom(data.payload);
	})

	client.on("room-master", data => {
		// display image (data.payload holds the image uri)
		$selectors["main-viewer-img"].attr("src", data.payload);
	})

	client.on("error", data => {
		var err_msg = data.payload;
		console.log("[ERR]", err_msg);
	})

	$selectors["create-room"].on("click", () => {
		// create room
		client.send("createRoom");
	})

	$selectors["join-room"].on("click", () => {
		// open modal
		$selectors["input-modal"].css("display", "block");
	})

	$selectors["input-modal-out"].on("click", (e) => {
		// close modal
		e.stopPropagation();
		$selectors["input-modal"].css("display", "none");
	})

	$selectors["join-room-confirm"].on("click", (e) => {
		// join room
		console.log("trying to join")
		e.preventDefault();
		$selectors["join-room-input"][0].checkValidity();
		client.send("joinRoom", {id: $selectors["join-room-input"].val()});
	})

	$selectors["upload-button"].on("click", function() {
		// upload file image
		$selectors["file-upload"].trigger("click");
	})

	$selectors["file-upload"].on("click", (e) => {
		e.target.value = null;
	})

	$selectors["file-upload"].on("change", function() {
		console.log("CHANGED")
		var fr = new FileReader();

		fr.onload = function(e) {
			client.send("sendData", {payload: e.target.result})
		}

		fr.readAsDataURL(this.files[0])
	})

	$selectors["full-hint"].on("click", (e) => {
		// full-screen
		var data = $selectors["main-viewer-img"].attr("src");

		// neat solution of converting base64 uri to a blob
		// @https://stackoverflow.com/a/36183085/12031810
		fetch(data).then(r => r.blob()).then(d => window.open(URL.createObjectURL(d), "_blank"))
	})


	// initialise a room
	client.send("createRoom")
})