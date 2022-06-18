// client object
// prevents attaching custom properties to ws client instance in case of naming overlaps
// includes implementation for custom events using the base "message" event

const SOCKETS_TTL = 30000; // after this duration (ms) of unresponsive, client instance will be dropped via .terminate()
const QUEUE_TTL = 30000; // queue time to live (ms); all queued data will be dropped after this duration

const clientMapping = new Map();

class Client {
	static getClientFromWS(ws) {
		// returns the client object with the matching websocket client instance
		return clientMapping.get(ws);
	}

	static getClientFromId(id) {
		// returns a Client object from the id assigned at creation
		for (const ws of clientMapping.entries()) {
			if (clientMapping.get(ws).id == id) {
				return clientMapping.get(ws);
			}
		}
	}

	constructor (ws, metadata) {
		// ws being the websocket client instance
		this.ws = ws;
		this.metadata = metadata;

		this.connections = {}; // stores mapping of callback functions to their id
		this._queue = {}; // stores the received ids if connections had not been set up

		// internal states
		this.isAlive = true;

		// set up internal connections
		this.ws.on("pong", () => {
			this.isAlive = true;
		})

		this.ws.on("close", () => {
			this.destroy();
		})

		this.ws.on("message", data => {
			// calls the callback function binded to the id
			// params sent by the client should always be an array/dict
			var [id, params] = JSON.parse(data);

			if (this.connections[id] != null) {
				this.connections[id](params);
			} else if (this._queue[id] != null) {
				// add to pre-existing queues that will be used when callback is finally binded to id
				this._queue[id].push(params);
			} else {
				// create new queue
				this._queue[id] = [params];

				// clear up queues if hasn't been used
				var timeout = setTimeout(() => {
					if (this.connections[id] == null) {
						// drop all queues
						delete this._queue[id];
						console.log(`CLEARED queue for '${id}' event.`)
					}
				}, QUEUE_TTL)
			}
		})

		clientMapping.set(ws, this);
	}

	on(id, callback) {
		this.connections[id] = callback;

		if (this._queue[id] != null) {
			// retrieve existing queued data
			for (let i = 0; i < this._queue[id].length; i++) {
				callback(this._queue[id][i])
			}
		}
		delete this._queue[id];
	}

	send(id, data) {
		// data should always be an array/dict
		var payload = [id, data];
		this.ws.send(JSON.stringify(payload));
	}

	error(msg) {
		// notify browswer (client side) of an error
		this.ws.send(JSON.stringify(["error", {payload: msg}]));
	}

	destroy() {
		clientMapping.delete(this.ws);
		// let this get gc'ed
	}

	joinRoom(roomInstance, isHost=false) {
		if (this.metadata.connectedTo != null) {
			// leave current room
			this.leaveRoom();
		}

		if (!isHost) {
			// add as a room guest
			var success = roomInstance.addClient(this);
			if (!success) {
				this.error("room failed to accept you")
				return; // not successful
			}
		}
		this.metadata.connectedTo = roomInstance;

		// notify actual client
		this.send("room-id", {"payload": roomInstance.id});
	}

	leaveRoom() {
		// check if there is a current room
		if (this.metadata.connectedTo != null) {
			// connected to a room
			this.metadata.connectedTo.removeClient(this);
		}
		this.metadata.connectedTo = null;
		this.send("room-id", {"payload": "#"}); // send empty room id; to denote client is not in a room
	}
}

// will handle dead connections
const cemetery = setInterval(() => {
	clientMapping.forEach((client, ws) => {
		if (client.isAlive == false) {
			return client.ws.terminate();
		}

		client.isAlive = false
		client.ws.ping();
	})
}, SOCKETS_TTL)


// exports
module.exports = {
	Client,
	clientMapping
}