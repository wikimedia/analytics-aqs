'use strict';

/**
 * Pagecounts API Module (legacy)
 *
 * This API serves pre-aggregated pagecounts statistics.
 * Read more about those metrics on:
 * https://wikitech.wikimedia.org/wiki/Analytics/Data/Pagecounts-raw
 */

const HyperSwitch = require('hyperswitch');
const path = require('path');
const URI = HyperSwitch.URI;

const aqsUtil = require('../../lib/aqsUtil');

const spec = HyperSwitch.utils.loadSpec(path.join(__dirname, 'pagecounts.yaml'));

// Pagecounts service
function LPCS(options) {
    this.options = options;
}

function tableURI(domain, tableName) {
    return new URI([domain, 'sys', 'table', tableName, '']);
}

const tables = {
    project: 'lgc.pagecounts.per.project'
};
const tableSchemas = {
    project: {
        table: tables.project,
        version: 1,
        attributes: {
            project: 'string',
            'access-site': 'string',
            granularity: 'string',
            timestamp: 'string',
            count: 'long'
        },
        index: [
            { attribute: 'project', type: 'hash' },
            { attribute: 'access-site', type: 'hash' },
            { attribute: 'granularity', type: 'hash' },
            { attribute: 'timestamp', type: 'range', order: 'asc' }
        ]
    }
};

LPCS.prototype.pagecountsPerProject = function(hyper, req) {
    const rp = req.params;

    aqsUtil.validateStartAndEnd(rp, {
        zeroHour: rp.granularity !== 'hourly',
        fullMonths: rp.granularity === 'monthly'
    });

    const dataRequest = hyper.get({
        uri: tableURI(rp.domain, tables.project),
        body: {
            table: tables.project,
            attributes: {
                project: rp.project,
                'access-site': rp['access-site'],
                granularity: rp.granularity,
                timestamp: { between: [rp.start, rp.end] }
            }
        }
    }).catch(aqsUtil.notFoundCatcher);

    // Parse long from string to int
    return dataRequest.then(aqsUtil.normalizeResponse).then((res) => {
        if (res.body.items) {
            res.body.items.forEach((item) => {
                if (item.count !== null) {
                    try {
                        item.count = parseInt(item.count, 10);
                    } catch (e) {
                        item.count = null;
                    }
                }
            });
        }
        return res;
    });

};

module.exports = function(options) {
    const lpcs = new LPCS(options);

    return {
        spec,
        operations: {
            pagecountsPerProject: lpcs.pagecountsPerProject.bind(lpcs)
        },
        resources: [
            {
                uri: `/{domain}/sys/table/${tables.project}`,
                body: tableSchemas.project
            }
        ]
    };
};
