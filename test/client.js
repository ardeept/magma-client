var magmaClient = require('../magma-client');

var config = {
	magma_server 		: "ws://localhost:8001",
	microservice_code	: "IH",
	node_code         	: "IH-10.0.0.2",
	// debug_mode 			: true
};

var mc = new magmaClient(config);


mc.publish({ value: 1, metric_code: 'total_request'});
// mc.publish({ value: 1, metric_code: 'inbound_throughput'});

mc.publish([{ value: 1, metric_code: 'total_request'}, { value: 1, metric_code: 'throughput'}]);

mc.publish_err({ error: "cant connect", send_alert:true });
mc.publish_err({ error: "cant connect", send_alert:true });
mc.publish_err({ error: "cant connect", send_alert:true });
mc.publish_err({ error: "cant connect", send_alert:true });
mc.publish_err({ error: "cant connect", send_alert:true });
mc.publish_err({ error: "cant connect", send_alert:true });
mc.publish_err({ error: "cant connect", send_alert:true });


// after 2 seconds, send another 3 errors
setTimeout(function(){
	mc.publish_err({ error: "cant connect", send_alert:true });
	mc.publish_err({ error: "cant connect", send_alert:true });
	mc.publish_err({ error: "cant connect", send_alert:true });
},2000);


for(var i = 0; i< 100; i++)
{
	mc.publish({ value: 1, metric_code: 'total_request'});
}