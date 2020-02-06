'use strict';

const HyperSwitch = require('hyperswitch');
const HTTPError = HyperSwitch.HTTPError;

const aqsUtil = {};

const NON_PROJECT_REFERERS = ['internal', 'external',
    'search-engine', 'unknown', 'none'];
aqsUtil.notFoundCatcher = function(e) {

    if (e.status === 404) {
        e.body = e.body || {};
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
    res.body = res.body || {
        items: []
    };
    res.headers = res.headers || {};
    res.headers['cache-control'] = 's-maxage=86400, max-age=86400';
    res.headers['content-type'] = 'application/json; charset=utf-8';
    return res;
};

/**
 * Parameter validators
 * Only needed internally, not exposed
 */
function throwIfNeeded(errors) {
    if (errors && errors.length) {
        throw new HTTPError({
            status: 400,
            body: {
                type: 'invalid_request',
                detail: errors,
            }
        });
    }
}

/**
 * Normalizes the project parameter to "en.wikipedia"
 * from:
 * en.wikipedia.org, EN.WIKIPEDIA.ORG, www.en.wikipedia.org
 * Enforces the project to contain only letters, numbers, -, _ or .
 */

aqsUtil.normalizeProject = (project, noAllProjects) => {
    const normalizedProject = project.trim().toLowerCase()
        .replace(/^www\./, '')
        .replace(/\.org$/, '');
    if (!normalizedProject.match('^[a-z0-9_\\.\\-]+$')) {
        throwIfNeeded('The parameter `project` contains invalid charaters.');
    }
    if (noAllProjects && normalizedProject.startsWith('all-')) {
        throwIfNeeded('`all-...` project values are not accepted for this metric.');
    }
    return normalizedProject;
};

aqsUtil.normalizeReferer = (referer) => {
    const lowerCaseReferer = referer.trim().toLowerCase();
    const isProjectReferer = !NON_PROJECT_REFERERS.includes(lowerCaseReferer);
    if (isProjectReferer) {
        return aqsUtil.normalizeProject(referer);
    } else {
        return lowerCaseReferer;
    }
};

/**
 * Normalizes the page-title parameter, replacing spaces with underscores
 */
aqsUtil.normalizePageTitle = (title) => {
    return title.replace(/ /g, '_');
};

/**
 * Within the mediarequest dataset, the file name is urlencoded, but not the rest
 * of the path (slashes). Since at this point the whole URI is decoded, we need to
 * re-urlencode the file name for it to be found.
 */
aqsUtil.normalizeFileURI = (fileURI) => {
    if (fileURI[0] !== '/') {
        throw new HTTPError({
            status: 404,
            body: {
                type: 'not_found',
                detail: 'The file name you have requested has an invalid format.',
            }
        });
    }
    const beginningOfFileName = fileURI.lastIndexOf('/') + 1;
    const pathBeforeFileName = fileURI.slice(0, beginningOfFileName);
    const fileName = fileURI.slice(beginningOfFileName);
    return pathBeforeFileName + encodeURIComponent(fileName);
};

aqsUtil.validateTimestampAndExtractDate = function(timestamp, opts) {
    opts = opts || {};

    if (timestamp && timestamp.length > 10) {
        return null;
    }

    try {
        const year = timestamp.substring(0, 4);
        const month = timestamp.substring(4, 6);
        const day = timestamp.substring(6, 8);
        const hour = opts.fakeHour ? '00' : timestamp.substring(8, 10);

        const dt =  new Date(`${year}-${month}-${day} ${hour}:00:00 UTC`);

        if (dt.toString() !== 'Invalid Date'
            && dt.getUTCFullYear() === parseInt(year, 10)
            && dt.getUTCMonth() === (parseInt(month, 10) - 1)
            && dt.getUTCDate() === parseInt(day, 10)
            && dt.getUTCHours() === parseInt(hour, 10)) {

            return dt;
        } else {
            return null;
        }


    } catch (e) {
        return null;
    }
};

/**
 * Generic validator of YYYYMMDDHH timestamps, with optional HH
 *
 * Options
 *  fakeHour: add a '00' when validating a YYYYMMDD timestamp
 *  zeroHour: actually change start and end to YYYYMMDD00
 *  stripHour: change any YYYYMMDDHH to YYYYMMDD
 *  fullMonths: make date range include only full months
 *  maxSpanSeconds: maximum timespan between start and end in seconds
 *
 * Returns
 *  Nothing, but may change rp.start and rp.end
 *
 * Throws
 *  invalid date format exceptions
 */
aqsUtil.validateStartAndEnd = function(rp, opts) {
    opts = opts || {};

    const errors = [];
    const messageFormat = opts.fakeHour ? 'YYYYMMDD' : 'YYYYMMDDHH';
    const invalidMessage = `invalid, must be a valid date in ${messageFormat} format`;

    const startDt = aqsUtil.validateTimestampAndExtractDate(rp.start, opts);
    if (startDt === null) {
        errors.push(`start timestamp is ${invalidMessage}`);
    }
    const endDt = aqsUtil.validateTimestampAndExtractDate(rp.end, opts);
    if (endDt === null) {
        errors.push(`end timestamp is ${invalidMessage}`);
    }

    if (startDt && endDt && startDt > endDt) {
        errors.push('start timestamp should be before the end timestamp');
    }

    if (opts.maxSpanSeconds && ((endDt - startDt) > opts.maxSpanSeconds * 1000)) {
        errors.push(`Query timespan is too long (max: ) ${opts.maxSpanSeconds} seconds`);
    }

    if (opts.fullMonths) {
        rp.start = aqsUtil.getFirstFullMonthFirstDay(rp.start);
        rp.end = aqsUtil.getLastFullMonthLastDay(rp.end);

        if (rp.start > rp.end) {
            errors.push('no full months found in specified date range');
        }
    }

    if (opts.fullMonthsDruid) {
        rp.start = aqsUtil.getFirstFullMonthFirstDay(rp.start);
        rp.end = aqsUtil.getDayAfterLastFullMonth(rp.end);

        if (rp.start >= rp.end) {
            errors.push('no full months found in specified date range');
        }
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
    if (opts.isoDateFormat) {
        rp.start = aqsUtil.convertTimestampToDate(rp.start).toISOString().slice(0, 10);
        rp.end = aqsUtil.convertTimestampToDate(rp.end).toISOString().slice(0, 10);
    }
    if (opts.isoDateTimeFormat) {
        rp.start = aqsUtil.convertTimestampToDate(rp.start).toISOString();
        rp.end = aqsUtil.convertTimestampToDate(rp.end).toISOString();
    }

};

aqsUtil.validateYearMonthDay = function(rp, opts) {
    let end;

    opts = opts || {};

    const errors = [];

    // fake a timestamp in the YYYYMMDDHH format so we can reuse the validator
    const day = ((rp.day === 'all-days') ? '01' : rp.day);
    const start = `${rp.year}${rp.month}${day}00`;
    const startDt = aqsUtil.validateTimestampAndExtractDate(start);

    if (startDt === null) {
        errors.push('Given year/month/day is invalid date');
    }

    // Erroring before next block as Druid-range is about extracting
    // druid start and end dates from year-month-day values.
    // It shouldn' be executed in case of invalid start-date
    throwIfNeeded(errors);


    if (opts.druidRange) {
        const startDate = aqsUtil.convertTimestampToDate(start);
        rp.start = startDate.toISOString().slice(0, 10);
        if (rp.day === 'all-days') {
            // Manual 0 padding man using prefix and slice
            const month = `00${parseInt(rp.month, 10) + 1}`.slice(-2);
            end = `${rp.year}${month}01`;
        } else {
            // Manual 0 padding man using prefix and slice
            const endDay = `00${parseInt(day, 10) + 1}`.slice(-2);
            end = `${rp.year}${rp.month}${endDay}`;
        }
        rp.end = aqsUtil.convertTimestampToDate(end).toISOString().slice(0, 10);
    }
};

aqsUtil.validateYearMonth = function(rp) {
    const errors = [];

    // fake a timestamp in the YYYYMMDDHH format so we can reuse the validator
    const day = '01';
    const start = `${rp.year}${rp.month}${day}00`;
    const startDt = aqsUtil.validateTimestampAndExtractDate(start);

    if (startDt === null) {
        errors.push('Given year/month is invalid date');
    }

    throwIfNeeded(errors);
};

aqsUtil.convertTimestampToDate = function(timestamp) {
    const year = parseInt(timestamp.substring(0, 4), 10);
    const month = parseInt(timestamp.substring(4, 6), 10) - 1;
    const day = parseInt(timestamp.substring(6, 8), 10);
    return new Date(Date.UTC(year, month, day));
};

aqsUtil.convertDateToTimestamp = function(date) {
    const year = date.getUTCFullYear().toString();
    const month = (`0${(date.getUTCMonth() + 1)}`).slice(-2);
    const day = (`0${date.getUTCDate()}`).slice(-2);
    return `${year}${month}${day}`;
};

aqsUtil.getFirstFullMonthFirstDay = function(startDate) {
    const dt = aqsUtil.convertTimestampToDate(startDate);

    if (dt.getUTCDate() === 1) {
        return startDate;
    } else {
        dt.setUTCMonth(dt.getUTCMonth() + 1);
        dt.setUTCDate(1);

        return aqsUtil.convertDateToTimestamp(dt);
    }
};

aqsUtil.getLastFullMonthLastDay = function(endDate) {
    const dt = aqsUtil.convertTimestampToDate(endDate);
    const lastDayOfCurrentMonth = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));

    if (dt.getUTCDate() === lastDayOfCurrentMonth.getUTCDate()) {
        return endDate;
    } else {
        dt.setUTCDate(0);

        return aqsUtil.convertDateToTimestamp(dt);
    }
};

aqsUtil.getDayAfterLastFullMonth = function(endDate) {
    const dt = aqsUtil.convertTimestampToDate(endDate);
    dt.setUTCDate(1);
    return aqsUtil.convertDateToTimestamp(dt);
};

aqsUtil.getIntervalForCeiledValue = function(value) {
    // This shouldn't happen by data construction, checking nonetheless
    if (value < 100) {
        return '100-999';
    }
    // Special case for exactly power-of-ten values
    // They should be mapped to the previous bucket of values
    if (Math.log10(value) % 1.0 === 0.0) {
        return aqsUtil.getIntervalForCeiledValue(value - 1);
    }
    const valueString = `${value}`;
    const numberLength = valueString.length;
    const start = Math.pow(10, numberLength - 1);
    const end = Math.pow(10, numberLength) - 1;
    return `${start}-${end}`;
};

module.exports = aqsUtil;
