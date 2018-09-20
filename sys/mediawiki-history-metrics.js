'use strict';

/**
 * mediawiki_history_metrics API module
 *
 * This API serves pre-aggregated metrics from Druid
 *
 * TODO:
 *  - Implement topN endpoints
 *
 */

const HyperSwitch = require('hyperswitch');
const HTTPError = HyperSwitch.HTTPError;
const path = require('path');

const aqsUtil = require('../lib/aqsUtil');
const druidUtil = require('../lib/druidUtil');

const spec = HyperSwitch.utils.loadSpec(path.join(__dirname, 'mediawiki-history-metrics.yaml'));
const schemas = HyperSwitch.utils.loadSpec(path.join(__dirname, 'mediawiki-history-schemas.yaml'));
const D = schemas.druid;
const A2D = schemas.aqs2druid;

// How many results to return in topN queries
const TOP_THRESHOLD = 100;

const AQS_PARAMS = [
    'project', 'editor-type', 'page-type', 'activity-level',
    'page-title', 'user-text', 'granularity'
];


// mediawiki_history_metrics Service
function MHMS(options) {
    this.options = options;
    this.druid = options.druid;
}

function requestURI(druid) {
    if (druid) {
        const scheme = (druid.scheme) ? `${druid.scheme}://` : '';
        const host = druid.host || '';
        const port = (druid.port) ? `:${druid.port}` : '';
        const path = druid.query_path || '';

        return `${scheme}${host}${port}${path}`;
    } else { // Fail with 500 if druid conf is not set
        throw new HTTPError({
            status: 500,
            body: {
                type: 'internal_error',
                detail: 'Druid configuration not set',
            }
        });
    }
}

function requestDatasource(druid) {
    if (druid && druid.datasources && druid.datasources.mediawiki_history) {
        return druid.datasources.mediawiki_history;
    } else { // Fail with 500 if druid conf is not set
        throw new HTTPError({
            status: 500,
            body: {
                type: 'internal_error',
                detail: 'Druid datasource configuration not set',
            }
        });
    }
}


const druidQueriesBlocks = {
    filter: {
        revisions: druidUtil.makeSelectorFilter(
            D.dimension.eventEntity,
            D.eventEntity.revision
        ),
        pages: druidUtil.makeSelectorFilter(
            D.dimension.eventEntity,
            D.eventEntity.page
        ),
        users: druidUtil.makeSelectorFilter(
            D.dimension.eventEntity,
            D.eventEntity.user
        ),
        create: druidUtil.makeSelectorFilter(
            D.dimension.eventType,
            D.eventType.create
        )
    }
};


function validateRequestParams(requestParams, opts) {
    opts = opts || {};

    aqsUtil.normalizeProject(requestParams, opts);
    aqsUtil.normalizePageTitle(requestParams, opts);
    if (opts.topQuery) {
        aqsUtil.validateYearMonthDay(requestParams, Object.assign(opts, {
            // Make year-month-day validation generate start/end for druid
            druidRange: true
        }));
        if (requestParams.day === 'all-days') {
            requestParams.granularity = 'monthly';
        } else {
            requestParams.granularity = 'daily';
        }
    } else {
        aqsUtil.validateStartAndEnd(requestParams, Object.assign(opts, {
            // YYYYMMDD dates are allowed, but need an hour to pass validation
            fakeHour: true,
            // YYYYMMDDHH dates are also allowed, but the hour should be stripped
            // since we only work at day level
            stripHour: true,
            // Use fullmonthDruid if monthly granularity == true
            fullMonthsDruid: requestParams.granularity === 'monthly',
            // Druid uses ISO date format, so convert to YYYY-MM-DD
            isoDateFormat: true
        }));
    }
}


/*
 * Function generating filters for non-denormalized event entities
 * (page, user, revision)
 * With those events, metrics are additive and therefore 'all'
 * parameter values always mean 'no filtering'
 */
function eventsFiltersFromRequestParams(requestParams) {
    return AQS_PARAMS.filter((paramName) => {
        return requestParams[paramName] && // Parameter is defined in request
                A2D.filter[paramName] && // Parameter has a related filter function
                // Parameter value is not ALL
                !Object.prototype.hasOwnProperty.call(A2D.all, requestParams[paramName]);
    }).map((paramName) => {
        const paramValue = requestParams[paramName];
        // Special case for 'project' and project-families:
        // replace paramName project by project-family if its value is one of
        // the accepted project-family
        if (Object.prototype.hasOwnProperty.call(A2D['project-family'], paramValue)) {
            paramName = 'project-family';
        }
        // Get filter function by name from schemas
        const makeFilter = druidUtil[A2D.filter[paramName]];
        const filterDim = A2D.dimension[paramName];
        let filterVal = paramValue;
        if (Object.prototype.hasOwnProperty.call(A2D, paramName)) { // Convert or keep same
            filterVal = A2D[paramName][paramValue];
        }
        return makeFilter(filterDim, filterVal);
    });
}


/*
 * Function generating filters for denormalized event entities
 * (digests)
 * With those events, metrics are non-additive over dimensions
 * and therefore 'all' parameter means explicit filtering for a
 * 'all' value.
 * Since the digests are currently not fully optimized, some special
 * cases also apply (see below)
 */
function digestsFiltersFromRequestParams(requestParams) {
    return AQS_PARAMS.filter((paramName) => {
        // Special case:
        // request[project] = all-projects --> No filter
        // request[activity-level] = all-activity-levels --> No filter
        // request[editor-type] = all-editor-types --> Filter
        // request[page-type] = all-page-types --> Filter
        if (paramName === 'project' || paramName === 'activity-level') {
            return requestParams[paramName] && // Parameter is defined in request
                A2D.filter[paramName] && // Parameter has a related filter function
                // Parameter value is not ALL
                !Object.prototype.hasOwnProperty.call(A2D.all, requestParams[paramName]);
        } else {
            return requestParams[paramName] && // Parameter is defined in request
                A2D.dimension[paramName] && // Parameter has a related druid dimension
                A2D.filter[paramName]; // Parameter has a related filter function
        }
    }).map((paramName) => {
        // Get filter function by name from schemas
        const makeFilter = druidUtil[A2D.filter[paramName]];
        const filterDim = A2D.dimension[paramName];
        let filterVal = requestParams[paramName];
        if (Object.prototype.hasOwnProperty.call(A2D, paramName)) { // Convert or keep same
            filterVal = A2D[paramName][requestParams[paramName]];
        }
        return makeFilter(filterDim, filterVal);
    });
}

function digestGranularityFilter(granularity) {
    return druidUtil.makeSelectorFilter(
        D.dimension.eventType,
        A2D['granularity-digest'][granularity]
    );
}

function eventsCountingAggregation(outputMetricName) {
    return druidUtil.makeLongSum(outputMetricName, D.metric.events);
}

function convertDruidResultToAqsResult(druidResult, requestParams, keyFilters, isTop) {
    if (druidResult.status === 200) {
        // Overwrite body: Druid result is an array of results,
        // we send a single item with an array of results
        const coreItem = {};

        AQS_PARAMS.forEach((paramName) => {
            if (requestParams[paramName]) {
                coreItem[paramName] = requestParams[paramName];
            }
        });

        coreItem.results = druidResult.body.map((druidRes) => {
            const aqsRes = { timestamp: druidRes.timestamp };
            if (isTop) {
                // copy the result array to top field adding rank value
                aqsRes.top = druidRes.result.map((item, idx) => {
                    return Object.assign(item, { rank: idx + 1 });
                });
            } else {
                // Iterate over result keys and keep/convert only needed ones
                Object.keys(druidRes.result).forEach((k) => {
                    if ((keyFilters === undefined) || (keyFilters[k] !== undefined)) {
                        // Results from Druid can be floats in case of
                        // count-distinct approximations. We convert them to int
                        aqsRes[k] = Math.floor(druidRes.result[k]);
                    }
                });
            }
            return aqsRes;
        });

        // Return a single item
        druidResult.body = { items: [ coreItem ] };
    } else {
        druidResult.body = ```Druid server error.
It would be great if you could send us an email (analytics@wikimedia.org)
with a copy of this message.
Thanks a lot!
${druidResult.body}```;
    }

    return druidResult;
}


/*
 * Function serving new-edited-pages
 */
MHMS.prototype.newPagesTimeseries = function(hyper, req) {

    // Validate request parameters in place
    const rp = req.params;
    validateRequestParams(rp);

    const druidRequest = druidUtil.makeTimeseriesQuery(
        requestURI(this.druid),
        requestDatasource(this.druid),
        A2D.granularity[rp.granularity],
        druidUtil.makeAndFilter(
            [
                druidQueriesBlocks.filter.pages,
                druidQueriesBlocks.filter.create,
                druidUtil.makeNotFilter(
                    druidUtil.makeSelectorFilter(
                        D.dimension.otherTags,
                        D.otherTags.redirect))
            ].concat(eventsFiltersFromRequestParams(rp))),
        [ eventsCountingAggregation(D.outputMetric.newPages) ],
        [], // No post-aggregation
        druidUtil.makeInterval(rp.start, rp.end)
    );

    const keyFilters = {};
    keyFilters[D.outputMetric.newPages] = true;

    return hyper
        .post(druidRequest)
        .catch(aqsUtil.notFoundCatcher)
        .then(aqsUtil.normalizeResponse).then((res) => {
            // Need to filter out some druid results fields
            // we only want the post-aggregation one
            return convertDruidResultToAqsResult(res, rp, keyFilters);
        });
};

/*
 * Function serving newly-registered users
 */
MHMS.prototype.newlyRegisteredUsersTimeseries = function(hyper, req) {

    // Validate request parameters in place
    const rp = req.params;
    validateRequestParams(rp);

    const druidRequest = druidUtil.makeTimeseriesQuery(
        requestURI(this.druid),
        requestDatasource(this.druid),
        A2D.granularity[rp.granularity],
        druidUtil.makeAndFilter(
            [
                druidQueriesBlocks.filter.users,
                druidQueriesBlocks.filter.create,
                druidUtil.makeSelectorFilter(
                    D.dimension.otherTags,
                    D.otherTags.selfCreated)
            ].concat(eventsFiltersFromRequestParams(rp))),
        [ eventsCountingAggregation(D.outputMetric.newRegisteredUsers) ],
        [], // No post-aggregation
        druidUtil.makeInterval(rp.start, rp.end)
    );

    return hyper
        .post(druidRequest)
        .catch(aqsUtil.notFoundCatcher)
        .then(aqsUtil.normalizeResponse).then((res) => {
            return convertDruidResultToAqsResult(res, rp);
        });
};


/*
 * Function serving timeseries endpoints using digests events:
 *  - editors global
 *  - edited-pages global
 */
MHMS.prototype.digestsTimeseries = function(hyper, req) {

    // Validate request parameters in place
    const rp = req.params;
    validateRequestParams(rp, {
        noAllProjects: true // Don't accept all-... project type aggregation
    });

    // editors or edited-pages specific parts
    let eventEntityFilter;
    let outputMetric;
    if (rp['digest-type'] === 'editors') {
        eventEntityFilter = druidQueriesBlocks.filter.users;
        outputMetric = D.outputMetric.editors;
    } else if (rp['digest-type'] === 'edited-pages') {
        eventEntityFilter = druidQueriesBlocks.filter.pages;
        outputMetric = D.outputMetric.editedPages;
    } else { // Internal endpoint parameter, this case should never happen
        throw new Error('Internal error - Invalid digest-type parameter for digestsTimeseries');
    }

    const druidRequest = druidUtil.makeTimeseriesQuery(
        requestURI(this.druid),
        requestDatasource(this.druid),
        A2D.granularity[rp.granularity],
        druidUtil.makeAndFilter(
            [
                eventEntityFilter,
                digestGranularityFilter(rp.granularity)
            ].concat(digestsFiltersFromRequestParams(rp))),
        [ eventsCountingAggregation(outputMetric) ],
        [], // No post-aggregation
        druidUtil.makeInterval(rp.start, rp.end)
    );

    return hyper
        .post(druidRequest)
        .catch(aqsUtil.notFoundCatcher)
        .then(aqsUtil.normalizeResponse).then((res) => {
            return convertDruidResultToAqsResult(res, rp);
        });
};

/*
 * Function serving timeseries endpoints using revisions events:
 *  - edits global, per-page and per-editor
 *  - net-bytes-diff global, per-page and per-editor
 *  - abs-bytes-diff global, per-page and per-editor
 */
MHMS.prototype.revisionsTimeseries = function(hyper, req) {

    // Validate request parameters in place
    const rp = req.params;
    validateRequestParams(rp);

    // edits, net-bytes-diff or abs-bytes-diff specific parts
    let aggregation;
    if (rp.metric === 'edits') {
        aggregation = eventsCountingAggregation(D.outputMetric.edits);
    } else if (rp.metric === 'net-bytes-diff') {
        aggregation = druidUtil.makeLongSum(D.outputMetric.netBytesDiff,
            D.metric.textBytesDiffSum);
    } else if (rp.metric === 'abs-bytes-diff') {
        aggregation = druidUtil.makeLongSum(D.outputMetric.absBytesDiff,
            D.metric.textBytesDiffAbsSum);
    } else { // Internal endpoint parameter, this case should never happen
        throw new Error('Internal error - Invalid metric parameter for revisionsTimeseries');
    }

    const druidRequest = druidUtil.makeTimeseriesQuery(
        requestURI(this.druid),
        requestDatasource(this.druid),
        A2D.granularity[rp.granularity],
        druidUtil.makeAndFilter(
            [
                druidQueriesBlocks.filter.revisions,
                druidQueriesBlocks.filter.create,
                druidUtil.makeNotFilter(
                    druidUtil.makeSelectorFilter(
                        D.dimension.otherTags,
                        D.otherTags.deleted))
            ].concat(eventsFiltersFromRequestParams(rp))),
        [ aggregation ],
        [], // No post-aggregation
        druidUtil.makeInterval(rp.start, rp.end)
    );

    return hyper
        .post(druidRequest)
        .catch(aqsUtil.notFoundCatcher)
        .then(aqsUtil.normalizeResponse).then((res) => {
            return convertDruidResultToAqsResult(res, rp);
        });
};


/*
 * Function serving top endpoints using revisions events:
 *  - Top editors by edits, net-bytes-diff or abs-bytes-diff
 *  - Top edited-pages by edits, net-bytes-diff or abs-bytes-diff
 */
MHMS.prototype.revisionsTop = function(hyper, req) {

    // Validate request parameters in place
    const rp = req.params;
    validateRequestParams(rp, { topQuery: true });

    // editors or edited-pages specific parts
    let topDimension;
    if (rp['top-type'] === 'editors') {
        topDimension = D.dimension.userText;
    } else if (rp['top-type'] === 'edited-pages') {
        topDimension = D.dimension.pageTitle;
    } else { // Internal endpoint parameter, this case should never happen
        throw new Error('Internal error - Invalid top-type parameter for revisionsTop');
    }

    // edits, net-bytes-diff or abs-bytes-diff specific parts
    let aggregation;
    let outputMetric;
    if (rp.metric === 'edits') {
        outputMetric = D.outputMetric.edits;
        aggregation = eventsCountingAggregation(outputMetric);
    } else if (rp.metric === 'net-bytes-diff') {
        outputMetric = D.outputMetric.netBytesDiff;
        aggregation = druidUtil.makeLongSum(outputMetric, D.metric.textBytesDiffSum);
    } else if (rp.metric === 'abs-bytes-diff') {
        outputMetric = D.outputMetric.absBytesDiff;
        aggregation = druidUtil.makeLongSum(outputMetric, D.metric.textBytesDiffAbsSum);
    } else { // Internal endpoint parameter, this case should never happen
        throw new Error('Internal error - Invalid metric parameter for revisionsTop');
    }

    const druidRequest = druidUtil.makeTopN(
        requestURI(this.druid),
        requestDatasource(this.druid),
        A2D.granularity[rp.granularity],
        topDimension,
        TOP_THRESHOLD, // Get top 100
        outputMetric,
        druidUtil.makeAndFilter(
            [
                druidQueriesBlocks.filter.revisions,
                druidQueriesBlocks.filter.create
            ].concat(eventsFiltersFromRequestParams(rp))),
        [ aggregation ],
        [], // No post-aggregation
        druidUtil.makeInterval(rp.start, rp.end)
    );

    return hyper
        .post(druidRequest)
        .catch(aqsUtil.notFoundCatcher)
        .then(aqsUtil.normalizeResponse).then((res) => {
            return convertDruidResultToAqsResult(res, rp, undefined, true);
        });
};


module.exports = function(options) {
    const mhms = new MHMS(options);

    return {
        spec,
        operations: {
            newPagesTimeseries: mhms.newPagesTimeseries.bind(mhms),
            newlyRegisteredUsersTimeseries: mhms.newlyRegisteredUsersTimeseries.bind(mhms),
            digestsTimeseries: mhms.digestsTimeseries.bind(mhms),
            revisionsTimeseries: mhms.revisionsTimeseries.bind(mhms),
            revisionsTop: mhms.revisionsTop.bind(mhms)
        }
    };
};
