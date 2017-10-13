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

var HyperSwitch = require('hyperswitch');
var HTTPError = HyperSwitch.HTTPError;
var path = require('path');
var URI = HyperSwitch.URI;

var aqsUtil = require('../lib/aqsUtil');
var druidUtil = require('../lib/druidUtil');

var spec = HyperSwitch.utils.loadSpec(path.join(__dirname, 'mediawiki-history-metrics.yaml'));
var schemas = HyperSwitch.utils.loadSpec(path.join(__dirname, 'mediawiki-history-schemas.yaml'));
var D = schemas.druid;
var A2D = schemas.aqs2druid;

const ALL = 'all';
// How many results to return in topN queries
const TOP_THRESHOLD = 100;

const AQS_PARAMS = [
    'project', 'editor-type', 'page-type', 'activity-level', 'page-id', 'editor-id', 'granularity'
];


// mediawiki_history_metrics Service
function MHMS(options) {
    this.options = options;
    this.druid = options.druid;
}

var requestURI = function(druid) {
    if (druid) {
        var uri = '';
        uri += (druid.scheme) ? druid.scheme + '://' : '';
        uri += druid.host || '';
        uri += (druid.port) ? ':' + druid.port : '';
        uri += druid.query_path || '';

        return uri;
    } else { // Fail with 500 if druid conf is not set
        throw new HTTPError({
            status: 500,
            body: {
                type: 'internal_error',
                detail: 'Druid configuration not set',
            }
        });
    }
};


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


var validateRequestParams = function(requestParams, opts) {
    opts = opts || {};

    aqsUtil.normalizeProject(requestParams, opts);
    aqsUtil.validateStartAndEnd(requestParams, Object.assign(opts, {
        // YYYYMMDD dates are allowed, but need an hour to pass validation
        fakeHour: true,
        // YYYYMMDDHH dates are also allowed, but the hour should be stripped
        // to match how cassandra stores records
        stripHour: true,
        // Use fullmonthDruid if monthly granularity == true
        fullMonthsDruid: requestParams.granularity === 'monthly',
        // Druid uses ISO date format, so convert to YYYY-MM-DD
        isoDateFormat: true
    }));
};


/*
 * Function generating filters for non-denormalized event entities
 * (page, user, revision)
 * With those events, metrics are additive and therefore 'all'
 * parameter values always mean 'no filtering'
 */
var eventsFiltersFromRequestParams = function(requestParams) {
    return AQS_PARAMS.filter(paramName => {
        return requestParams[paramName] && // Parameter is defined in request
                A2D.filter[paramName] && // Parameter has a related filter function
                !A2D.all.hasOwnProperty(requestParams[paramName]); // Parameter value is not ALL
    }).map(paramName => {
        // Get filter function by name from schemas
        var makeFilter = druidUtil[A2D.filter[paramName]];
        var filterDim = A2D.dimension[paramName];
        var filterVal = requestParams[paramName];
        if (A2D.hasOwnProperty(paramName)) { // Convert or keep same
            filterVal = A2D[paramName][requestParams[paramName]];
        }
        return makeFilter(filterDim, filterVal);
    });
};


/*
 * Function generating filters for denormalized event entities
 * (digests)
 * With those events, metrics are non-additive over dimensions
 * and therefore 'all' parameter means explicit filtering for a
 * 'all' value.
 * Since the digests are currently not fully optimized, some special
 * cases also apply (see below)
 */
var digestsFiltersFromRequestParams = function(requestParams) {
    return AQS_PARAMS.filter(paramName => {
        // Special case:
        // request[project] = all-projects --> No filter
        // request[activity-level] = all-activity-levels --> No filter
        // request[editor-type] = all-editor-types --> Filter
        // request[page-type] = all-page-types --> Filter
        if ({ project: true, 'activity-level': true }.hasOwnProperty(paramName)) {
            return requestParams[paramName] && // Parameter is defined in request
                A2D.filter[paramName] && // Parameter has a related filter function
                !A2D.all.hasOwnProperty(requestParams[paramName]); // Parameter value is not ALL
        } else {
            return requestParams[paramName] && // Parameter is defined in request
                A2D.dimension[paramName] && // Parameter has a related druid dimension
                A2D.filter[paramName]; // Parameter has a related filter function
        }
    }).map(paramName => {
        // Get filter function by name from schemas
        var makeFilter = druidUtil[A2D.filter[paramName]];
        var filterDim = A2D.dimension[paramName];
        var filterVal = requestParams[paramName];
        if (A2D.hasOwnProperty(paramName)) { // Convert or keep same
            filterVal = A2D[paramName][requestParams[paramName]];
        }
        return makeFilter(filterDim, filterVal);
    });
};

var digestGranularityFilter = function(granularity) {
    return druidUtil.makeSelectorFilter(
        D.dimension.eventType,
        A2D['granularity-digest'][granularity]
    );
};


/*

Currently not used - We have decided to go for metrics without
deletion drift at first, in order to be able to explain it and
show it correctly in the future. Keeping this function for later

var deletedCurrentFilters = function(granularity) {
    var deletedCurrents = A2D['granularity-deleted_currents'][granularity];
    return deletedCurrents.map(tag => {
        return druidUtil.makeNotFilter(
            druidUtil.makeSelectorFilter(D.dimension.otherTags, tag));
    });
};
*/

var eventsCountingAggregation = function(outputMetricName) {
    return druidUtil.makeLongSum(outputMetricName, D.metric.events);
};

var convertDruidResultToAqsResult = function(druidResult, requestParams, keyFilters, isTop) {
    if (druidResult.status === 200) {
        // Overwrite body: Druid result is an array of results,
        // we send a single item with an array of results
        var coreItem = {};

        AQS_PARAMS.forEach(paramName => {
            if (requestParams[paramName]) {
                coreItem[paramName] = requestParams[paramName];
            }
        });

        coreItem.results = druidResult.body.map(druidRes => {
            var aqsRes = { timestamp: druidRes.timestamp };
            if (isTop) {
                // Just copy the result array to top field
                aqsRes.top = druidRes.result;
            } else {
                // Iterate over result keys and keep/convert only needed ones
                Object.keys(druidRes.result).forEach(k => {
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
        druidResult.body = 'Druid server error.\nIt would be great if you could send us ' +
            'an email (analytics@wikimedia.org) with a copy of this message.\n ' +
            'Thanks a lot !\n' + druidResult.body;
    }

    return druidResult;
};


/*
 * Function serving new-edited-pages
 */
MHMS.prototype.newPagesTimeseries = function(hyper, req) {

    // Validate request parameters in place
    var rp = req.params;
    validateRequestParams(rp);

    var druidRequest = druidUtil.makeTimeseriesQuery(
        requestURI(this.druid),
        D.datasource,
        A2D.granularity[rp.granularity],
        druidUtil.makeAndFilter(
            [ druidQueriesBlocks.filter.pages ]
                .concat(eventsFiltersFromRequestParams(rp))),
        [
            druidUtil.makeFilteredAggregation(
                druidQueriesBlocks.filter.create,
                druidUtil.makeCount(D.outputMetric.pagesCreated)),
            druidUtil.makeFilteredAggregation(
                druidUtil.makeSelectorFilter(
                    D.dimension.eventType,
                    D.eventType.delete),
                druidUtil.makeCount(D.outputMetric.pagesDeleted)),
            druidUtil.makeFilteredAggregation(
                druidUtil.makeSelectorFilter(
                    D.dimension.eventType,
                    D.eventType.restore),
                druidUtil.makeCount(D.outputMetric.pagesRestored))
        ],
        [
            druidUtil.makeMinusPostAggregation(D.outputMetric.newPages, [
                druidUtil.makePlusPostAggregation('tmp', [
                    druidUtil.makeFieldAccessor(D.outputMetric.pagesCreated),
                    druidUtil.makeFieldAccessor(D.outputMetric.pagesRestored) ]),
                druidUtil.makeFieldAccessor(D.outputMetric.pagesDeleted) ])
        ],
        druidUtil.makeInterval(rp.start, rp.end)
    );

    var keyFilters = {};
    keyFilters[D.outputMetric.newPages] = true;

    return hyper
        .post(druidRequest)
        .catch(aqsUtil.notFoundCatcher)
        .then(aqsUtil.normalizeResponse).then(res => {
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
    var rp = req.params;
    validateRequestParams(rp);

    var druidRequest = druidUtil.makeTimeseriesQuery(
        requestURI(this.druid),
        D.datasource,
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
        .then(aqsUtil.normalizeResponse).then(res => {
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
    var rp = req.params;
    validateRequestParams(rp, {
        noAllProjects: true // Don't accept all-projects aggregation
    });

    // editors or edited-pages specific parts
    var eventEntityFilter;
    var outputMetric;
    if (rp['digest-type'] === 'editors') {
        eventEntityFilter = druidQueriesBlocks.filter.users;
        outputMetric = D.outputMetric.editors;
    } else if (rp['digest-type'] === 'edited-pages') {
        eventEntityFilter = druidQueriesBlocks.filter.pages;
        outputMetric = D.outputMetric.editedPages;
    } else { // Internal endpoint parameter, this case should never happen
        throw new Error('Internal error - Invalid digest-type parameter for digestsTimeseries');
    }

    var druidRequest = druidUtil.makeTimeseriesQuery(
        requestURI(this.druid),
        D.datasource,
        A2D.granularity[rp.granularity],
        druidUtil.makeAndFilter(
            [ eventEntityFilter, digestGranularityFilter(rp.granularity) ]
                .concat(digestsFiltersFromRequestParams(rp))),
        [ eventsCountingAggregation(outputMetric) ],
        [], // No post-aggregation
        druidUtil.makeInterval(rp.start, rp.end)
    );

    return hyper
        .post(druidRequest)
        .catch(aqsUtil.notFoundCatcher)
        .then(aqsUtil.normalizeResponse).then(res => {
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
    var rp = req.params;
    validateRequestParams(rp,
      // Accept all-projects aggregation if not grouping by page-id or editor-id
      (rp['page-id'] || rp['editor-id']) ? { noAllProjects: true } : {}
    );


    // edits, net-bytes-diff or abs-bytes-diff specific parts
    var aggregation;
    if (rp.metric === 'edits') {
        aggregation = eventsCountingAggregation(D.outputMetric.edits);
    } else if (rp.metric === 'net-bytes-diff') {
        aggregation = druidUtil.makeLongSum(
          D.outputMetric.netBytesDiff, D.metric.textBytesDiffSum);
    } else if (rp.metric === 'abs-bytes-diff') {
        aggregation = druidUtil.makeLongSum(
          D.outputMetric.absBytesDiff, D.metric.textBytesDiffAbsSum);
    } else { // Internal endpoint parameter, this case should never happen
        throw new Error('Internal error - Invalid metric parameter for revisionsTimeseries');
    }

    var druidRequest = druidUtil.makeTimeseriesQuery(
        requestURI(this.druid),
        D.datasource,
        A2D.granularity[rp.granularity],
        druidUtil.makeAndFilter(
            [ druidQueriesBlocks.filter.revisions, druidQueriesBlocks.filter.create ]
                .concat(eventsFiltersFromRequestParams(rp))),
        [ aggregation ],
        [], // No post-aggregation
        druidUtil.makeInterval(rp.start, rp.end)
    );

    return hyper
        .post(druidRequest)
        .catch(aqsUtil.notFoundCatcher)
        .then(aqsUtil.normalizeResponse).then(res => {
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
    var rp = req.params;
    validateRequestParams(rp, {
        noAllProjects: true // Don't accept all-projects aggregation
    });

    // editors or edited-pages specific parts
    var topDimension;
    if (rp['top-type'] === 'editors') {
        topDimension = D.dimension.userId;
    } else if (rp['top-type'] === 'edited-pages') {
        topDimension = D.dimension.pageId;
    } else { // Internal endpoint parameter, this case should never happen
        throw new Error('Internal error - Invalid top-type parameter for revisionsTop');
    }

    // edits, net-bytes-diff or abs-bytes-diff specific parts
    var aggregation;
    var outputMetric;
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

    var druidRequest = druidUtil.makeTopN(
        requestURI(this.druid),
        D.datasource,
        A2D.granularity[rp.granularity],
        topDimension,
        TOP_THRESHOLD, // Get top 100
        outputMetric,
        druidUtil.makeAndFilter(
            [ druidQueriesBlocks.filter.revisions, druidQueriesBlocks.filter.create ]
                .concat(eventsFiltersFromRequestParams(rp))),
        [ aggregation ],
        [], // No post-aggregation
        druidUtil.makeInterval(rp.start, rp.end)
    );

    return hyper
        .post(druidRequest)
        .catch(aqsUtil.notFoundCatcher)
        .then(aqsUtil.normalizeResponse).then(res => {
            return convertDruidResultToAqsResult(res, rp, undefined, true);
        });
};


module.exports = function(options) {
    var mhms = new MHMS(options);

    return {
        spec: spec,
        operations: {
            newPagesTimeseries: mhms.newPagesTimeseries.bind(mhms),
            newlyRegisteredUsersTimeseries: mhms.newlyRegisteredUsersTimeseries.bind(mhms),
            digestsTimeseries: mhms.digestsTimeseries.bind(mhms),
            revisionsTimeseries: mhms.revisionsTimeseries.bind(mhms),
            revisionsTop: mhms.revisionsTop.bind(mhms)
        }
    };
};
