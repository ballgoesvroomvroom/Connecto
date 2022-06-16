// handles groups of sockets (clients) connected to together
const crypto = require("crypto");

const roomMapping = new Map();

function generateNewRoomCode() {
	// used as id; prevents duplicated ids
	while (true) {
		var id = crypto.randomBytes(3).toString("hex");
		if (!roomMapping.has(id)) {
			return id;
		}
	}
}

class Room {
	constructor (hostClient) {
		// host: client object
		this.host = hostClient;
		this.guests = new Map();

		this.id = generateNewRoomCode();

		roomMapping.set(this.id, this);
	}

	sendAll(id, data) {
		// id and data follow the same parameters as client.send();
		// with data being an array/dict
		this.host.send(id, data)
		this.guests.forEach((ws, client) => {
			client.send(id, data)
		})
	}

	addClient(client) {
		// called by inner methods of client object
		// no need to validate if client is still in another room
		if (this.host == null || this.host == client) {
			// invalid room; or client cannot be added to its room
			return false; // prevent an recursive loop
		}
		this.guests.set(client, true); // placeholder value for now
		return true
	}

	removeClient(client) {
		// also called by inner methods of client object
		// no need to validate if client isn't in this room; done by client's methods
		
		// do check if client is a host; if it is, destroy
		if (this.host == client) {
			this.destroy(true);
		} else {
			// find host
			this.guests.delete(client);
		}
	}

	destroy(calledbyHost=false) {
		console.log(calledbyHost)
		// kick out everyone
		if (!calledbyHost) {
			// host didn't call .destroy(), kick host out too
			this.host.leaveRoom();
		}

		this.guests.forEach((value, guest) => {
			guest.leaveRoom();
		})

		// let this object get gc'ed
	}
}


// exports
module.exports = {
	Room,
	roomMapping
}