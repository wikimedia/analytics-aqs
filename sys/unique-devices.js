'use strict';

/**
 * Unique devices API module
 *
 * This API serves pre-aggregated unique devices statistics from Cassandra
 */

var HyperSwitch = require('hyperswitch');
var path = require('path');
var HTTPError = HyperSwitch.HTTPError;
var URI = HyperSwitch.URI;

var aqsUtil = require('../lib/aqsUtil');

var spec = HyperSwitch.utils.loadSpec(path.join(__dirname, 'unique-devices.yaml'));

// Unique devices Service
function UDVS(options) {
    this.options = options;
}


var tables = {
    project: 'unique.devices',
};
var tableURI = function(domain, tableName) {
    return new URI([domain, 'sys', 'table', tableName, '']);
};
var tableSchemas = {
    project: {
        table: tables.project,
        version: 1,
        attributes: {
            project: 'string',
            'access-site': 'string',
            granularity: 'string',
            // the hourly timestamp will be stored as YYYYMMDDHH
            timestamp: 'string',
            devices: 'long'
        },
        index: [
            { attribute: 'project', type: 'hash' },
            { attribute: 'access-site', type: 'hash' },
            { attribute: 'granularity', type: 'hash' },
            { attribute: 'timestamp', type: 'range', order: 'asc' },
        ]
    }
};


UDVS.prototype.uniqueDevices = function(hyper, req) {
    var rp = req.params;

    // dates are passed in as YYYYMMDD but we need the HH to be validated using
    // our generic data validator, so we pass "fakeHour"
    aqsUtil.validateStartAndEnd(rp, { fakeHour: true });

    var dataRequest = hyper.get({
        uri: tableURI(rp.domain, tables.project),
        body: {
            table: tables.project,
            attributes: {
                project: rp.project,
                'access-site': rp['access-site'],
                granularity: rp.granularity,
                timestamp: { between: [rp.start, rp.end] },
            }
        }

    }).catch(aqsUtil.notFoundCatcher);

    // Parse long from string to int
    return dataRequest.then(aqsUtil.normalizeResponse).then(function(res) {
        if (res.body.items) {
            res.body.items.forEach(function(item) {
                if (item.devices !== null) {
                    try {
                        item.devices = parseInt(item.devices, 10);
                    } catch (e) {
                        item.devices = null;
                    }
                }
            });
        }
        return res;
    });

};

module.exports = function(options) {
    var udvs = new UDVS(options);

    return {
        spec: spec,
        operations: {
            uniqueDevices: udvs.uniqueDevices.bind(udvs)
        },
        resources: [
            {
                // unique devices per project table
                uri: '/{domain}/sys/table/' + tables.project,
                body: tableSchemas.project,
            }
        ]
    };
};
