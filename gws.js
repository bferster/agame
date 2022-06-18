
	console.log("Initializing Game nodeJS socket server");
	const https = require('https');
	const fs = require('fs');
	const os = require('os');
	const WebSocket = require('ws');
	let webSocketServer;																		// Holds socket server	
	let local=os.hostname().match(/^bill|desktop/i);											// Running on localhost?
	let games=[];																				// Holds gmes
	let timer=null;

/* SOCKET SERVER  ////////////////////////////////////////////////////////////////////////////////////////////////////

	npm install https
	npm install fs
	npm install ws
	npm install os
	node gws.js

	npm install forever
	cd ~/htdocs/go | forever stopall | forever start gws.js | forever logs | sudo cat /home/bitnami/.forever/<id>.log
	open port:8080
	
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////*/
	
class Game  {																					

	constructor(id, numIfs=18, numThens=90)   														// CONSTRUCTOR
	{
		this.id=id;																						// Set ID
		this.ifs=new Array(numIfs);																		// Ifs active array
		this.thens=new Array(numThens);																	// Thens
		this.maxTime=45*60;																				// Max time in seconds
		this.startTime=new Date().getTime()/1000;														// Get start time in seconds
		this.players=[{name:"Bill",picks:[]},{name:"Sara",picks:[22,66,12]},{name:"Rhonda",picks:[33,25,8]},{name:"Lily",picks:[45]},]																					// Holds player info
		this.stuPos=[0,0,5,2,1];																		// Student track positions
		this.curPhase=0;																				// Phase
		this.curIf=-1;																					// No if condition yet
		this.winner=-1;																					// No winner yet
	}

	PlayerIndex(name)																				// GET PLAYER''S INDEX FROM NAME
	{
		let i;
		for (i=0;i<this.players.length;++i)																// For each player
			if (name == this.players[i].name)	return i;												// Return match
		return -1;																						// No match
	}

} // CLASS CLOSURE

	if (!local) {																				// If on web
		const server = https.createServer({														// Create an https server
			cert: fs.readFileSync("/opt/bitnami/apache/conf/www.lizasim.com.crt"),				// Point at cert
			key: fs.readFileSync("/opt/bitnami/apache/conf/www.lizasim.com.key")				// And key
			});
		webSocketServer= new WebSocket.Server({ server });										// Open it
		server.listen(8080);																	// Listen on port 8080
		}
	else webSocketServer = new WebSocket.Server({ port:8080 });									// Open in debug

try{
	webSocketServer.on('connection', (webSocket, req) => {										// ON CONNECTION
		let d=new Date();																		// Get UTC time
		d=new Date(d.getTime()+(-3600000*5));													// Get UTC-5 time	
		let str=d.toLocaleDateString()+" -- "+d.toLocaleTimeString()+" -> "+ req.socket.remoteAddress.substring(7);
		console.log(`Connect: (${webSocketServer.clients.size}) ${str}`);						// Log connect
		webSocket.on('message', (msg) => {														// ON MESSAGE
			if (!msg)	return;																	// Quit if no message
			message=msg.toString();																// Get as string
			trace('In:', message);																// Log
			let v=message.split("|");															// Get params
			if (v[0] == "INIT") {																// INIT
				webSocket.meetingId=v[1];														// Set meeting id
				if (!games["g"+1]) games["g"+1]=new Game(1),trace("New game");					// Alloc new game
				games["g"+webSocket.meetingId].curPhase=0
				Broadcast(webSocket.meetingId,message);											// Send to all players
				}
			let gs=games["g"+webSocket.meetingId];												// Point at game data
			if (v[0] == "START") {																// START
				if (timer) clearInterval(timer);												// Clear timer
				gs.curPhase=1;																	// Set phase
				gs.curIf=Math.floor(Math.random()*gs.ifs.length);								// Random number
				gs.ifs.splice(gs.curIf,1);														// Remove it
				Broadcast(webSocket.meetingId,message);											// Send to all players
				}
			else if (v[0] == "NEXT") {															// NEXT
				gs.curPhase+=1;																	// Inc phase to deal
				Broadcast(webSocket.meetingId,message);											// Send to all players to deal
				clearInterval(timer);															// Clear
				timer=setInterval(()=>{															// Set interval
					gs.curPhase+=1;																// Inc phase
					if (gs.curPhase > gs.players.length+3) {									// Done
						clearInterval(timer);													// Complete
						}
				if ((gs.curPhase != 2) && (gs.curPhase != gs.players.length+4))					// Not dealing or voting
					Broadcast(webSocket.meetingId,message);										// Send to all players
					},10000);	
				}
			else if (v[0] == "PICKS") {															// PICKS
				let pdex=gs.PlayerIndex(v[2]);													// Get index of player from name
				if (pdex != -1)	gs.players[pdex].picks=JSON.parse(v[3]);						// Record their picks
				message="NEXT|"+v[1]+"|"+v[2];													// Remove new data
				Broadcast(webSocket.meetingId, message); 										// Trigger players
				}
			else if (v[0] == "WINNER") {														// WINNER
				gs.winner=v[3];																	// Record the winner
				message="NEXT|"+v[1]+"|"+v[2];													// Remove new data
				Broadcast(webSocket.meetingId, message); 										// Trigger players
				}
			else if (v[0] == "STUDENTS") {														// STUDENTS
				gs.stuPos=JSON.parse(v[3])														// Record student progress
				message="STUDENTS|"+v[1]+"|"+v[2];												// Remove new data
				Broadcast(webSocket.meetingId, message); 										// Trigger players
				}
				});
		});
} catch(e) { console.log(e) }
	
function Broadcast(meetingId, msg)															// BROADCAST DATA TO ALL CLIENTS 
{
	try{
		let o=games["g"+meetingId];																// Point at game data
		let data={ curPhase:o.curPhase, curIf:o.curIf, stuPos:o.stuPos, players:o.players, winner:o.winner };
		msg+=`|${JSON.stringify(data)}`;														// Add data
		webSocketServer.clients.forEach((client)=>{												// For each client
			if (client.meetingId == meetingId) 													// In this meeting
				if (client.readyState === WebSocket.OPEN) client.send(msg);						// Send to client
			});
		trace("Broadcast",msg);																	// Show sent											
	} catch(e) { console.log(e) }
}


/////////////////////////////////////////////////////////////////////////////////////////////////
// HELPERS 
/////////////////////////////////////////////////////////////////////////////////////////////////

	function trace(msg, p1, p2, p3, p4)																// CONSOLE 
	{
		if (p4 != undefined)
			console.log(msg,p1,p2,p3,p4);
		else if (p3 != undefined)
			console.log(msg,p1,p2,p3);
		else if (p2 != undefined)
			console.log(msg,p1,p2);
		else if (p1 != undefined)
			console.log(msg,p1);
		else
			console.log(msg);
	}

