'use strict';

// mocha defines to avoid JSHint breakage
/* global describe, it, before, beforeEach, afterEach */

var assert = require('../../utils/assert.js');
var preq   = require('preq');
var aqsUtil  = require('../../../lib/aqsUtil');
const TestRunner = require('../../utils/server');


describe('knowledge gap endpoints', function() {
    this.timeout(20000);

    const baseURL = TestRunner.AQS_URL;


    // NOTE: this tests using the projects/aqs_default.yaml config, so
    // it doesn't know about the /metrics root like the prod config does
    var endpoints = {
        byCategoryTest: {
            metricQuery: '/knowledge-gap/per-category/en.wikipedia/geographic/nigeria/20220301/20221201',
            insertMetricEndpoint: '/knowledge-gap/insert-per-category/en.wikipedia/geographic/nigeria/revision_count/'
        },
    }

    function fix(b, s, u) { return b.replace(s, s + u); }

    // Start server before running tests
    // insert here data that tests assume exists on db to start working
    before('before-suite', function(setupDone) {

        const dataToInsertByCategory = {
            20220301: 100,
            20220501: 200,
            20220701: 300,
            20220901: 400,
            20221201: 500,
            20230201: 600
        };

        Object.keys(dataToInsertByCategory).map(function(date){
            preq.post({
                uri: baseURL + endpoints.byCategoryTest.insertMetricEndpoint + date + '/' + dataToInsertByCategory[date]
            }).then(function() {

                var x = baseURL + endpoints.byCategoryTest.insertMetricEndpoint + date + '/' + dataToInsertByCategory[date];

                delete dataToInsertByCategory[date];
                // Start tests only after data insertion is finished
                if(Object.keys(dataToInsertByCategory).length === 0){
                    setupDone();
                }
            });
        });
    });

    describe('per category endpoint', () => {
        it('should retrieve some data', function() {
            return preq.get({
                uri: baseURL + endpoints.byCategoryTest.metricQuery
            }).then(function(res) {
                assert.deepEqual(res.body.items[0].value, 200);
            });
        });
    });
});
