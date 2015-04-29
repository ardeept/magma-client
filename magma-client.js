(function() {
	"use strict";

	var MagmaClient = function(config) {

		var self 			= this;
		var ws 				= require("nodejs-websocket");

		self.connected 		= false;

		self.msg_queue 		= [];

		self.debug_mode 	= true;

		self.logger 		= console;


		self.stats 		 	 = {
			sent 	: 0,
			error 	: 0
		};

		self.connect_delay  = 1000;

		self.init = function()
		{
		
			self.connect();
		}

		self.connect = function()
		{
			self.connection = ws.connect(config.magma_server,{}, function(){
				self.connected = true;
			});

			self.connection.on('connect', function(){
				self.connected = true;
			});

			self.connection.on('error', function(code, reason){
				self.log("debug", "connection not availble", code, reason);				
			});

			self.connection.on('close', function(code, reason){

				self.log("debug", "connection closed", code, reason);

				self.connected = false;

				// retry connection

				setTimeout(self.connect, self.connect_delay*=2);
			});

		}

		self.publish = function(msg)
		{
			self.log("debug", "sending", msg);

			if(self.connected == true)
			{
				self.connection.sendText(JSON.stringify(msg), function(err){

					self.log("debug", err);

					if(err)
					{
						self.stats.error++;

						// resend?
						self.log("warning", "error encountered" ,"resending");

						self.msg_queue.push(msg);
					}
					else
					{
						self.stats.sent++;
					}
						
				});

			}
			else
			{
				self.log("warning", "disconnected");

				// defer sending
				self.msg_queue.push(msg);
			}
		}

		self.resend_failed_publish = function()
		{
			var c = self.msg_queue;

			self.msg_queue = [];

			for(var i = 0 ; i < c.length; i++)
			{
				self.publish(c[i]);
			}
		}

		self.log = function(type, message)
		{
			var more = Array.prototype.slice.call(arguments, 2);

			if(more.length > 0) {
				for(var i in more) {
					message = message + " " + JSON.stringify(more[i]);
				}

			}

			if(type == 'debug' && self.debug_mode == true)
			{
				self.logger.log(type, message);
			}
			else if(type == 'debug' && self.debug_mode == false)
			{
				// self.logger.log(type, message);	 // do nothing
			}
			else
			{
				self.logger.log(type, message);		
			}
		}

		setInterval(self.resend_failed_publish, 10000);

		self.init();
	};

	module.exports = MagmaClient;
})();