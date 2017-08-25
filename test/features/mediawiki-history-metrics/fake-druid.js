'use strict';

/*
  Test utility faking a druid cluster.
  Check received query against known ones using fixtures files
  and sends data or error back.
*/

var HyperSwitch = require('hyperswitch');
var path = require('path');
var assert = require('../../utils/assert.js');
var fixtures = require('./fixtures.js');


var spec = HyperSwitch.utils.loadSpec(path.join(__dirname, 'fake-druid.yaml'));

// FakeDruid service
function FDS(options) {
    this.options = options;
}

FDS.prototype.query = function(hyper, req) {
    var body = req.body;

    // Uncomment to print druid requests and
    // copy/paste them against a real cluster
    // Don't forget to change the datasource :)
    /*
    console.log('************Test for real druid: ****************');
    console.log(JSON.stringify(body));
    console.log('*************************************************');
    */


    var foundValue = fixtures.values.filter(value => {
        return assert.isDeepEqual(body, value.expectedDruidQuery)
    });

    if (foundValue.length === 1) {
        return foundValue[0].druidResult;
    } else {
        console.error('fake_druid couldn\'t find an expected matching druid query:\n' +
                'Received: ' + JSON.stringify(body));
        return { status: 404 };
    }
};

module.exports = function(options) {
    var fds = new FDS(options);

    return {
        spec: spec,
        operations: {
            query: fds.query.bind(fds)
        }
    };
};
