var graph = require('./graph.json');

// map between node/trigger's name and object contains the metadata 
// ex.
//  {
//      interface: MP_LED, MP_Button, ...
//      device_id: DEV_1, ...
//      libname: MP_LSM303, ...
//      pin: 3, ...
//  }
var data = new Map();

// loop through node and edge and put every interface use into a map
var actions = require('./action.json');
var nodes = graph['nodes'];
for (var nodeId of Object.keys(graph['nodes'])) {
    var node = nodes[nodeId];
    var name = node['params']['name'][0];
    if (!data.has(name)) {
        data.set(name, {interface: "..."});
    }
}
var triggers = require('./trigger.json');
var edges = graph['edges'];
for (var edgeId of Object.keys(graph['edges'])) {
    var edge = edges[edgeId];
    for (var trigger of edge['trigger']) {
        var name = trigger['params']['name'][0];
        if (!data.has(name)) {
            data.set(name, {interface: "..."});
        }
    }
}

for (var [key, value] of data) {
    console.log(key, value);
}

var interface = require('./interface.json');

// update device_id and libname into data
for (var value of data.values()) {

}

var device = require('./device.json');

// assign pin
var gpio = ['2', '4', '7', '8', '12', '13'];
var pwm = ['3', '5', '6', '9', '10', '11'];
var analog = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
for (var value of data.values()) {
    if (value )
}

// var fn = 'hello';
// var ts = `test template string ${fn}`;
// console.log(ts);

// var code = [];
// code.push("#include<stdio.h>", "int main()");
// console.log(code.join("\n"));
