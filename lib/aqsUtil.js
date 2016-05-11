'use strict';

var HyperSwitch = require('hyperswitch');
var HTTPError = HyperSwitch.HTTPError;

var aqsUtil = {};

aqsUtil.notFoundCatcher = function(e) {
    if (e.status === 404) {
        e.body.description = 'The date(s) you used are valid, but we either do ' +
                             'not have data for those date(s), or the project ' +
                             'you asked for is not loaded yet.  Please check ' +
                             'https://wikimedia.org/api/rest_v1/?doc for more ' +
                             'information.';
        e.body.type = 'not_found';
    }
    throw e;
};

/**
 * general handler functions
 */
aqsUtil.normalizeResponse = function(res) {
    // always return at least an empty array so that queries for non-existing data don't error
    res = res || {};
    res.body = res.body || { items: [] };
    res.headers = res.headers || {};
    res.headers['cache-control'] = 's-maxage=86400, max-age=86400';
    res.headers['content-type'] = 'application/json; charset=utf-8';
    return res;
};

/**
 * Parameter validators
 * Only needed internally, not exposed
 */
var throwIfNeeded = function(errors) {
    if (errors && errors.length) {
        throw new HTTPError({
            status: 400,
            body: {
                type: 'invalid_request',
                detail: errors,
            }
        });
    }
};

/**
 * Cleans the project parameter so it can be passed in as either en.wikipedia.org or en.wikipedia
 * Also cleans any www. prefix so that projects like www.mediawiki.org or www.wikidata.org work
 */
aqsUtil.stripProject = function(rp) {
    rp.project = rp.project.replace(/^www\./, '').replace(/\.org$/, '');
};

aqsUtil.validateTimestamp = function(timestamp, opts) {
    opts = opts || {};

    if (timestamp && timestamp.length > 10) {
        return false;
    }

    try {
        var year = timestamp.substring(0, 4);
        var month = timestamp.substring(4, 6);
        var day = timestamp.substring(6, 8);
        var hour = opts.fakeHour ? '00' : timestamp.substring(8, 10);

        var dt = new Date([year, month, day].join('-') + ' ' + hour + ':00:00 UTC');

        return dt.toString() !== 'Invalid Date'
            && dt.getUTCFullYear() === parseInt(year, 10)
            && dt.getUTCMonth() === (parseInt(month, 10) - 1)
            && dt.getUTCDate() === parseInt(day, 10)
            && dt.getUTCHours() === parseInt(hour);

    } catch (e) {
        return false;
    }
};

/**
 * Generic validator of YYYYMMDDHH timestamps, with optional HH
 *
 * Options
 *  fakeHour: add a '00' when validating a YYYYMMDD timestamp
 *  zeroHour: actually change start and end to YYYYMMDD00
 *  stripHour: change any YYYYMMDDHH to YYYYMMDD
 *
 * Returns
 *  Nothing, but may change rp.start and rp.end
 *
 * Throws
 *  invalid date format exceptions
 */
aqsUtil.validateStartAndEnd = function(rp, opts) {
    opts = opts || {};

    var errors = [];
    var invalidMessage = opts.fakeHour ?
       'invalid, must be a valid date in YYYYMMDD format' :
       'invalid, must be a valid timestamp in YYYYMMDDHH format';

    aqsUtil.stripProject(rp);

    if (!aqsUtil.validateTimestamp(rp.start, opts)) {
        errors.push('start timestamp is ' + invalidMessage);
    }
    if (!aqsUtil.validateTimestamp(rp.end, opts)) {
        errors.push('end timestamp is ' + invalidMessage);
    }

    if (rp.start > rp.end) {
        errors.push('start timestamp should be before the end timestamp');
    }

    throwIfNeeded(errors);

    if (opts.zeroHour || opts.stripHour) {
        rp.start = rp.start.substring(0, 8);
        rp.end = rp.end.substring(0, 8);
    }
    if (opts.zeroHour) {
        rp.start += '00';
        rp.end += '00';
    }
};

aqsUtil.validateYearMonthDay = function(rp) {
    var errors = [];

    aqsUtil.stripProject(rp);

    // fake a timestamp in the YYYYMMDDHH format so we can reuse the validator
    var validDate = aqsUtil.validateTimestamp(
        rp.year + rp.month +
        ((rp.day === 'all-days') ? '01' : rp.day) +
        '00'
    );

    if (!validDate) {
        errors.push('Given year/month/day is invalid date');
    }

    throwIfNeeded(errors);
};

module.exports = aqsUtil;
