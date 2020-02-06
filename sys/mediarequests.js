'use strict';

/**
 * Mediarequests API module
 *
 * This API serves pre-aggregated mediarequests statistics from Cassandra
 */

const HyperSwitch = require('hyperswitch');
const path = require('path');
const URI = HyperSwitch.URI;

const aqsUtil = require('../lib/aqsUtil');

const spec = HyperSwitch.utils.loadSpec(path.join(__dirname, 'mediarequests.yaml'));

const MONTHLY = 'monthly';
const DAILY = 'daily';

const AGENT_TYPES = ['spider', 'user'];

function MediaRequestsService(options) {
    this.options = options;
}

function tableURI(domain, tableName) {
    return new URI([domain, 'sys', 'table', tableName, '']);
}

// Datasets are written in singular form unlike metrics
const tables = {
    mediarequestPerFile: 'mediarequest.per.file',
    mediarequestPerReferer: 'mediarequest.per.referer',
    mediarequestTopFiles: 'mediarequest.top.files',
};

const tableSchemas = {
    mediarequestPerFile: {
        table: tables.mediarequestPerFile,
        version: 1,
        attributes: {
            referer: 'string',
            file_path: 'string',
            granularity: 'string',
            // the hourly timestamp will be stored as YYYYMMDDHH
            timestamp: 'string',
            spider: 'int',
            user: 'int'
        },
        index: [
            { attribute: 'referer', type: 'hash' },
            { attribute: 'file_path', type: 'hash' },
            { attribute: 'granularity', type: 'hash' },
            { attribute: 'timestamp', type: 'range', order: 'asc' },
        ]
    },
    mediarequestPerReferer: {
        table: tables.mediarequestPerReferer,
        version: 1,
        attributes: {
            referer: 'string',
            media_type: 'string',
            agent: 'string',
            granularity: 'string',
            timestamp: 'string',
            requests: 'long'
        },
        index: [
            { attribute: 'referer', type: 'hash' },
            { attribute: 'media_type', type: 'hash' },
            { attribute: 'agent', type: 'hash' },
            { attribute: 'granularity', type: 'hash' },
            { attribute: 'timestamp', type: 'range', order: 'asc' },
        ]
    },
    mediarequestTopFiles: {
        table: tables.mediarequestTopFiles,
        version: 1,
        attributes: {
            referer: 'string',
            media_type: 'string',
            year: 'string',
            month: 'string',
            day: 'string',
            filesJSON: 'json'
        },
        index: [
            { attribute: 'referer', type: 'hash' },
            { attribute: 'media_type', type: 'hash' },
            { attribute: 'year', type: 'hash' },
            { attribute: 'month', type: 'hash' },
            { attribute: 'day', type: 'hash' },
        ]
    }
};

MediaRequestsService.prototype.mediarequestsForFile = function(hyper, req) {
    const requestParams = req.params;
    const referer = aqsUtil.normalizeReferer(requestParams.referer);
    const agentType = requestParams.agent;
    // dates are passed in as YYYYMMDD but we need the HH to match the loaded data
    // which was originally planned at hourly resolution, so we pass "fakeHour"
    // Additionally, for monthly granularity we need to take only full months into account
    aqsUtil.validateStartAndEnd(requestParams, {
        fakeHour: true,
        zeroHour: true,
        fullMonths: requestParams.granularity === MONTHLY
    });

    const dataRequest = hyper.get({
        uri: tableURI(requestParams.domain, tables.mediarequestPerFile),
        body: {
            table: tables.mediarequestPerFile,
            attributes: {
                referer,
                file_path: aqsUtil.normalizeFileURI(requestParams.file_path),
                granularity: DAILY,
                timestamp: { between: [requestParams.start, requestParams.end] },
            }
        }
    }).catch(aqsUtil.notFoundCatcher);

    return dataRequest.then(aqsUtil.normalizeRequestParams).then((res) => {
        if (res.body.items) {
            const monthMediarequests = {};
            const aggregateMonthly = requestParams.granularity === MONTHLY;

            res.body.items.forEach((item) => {
                const yearAndMonth = item.timestamp.substring(0, 6);
                item.agent = agentType;
                // Make sure that nulls are taken as zeroes.
                item.user = item.user || 0;
                item.spider = item.spider || 0;
                // Since we don't store "all agents" in Cassandra,
                // we need to sum both values on the fly.
                if (agentType === 'all-agents') {
                    item.requests = item.user + item.spider;
                } else {
                    item.requests = item[agentType];
                }

                if (aggregateMonthly) {
                    if (!Object.prototype.hasOwnProperty.call(monthMediarequests, yearAndMonth)) {
                        const newMonth = {
                            referer: item.referer,
                            file_path: item.file_path,
                            granularity: MONTHLY,
                            timestamp: `${yearAndMonth}0100`,
                            agent: agentType,
                            requests: 0
                        };

                        monthMediarequests[yearAndMonth] = newMonth;
                    }

                    monthMediarequests[yearAndMonth].requests += item.requests;
                }
                AGENT_TYPES.forEach(agent => delete item[agent]);
            });

            if (aggregateMonthly) {
                const sortedMonths = Object.keys(monthMediarequests);
                sortedMonths.sort();
                res.body.items = sortedMonths.map((month) => {
                    return monthMediarequests[month];
                });
            }
        }

        return res;
    });
};

MediaRequestsService.prototype.mediarequestsForReferer = function(hyper, req) {
    const requestParams = req.params;
    const referer = aqsUtil.normalizeReferer(requestParams.referer);
    aqsUtil.validateStartAndEnd(requestParams, {
        fakeHour: (requestParams.granularity === MONTHLY || requestParams.granularity === DAILY),
        zeroHour: (requestParams.granularity === MONTHLY || requestParams.granularity === DAILY),
        fullMonths: requestParams.granularity === MONTHLY
    });

    const dataRequest = hyper.get({
        uri: tableURI(requestParams.domain, tables.mediarequestPerReferer),
        body: {
            table: tables.mediarequestPerReferer,
            attributes: {
                referer,
                media_type: requestParams.media_type,
                agent: requestParams.agent,
                granularity: requestParams.granularity,
                timestamp: { between: [requestParams.start, requestParams.end] },
            }
        }

    }).catch(aqsUtil.notFoundCatcher);

    return dataRequest.then(aqsUtil.normalizeResponse).then((res) => {
        if (res.body.items) {
            res.body.items.forEach((item) => {
                item.requests = parseInt(item.requests, 10) || 0;
            });
        }
        return res;
    });
};

MediaRequestsService.prototype.mediarequestsForTops = function(hyper, req) {
    const requestParams = req.params;
    const referer = aqsUtil.normalizeReferer(requestParams.referer);

    aqsUtil.validateYearMonthDay(requestParams);

    const dataRequest = hyper.get({
        uri: tableURI(requestParams.domain, tables.mediarequestTopFiles),
        body: {
            table: tables.mediarequestTopFiles,
            attributes: {
                referer,
                media_type: requestParams.media_type,
                year: requestParams.year,
                month: requestParams.month,
                day: requestParams.day
            }
        }

    }).catch(aqsUtil.notFoundCatcher);

    return dataRequest.then(aqsUtil.normalizeResponse).then((res) => {
        if (res.body.items) {
            res.body.items.forEach((item) => {
                item.files = item.filesJSON;
                delete item.filesJSON;
                item.files = item.files.sort((a, b) => a.rank - b.rank);
            });
        }

        return res;
    });
};

module.exports = function(options) {
    const mediaRequestsService = new MediaRequestsService(options);

    return {
        spec,
        operations: {
            mediarequestsForFile: mediaRequestsService.mediarequestsForFile,
            mediarequestsForReferer: mediaRequestsService.mediarequestsForReferer,
            mediarequestsForTops: mediaRequestsService.mediarequestsForTops,
        },
        resources: [
            {
                uri: `/{domain}/sys/table/${tables.mediarequestPerFile}`,
                body: tableSchemas.mediarequestPerFile,
            },
            {
                uri: `/{domain}/sys/table/${tables.mediarequestPerReferer}`,
                body: tableSchemas.mediarequestPerReferer,
            },
            {
                uri: `/{domain}/sys/table/${tables.mediarequestTopFiles}`,
                body: tableSchemas.mediarequestTopFiles,
            }
        ]
    };
};
