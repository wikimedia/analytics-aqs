'use strict';

// mocha defines to avoid JSHint breakage
/* global describe, it, before, beforeEach, afterEach */

var assert = require('../../utils/assert.js');
var preq   = require('preq');
var aqsUtil  = require('../../../lib/aqsUtil');
const TestRunner = require('../../utils/server');


describe('mediarequests endpoints', function() {
    this.timeout(20000);

    const baseURL = TestRunner.AQS_URL;

    // NOTE: this tests using the projects/aqs_default.yaml config, so
    // it doesn't know about the /metrics root like the prod config does
    var endpoints = {
        perFile: {
            daily: '/mediarequests/per-file/en.wikipedia/spider/%2Fwiktionary%2Fte%2F4%2F40%2Fpeacocks.JPG/daily/{start}/{end}',
            insertDaily: '/mediarequests/insert-per-file-mediarequests/en.wikipedia/%2Fwiktionary%2Fte%2F4%2F40%2Fpeacocks.JPG/daily/{timestamp}/{requests}',
            monthly: '/mediarequests/per-file/en.wikipedia/spider/%2Fwiktionary%2Fte%2F4%2F40%2Fpeacocks.JPG/monthly/{start}/{end}'
        },
        referer: {
            monthly: '/mediarequests/aggregate/en.wikipedia/all-media-types/all-agents/monthly/1969010100/1971010100',
            insertMonthly: '/mediarequests/insert-aggregate/en.wikipedia/all-media-types/all-agents/monthly/1970010100',
        },
    }

    // Start server before running tests
    // insert here data that tests assume exists on db to start working
    before('before-suite', function(setupDone) {

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
                uri: baseURL + endpoints.perFile.insertDaily.replace('{timestamp}', date).replace('{requests}', dataToInsert[date])
            }).catch(function(e) {
            }).then(function() {
                delete dataToInsert[date];

                // Start tests only after data insertion is finished
                if(Object.keys(dataToInsert).length === 0){
                    setupDone();
                }
            });
        });
    });

    describe('per file endpoint', () => {
        it('should return 400 when per file parameters are wrong', function() {
            return preq.get({
                uri: baseURL + endpoints.perFile.daily.replace('{start}', '201507a3').replace('{end}', '20150723')
            }).catch(function(res) {
                assert.deepEqual(res.status, 400);
            });
        });

        it('should return the expected per file data after insertion', function() {
            return preq.get({
                uri: baseURL + endpoints.perFile.daily.replace('{start}', '20150701').replace('{end}', '20150703')

            }).then(function(res) {
                assert.deepEqual(res.body.items.length, 1);
                assert.deepEqual(res.body.items[0].requests, 1001);
            });
        });

        it('should return the expected all agent types per file data after insertion', function() {
            return preq.get({
                uri: baseURL + endpoints.perFile.daily.replace('{start}', '20150701')
                    .replace('{end}', '20150703')
                    .replace('spider', 'all-agents')

            }).then(function(res) {
                assert.deepEqual(res.body.items.length, 1);
                assert.deepEqual(res.body.items[0].requests, 2003);
            });
        });

        function r(s, replaceSpaces) {
            var weirdArticleTitle = 'dash - space : colon % percent / slash';
            if (replaceSpaces) {
                weirdArticleTitle = weirdArticleTitle.replace(/ /g, '_');
            }
            return s.replace(
                '/%2Fwiktionary%2Fte%2F4%2F40%2Fpeacocks.JPG/', '/' + encodeURIComponent(weirdArticleTitle) + '/'
            );
        }

        it('should handle per file queries with encoded characters', function() {
            return preq.post({
                // the way we have configured the test insert-per-article endpoint
                // means requests_desktop_spider will be 1007 when we pass /100
                uri: baseURL + r(endpoints.perFile.insertDaily.replace('{timestamp}', 2015070200), true).replace('{resquests}', 100)
            }).then(function() {
                return preq.get({
                    uri: baseURL + r(endpoints.perFile.daily.replace('{start}', '20150701').replace('{end}', '20150703'))
                });
            }).then(function(res) {
                assert.deepEqual(res.body.items.length, 1);
                assert.deepEqual(res.body.items[0].file_path, 'dash_-_space_:_colon_%_percent_/_slash');
            });
        });

        it('should return data when start = timestamp = end and YYYYMMDD is used', function() {
            return preq.get({
                uri: baseURL +
                        endpoints.perFile.daily
                            .replace('{start}', '20150702')
                            .replace('{end}', '20150702')
            }).then(function(res) {
                assert.deepEqual(res.body.items.length, 1);
                assert.deepEqual(res.body.items[0].requests, 1001);
            });
        });

        it('should return the expected per file monthly data after insertion', function() {
            return preq.get({
                uri: baseURL + endpoints.perFile.monthly.replace('{start}', '20150601').replace('{end}', '20150803')

            }).then(function(res) {
                assert.deepEqual(res.body.items.length, 2);
                assert.deepEqual(res.body.items[0].requests, 3001);
                assert.deepEqual(res.body.items[1].requests, 3002);
            });
        });

        it('should return the expected monthly data only for full months', function() {
            return preq.get({
                uri: baseURL +
                        endpoints.perFile.monthly
                        .replace('{start}', '20151120')
                        .replace('{end}', '20160103')

            }).then(function(res) {
                assert.deepEqual(res.body.items.length, 1);
                assert.deepEqual(res.body.items[0].requests, 5001);
            });
        });

        it('should return 400 when there are no full months in specified date range', function() {
            return preq.get({
                uri: baseURL +
                        endpoints.perFile.monthly
                        .replace('{start}', '20151203')
                        .replace('{end}', '20151220')

            }).catch(function(res) {
                assert.deepEqual(res.status, 400);
            });
        });
    });

    describe('per referer aggregate endpoint', () => {
        it('should return 400 when aggregate parameters are wrong', function() {
            return preq.get({
                uri: baseURL + endpoints.referer.monthly.replace('1971010100', '20150701000000')
            }).catch(function(res) {
                assert.deepEqual(res.status, 400);
            });
        });

        it('should return 400 when start is before end', function() {
            return preq.get({
                uri: baseURL + endpoints.referer.monthly.replace('1969010100', '2016070100')
            }).catch(function(res) {
                assert.deepEqual(res.status, 400);
            });
        });

        it('should return 400 when timestamp is invalid', function() {
            return preq.get({
                uri: baseURL + endpoints.referer.monthly.replace('1971010100', '2015022900')
            }).catch(function(res) {
                assert.deepEqual(res.status, 400);
            });
        });

        it('should return multiple hours inside a day', function () {
            var datesToAdd = 3;
            ['2017010100', '2017010101', '2017010102'].forEach(function (timestamp) {
                preq.post({
                    uri: baseURL + endpoints.referer.insertMonthly
                        .replace('1970010100', timestamp) + '/100'
                }).then(function (res) {
                    datesToAdd--;
                    if (datesToAdd === 0) {
                        preq.get({
                            uri: baseURL + endpoints.referer.monthly
                                .replace('1969010100', '2017010100')
                                .replace('1971010100', '2017010102')
                        }).then(function (res) {
                            assert.deepEqual(res.body.items.length, 3);
                            assert.deepEqual(res.body.items[0].timestamp, '2017010100');
                            assert.deepEqual(res.body.items[0].requests, 100);
                            assert.deepEqual(res.body.items[1].timestamp, '2017010101');
                            assert.deepEqual(res.body.items[1].requests, 100);
                            assert.deepEqual(res.body.items[2].timestamp, '2017010102');
                            assert.deepEqual(res.body.items[2].requests, 100);
                        });
                    }
                });
            });
        });
    })


})