'use strict';

/**
 * Legacy Pageviews API Module
 *
 * This API serves pre-aggregated legacy pageview statistics from Cassandra.
 * Read more about legacy pageviews (not the same metric as pageviews) on:
 * https://wikitech.wikimedia.org/wiki/Analytics/LegacyPageviewAPI
 */

var HyperSwitch = require('hyperswitch');
var path = require('path');
var URI = HyperSwitch.URI;

var aqsUtil = require('../lib/aqsUtil');

var spec = HyperSwitch.utils.loadSpec(path.join(__dirname, 'legacy-pageviews.yaml'));

// Legacy pageviews service
function LPVS(options) {
    this.options = options;
}

var tables = {
    project: 'lgc.pageviews.per.project'
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
            timestamp: 'string',
            views: 'long'
        },
        index: [
            { attribute: 'project', type: 'hash' },
            { attribute: 'access-site', type: 'hash' },
            { attribute: 'granularity', type: 'hash' },
            { attribute: 'timestamp', type: 'range', order: 'asc' }
        ]
    }
};

LPVS.prototype.legacyPageviewsPerProject = function(hyper, req) {
    var rp = req.params;

    aqsUtil.validateStartAndEnd(rp, {
        zeroHour: rp.granularity !== 'hourly',
        fullMonths: rp.granularity === 'monthly'
    });

    var dataRequest = hyper.get({
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
    return dataRequest.then(aqsUtil.normalizeResponse).then(function(res) {
        if (res.body.items) {
            res.body.items.forEach(function(item) {
                if (item.views !== null) {
                    try {
                        item.views = parseInt(item.views, 10);
                    } catch (e) {
                        item.views = null;
                    }
                }
            });
        }
        return res;
    });

};

module.exports = function(options) {
    var lpvs = new LPVS(options);

    return {
        spec: spec,
        operations: {
            legacyPageviewsPerProject: lpvs.legacyPageviewsPerProject.bind(lpvs)
        },
        resources: [
            {
                uri: '/{domain}/sys/table/' + tables.project,
                body: tableSchemas.project
            }
        ]
    };
};
