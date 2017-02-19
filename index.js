var actions = require('./action.json');
var triggers = require('./trigger.json');
var interfaces = require('./interface.json');
var devices = require('./device.json');

const INDENT_CHAR = '\t';
const INDENT_CHAR2 = '\t\t';
const INDENT_CHAR3 = '\t\t\t';

function findActionById(id) {
    for (var category of actions) {
        for (var action of category['children']) {
            if (action['id'] === id)
                return action;
        }
    }
    return undefined;
}

function findTriggerById(id) {
    for (var category of triggers) {
        for (var trigger of category['children']) {
            if (trigger['id'] === id)
                return trigger;
        }
    }
    return undefined;
}

function findEdgeBySrcNode(graph, nodeId) {
    var result = [];
    for (var edgeId of Object.keys(graph['edges'])){
        var edge = graph['edges'][edgeId];
        if (edge['src_node_id'] == nodeId) {
            result.push(edge);
        }
    }
    return result;
}

function findDeviceById(id) {
    for (var device of devices) {
        if (device['id'] === id) {
            return device;
        }
    }
    return undefined;
}

function generateCode(graph) {
    // map between node/trigger's name and object contains the metadata 
    // ex.
    //  {
    //      interface: MP_LED, MP_Button, ...
    //      device_id: DEV_1, ...
    //      lib_name: MP_LSM303, ...
    //      lib_path: Magnetometer/MP_LSM303.h, ...
    //      pin: 3, ...
    //  }
    var data = new Map();

    // loop through node and edge and put every interface use into a map
    for (var nodeId of Object.keys(graph['nodes'])) {
        var node = graph['nodes'][nodeId];
        var name = node['params']['name'][0];
        if (!data.has(name)) {
            var action = findActionById(node['action_id']);
            if (action === undefined) {
                throw 'Error: unknown action id => ' + node['action_id'];
            }
            data.set(name.replace(' ', '_'), {interface: action['compatibility']['interface']});
        }
    }
    for (var edgeId of Object.keys(graph['edges'])) {
        var edges = graph['edges'][edgeId];
        for (var trigger of edges['trigger']) {
            var name = trigger['params']['name'][0];
            if (!data.has(name)) {
                var triggerInfo = findTriggerById(trigger['id']);
                if (triggerInfo === undefined) {
                    throw 'Error: unknown trigger id => ' + trigger['id'];
                }
                data.set(name.replace(' ', '_'), { interface: triggerInfo['compatibility']['interface'] });
            }
        }
    }

    // update device_id and libname into data
    for (var value of data.values()) {
        //var mp_interface = findInterfaceByName();
        var mp_interface = interfaces[value['interface']][0];   // TODO: Hardcoded
        if (mp_interface === undefined) {
            throw 'Error: unknown interface name => ' + value['interface'];
        }
        value['lib_name'] = mp_interface['lib_name'];
        value['lib_path'] = mp_interface['lib_path'];
        value['device_id'] = mp_interface['device_id'];
    }

    // assign pin
    var gpio = ['2', '4', '7', '8', '12', '13'];
    var pwm = ['3', '5', '6', '9', '10', '11'];
    var analog = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
    for (var value of data.values()) {
        var device = findDeviceById(value['device_id']);
        if (device === undefined) {
            throw 'Error: unknown interface name => ' + value['interface'];
        }
        if (device['connectivity'] === 'GPIO') {
            value['pin'] = gpio.shift();
        } else if (device['connectivity'] === 'PWM') {
            value['pin'] = pwm.shift();
        } else if (device['connectivity'] === 'Analog') {
            value['pin'] = analog.shift();
        } else {
            value['pin'] = '';
        }
    }

    console.log('DEBUG\n=====')
    for (var [key, value] of data) {
        console.log(key, value);
    }
    console.log();

    var code = [];
    
    // generate header section
    for (var value of data.values()) {
        code.push('#include "' + value['lib_path'] + '"');
    }
    code.push('');

    // instantiate object
    for (var [key, value] of data) {
        code.push(value['lib_name'] + ' ' + key + ';');
    }
    code.push('');

    // instantiate state fn
    code.push('void (*currentState)(void);\n');
    for (var nodeId of Object.keys(graph['nodes'])) {
        var node = graph['nodes'][nodeId];
        var name = node['params']['name'][0];
        var action = findActionById(node['action_id']);

        // check if there is any trigger connect to this node, 
        // if there isn't any we skip this node
        var edges = findEdgeBySrcNode(graph, nodeId);
        if (edges.length === 0)
            continue;

        // function definition
        code.push('void ' + nodeId + '() {');
        // get all parameter of node's 
        var arg = [];
        for (var paramName of Object.keys(node['params'])) {
            if (paramName !== 'name') {
                for (var paramValue of node['params'][paramName]) {
                    if (isNaN(paramValue))
                        arg.push('"' + paramValue + '"');
                    else
                        arg.push(paramValue);
                }
            }
        }
        // call fn associate with node's action
        code.push(INDENT_CHAR + name.replace(' ', '_') + '.' + action['compatibility']['fn_name']
                 + '(' + arg.join(",") + ');');
        code.push();
        // check a condition and goto next node
        code.push(INDENT_CHAR + 'while (1) {');
        for (var edge of edges) {
            // every condition of this edge will be put into this list and 
            // later transform into an if statement
            var condition = []
            for (var trigger of edge['trigger']) {
                var triggerInfo = findTriggerById(trigger['id']);
                var arg = [];
                for (var paramName of Object.keys(trigger['params'])) {
                    if (paramName !== 'name') {
                        for (var paramValue of trigger['params'][paramName]) {
                            if (isNaN(paramValue))
                                arg.push('"' + paramValue + '"');
                            else
                                arg.push(paramValue);
                        }
                    }
                }
                condition.push(trigger['params']['name'][0].replace(' ', '_') 
                            + '.' + triggerInfo['compatibility']['fn_name']
                            + '(' + arg.join(",") + ')');
            }
            code.push(INDENT_CHAR2 + 'if (' + condition.join(' && ') + ') {');
            // assign value to the function pointer to proceed to next node
            code.push(INDENT_CHAR3 + 'currentState = ' + edge['dst_node_id'] + ';');
            code.push(INDENT_CHAR3 + 'return;');
            code.push(INDENT_CHAR2 + '}');
        }
        code.push(INDENT_CHAR + '}');
        // end of function
        code.push('}');
        code.push();
    }

    // generate void setup()
    code.push('void setup() {');
    for (var key of data.keys()) {
        code.push(INDENT_CHAR + key + '.init();');
    }
    code.push(INDENT_CHAR + 'currentState = ')
    code.push('}');
    code.push();
    
    // generate void loop()
    code.push('void loop() {');
    code.push(INDENT_CHAR + 'currentState();');
    code.push('}');
    code.push();
    
    console.log('CODE\n====')
    console.log(code.join("\n"));
}

var graph = require('./graph.json');
generateCode(graph);