
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
		this.curPhase=0;																				// Current phase
		this.curIf=-1;																					// Current if
		this.maxTime=45*60;																				// Max time in seconds
		this.startTime=new Date();																		// Get time
		this.players=[{name:"Bill",cards:[],picks:[]},{name:"Sara",cards:[],picks:[]},{name:"Rhonda",cards:[],picks:[]},{name:"Lily",cards:[],picks:[]}]																					// Holds player info
		this.curLead=0;																					// Lead player
		this.stuPos=[0,0,5,2,1];																		// Student track positions
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
			trace('In:', message.substr(0,128));												// Log
			let v=message.split("|");															// Get params
			if (v[0] == "INIT") {																// INIT
				webSocket.meetingId=v[1];														// Set meeting id
				if (!games["g"+1]) games["g"+1]=new Game(1),trace("New game");					// Alloc new game
				}
			let gs=games["g"+webSocket.meetingId];												// Point at game data
			if (v[0] == "START") {																// START
				if (timer) clearInterval(timer);												// Clear timer
				gs.curPhase=1;																	// Set phase
				gs.curIf=Math.floor(Math.random()*gs.ifs.length);								// Random number
				gs.ifs.splice(gs.curIf,1);														// Remove it
				}
			else if (v[0] == "NEXT") {															// NEXT
				gs.curPhase+=1;																	// Inc phase
				timer=setInterval(()=>{															// Set interval
					gs.curPhase+=1;																// Inc phase
					if (gs.curPhase > gs.players.length+4) {									// Done
						clearInterval(timer);													// Complete
						gs.curPhase=0;															// Reset
						}
					Broadcast(webSocket.meetingId, msg); 										// Trigger players
					},10000);								
				}
			else if (v[0] == "PICKS") {															// PICKS
				trace(JSON.parse(v[3]));	
				// Add to gs
				
				message=v[0]+"|"+v[1]+"|"+v[2];													// Remove new data
				}
			Broadcast(webSocket.meetingId,message);												// Sent to all players
			});
		});
} catch(e) { console.log(e) }
	
function Broadcast(meetingId, msg)															// BROADCAST DATA TO ALL CLIENTS 
{
	try{
		let o=games["g"+meetingId];																// Point at game data
		let data={ curPhase:o.curPhase, curTime:d=o.startTime, curIf:o.curIf, stuPos:o.stuPos, players:o.players };
		msg+=`|${JSON.stringify(data)}`;														// Add data
		webSocketServer.clients.forEach((client)=>{												// For each client
			if (client.meetingId == meetingId) 													// In this meeting
				if (client.readyState === WebSocket.OPEN) client.send(msg);						// Send to client
			});
		trace("Broadcast",msg.substr(0,128));													// Log truncated message												
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

