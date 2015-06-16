(function() {
	"use strict";

	var MagmaClient = function(config) {


		var self 			= this;

		var util 			= require('util');
		// if no config, don't do anything

		/* sample config

			config = {
				magma_server 		: "ws://localhost:8001",
				microservice_code	: "IH",
				node_code         	: "AHIN10.0.0.2"
			}
		*/

		/* 
			if there is no config 
				let the client access "publish" method but do nothing
				let the client access "publish_err" method  but do nothing

		*/
		if(!config) 
		{
			console.log("MAGMA config not found");
			return {
				publish : function()
				{
					console.log("magmaClient cannot publish");
				},
				publish_err : function()
				{
					console.log("magmaClient cannot publish_err");
				}
			};
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

		// storage of transactions for publishing
		self.queue 			= {};

		// how many second before resending the queued transactions
		self.resend_time    = 1000;




		/* DELAY control*/

		// this is the current delay of re-trying after the initial failure
		self.delay 			= 1000;

		// current delay
		self.delay_current 	= 1000;

		// after the succeeding failure, self.delay will be multiplied to this
		self.delay_factor	= 2;


		// store the current disconnection count
		self.disconnected_count = 0;

		self.init = function()
		{
			self.connect();

			/*
				let's run the resending function if defer_sending is enabled
			*/
			if(self.retry_sending)
				setInterval(self.resend_failed_publish, self.resend_time);

			/*
				let's start publishing
			*/


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

				// after connection, let's publish
				self.publishing = setTimeout(self._publish_aggregated, 1000);
			});

			self.connection.on('error', function(code, reason){
				self.log("debug", "connection not availble", code, reason);				
			});

			self.connection.on('text', self.read_text);

			self.connection.on('close', function(code, reason){

				self.log("info", "connection closed", code, reason);

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
				self.log("info","registered", msg);
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

			if(util.isArray(msg) == true)
			{
				// msg.type = 'stats';

				// msg = {
				// 	type : 'stats',
				// 	data : msg,
				// }

				// dismantle the array

				_.each(msg, function(v, k){
					v.type = 'stat';

					if(!v.value)
						v.value = 1;

					self.add_message(v);
				});

			}
			else
			{
				msg.type = 'stat';
				
				if(!msg.value)
					msg.value = 1;

				self.add_message(msg);
			}

			// let's not publish it, let's just add it to the queue
			// self._publish(msg);
			
			
		}


		/*
			add_message will do the following

				1. check if the message has already an enrty in the main message queue
				2. If the message exists
					if(metric)
						add msg.value to value
					if(err)
						add 1 to count



		*/
		self.add_message = function(msg)
		{
			if(msg.type == 'stat')
			{
				var key = 'metric_code';

				if(self.queue[msg[key]])
				{
					// key exists
					
					// metric type is replace
					if(msg.replace_value == true)
						self.queue[msg[key]].value += msg.value;
					else
						self.queue[msg[key]].value = msg.value;
				}
				else
				{
					// doesn't exists, let's add it
					// add default values
					self.queue[msg[key]] = _.extend(msg, self.message_default);
				}
			}
			else if(msg.type == 'error')
			{
				var key = 'name';

				if(self.queue[msg[key]])
				{
					// key exists
					// so just append the value
					self.queue[msg[key]].count += 1;
				}
				else
				{
					// doesn't exists, let's add it
					// add default values
					msg.count = 1;
					self.queue[msg[key]] = _.extend(msg, self.message_default);
				}
			}
			else
			{
				// unsupported add_messagse call
				console.log("Unsupported [add_message]", msg.type);
			}
		}


		/*

		*/
		self._publish_aggregated = function()
		{
			// now let's send the aggregated data
			if(self.connected == true)
			{
				// convert self.queue to array only
				var queue_arr = _.values(self.queue);


				if(queue_arr.length)
				{
					self.log("info","sending messages:", queue_arr.length);

					self.connection.sendText(JSON.stringify(queue_arr), function(err){

						self.disconnected_count = 0;

						if(err)
						{

							self.log("debug", err);

							self.stats.error++;

							// run again
							setTimeout(self._publish_aggregated, self.get_delay(true));
						}
						else
						{
							self.log("debug", "no error");


							// clear the array
							self.queue = {};

							// run again
							setTimeout(self._publish_aggregated, self.get_delay());
						}
							
					});
				}
				else
				{
					// nothing to send
					self.log("debug","no message to send");
					setTimeout(self._publish_aggregated, self.get_delay());
				}
			}
			else
			{
				self.log("warning", "disconnected count:", self.disconnected_count++);
			}
		}


		self.get_delay = function(err)
		{
			if(err)
			{
				// delay must increase 
				self.delay_current *= self.delay_factor;
				
				self.log("info", "delay:", self.delay_current);
			}	
			else
			{
				// no error
				// reset it
				self.delay_current = self.delay;
			}

			return self.delay_current;
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
				if(self.retry_sending == true && msg.send_retries < 3)
				{
					/* RETRY control */
					if(msg.send_retries)
						msg.send_retries++;
					else
						msg.send_retries = 1;

					self.msg_queue.push(msg);
				}
			}
		}

		/*
			send an error to magmaServer
		*/
		self.publish_err = function(msg)
		{
			self.log("debug", "publish_err", msg);

			msg.type = 'error';

			// self._publish(msg);
			self.add_message(msg);
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

			message = "magmaclient " + message;
			

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