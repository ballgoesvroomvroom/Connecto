const http = require("http")
const path = require("path")
const express = require("express")
const ws = require("ws")
const crypto = require("crypto")

const clients = require("./clients")
const rooms = require("./rooms")

const app = express()
const httpServer = http.createServer(app)
const wss = new ws.Server({ port: 7071 })

const public = path.join(__dirname, "../public/")
const views = {
	"base": public +"/html/base.html"
}
app.use(express.static(public))

app.get("/", (req, res) => {
	res.type("html")
	res.sendFile(views["base"])
})

app.get("/css/:filename", (req, res) => {
	var filename = req.params.filename

	res.type("css")
	res.sendFile(path.join(public, "css/", filename))
})

wss.on("connection", (ws) => {
	const id = crypto.randomBytes(16).toString("hex")
	const connectedTo = null

	const metadata = { connectedTo, id }
	let client = new clients.Client(ws, metadata)

	client.on("createRoom", () => {
		room = new rooms.Room(client)
		// client is automatically set to room's host
		client.joinRoom(room, true); // isRoomsHost = true
	})

	client.on("joinRoom", data => {
		// find if room exists

		// validate data id
		var roomid = data.id;
		if (roomid.length != 6 || !((/^[a-fA-F\d]{6}$/).test(roomid))) {
			client.error("invalid room id")
			return;
		}

		if (rooms.roomMapping.has(roomid)) {
			// room exists
			client.joinRoom(rooms.roomMapping.get(roomid));
		} else {
			// no room exists
			client.error("no room exists")
		}
	})

	client.on("sendData", data => {
		// send data into group
		// check if client is in a group
		if (client.metadata.connectedTo != null) {
			// connected to a room
			var rooms = client.metadata.connectedTo;
			rooms.sendAll("room-master", {payload: data.payload});
		}
	})
})


httpServer.listen(5004, console.log("connected at port 5004"))