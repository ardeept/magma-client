var magmaClient = require('../magma-client');

var config = {
	magma_server 		: "ws://localhost:8001",
	microservice_code	: "IH",
	node_code         	: "AHIN10.0.0.2"
};

var mc = new magmaClient(config);

mc.publish({ value: 1});