'use strict';

/**
 * Pageviews API module
 *
 * This API serves pre-aggregated pageview statistics from Cassandra
 */

const HyperSwitch = require('hyperswitch');
const path = require('path');
const URI = HyperSwitch.URI;

const aqsUtil = require('../lib/aqsUtil');

const spec = HyperSwitch.utils.loadSpec(path.join(__dirname, 'knowledge-gap.yaml'));


// Knowledge Gap Services
function KGS(options) {
    this.options = options;
}

function tableURI(domain, tableName) {
    return new URI([domain, 'sys', 'table', tableName, '']);
}

const tables = {
    knowledgeGapByCategory: 'knowledge.gap.by.category',
};

const tableSchemas = {
    // We're reading from the knowledge gaps metrics table. Check it out in the link below
    // Check out the knowledge_gap.content_gap_metrics in https://datahub.wikimedia.org
    knowledgeGapByCategory: {
        table: tables.knowledgeGapByCategory,
        version: 0,
        attributes: {
            dt: 'string', // YYYYMM01
            project: 'string',
            content_gap: 'string',
            category: 'string',
            metric: 'string',
            value: 'int',
        },
        index: [
            { attribute: 'project', type: 'hash' },
            { attribute: 'content_gap', type: 'hash' },
            { attribute: 'category', type: 'hash' },
            // { attribute: 'metric', type: 'hash' },
            { attribute: 'dt', type: 'range', order: 'asc' },
        ]
    },
};


KGS.prototype.contentGapForCategories = function(hyper, req) {
    const rp = req.params;
    const project = aqsUtil.normalizeProject(rp.project);

    aqsUtil.validateStartAndEnd(rp, {
        fakeHour: true,
        zeroHour: true,
    });


    const dataRequest = hyper.get({
        uri: tableURI(rp.domain, tables.knowledgeGapByCategory),
        body: {
            table: tables.knowledgeGapByCategory,
            attributes: {
                project,
                content_gap: rp.content_gap,
                category: rp.category,
                dt: { between: [rp.start, rp.end] }
            }
        }
    }).catch(aqsUtil.notFoundCatcher);


    return dataRequest.then(aqsUtil.normalizeResponse);
};


module.exports = function(options) {
    const kgs = new KGS(options);

    return {
        spec,
        operations: {
            contentGapForCategories: kgs.contentGapForCategories.bind(kgs),
        },
        resources: [
            {
                uri: `/{domain}/sys/table/${tables.knowledgeGapByCategory}`,
                body: tableSchemas.knowledgeGapByCategory,
            },
        ]
    };
};
