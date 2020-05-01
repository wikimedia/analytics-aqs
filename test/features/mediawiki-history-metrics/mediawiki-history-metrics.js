'use strict';

// mocha defines to avoid JSHint breakage
/* global describe, it, before, beforeEach, afterEach */

var assertBase = require('assert');
var assert = require('../../utils/assert.js');
var preq   = require('preq');
const TestRunner = require('../../utils/server');
var aqsUtil  = require('../../../lib/aqsUtil');

/*
  In order to be able to fake a druid endpoint inside AQS,
  we need the test data (fixtures) to be available not only
  in this test file but also in the fake_druid.js one.
  Therefore this file is only a loop reading fixtures from
  other files and comparing results against expected.
  See edits_fitures.js for actual test data.
*/
var fixtures = require('./fixtures.js');


describe('mediawiki-history-metrics endpoints', function() {
    this.timeout(20000);

    const baseURL = TestRunner.AQS_URL;

    // Tests for druid endpoints.

    var makeTest = function(fixture) {
        it(fixture.describe, () => {
            var uri = baseURL + fixture.aqsEndpoint;
            return preq.get({
                uri: uri
            }).then(res => {
                if (fixture.expectedAqsResult) {
                    assertBase.strictEqual(res.status, fixture.expectedAqsResult.status);
                    assert.deepEqual(res.body, fixture.expectedAqsResult.body);
                }
            }).catch(res => {
                if (fixture.expectedAqsResult) {
                    assertBase.strictEqual(res.status, fixture.expectedAqsResult.status);
                }
            });
        });
    }

    for (var i in fixtures.values) {
        makeTest(fixtures.values[i]);
    }

    // Tests for cassandra endpoints.

    // NOTE: This tests use the projects/aqs_default.yaml config, so
    // they don't know about the /metrics root like the prod config does.
    var endpoints = {
        bycountry: {
            insert_monthly: '/editors/insert-by-country/en.wikipedia/5..99-edits/2020/05',
            monthly: '/editors/by-country/en.wikipedia/5..99-edits/2020/05'
        }
    }

    it('should return 400 when bycountry parameters are wrong', function() {
        return preq.get({
            uri: baseURL + endpoints.bycountry.monthly.replace('en.wikipedia', 'w\'eird')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
        return preq.get({
            uri: baseURL + endpoints.bycountry.monthly.replace('5..99-edits', '3..47-edits')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
        return preq.get({
            uri: baseURL + endpoints.bycountry.monthly.replace('2020', 'xyzw')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
        return preq.get({
            uri: baseURL + endpoints.bycountry.monthly.replace('05', '50')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    it('should return 400 when bycountry parameters are all aggregators', function() {
        return preq.get({
            uri: baseURL + endpoints.bycountry.monthly.replace('en.wikipedia', 'all-projects')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
        return preq.get({
            uri: baseURL + endpoints.bycountry.monthly.replace('5..99-edits', 'all-activity-levels')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
        return preq.get({
            uri: baseURL + endpoints.bycountry.monthly.replace('2020', 'all-years')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
        return preq.get({
            uri: baseURL + endpoints.bycountry.monthly.replace('05', 'all-months')
        }).catch(function(res) {
            assert.deepEqual(res.status, 400);
        });
    });

    it('should return the expected data after bycountry insertion', function () {
        return preq.post({
            uri: baseURL + endpoints.bycountry.insert_monthly,
            body: {
                countries: [
                    {country: 'MUK', 'editors-ceil': 10},
                    {country: 'JJI', 'editors-ceil': 20},
                    {country: 'PPA', 'editors-ceil': 30}
                ]
            },
            headers: { 'content-type': 'application/json' }
        }).then(function() {
            return preq.get({
                uri: baseURL + endpoints.bycountry.monthly
            });
        }).then(function(res) {
            assert.deepEqual(res.body.items.length, 1);
            var countries = res.body.items[0].countries;
            assert.deepEqual(countries[0].country, 'MUK');
            assert.deepEqual(countries[0]['editors-ceil'], 10);
            assert.deepEqual(countries[1].country, 'JJI');
            assert.deepEqual(countries[1]['editors-ceil'], 20);
            assert.deepEqual(countries[2].country, 'PPA');
            assert.deepEqual(countries[2]['editors-ceil'], 30);
        });
    })
});
