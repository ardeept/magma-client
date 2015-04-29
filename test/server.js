var ws = require("nodejs-websocket")
 
// Scream server example: "hi" -> "HI!!!" 
var server = ws.createServer(function (conn) {


	// new connectio nhas been made

    conn.on("text", function (msg) {

    	msg = JSON.parse(msg);

        console.log("Received ",msg)
        // conn.sendText(str.toUpperCase()+"!!!")

        // let's check what message type this is
        if(msg.type == 'register')
        {	
        	// connection
        	// let's register let's register this

        	console.log("register request received");

        	// call the attachNode api

            // let's simulate and answer
            conn.sendText(JSON.stringify({ type: 'registered'}));
        }
        else if(msg.type == 'stat')
        {
        	// trying to send stats now so what to do

        	// call the addNodeStats
        	console.log("stats received");
        }

    })
    conn.on("close", function (code, reason) {
        console.log("Connection closed")
    })
}).listen(8001);

