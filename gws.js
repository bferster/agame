
	console.log("Initializing Game nodeJS socket server");
	const https = require('https');
	const fs = require('fs');
	const os = require('os');
	const WebSocket = require('ws');
	const local=os.hostname().match(/^bill|desktop/i);											// Running on localhost?
	var webSocketServer;																		// Holds socket server	
	var games=[];																				// Holds games
	var phaseTimer=null;																		// Phase timer
	var gameTimer=null;																			// Overall game 20 minute timer 
	var lastClean=new Date().getTime();															// Last time a clean was initiated
	

/* SOCKET SERVER  ////////////////////////////////////////////////////////////////////////////////////////////////////

	npm install https
	npm install fs
	npm install ws
	npm install os
	node gws.js

	npm install forever
	cd ~/htdocs/game | forever stop gws.js | forever start gws.js | forever logs | sudo cat /home/bitnami/.forever/<id>.log
	open port:8085
	
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////*/
	
class Game {																					

	constructor(numIfs=18, numThens=90)   															// CONSTRUCTOR
	{
		this.id=games.length;																			// Set ID
		this.ifs=new Array(numIfs);																		// Ifs active array
		this.thens=new Array(numThens);																	// Thens
		this.maxTime=45*60;																				// Max time in seconds
		this.startTime=new Date().getTime()/1000;														// Get start time in seconds
		this.players=[{name:"Sara",id:123,picks:[22,66,12]},{name:"Rhonda",id:456,picks:[33,25,8]},{name:"Lily",id:789,picks:[45]}]																					// Holds player info
		this.stuPos=[0,0,5,2,1];																		// Student track positions
		this.curPhase=0;																				// Phase
		this.curIf=-1;																					// No if condition yet
		this.winner=-1;																					// No winner yet
		this.curSpeed=1;																				// Current speed
		this.time=2*1000;																				// Base time in ms
		this.timer=null;																				// Phaswe timer
	}

	StartNextPhase(v)																				// START NEXT PHASE
	{
		let pdex;
		this.curPhase++;																				// Inc phase
		trace("PRE",this.curPhase,v[1])
		if (this.curPhase == 1) {																		// START
			this.curIf=Math.floor(Math.random()*this.ifs.length);										// Random number
			this.ifs.splice(this.curIf,1);																// Remove it
			Broadcast(this.id,"START|"+v[1]+"|"+v[2]); 													// Send message
			}
		else if (this.curPhase == 2) {																	// DEAL
			clearInterval(this.timer);																	// Stop timer
			Broadcast(this.id,"NEXT|"+v[1]+"|"+v[2]); 													// Send message
			this.timer=setInterval( ()=>{																// Start timer no payload since PICKS triggers next phase
				clearInterval(this.timer);																// Stop timer
				}, this.time*this.speed);																// Might be longer
			}	
		else if ((this.curPhase > 2) && (this.curPhase < this.players.length+3)) {						// EXPLAIN
				// Get picks
			clearInterval(this.timer);																	// Stop timer
			if (this.curPhase == 3) Broadcast(this.id,"NEXT|"+v[1]+"|"+v[2]); 							// Send message
			this.timer=setInterval( ()=>{																// Start seconds timer
				clearInterval(this.timer);																// Stop timer
				this.StartNextPhase(v);																	// Recurse			
				Broadcast(this.id,"NEXT|"+v[1]+"|"+v[2]); 												// Send message
				},this.time);																			// Short
			}
		else if (this.curPhase == this.players.length+3) {												// VOTE
			clearInterval(this.timer);																	// Stop timer
			this.timer=setInterval( ()=>{																// Start timer no payload since WINNER triggers next phase
				clearInterval(this.timer);																// Stop timer
				},this.time*this.speed);																// Long
			}
			else if (this.curPhase == this.players.length+4) {											// DISCUSS
				// Get votes
				Broadcast(this.id,"NEXT|"+v[1]+"|"+v[2]); 												// Send message
			}
			else if (this.curPhase == this.players.length+5) {											// ON STUDENTS IN
				this.curPhase=this.players.length+4;													// Hold back phase
				Broadcast(this.id,"INIT|"+v[1]+"|"+v[2]); 												// Send message to draw track
				}
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
		server.listen(8085);																	// Listen on port 8085
		}
	else webSocketServer = new WebSocket.Server({ port:8085 });									// Open in debug
//	gameTimer=setInterval(()=>{ CleanUp(); },10*60*1000)										// Set cleanup timer
	games[0]=new Game();																		// Add first game																			

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
				if (!games.length || (games[games.length-1].players.length >= 4)) {				// No game open or full
					games.push(new Game());														// Alloc new game
					trace("NEW GAME",games.length-1);											// Log
					}
				games[games.length-1].players.push({ name:v[2], picks:[] });					// Add player to game
				webSocket.gameId=games.length-1;												// Set game id
				Broadcast(webSocket.gameId,"INIT|"+v[1]+"|"+v[2]); 								// Send INIT message
				}
			let gs=games[webSocket.gameId];														// Point at game data
			if (v[0] == "START") 	  		gs.StartNextPhase(v);								// START
			else if (v[0] == "NEXT")  		gs.StartNextPhase(v);								// NEXT
			else if (v[0] == "PICKS") 		gs.StartNextPhase(v);								// PICKS
			else if (v[0] == "WINNER") 		gs.StartNextPhase(v);								// WINNER
			else if (v[0] == "STUDENTS") 	gs.StartNextPhase(v);								// STUDENTS

/*			gs.winner=v[3];																	// Record the winner
				message="NEXT|"+v[1]+"|"+v[2];													// Remove new data
				Broadcast(webSocket.gameId, message); 											// Trigger players
				}
			else if (v[0] == "STUDENTS") {														// STUDENTS
				gs.stuPos=JSON.parse(v[3])														// Record student progress
				message="STUDENTS|"+v[1]+"|"+v[2];												// Remove new data
				Broadcast(webSocket.gameId, message); 											// Trigger players
				let trt=Math.floor(new Date().getTime()/1000-gs.startTime);						// TRT in seconds
				if (trt >= gs.maxTime)															// If over time
					Broadcast(webSocket.gameId, "OVER|"+v[1]+"|"+v[2]); 						// Send OVER message
				}
			*/			});
		});
} catch(e) { console.log(e) }
	
	function Broadcast(gameId, msg)															// BROADCAST DATA TO ALL CLIENTS 
	{
		try{
			let o=games[gameId];																	// Point at game data
			let now=Math.floor(new Date().getTime()/1000-o.startTime);								// TRT in seconds
			let data={ curPhase:o.curPhase, curIf:o.curIf, stuPos:o.stuPos, players:o.players, winner:o.winner, curSpeed:o.curSpeed, gameId:gameId, curTime:now };
			msg+=`|${JSON.stringify(data)}`;														// Add data
			webSocketServer.clients.forEach((client)=>{												// For each client
				if (client.gameId == gameId) 														// In this game
					if (client.readyState === WebSocket.OPEN) client.send(msg);						// Send to client
				});
			trace("Broadcast",msg);																	// Show sent											
		} catch(e) { console.log(e) }
	}
	
function CleanUp()																			// CLEANUP GAME
{
	let i;
	trace("CLEAN",lastClean);
	let now=new Date().getTime();																// Get now
	lastClean=now;																				// Then is now

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

