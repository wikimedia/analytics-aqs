'use strict';

// mocha defines to avoid JSHint breakage
/* global describe, it, before, beforeEach, afterEach */

var assert = require('../../utils/assert.js');
var preq   = require('preq');
var server = require('../../utils/server.js');


describe('pageviews endpoints', function() {
    this.timeout(20000);


    // NOTE: this tests using the projects/aqs_default.yaml config, so
    // it doesn't know about the /metrics root like the prod config does
    var articleEndpoint = '/pageviews/per-article/en.wikipedia/desktop/spider/one/daily/20150701/20150703';
    var articleEndpointMobile = '/pageviews/per-article/en.wikipedia/desktop/user/one/daily/20150701/20150703';
    var articleEndpointMonthly = '/pageviews/per-article/en.wikipedia/desktop/spider/one/monthly/20150601/20150803';
    var projectEndpoint = '/pageviews/aggregate/en.wikipedia/all-access/all-agents/hourly/1969010100/1971010100';
    var topsEndpoint = '/pageviews/top/en.wikipedia/mobile-web/2015/01/all-days';
    var projectEndpointStrip = '/pageviews/aggregate/www.en.wikipedia.org/all-access/all-agents/hourly/1969010100/1971010100';

    // Fake data insertion endpoints
    var insertArticleEndpoint = '/pageviews/insert-per-article-flat/en.wikipedia/one/daily/2015070200';
    var insertProjectEndpoint = '/pageviews/insert-aggregate/en.wikipedia/all-access/all-agents/hourly/1970010100';
    var insertProjectEndpointLong = '/pageviews/insert-aggregate-long/en.wikipedia/all-access/all-agents/hourly/1970010100';
    var insertTopsEndpoint = '/pageviews/insert-top/en.wikipedia/mobile-web/2015/01/all-days';

    function fix(b, s, u) { return b.replace(s, s + u); }

    // Start server before running tests
    // insert here data that tests assume exists on db to start working
    before('before-suite', function(setupDone) {
        return server.start().then(function() {
            const dataToInsert = {
                2015070200: 100,
                2015072100: 200,
                2015063000: 300,
                2015112500: 400,
                2015121500: 500,
                2016010200: 600
            };

            Object.keys(dataToInsert).map(function(date){
                preq.post({
                    // the way we have configured the test insert-per-article endpoint
                    // means views_desktop_spider will be 1007 when we pass /100
                    uri: server.config.aqsURL + insertArticleEndpoint.replace('2015070200', date) + '/' + dataToInsert[date]
                }).catch(function(e) {
                    console.log(e);
                }).then(function() {
                    delete dataToInsert[date];

                    // Start tests only after data insertion is finished
                    if(Object.keys(dataToInsert).length === 0){
                        setupDone();
                    }
                });
            });
        });
    });

    // Test Article Endpoint

    it('should return 400 when per article parameters are wrong', function() {
        return preq.get({
            uri: server.config.aqsURL + articleEndpoint.replace('20150703', '201507a3')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    it('should return the expected per article data after insertion', function() {
        return preq.get({
            uri: server.config.aqsURL + articleEndpoint

        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepEqual(res.body.items[0].views, 1007);
        });
    });

    it('should return the expected per article data even if project is uppercase and with org sufix', function() {
        return preq.get({
            uri: server.config.aqsURL + articleEndpoint.replace('en.wikipedia', 'EN.WIKIPEDIA.ORG')

        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepEqual(res.body.items[0].views, 1007);
        });
    });

    it('should return integer zero if view count is null', function () {
        return preq.get({
            uri: server.config.aqsURL + articleEndpointMobile

        }).then(function (res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepEqual(res.body.items[0].views, 0);
        });
    });

    function r(s, replaceSpaces) {
        var weirdArticleTitle = 'dash - space : colon % percent / slash';
        if (replaceSpaces) {
            weirdArticleTitle = weirdArticleTitle.replace(/ /g, '_');
        }

        return s.replace(
            '/one/', '/' + encodeURIComponent(weirdArticleTitle) + '/'
        );
    }

    it('should handle per article queries with encoded characters', function() {
        return preq.post({
            // the way we have configured the test insert-per-article endpoint
            // means views_desktop_spider will be 1007 when we pass /100
            uri: server.config.aqsURL + r(insertArticleEndpoint, true) + '/100'
        }).then(function() {
            return preq.get({
                uri: server.config.aqsURL + r(articleEndpoint)
            });
        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepEqual(res.body.items[0].article, 'dash_-_space_:_colon_%_percent_/_slash');
        });
    });

    it('should return data when start = timestamp = end and YYYYMMDD is used', function() {
        return preq.get({
            uri: server.config.aqsURL +
                    articleEndpoint
                        .replace('20150701', '20150702')
                        .replace('20150703', '20150702')
        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepEqual(res.body.items[0].views, 1007);
        });
    });

    it('should return the expected per article monthly data after insertion', function() {
        return preq.get({
            uri: server.config.aqsURL + articleEndpointMonthly

        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 2);
            assert.deepEqual(res.body.items[0].views, 3007);
            assert.deepEqual(res.body.items[1].views, 3014);
        });
    });

    it('should return the expected monthly data only for full months', function() {
        return preq.get({
            uri: server.config.aqsURL +
                    articleEndpointMonthly
                    .replace('20150601', '20151120')
                    .replace('20150803', '20160103')

        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepEqual(res.body.items[0].views, 5007);
        });
    });

    it('should return 400 when there are no full months in specified date range', function() {
        return preq.get({
            uri: server.config.aqsURL +
                    articleEndpointMonthly
                    .replace('20150601', '20151203')
                    .replace('20150803', '20151220')

        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    // Test Project Endpoint

    it('should return 400 when aggregate parameters are wrong', function() {
        return preq.get({
            uri: server.config.aqsURL + projectEndpoint.replace('1971010100', '20150701000000')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    it('should return 400 when start is before end', function() {
        return preq.get({
            uri: server.config.aqsURL + projectEndpoint.replace('1969010100', '2016070100')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    it('should return 400 when timestamp is invalid', function() {
        return preq.get({
            uri: server.config.aqsURL + projectEndpoint.replace('1971010100', '2015022900')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    // WARNING: the data created in this test is used exactly as created
    // by the monitoring tests.
    it('should return the expected aggregate data after insertion', function() {
        return preq.post({
            uri: server.config.aqsURL + insertProjectEndpoint + '/0'
        }).then(function() {
            return preq.get({
                uri: server.config.aqsURL + projectEndpoint
            });
        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepEqual(res.body.items[0].views, 0);
        });
    });

    it('should return the expected aggregate data after insertion, when querying with www.<<project>>.org', function() {
        // data for this is already inserted in the test above, weird that tests are inter-dependent
        return preq.get({
            uri: server.config.aqsURL + projectEndpointStrip
        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepEqual(res.body.items[0].views, 0);
        });
    });

    it('should return the expected aggregate data after long insertion', function() {
        return preq.post({
            uri: server.config.aqsURL +
                 fix(insertProjectEndpointLong, 'en.wikipedia', '1') +
                 '/0'
        }).then(function() {
            return preq.get({
                uri: server.config.aqsURL +
                     fix(projectEndpoint, 'en.wikipedia', '1')
            });
        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepEqual(res.body.items[0].views, 0);
        });
    });

    it('should parse the v column string into an int', function() {
        return preq.post({
            uri: server.config.aqsURL +
                 fix(insertProjectEndpointLong, 'en.wikipedia', '3') +
                 '/9007199254740991'
        }).then(function() {
            return preq.get({
                uri: server.config.aqsURL +
                     fix(projectEndpoint, 'en.wikipedia', '3')
            });
        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepStrictEqual(res.body.items[0].views, 9007199254740991);
        });
    });


    // Test Top Endpoint

    it('should return 400 when tops parameters are wrong', function() {
        return preq.get({
            uri: server.config.aqsURL + topsEndpoint.replace('all-days', 'all-dayz')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    it('Should return 400 when all-year is used for the year parameter', function() {
        return preq.get({
            uri: server.config.aqsURL + topsEndpoint.replace('2015', 'all-years')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    it('Should return 400 when all-months is used for the month parameter', function() {
        return preq.get({
            uri: server.config.aqsURL + topsEndpoint.replace('01', 'all-months')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    it('should return 400 when tops date is invalid', function() {
        return preq.get({
            uri: server.config.aqsURL + topsEndpoint.replace('01/all-days', '02/29')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    it('should return the expected tops data after insertion', function() {
        return preq.post({
            uri: server.config.aqsURL + insertTopsEndpoint,
            body: {
                articles: [{
                        rank: 1,
                        article: 'o"n"e',
                        views: 2000
                    },{
                        rank: 2,
                        article: 'two\\',
                        views: 1000
                    }
                ]
            },
            headers: { 'content-type': 'application/json' }

        }).then(function() {
            return preq.get({
                uri: server.config.aqsURL + topsEndpoint
            });
        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            assert.deepEqual(res.body.items[0].articles[0].article, 'o"n"e');
            assert.deepEqual(res.body.items[0].articles[1].views, 1000);
            assert.deepEqual(res.body.items[0].articles[1].article, 'two\\');
        });
    });
});
