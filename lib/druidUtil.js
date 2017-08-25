'use strict';

var druidUtil = {};

/*
 * Intervals building functions
 */
var makeInterval = function(start, end) {
    return start + '/' + end ;
};

druidUtil.makeInterval = function(start, end) {
    return [ makeInterval(start, end) ];
};

/*
 * Filters building functions
 */
druidUtil.makeSelectorFilter = function(dimension, value) {
    return { type: 'selector', dimension: dimension, value: value };
};

druidUtil.makeRegexFilter = function(dimension, pattern) {
    return { type: 'regex', dimension: dimension, pattern: pattern };
};

druidUtil.makeAndFilter = function(fields) {
    return { type: 'and', fields: fields };
};

druidUtil.makeOrFilter = function(fields) {
    return { type: 'or', fields: fields };
};

druidUtil.makeNotFilter = function(field) {
    return { type: 'not', field: field };
};


/*
 * Aggregations building functions
 */
druidUtil.makeCount = function(name) {
    return { type: 'count', name: name };
};

var makeSimpleTypeAggregation = function(type, name, fieldName) {
    return { type: type, name: name, fieldName: fieldName };
};
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
    return { type: 'cardinality', name: name, fields: fields };
};

druidUtil.makeFilteredAggregation = function(filter, aggregator) {
    return { type: 'filtered', filter: filter, aggregator: aggregator };
};


/*
 * PostAggregations building functions
 */
druidUtil.makeFieldAccessor = function(fieldName) {
    return { type: 'fieldAccess', fieldName: fieldName };
};

var makeArithmeticPostAggregation = function(fn, name, fields) {
    return { type: 'arithmetic', name: name, fn: fn, fields: fields };
};

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

var makeQuery = function(uri, body) {
    return { uri: uri, headers: JSON_HEADER, body: body };
};

druidUtil.makeTimeseriesQuery = function(uri, datasource, granularity,
                                         filters, aggregations, postAggregations, intervals) {
    return makeQuery(uri,
        {
            queryType: 'timeseries',
            dataSource: datasource,
            granularity: granularity,
            filter: filters,
            aggregations: aggregations,
            postAggregations: postAggregations,
            intervals: intervals
        }
    );
};

druidUtil.makeTopN = function(uri, datasource, granularity,
                                   dimension, threshold, metric,
                                   filters, aggregations, postAggregations, intervals) {
    return makeQuery(uri,
        {
            queryType: 'topN',
            dataSource: datasource,
            granularity: granularity,
            dimension: dimension,
            threshold: threshold,
            metric: metric,
            filter: filters,
            aggregations: aggregations,
            postAggregations: postAggregations,
            intervals: intervals
        }
    );
};

module.exports = druidUtil;
