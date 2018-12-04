'use strict';

/**
 * Unique devices API module
 *
 * This API serves pre-aggregated unique devices statistics from Cassandra
 */

const HyperSwitch = require('hyperswitch');
const path = require('path');
const URI = HyperSwitch.URI;

const aqsUtil = require('../lib/aqsUtil');

const spec = HyperSwitch.utils.loadSpec(path.join(__dirname, 'unique-devices.yaml'));

// Unique devices Service
function UDVS(options) {
    this.options = options;
}

function tableURI(domain, tableName) {
    return new URI([domain, 'sys', 'table', tableName, '']);
}

const tables = {
    project: 'unique.devices',
};

const tableSchemas = {
    project: {
        table: tables.project,
        version: 2,
        attributes: {
            project: 'string',
            'access-site': 'string',
            granularity: 'string',
            // the hourly timestamp will be stored as YYYYMMDDHH
            timestamp: 'string',
            devices: 'long',
            offset: 'long',
            underestimate: 'long'
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
    const rp = req.params;

    aqsUtil.validateStartAndEnd(rp, {
        // YYYYMMDD dates are allowed, but need an hour to pass validation
        fakeHour: true,
        // YYYYMMDDHH dates are also allowed, but the hour should be stripped
        // to match how cassandra stores records
        stripHour: true,
    });

    const dataRequest = hyper.get({
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
    return dataRequest.then(aqsUtil.normalizeResponse).then((res) => {
        const uniquesNumericValues = ["devices", "underestimate", "offset"];
        if (res.body.items) {
            res.body.items.forEach((item) => {
                uniquesNumericValues.forEach((numericValue) => {
                    if (item[numericValue] !== null) {
                        try {
                            item[numericValue] = parseInt(item[numericValue], 10);
                        } catch (e) {
                            item[numericValue] = null;
                        }
                    }
                });
            });
        }
        return res;
    });

};

module.exports = function(options) {
    const udvs = new UDVS(options);

    return {
        spec,
        operations: {
            uniqueDevices: udvs.uniqueDevices.bind(udvs)
        },
        resources: [
            {
                // unique devices per project table
                uri: `/{domain}/sys/table/${tables.project}`,
                body: tableSchemas.project,
            }
        ]
    };
};
