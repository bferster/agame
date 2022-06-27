
	console.log("Initializing Game nodeJS socket server");
	const https = require('https');
	const fs = require('fs');
	const os = require('os');
	const WebSocket = require('ws');
	const local=os.hostname().match(/^bill|desktop/i);											// Running on localhost?
	var webSocketServer;																		// Holds socket server	
	var games=[];																				// Holds games
	var gameTimer=null;																			// Overall game 20 minute timer 
	var lastClean=new Date().getTime();															// Last time a clean was initiated

/* SOCKET SERVER  ////////////////////////////////////////////////////////////////////////////////////////////////////

node gws.js

	cd /opt/bitnami/wordpress/game
 	forever logs | sudo cat /home/bitnami/.forever/<id>.log

	forever stop gws.js 
	forever start gws.js

	Ports: 8080,8085
	A Records: @.agileteacher.org -> AgileTeacherIP     www.agileteacher.org -> AgileTeacherIP
	sudo apt update
	sudo apt upgrade
	sudo apt install nodejs
	sudo apt install npm
	npm install https
	npm install fs
	npm install ws
	npm install os
	sudo /opt/bitnami/bncert-tool
	PASS=prename
	
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////*/
	
class Game {																					

	constructor(numIfs=18, numThens=90)   															// CONSTRUCTOR
	{
		this.started=false;																				// Game started flag
		this.id=games.length;																			// Set ID
		this.ifs=new Array(numIfs);																		// Ifs active array
		this.thens=new Array(numThens);																	// Thens
		this.maxTime=45*60;																				// Max time in seconds
		this.startTime=new Date().getTime()/1000;														// Get start time in seconds
		this.players=[{name:"Sara",id:123,picks:[22,66,12], winner:0} ];								// Holds player info
		this.stuPos=[0,0,5,2,1];																		// Student track positions
		this.curPhase=0;																				// Phase
		this.curIf=-1;																					// No if condition yet
		this.winner=-1;																					// No winner yet
		this.curSpeed=2;																				// Current speed
		this.time=10*1000;																				// Base time in ms
		this.timer=null;																				// Phase timer
		this.numVotes=0;																				// Numer of votes
	}

	StartNextPhase(v)																				// START NEXT PHASE
	{
		let time,op="NEXT|";
		this.curPhase++;																				// Inc phase
		if (this.curPhase == 1) {																		// START
			this.curIf=Math.floor(Math.random()*this.ifs.length);										// Set if with random number
			this.ifs.splice(this.curIf,1);																// Remove it
			this.numVotes=0;																			// No votes
			time=0; 																					// No interval needed
			op="START|";																				// Set op
			}
		else if (this.curPhase == 2)					 	time=this.time*this.curSpeed;				// DEAL
		else if ((this.curPhase > 2) && (this.curPhase < this.players.length+3)) time=this.time;		// EXPLAIN
		else if (this.curPhase == this.players.length+3) 	time=this.time*this.curSpeed;				// VOTE
		if (time) {																						// If waiting
			clearInterval(this.timer);																	// Stop timer
			this.timer=setInterval( ()=>{																// Start timer 
				clearInterval(this.timer);																// Stop timer
				this.StartNextPhase(v);																	// Recurse			
				},time+2000);
			}
		Broadcast(this.id,op+v[1]+"|"+v[2]); 															// Send message
	}

	PlayerIndex(name)																				// GET PLAYER''S INDEX FROM NAME
	{
		let i;
		for (i=0;i<this.players.length;++i)																// For each player
			if (name == this.players[i].name)	return i;												// Return match
		return -1;																						// No match
	}

} // CLASS CLOSURE

/////////////////////////////////////////////////////////////////////////////////////////////////
// SOCKET SERVER 
/////////////////////////////////////////////////////////////////////////////////////////////////

	if (!local) {																				// If on web
		const server = https.createServer({														// Create an https server
			cert: fs.readFileSync("/opt/bitnami/apache/conf/agileteacher.org.crt"),				// Point at cert
			key: fs.readFileSync("/opt/bitnami/apache/conf/agileteacher.org.key")				// And key
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
				if (!games.length || 															// If no game yet
					(games[games.length-1].players.length >= 4) ||								// Or full
					(games[games.length-1].started)) {											// Or already started
					games.push(new Game());														// Alloc new game
					trace("NEW GAME",games.length-1);											// Log
					}
				games[games.length-1].players.push({ name:v[2], picks:[] });					// Add player to game
				webSocket.gameId=games.length-1;												// Set game id
				Broadcast(webSocket.gameId,"INIT|"+v[1]+"|"+v[2]); 								// Send INIT message
				}
			let gs=games[webSocket.gameId];														// Point at game data
			if (v[0] == "START") {	  															// START
				gs.curPhase=0;																	// Reset phase
				gs.started=true;																// Close game for new entrants
				gs.StartNextPhase(v);															// Start next phase	
				}					
			else if (v[0] == "NEXT") {															// NEXT
				gs.StartNextPhase(v);															// Start next phase	
				}
			else if (v[0] == "PICKS") {															// PICKS
				let pdex=gs.PlayerIndex(v[2]);													// Get index of player from name
				if (pdex != -1)	gs.players[pdex].picks=JSON.parse(v[3]);						// Record their picks
				Broadcast(webSocket.gameId, "DRAW|"+v[1]+"|"+v[2]); 							// Trigger players
				}	
			else if (v[0] == "WINNER") {														// WINNER
				let pdex=gs.PlayerIndex(v[2]);													// Get index of player from name
				if (pdex != -1)	gs.players[pdex].winner=JSON.parse(v[3]);						// Record their picks
				++gs.numVotes;																	// Add to count
				if (gs.numVotes == gs.players.length-1) {										// All voters in !!!!!!!!!!!!!! REMOVE -1  !!!!!!!!!
					Advance(gs);																// Advance students	
					gs.winner=Vote(gs);															// Vote
					Broadcast(webSocket.gameId, "VOTED|"+v[1]+"|"+v[2]); 						// Trigger redraw
					let trt=Math.floor(new Date().getTime()/1000-gs.startTime);					// TRT in seconds
					if (trt >= gs.maxTime)														// If over time
						Broadcast(webSocket.gameId, "OVER|"+v[1]+"|"+v[2]); 					// Send OVER message
					}
				}
			});
		});
} catch(e) { console.log(e) }
	
	function Broadcast(gameId, msg)															// BROADCAST DATA TO ALL CLIENTS 
	{
		try{
			let o=games[gameId];																// Point at game data
			let now=Math.floor(new Date().getTime()/1000-o.startTime);							// TRT in seconds
			let data={ curPhase:o.curPhase, curIf:o.curIf, stuPos:o.stuPos, players:o.players, winner:o.winner, curSpeed:o.curSpeed, gameId:gameId, curTime:now };
			msg+=`|${JSON.stringify(data)}`;													// Add data
			webSocketServer.clients.forEach((client)=>{											// For each client
				if (client.gameId == gameId) 													// In this game
					if (client.readyState === WebSocket.OPEN) client.send(msg);					// Send to client
				});
			trace("Broadcast",msg);																// Show sent											
		} catch(e) { console.log(e) }
	}

	function Vote(gs)																		// VOTE
	{
		let i,votes=[0,0,0,0,0];
		for (i=0;i<gs.players.length;++i) 														// For each player
			if (gs.players[i].winner != -1)	votes[i]++;											// Add to vote count
		votes.sort((a, b)=>{return a-b});														// Descending sort
		return votes[0];																		// Return highest
	}
	
	function Advance(gs)																	// ADVANCE STUDENT POSITIONS
	{
		let i;
		for (let i=0;i<5;++i) gs.stuPos[i]+=Math.floor(Math.random()*4)+1;						// Advance
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

