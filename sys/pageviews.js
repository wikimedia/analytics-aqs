'use strict';

/**
 * Pageviews API module
 *
 * This API serves pre-aggregated pageview statistics from Cassandra
 */

const HyperSwitch = require('hyperswitch');
const path = require('path');
const HTTPError = HyperSwitch.HTTPError;
const URI = HyperSwitch.URI;

const aqsUtil = require('../lib/aqsUtil');

const spec = HyperSwitch.utils.loadSpec(path.join(__dirname, 'pageviews.yaml'));

const MONTHLY = 'monthly';
const DAILY = 'daily';

// Pageviews Service
function PJVS(options) {
    this.options = options;
}

function tableURI(domain, tableName) {
    return new URI([domain, 'sys', 'table', tableName, '']);
}

const tables = {
    articleFlat: 'pageviews.per.article.flat',
    project_v2: 'pageviews.per.project.v2',
    tops: 'top.pageviews',
    bycountry: 'top.bycountry',
    percountry: 'top.percountry'
};

const tableSchemas = {
    articleFlat: {
        table: tables.articleFlat,
        version: 3,
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
        ]
    },
    project_v2: {
        table: tables.project_v2,
        version: 3,
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
        version: 3,
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
    },
    bycountry: {
        table: tables.bycountry,
        version: 1,
        attributes: {
            project: 'string',
            access: 'string',
            year: 'string',
            month: 'string',
            countriesJSON: 'json'
        },
        index: [
            { attribute: 'project', type: 'hash' },
            { attribute: 'access', type: 'hash' },
            { attribute: 'year', type: 'hash' },
            { attribute: 'month', type: 'hash' }
        ]
    },
    percountry: {
        table: tables.percountry,
        version: 1,
        attributes: {
            country: 'string',
            access: 'string',
            year: 'string',
            month: 'string',
            day: 'string',
            articles: 'json'
        },
        index: [
            { attribute: 'country', type: 'hash' },
            { attribute: 'access', type: 'hash' },
            { attribute: 'year', type: 'hash' },
            { attribute: 'month', type: 'hash' },
            { attribute: 'day', type: 'hash' }
        ]
    }
};


const viewCountColumnsForArticleFlat = {
    views_all_access_all_agents: 'aa', // views for all-access, all-agents
    views_all_access_automated: 'ab',  // views for all-access, automated
    views_all_access_spider: 'as',     // views for all-access, spider
    views_all_access_user: 'au',       // views for all-access, user

    views_desktop_all_agents: 'da',    // views for desktop, all-agents
    views_desktop_automated: 'db',     // views for desktop, automated
    views_desktop_spider: 'ds',        // views for desktop, spider
    views_desktop_user: 'du',          // views for desktop, user

    views_mobile_app_all_agents: 'maa', // views for mobile-app, all-agents
    views_mobile_app_automated: 'mab',  // views for mobile-app, automated
    views_mobile_app_spider: 'mas',     // views for mobile-app, spider
    views_mobile_app_user: 'mau',       // views for mobile-app, user

    views_mobile_web_all_agents: 'mwa', // views for mobile-web, all-agents
    views_mobile_web_automated: 'mwb',  // views for mobile-web, automated
    views_mobile_web_spider: 'mws',     // views for mobile-web, spider
    views_mobile_web_user: 'mwu'        // views for mobile-web, user
};

// in the pageviews.per.article.flat table, make an integer column for each
// view count column in the dictionary above, using its short name.
// The short name saves space because cassandra stores the column name with
// each record.
Object.values(viewCountColumnsForArticleFlat).forEach((v) => {
    tableSchemas.articleFlat.attributes[v] = 'int';
});

function viewKeyForArticleFlat(access, agent) {
    const ret = ['views', access, agent].join('_');
    return viewCountColumnsForArticleFlat[ret.replace(/-/g, '_')];
}

function removeDenormalizedColumnsForArticleFlat(item) {
    Object.values(viewCountColumnsForArticleFlat).forEach((v) => {
        delete item[v];
    });
}

PJVS.prototype.pageviewsForArticleFlat = function(hyper, req) {
    const rp = req.params;
    const project = aqsUtil.normalizeProject(rp.project);
    // dates are passed in as YYYYMMDD but we need the HH to match the loaded data
    // which was originally planned at hourly resolution, so we pass "fakeHour"
    // Additionally, for monthly granularity we need to take only full months into account
    aqsUtil.validateStartAndEnd(rp, {
        fakeHour: true,
        zeroHour: true,
        fullMonths: rp.granularity === MONTHLY
    });

    const dataRequest = hyper.get({
        uri: tableURI(rp.domain, tables.articleFlat),
        body: {
            table: tables.articleFlat,
            attributes: {
                project,
                article: rp.article.replace(/ /g, '_'),
                granularity: DAILY,
                timestamp: { between: [rp.start, rp.end] },
            }
        }

    }).catch(aqsUtil.notFoundCatcher);

    return dataRequest.then(aqsUtil.normalizeResponse).then((res) => {
        if (res.body.items) {
            const monthViews = {};
            const aggregateMonthly = rp.granularity === MONTHLY;

            res.body.items.forEach((item) => {
                const yearAndMonth = item.timestamp.substring(0, 6);

                item.access = rp.access;
                item.agent = rp.agent;
                item.views = item[viewKeyForArticleFlat(rp.access, rp.agent)];
                // map null to zero for view counts, we store null in cassandra for efficiency
                if (item.views === null) {
                    item.views = 0;
                }
                removeDenormalizedColumnsForArticleFlat(item);

                if (aggregateMonthly) {
                    if (!Object.prototype.hasOwnProperty.call(monthViews, yearAndMonth)) {
                        const newMonth = {
                            project: item.project,
                            article: item.article,
                            granularity: MONTHLY,
                            timestamp: `${yearAndMonth}0100`,
                            access: rp.access,
                            agent: rp.agent,
                            views: 0
                        };

                        monthViews[yearAndMonth] = newMonth;
                    }

                    monthViews[yearAndMonth].views += item.views;
                }
            });

            if (aggregateMonthly) {
                const sortedMonths = Object.keys(monthViews);
                sortedMonths.sort();
                res.body.items = sortedMonths.map((month) => {
                    return monthViews[month];
                });
            }
        }

        return res;
    });
};

PJVS.prototype.pageviewsForProjects = function(hyper, req) {
    const rp = req.params;
    const project = aqsUtil.normalizeProject(rp.project);
    aqsUtil.validateStartAndEnd(rp, {
        fakeHour: (rp.granularity === MONTHLY || rp.granularity === DAILY),
        zeroHour: (rp.granularity === MONTHLY || rp.granularity === DAILY),
        fullMonths: rp.granularity === MONTHLY
    });

    const dataRequest = hyper.get({
        uri: tableURI(rp.domain, tables.project_v2),
        body: {
            table: tables.project_v2,
            attributes: {
                project,
                access: rp.access,
                agent: rp.agent,
                granularity: rp.granularity,
                timestamp: { between: [rp.start, rp.end] },
            }
        }

    }).catch(aqsUtil.notFoundCatcher);

    return dataRequest.then(aqsUtil.normalizeResponse).then((res) => {
        if (res.body.items) {
            res.body.items.forEach((item) => {
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
    const rp = req.params;
    const project = aqsUtil.normalizeProject(rp.project);

    aqsUtil.validateYearMonthDay(rp);

    const dataRequest = hyper.get({
        uri: tableURI(rp.domain, tables.tops),
        body: {
            table: tables.tops,
            attributes: {
                project,
                access: rp.access,
                year: rp.year,
                month: rp.month,
                day: rp.day
            }
        }

    }).catch(aqsUtil.notFoundCatcher);

    return dataRequest.then(aqsUtil.normalizeResponse).then((res) => {
        if (res.body.items) {
            res.body.items.forEach((item) => {
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
                item.articles.sort((a, b) => a.rank - b.rank);
            });
        }

        return res;
    });
};

PJVS.prototype.pageviewsByCountry = function(hyper, req) {
    const rp = req.params;
    const project = aqsUtil.normalizeProject(rp.project);

    aqsUtil.validateYearMonth(rp);

    const dataRequest = hyper.get({
        uri: tableURI(rp.domain, tables.bycountry),
        body: {
            table: tables.bycountry,
            attributes: {
                project,
                access: rp.access,
                year: rp.year,
                month: rp.month
            }
        }

    }).catch(aqsUtil.notFoundCatcher);

    return dataRequest.then(aqsUtil.normalizeResponse).then((res) => {
        if (res.body.items) {
            res.body.items.forEach((item) => {
                item.countries = item.countriesJSON;
                delete item.countriesJSON;
                if (typeof item.countries[0].views === 'number') {
                    item.countries.forEach((country) => {
                        country.views_ceil = country.views;
                        country.views = aqsUtil.getIntervalForCeiledValue(country.views);
                    });
                }
            });
        }
        return res;
    });
};

PJVS.prototype.pageviewsPerCountry = function(hyper, req) {
    const rp = req.params;

    aqsUtil.validateYearMonthDay(rp);

    const dataRequest = hyper.get({
        uri: tableURI(rp.domain, tables.percountry),
        body: {
            table: tables.percountry,
            attributes: {
                country: rp.country,
                access: rp.access,
                year: rp.year,
                month: rp.month,
                day: rp.day
            }
        }
    }).catch(aqsUtil.notFoundCatcher);

    return dataRequest.then(aqsUtil.normalizeResponse);
};


module.exports = function(options) {
    const pjvs = new PJVS(options);

    return {
        spec,
        operations: {
            pageviewsForArticle: pjvs.pageviewsForArticleFlat.bind(pjvs),
            pageviewsForProjects: pjvs.pageviewsForProjects.bind(pjvs),
            pageviewsForTops: pjvs.pageviewsForTops.bind(pjvs),
            pageviewsByCountry: pjvs.pageviewsByCountry.bind(pjvs),
            pageviewsPerCountry: pjvs.pageviewsPerCountry.bind(pjvs),
        },
        resources: [
            {
                uri: `/{domain}/sys/table/${tables.articleFlat}`,
                body: tableSchemas.articleFlat,
            }, {
                // table where per-project data will be stored with fixed timestamps (T156312)
                uri: `/{domain}/sys/table/${tables.project_v2}`,
                body: tableSchemas.project_v2,
            }, {
                // top pageviews table
                uri: `/{domain}/sys/table/${tables.tops}`,
                body: tableSchemas.tops,
            }, {
                // pageviews by country table
                uri: `/{domain}/sys/table/${tables.bycountry}`,
                body: tableSchemas.bycountry,
            }, {
                // pageviews per country table
                uri: `/{domain}/sys/table/${tables.percountry}`,
                body: tableSchemas.percountry,
            }
        ]
    };
};
