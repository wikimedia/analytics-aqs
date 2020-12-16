'use strict';

const druidUtil = {};

/*
 * Intervals building function
 */
druidUtil.makeInterval = function(start, end) {
    return [ `${start}/${end}` ];
};

/*
 * Filters building functions
 */
druidUtil.makeSelectorFilter = function(dimension, value) {
    return { type: 'selector', dimension, value };
};
druidUtil.makeRegexFilter = function(dimension, pattern) {
    return { type: 'regex', dimension, pattern };
};
druidUtil.makeAndFilter = function(fields) {
    return { type: 'and', fields };
};
druidUtil.makeOrFilter = function(fields) {
    return { type: 'or', fields };
};
druidUtil.makeNotFilter = function(field) {
    return { type: 'not', field };
};


/*
 * Aggregations building functions
 */
druidUtil.makeCount = function(name) {
    return { type: 'count', name };
};
function makeSimpleTypeAggregation(type, name, fieldName) {
    return { type, name, fieldName };
}
// Sum
druidUtil.makeLongSum = function(name, fieldName) {
    return makeSimpleTypeAggregation('longSum', name, fieldName);
};
druidUtil.makeDoubleSum = function(name, fieldName) {
    return makeSimpleTypeAggregation('doubleSum', name, fieldName);
};
// Min - Max
druidUtil.makeLongMin = function(name, fieldName) {
    return makeSimpleTypeAggregation('longMin', name, fieldName);
};
druidUtil.makeLongMax = function(name, fieldName) {
    return makeSimpleTypeAggregation('longMax', name, fieldName);
};
druidUtil.makeDoubleMin = function(name, fieldName) {
    return makeSimpleTypeAggregation('doubleMin', name, fieldName);
};
druidUtil.makeDoubleMax = function(name, fieldName) {
    return makeSimpleTypeAggregation('doubleMax', name, fieldName);
};
// First Last
druidUtil.makeLongFirst = function(name, fieldName) {
    return makeSimpleTypeAggregation('longFirst', name, fieldName);
};
druidUtil.makeLongLast = function(name, fieldName) {
    return makeSimpleTypeAggregation('longLast', name, fieldName);
};
druidUtil.makeDoubleFirst = function(name, fieldName) {
    return makeSimpleTypeAggregation('doubleFirst', name, fieldName);
};
druidUtil.makeDoubleLast = function(name, fieldName) {
    return makeSimpleTypeAggregation('doubleLast', name, fieldName);
};
druidUtil.makeCardinalityAggregation = function(name, fields) {
    return { type: 'cardinality', name, fields };
};
druidUtil.makeFilteredAggregation = function(filter, aggregator) {
    return { type: 'filtered', filter, aggregator };
};


/*
 * PostAggregations building functions
 */
druidUtil.makeFieldAccessor = function(fieldName) {
    return { type: 'fieldAccess', fieldName };
};
function makeArithmeticPostAggregation(fn, name, fields) {
    return { type: 'arithmetic', name, fn, fields };
}
druidUtil.makePlusPostAggregation = function(name, fields) {
    return makeArithmeticPostAggregation('+', name, fields);
};
druidUtil.makeMinusPostAggregation = function(name, fields) {
    return makeArithmeticPostAggregation('-', name, fields);
};
druidUtil.makeTimesPostAggregation = function(name, fields) {
    return makeArithmeticPostAggregation('*', name, fields);
};
druidUtil.makeDividePostAggregation = function(name, fields) {
    return makeArithmeticPostAggregation('/', name, fields);
};
druidUtil.makeQuotientPostAggregation = function(name, fields) {
    return makeArithmeticPostAggregation('quotient', name, fields);
};


/*
 * Queries building functions
 */

const JSON_HEADER = { 'content-type': 'application/json' };
const AGENT_OPTIONS = { keepAlive: true };
const TIMEOUT = 10000; // Kill the request after 10 seconds
// const MAX_RETRIES = 3; // Try the request again a maximum of 3 times

function makeQuery(uri, body) {
    return {
        uri,
        headers: JSON_HEADER,
        body,
        agentOptions: AGENT_OPTIONS,
        timeout: TIMEOUT,
        // retries: MAX_RETRIES, // not enabling retries for now to prevent piling of requests
    };
}

/* eslint-disable */

druidUtil.makeTimeseriesQuery = function(uri, dataSource, granularity,
                                         filter, aggregations, postAggregations, intervals) {
    return makeQuery(uri, {
        queryType: 'timeseries',
        dataSource,
        granularity,
        filter,
        aggregations,
        postAggregations,
        intervals
    });
};

druidUtil.makeTopN = function(uri, dataSource, granularity,
                                   dimension, threshold, metric,
                                   filter, aggregations, postAggregations, intervals) {
    return makeQuery(uri, {
        queryType: 'topN',
        dataSource,
        granularity,
        dimension,
        threshold,
        metric,
        filter,
        aggregations,
        postAggregations,
        intervals
    });
};

/* eslint-enable */

module.exports = druidUtil;
