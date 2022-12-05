
	console.log("Initializing Game nodeJS socket server");
	const https = require('https');
	const fs = require('fs');
	const os = require('os');
	const WebSocket = require('ws');
	const local=os.hostname().match(/^bill|desktop/i);											// Running on localhost?
	var webSocketServer;																		// Holds socket server	
	var games=[];																				// Holds games
	var outcomes=[];																			// Holds outcomes
	var thens=[];																				// Holds thens
	var numIfs=0;																				// Number of ifs

/* SOCKET SERVER  ////////////////////////////////////////////////////////////////////////////////////////////////////

node ws.js

 	forever logs | sudo cat /home/bitnami/.forever/<id>.log
	
	cd /opt/bitnami/wordpress/game
	forever stop ws.js 
	forever start ws.js

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

	constructor()   																				// CONSTRUCTOR
	{
		this.started=false;																				// Game started flag
		this.startTime=new Date().getTime()/1000;														// Get start time in seconds
		this.id=Math.floor(Math.random()*10000)+Math.floor(this.startTime);								// Set ID
		this.ifs=new Array(numIfs);																		// Clone outcomes
		this.outcomes=JSON.parse(JSON.stringify(outcomes));												// Outcomes active array
		this.thens=new Array(thens.length);																// Thens
		this.maxTime=45*60;																				// Max time in seconds
		this.players=[];																				// Holds player info
		this.stuPos=[0,0,5,2,1,0,0,5,2,1];																// Student track positions [ ...last, ...current]
		this.curPhase=0;																				// Phase
		this.curIf=-1;																					// No if condition yet
		this.winner=-1;																					// No winner yet
		this.curTime=0;																					// Current time used so far
		this.curSpeed=2;																				// Current speed
		this.time=(local ? 5 : 30)*1000;																// Base time in ms
		this.timer=null;																				// Phase timer
		this.numVotes=0;																				// Number of votes
		this.numPlayers=1;																				// Number of active players
		this.round=0;																					// First round
		this.outcome=0;																					// Outcome
	}

	StartNextPhase(v)																				// START NEXT PHASE
	{
		let time=0,op="NEXT|";
		this.curPhase++;																				// Inc phase
		if (this.curPhase == 1) {																		// START
			this.curIf=Math.floor(Math.random()*this.ifs.length);										// Set if with random number
			this.ifs.splice(this.curIf,1);																// Remove it
			this.numVotes=0;																			// No votes
			time=0; 																					// No interval needed
			op="START|";																				// Set op
			}
		else if (this.curPhase == 2)					 	time=this.time*this.curSpeed;				// DEAL
//		else if ((this.curPhase > 2) && (this.curPhase < this.players.length+3)) time=this.time;		// EXPLAIN
		if (time) {																						// If waiting
			clearInterval(this.timer);																	// Stop timer
			this.timer=setInterval( ()=>{																// Start timer 
				clearInterval(this.timer);																// Stop timer
				this.StartNextPhase(v);																	// Recurse			
				},time);
			}
	
		Broadcast(this.id,op+v[1]+"|"+v[2]); 															// Send message
	}

	PlayerIndex(name)																				// GET PLAYER'S INDEX FROM NAME
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

	try{
		LoadConfig();																			// Load config file
	
		setInterval(()=>{																		// PING PONG TIMER
			let i;
			for (i=0;i<games.length;++i) {														// For each game
				if (!games[i].numPlayers) 														// No players found
					games.splice(i,1);															// Kill game
				}	
			trace("CLIENTS & GAMES", webSocketServer.clients.size,games.length);
			for (i=0;i<games.length;++i) games[i].numPlayers=0;									// No players found yet	
			webSocketServer.clients.forEach((client)=>{											// For each client
				if (!client.isAlive) { client.terminate(); return; };							// Kill dead one
				client.isAlive=false;															// Set flag to not alive
				client.ping();																	// Ping client																		
				});
			}, 5000);																			// Every 5 seconds
	} catch(e) { console.log(e) }


try{
	webSocketServer.on('connection', (webSocket, req) => {										// ON CONNECTION
		let d=new Date();																		// Get UTC time
		d=new Date(d.getTime()+(-3600000*5));													// Get UTC-5 time	
		let ip=req.socket.remoteAddress.substring(7);											// Get client's IP
		webSocket.clientIp=ip ? ip.replace(/\./g,"-") : "0-0-0-0";								// Set ip
		let str=d.toLocaleDateString()+" -- "+d.toLocaleTimeString()+" -> "+webSocket.clientIp;	// Log connection
		console.log(`Connect: (${webSocketServer.clients.size}) ${str}`);						// Log connect

		webSocket.on("pong", () => { 															// ON PONG
			webSocket.isAlive=true; 															// It's alive
			let index=games.findIndex(x => x.id == webSocket.gameId);							// Find array index by id
			if (index != -1)	games[index].numPlayers++;										// Add to count
			});

		webSocket.on('message', (msg) => {														// ON MESSAGE
			let gs;
			webSocket.isAlive=true;																// It's live
			if (!msg)	return;																	// Quit if no message
			message=msg.toString();																// Get as string
			trace('In:', message);																// Log
			let v=message.split("|");															// Get params
			if (v[0] == "INIT") {																// INIT
				gs=FindGame();																	// Find open game or new one
				gs.players.push( {name:v[1]+"@"+webSocket.clientIp,picks:[]});					// Add player data
				webSocket.gameId=gs.id;															// Set game id
				webSocket.player=v[1];															// Set player name													
				Broadcast(webSocket.gameId,"INIT|"+webSocket.clientIp+"|"+v[2]); 				// Send INIT message
				}
			let index=games.findIndex(x => x.id == webSocket.gameId)							// Find array index by id
			if (index == -1) return;															// Quit if not found
				gs=games[index];																// Point at game data
			if (v[0] == "START") {	  															// START
				gs.curPhase=0;																	// Reset phase
				gs.started=true;																// Close game for new entrants
				gs.StartNextPhase(v);															// Start next phase	
				}					
				
			else if (v[0] == "DEAL") {															// DEAL
				gs.StartNextPhase(v);															// Start next phase	
				}
			else if (v[0] == "PICKS") {															// PICKS
				let pdex=gs.PlayerIndex(v[2]);													// Get index of player from name
				if (pdex != -1)	gs.players[pdex].picks=JSON.parse(v[3]);						// Record their picks
				Broadcast(webSocket.gameId, "PICKS|"+v[1]+"|"+v[2]); 							// Trigger players
				}	
			else if (v[0] == "WINNER") {														// WINNER
				let pdex=gs.PlayerIndex(v[2]);													// Get index of player from name
				if (pdex != -1)	gs.players[pdex].winner=JSON.parse(v[3]);						// Record their picks
				++gs.numVotes;																	// Add to count
				let numClients=0;																// Assume none
				webSocketServer.clients.forEach(()=>{ numClients++; })							// Count clients
				if (gs.numVotes >= Math.min(gs.players.length,numClients)) {					// All voters in 
					gs.winner=Vote(gs);															// Vote
					gs.curPhase++;																// Final phase
					gs.round++;																	// Advance round
					Advance(gs);																// Advance students	
					Broadcast(webSocket.gameId, "VOTED|"+v[1]+"|"+v[2]); 						// Trigger redraw
					}
				}
			});
		});
} catch(e) { console.log(e) }
	
	function Broadcast(gameId, msg)															// BROADCAST DATA TO ALL CLIENTS 
	{
		try{
			let index=games.findIndex(x => x.id == gameId)										// Find array index by id
			if (index == -1) return;															// Quit if not found
			let o=games[index];																	// Point at game data
			let data={ gameId:gameId, curPhase:o.curPhase, curIf:o.curIf, stuPos:o.stuPos, players:o.players, 
				       winner:o.winner, outcome:o.outcome, curSpeed:o.curSpeed, curTime:o.curTime };
			msg+=`|${JSON.stringify(data)}`;													// Add data
			webSocketServer.clients.forEach((client)=>{											// For each client
				if (client.gameId == gameId) 													// In this game
					if (client.readyState === WebSocket.OPEN) client.send(msg);					// Send to client
				});
			trace("Broadcast",msg);																// Show sent											
		} catch(e) { console.log(e) }
	}

	function FindGame()																		// FIND OPEN GAME OR CREATE ONE
	{	
		let i,gs=null;
		if (games.length)
		for (i=0;i<games.length;++i)															// For each game
			if ((games[i].players.length < 4) && !games[i].started) {							// If an unstarted < 4 player game
				gs=games[i];  																	// Point at it	
				break; 																			// Quit looking
				}											
		if (!gs) {																				// Nothing found		
			gs=new Game();																		// Alloc new game
			games.push(gs);																		// Add to games array
			trace("NEW GAME",games.length,gs.id);												// Log
			}
		return gs;																				// Return game pointer
	}
	
	function LoadConfig()																	// LOAD CONFIG.CSV FILE
	{
		let i,v;
		outcomes=[];																			// No outcomes yet
		thens=[];																				// No thens yet
		numIfs=0;																				// Assume no ifs
		let d=fs.readFileSync("data/config.csv","utf8").split("\n");							// Get config file
		for (i=0;i<d.length;++i) {																// For each line
			d[i]=d[i].replace(/\r/g,"");														// No CRs
			if (d[i].match(/^if/i))				numIfs++;										// Add to if count
			else if (d[i].match(/^then/i))	{													// Get then							
				v=d[i].match(/{.*}/)[0];														// Pull out time field
				v=v.replace(/'/g,'"');															// Apos to quotes
				thens.push(JSON.parse(v));														// Add then										
				}
			else if (d[i].match(/^outcome/i))  {												// Get outcome
				v=d[i].split(",");																// Get fields
				outcomes.push({ amt: v[1], msg:v[2]} );											// Add outcome										
				}
			}	
		}	
	
	function Vote(gs)																		// VOTE
	{
		let topdex=0,highest=0;
		let i,votes=[0,0,0,0,0,0,0,0,0];
		for (i=0;i<gs.players.length;++i) 														// For each player
			if (gs.players[i].winner != -1)	votes[gs.players[i].winner]++;						// Add to vote count
		for (i=0;i<gs.players.length;++i) 														// For each player
			if (votes[i] > highest) { highest=votes[i]; topdex=i; }								// Get top index	 
		return  topdex;																			// Return highest index
	}
	
	function Advance(gs)																	// ADVANCE STUDENT POSITIONS
	{
		let i,j,k,o;
		for (i=0;i<5;++i) gs.stuPos[i]=gs.stuPos[i+5];											// Copy current to last position
		if (gs.winner != -1) {																	// If a winner
			let cards=gs.players[gs.winner].picks;												// Get winning cards
			gs.outcome=getOutcome();															// Get progress amount
			for (i=0;i<cards.length;++i) {														// For each one											
				o=thens[cards[i]];																// Point at cad
				gs.curTime+=o.time*60;															// Remove time (in minutes)
				for (j=0;j<o.students.length;++j) {												// For each student, progress accoring to rule
					k=o.students[j]-1;															// Student index (0-4)
					gs.stuPos[k+5]+=(outcomes[gs.outcome].amt-0);								// Advance now portion of index
					}
				}``
					
		function getOutcome() {																	// PROGRESS STUDENT BASED ON RULE
			let i,r,v=[];
			if (gs.round < 3)	r=Math.floor(Math.random()*2)+1;								// First 2 rounds are always +1 or +2
			else				r=Math.floor(Math.random()*4)-1;								// -1 to +2
			for (i=0;i<gs.outcomes.length;++i)													// Get all outcomes that match
				if (gs.outcomes[i].amt == r) v.push(i);											// Add to array
			r=Math.floor(Math.random()*v.length);												// Get random outcome
			if (v[r] > 3)	gs.outcomes[v[r]].amt=100;											// Remove it from picking again
			return v[r];																		// Return outcome index 
			}
		}
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

