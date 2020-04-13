'use strict';

// mocha defines to avoid JSHint breakage
/* global describe, it, before, beforeEach, afterEach */

var assert = require('../../utils/assert.js');
var preq   = require('preq');
const fs   = require('fs');
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
        top: {
            all: '/mediarequests/top/en.wikipedia/all-media-types/2015/01/all-days',
            insert: '/mediarequests/insert-top/en.wikipedia/all-media-types/2015/01/all-days'
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
            var weirdArticleTitle = 'dash - space : colon % percent';
            weirdArticleTitle = weirdArticleTitle.replace(/ /g, '_');
            return s.replace(
                '/%2Fwiktionary%2Fte%2F4%2F40%2Fpeacocks.JPG/', '/' + encodeURIcomponent(weirdArticleTitle) + '/'
            );
        }

        it('should handle per file queries with encoded characters', function() {
            return Promise.all(fs.readFileSync(__dirname + '/urls_with_punctuation.tsv').toString()
                .split('\n').slice(1)
                .map(row => {
                    const annoyingFileNameForLoading = row.split('\t')[2];
                    const insertUrl = `/mediarequests/insert-per-file-mediarequests/en.wikipedia/${annoyingFileNameForLoading}/daily/2015070200/100`;
                    const fileName = encodeURIComponent(row.split('\t')[0]);
                    const queryUrl = `/mediarequests/per-file/en.wikipedia/spider/${fileName}/daily/20150701/20150703`;
                    return preq.post({
                        uri: baseURL + insertUrl
                    }).then(function() {
                        return preq.get({
                            uri: baseURL + queryUrl
                        });
                    }).then(function(res) {
                        assert.deepEqual(res.body.items.length, 1);
                    });
                }))
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

    describe('tops endpoint', () => {

        it('should return 400 when tops parameters are wrong', function() {
            return preq.get({
                uri: baseURL + endpoints.top.all.replace('all-days', 'all-dayz')
            }).catch(function(res) {
                assert.deepEqual(res.status, 400);
            });
        });

        it('Should return 400 when all-year is used for the year parameter', function() {
            return preq.get({
                uri: baseURL + endpoints.top.all.replace('2015', 'all-years')
            }).catch(function(res) {
                assert.deepEqual(res.status, 400);
            });
        });

        it('Should return 400 when all-months is used for the month parameter', function() {
            return preq.get({
                uri: baseURL + endpoints.top.all.replace('01', 'all-months')
            }).catch(function(res) {
                assert.deepEqual(res.status, 400);
            });
        });

        it('should return 400 when tops date is invalid', function() {
            return preq.get({
                uri: baseURL + endpoints.top.all.replace('01/all-days', '02/29')
            }).catch(function(res) {
                assert.deepEqual(res.status, 400);
            });
        });

        it('should return the expected tops data after insertion, in rank order', function() {
            return preq.post({
                uri: baseURL + endpoints.top.insert,
                body: {
                    files: [{
                        rank: 2,
                        file_path: 'two\\',
                        requests: 1000
                    },{
                        rank: 1,
                        file_path: 'o"n"e',
                        requests: 2000
                    }]
                },
                headers: { 'content-type': 'application/json' }

            }).then(function() {
                return preq.get({
                    uri: baseURL + endpoints.top.all
                });
            }).then(function(res) {
                assert.deepEqual(res.body.items.length, 1);
                assert.deepEqual(res.body.items[0].files[0].file_path, 'o"n"e');
                assert.deepEqual(res.body.items[0].files[1].requests, 1000);
                assert.deepEqual(res.body.items[0].files[1].file_path, 'two\\');
            });
        });
    })


})