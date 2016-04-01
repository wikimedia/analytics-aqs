'use strict';

/**
 * Pageviews API module
 *
 * This API serves pre-aggregated pageview statistics from Cassandra
 */

var HyperSwitch = require('hyperswitch');
var path = require('path');
var HTTPError = HyperSwitch.HTTPError;
var URI = HyperSwitch.URI;

var aqsUtil = require('../lib/aqsUtil');

var spec = HyperSwitch.utils.loadSpec(path.join(__dirname, 'pageviews.yaml'));

// Pageviews Service
function PJVS(options) {
    this.options = options;
}


var tables = {
    articleFlat: 'pageviews.per.article.flat',
    project: 'pageviews.per.project',
    tops: 'top.pageviews',
};
var tableURI = function(domain, tableName) {
    return new URI([domain, 'sys', 'table', tableName, '']);
};
var tableSchemas = {
    articleFlat: {
        table: tables.articleFlat,
        version: 2,
        attributes: {
            project: 'string',
            article: 'string',
            granularity: 'string',
            // the hourly timestamp will be stored as YYYYMMDDHH
            timestamp: 'string'

            // The various int columns that hold view counts are added below
        },
        index: [
            { attribute: 'project', type: 'hash' },
            { attribute: 'article', type: 'hash' },
            { attribute: 'granularity', type: 'hash' },
            { attribute: 'timestamp', type: 'range', order: 'asc' },
        ],
        options: {
            updates: {
                pattern: 'timeseries'
            }
        }
    },
    project: {
        table: tables.project,
        version: 2,
        attributes: {
            project: 'string',
            access: 'string',
            agent: 'string',
            granularity: 'string',
            // the hourly timestamp will be stored as YYYYMMDDHH
            timestamp: 'string',
            views: 'int',
            v: 'long'
        },
        index: [
            { attribute: 'project', type: 'hash' },
            { attribute: 'access', type: 'hash' },
            { attribute: 'agent', type: 'hash' },
            { attribute: 'granularity', type: 'hash' },
            { attribute: 'timestamp', type: 'range', order: 'asc' },
        ]
    },
    tops: {
        table: tables.tops,
        version: 2,
        attributes: {
            project: 'string',
            access: 'string',
            year: 'string',
            month: 'string',
            day: 'string',
            // this is deprecated, it used to be json stringified to look like:
            // [{\"rank\": 1, \"article\": \"<<title>>\", \"views\": 123}, ...]
            articles: 'string',
            // this will be preferred to articles and uses the same format
            articlesJSON: 'json'
        },
        index: [
            { attribute: 'project', type: 'hash' },
            { attribute: 'access', type: 'hash' },
            { attribute: 'year', type: 'hash' },
            { attribute: 'month', type: 'hash' },
            { attribute: 'day', type: 'hash' },
        ]
    }
};


var viewCountColumnsForArticleFlat = {
    views_all_access_all_agents: 'aa', // views for all-access, all-agents
    views_all_access_bot: 'ab',        // views for all-access, bot
    views_all_access_spider: 'as',     // views for all-access, spider
    views_all_access_user: 'au',       // views for all-access, user

    views_desktop_all_agents: 'da',    // views for desktop, all-agents
    views_desktop_bot: 'db',           // views for desktop, bot
    views_desktop_spider: 'ds',        // views for desktop, spider
    views_desktop_user: 'du',          // views for desktop, user

    views_mobile_app_all_agents: 'maa', // views for mobile-app, all-agents
    views_mobile_app_bot: 'mab',        // views for mobile-app, bot
    views_mobile_app_spider: 'mas',     // views for mobile-app, spider
    views_mobile_app_user: 'mau',       // views for mobile-app, user

    views_mobile_web_all_agents: 'mwa', // views for mobile-web, all-agents
    views_mobile_web_bot: 'mwb',        // views for mobile-web, bot
    views_mobile_web_spider: 'mws',     // views for mobile-web, spider
    views_mobile_web_user: 'mwu'        // views for mobile-web, user
};

// in the pageviews.per.article.flat table, make an integer column for each
// view count column in the dictionary above, using its short name.
// The short name saves space because cassandra stores the column name with
// each record.
Object.keys(viewCountColumnsForArticleFlat).forEach(function(k) {
    tableSchemas.articleFlat.attributes[viewCountColumnsForArticleFlat[k]] = 'int';
});


PJVS.prototype.pageviewsForArticleFlat = function(hyper, req) {
    var rp = req.params;

    // dates are passed in as YYYYMMDD but we need the HH to match the loaded data
    // which was originally planned at hourly resolution, so we pass "fakeHour"
    aqsUtil.validateStartAndEnd(rp, { fakeHour: true });

    var dataRequest = hyper.get({
        uri: tableURI(rp.domain, tables.articleFlat),
        body: {
            table: tables.articleFlat,
            attributes: {
                project: rp.project,
                article: rp.article.replace(/ /g, '_'),
                granularity: rp.granularity,
                timestamp: { between: [rp.start, rp.end] },
            }
        }

    }).catch(aqsUtil.notFoundCatcher);

    function viewKey(access, agent) {
        var ret = ['views', access, agent].join('_');
        return viewCountColumnsForArticleFlat[ret.replace(/-/g, '_')];
    }

    function removeDenormalizedColumns(item) {
        Object.keys(viewCountColumnsForArticleFlat).forEach(function(k) {
            delete item[viewCountColumnsForArticleFlat[k]];
        });
    }

    return dataRequest.then(aqsUtil.normalizeResponse).then(function(res) {
        if (res.body.items) {
            res.body.items.forEach(function(item) {
                item.access = rp.access;
                item.agent = rp.agent;
                item.views = item[viewKey(rp.access, rp.agent)];
                removeDenormalizedColumns(item);
            });
        }

        return res;
    });
};

PJVS.prototype.pageviewsForProjects = function(hyper, req) {
    var rp = req.params;

    aqsUtil.validateStartAndEnd(rp);

    var dataRequest = hyper.get({
        uri: tableURI(rp.domain, tables.project),
        body: {
            table: tables.project,
            attributes: {
                project: rp.project,
                access: rp.access,
                agent: rp.agent,
                granularity: rp.granularity,
                timestamp: { between: [rp.start, rp.end] },
            }
        }

    }).catch(aqsUtil.notFoundCatcher);

    return dataRequest.then(aqsUtil.normalizeResponse).then(function(res) {
        if (res.body.items) {
            res.body.items.forEach(function(item) {
                // prefer the v column if it's loaded
                if (item.v !== null) {
                    try {
                        item.views = parseInt(item.v, 10);
                    } catch (e) {
                        item.views = null;
                    }
                }
                delete item.v;
            });
        }

        return res;
    });
};

PJVS.prototype.pageviewsForTops = function(hyper, req) {
    var rp = req.params;

    aqsUtil.validateYearMonthDay(rp);

    var dataRequest = hyper.get({
        uri: tableURI(rp.domain, tables.tops),
        body: {
            table: tables.tops,
            attributes: {
                project: rp.project,
                access: rp.access,
                year: rp.year,
                month: rp.month,
                day: rp.day
            }
        }

    }).catch(aqsUtil.notFoundCatcher);

    return dataRequest.then(aqsUtil.normalizeResponse).then(function(res) {
        if (res.body.items) {
            res.body.items.forEach(function(item) {
                // prefer the articlesJSON column if it's loaded
                if (item.articlesJSON !== null) {
                    item.articles = item.articlesJSON;
                } else {
                    try {
                        item.articles = JSON.parse(item.articles);
                    } catch (e) {
                        throw new HTTPError({
                            status: 500,
                            body: {
                                type: 'error',
                                description: 'This response contained invalid JSON, we are ' +
                                    'working on fixing the problem, but until then you can ' +
                                    'try a different date.'
                            }
                        });
                    }
                }
                delete item.articlesJSON;
            });
        }

        return res;
    });
};


module.exports = function(options) {
    var pjvs = new PJVS(options);

    return {
        spec: spec,
        operations: {
            pageviewsForArticle: pjvs.pageviewsForArticleFlat.bind(pjvs),
            pageviewsForProjects: pjvs.pageviewsForProjects.bind(pjvs),
            pageviewsForTops: pjvs.pageviewsForTops.bind(pjvs),
        },
        resources: [
            {
                uri: '/{domain}/sys/table/' + tables.articleFlat,
                body: tableSchemas.articleFlat,
            }, {
                // pageviews per project table
                uri: '/{domain}/sys/table/' + tables.project,
                body: tableSchemas.project,
            }, {
                // top pageviews table
                uri: '/{domain}/sys/table/' + tables.tops,
                body: tableSchemas.tops,
            }
        ]
    };
};
