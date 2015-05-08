(function() {
	"use strict";

	var MagmaClient = function(config) {


		var self 			= this;
		// if no config, don't do anything

		/* sample config

			config = {
				magma_server 		: "ws://localhost:8001",
				microservice_code	: "IH",
				node_code         	: "AHIN10.0.0.2"
			}
		*/

		if(!config) 
		{
			console.log("MAGMA config not found");
			return false;
		}

		var ws 				= require("nodejs-websocket");
		var _ 				= require("lodash");

		self.connected 		= false;

		self.debug_mode 	= config.debug_mode || false;

		self.logger 		= console;

		// this is internal stats of the magmaclient
		self.stats 		 	 = {
			sent 	: 0,
			error 	: 0
		};

		// how many seconds before we try to reconnect
		self.connect_delay  	 = 1000;
		self.connect_delay_orig  = self.connect_delay;

		// this are the parameters that will be automatically added in the transactions
		self.message_default = {
			microservice_code	: config.microservice_code,
			node_code         	: config.node_code,
		};

		// if this is set to true, failed transactions will be added to the retry queue
		self.retry_sending  = config.retry_sending || false;

		// data store of the failed transactions
		self.msg_queue 		= [];

		// how many second before resending the queued transactions
		self.resend_time    = 1000;

		self.init = function()
		{
			self.connect();

			/*
				let's run the resending function if defer_sending is enabled
			*/
			if(self.retry_sending)
				setInterval(self.resend_failed_publish, self.resend_time);
		}

		self.connect = function()
		{
			/*
				initiate connection to magmaServer
			*/
			self.connection = ws.connect(config.magma_server,{}, function(){
				
				// once connected, let's register the node
				self.register();

			});

			/*
				event listeneres
			*/
			self.connection.on('connect', function(){
				self.connected = true;
				self.log("debug", "connection established");

				self.connect_delay = self.connect_delay_orig;
			});

			self.connection.on('error', function(code, reason){
				self.log("debug", "connection not availble", code, reason);				
			});

			self.connection.on('text', self.read_text);

			self.connection.on('close', function(code, reason){

				self.log("debug", "connection closed", code, reason);

				self.connected = false;

				// retry connection

				setTimeout(self.connect, self.connect_delay*=2);
			});
		}

		/*
			initialize magmaClient registration to magmaServer
		*/
		self.register = function()
		{
			var msg = {
				type: "register"
			};

			self._publish(msg, true);
		}

		/*
			read messages from magmaServer
		*/
		self.read_text = function(msg)
		{
			msg = JSON.parse(msg);
			// let's read the response from the server

			if(msg.type == 'err')
			{
				// why
				self.log("error","Error msg from server", msg);
			}
			else if(msg.type == 'registered')
			{
				self.log("info","magmaClient - registered", msg);
				// we can now start publishing

				self.connected = true;
			}
			else
			{
				self.log("info","Unsupported msg.type sent", msg);
			}
		}

		/*
			send messages to magmaServer
		*/
		self.publish = function(msg)
		{
			self.log("debug", "sending", msg);

			msg.type = 'stats';

			self._publish(msg);
		}

		self._publish = function(msg, force_send)
		{
			if(self.connected == true || force_send)
			{
				self.connection.sendText(JSON.stringify(_.extend(msg, self.message_default) ), function(err){

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
				if(self.retry_sending == true)
					self.msg_queue.push(msg);
			}
		}

		/*
			send an error to magmaServer
		*/
		self.publish_err = function(msg)
		{
			self.log("debug", "publish_err", msg);

			msg.type = 'error';

			self._publish(msg);
		}

		/*
			resend messages to magmaServer
		*/
		self.resend_failed_publish = function()
		{
			var c = self.msg_queue;

			self.msg_queue = [];

			for(var i = 0 ; i < c.length; i++)
			{
				self._publish(c[i]);
			}
		}

		/*
			logging function
		*/
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

		/*
			logging function
		*/


			

		self.init();
	};

	module.exports = MagmaClient;
})();