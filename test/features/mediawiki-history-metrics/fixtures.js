
/*
  In order to be able to fake a druid endpoint inside AQS,
  we need the test data (fixtures) to be available not only
  in the test file (./mediawiki_history_metrics.js) but also
  in the fake druid server one (./fake_druid.js).
  Therefore we define tests data in this fixtures file
  and import it as needed in others.

  Fixture structure and how it is used in test / fake_druid:
  {
      describe: 'The test description for pretty printing',
      aqsEndpoint: '/the/aqs/endpoint/to/request/for/testing',
      expectedDruidQuery: 'The druid query we expect AQS to build',
      druidResult: 'The druid result to be sent if the expected queries match',
      expectedAqsResult: 'The expected result we expect AQS to send' [OPTIONAL]
  },

  Test data flow and checks:
  1] test_file  --- aqsEndpoint ---> AQS
  2] AQS        --- druidQuery  ---> fake_druid [druidQuery === expectedDruidQuery]
  3] fake_druid --- druidResult ---> AQS
  [OPTIONAL]
  4] AQS        --- aqsResult   ---> test_file [aqsResult === expectedAqsResult]


**************************************
              WARNING
**************************************
Please be extra careful at the order of the fields when building our fake queries
to be matched. The ORDER ACTUALLY MATTERS !!!??? (as I found after a week).

*/


/*****************************************
          Generic reusable functions
******************************************/

var makeErrorFixture = function(describe, aqsEndpoint) {
  return {
      describe: describe,
      aqsEndpoint: aqsEndpoint,
      expectedAqsResult: {
          status: 400
      }
  };
}

const makeStartTimestamp = function(dateTime=true) {
    return  (dateTime) ? '2017-01-01T00:00:00.000Z': '2017-01-01';
}

// We always use the same timestamps for testing
// so we can generate the end one automatically
var makeEndTimestamp = function(granularity, dateTime=true) {
    if ((granularity === 'month') || ((granularity === 'monthly'))) {
      // trick here ! for monthly granularity and dateTime = false, we want entire months, therefore first day of feb
      return (dateTime) ? '2017-02-01T00:00:00.000Z' : '2017-02-01';
    } else if ((granularity === 'day') || (granularity === 'daily')) {
        return  (dateTime) ? '2017-01-02T00:00:00.000Z': '2017-01-02';
    } else {
      throw new Error('Invalid granularity - day, daily, month or monthly expected, got ' + granularity);
    }
}


/*
 * Timeseriess helpers
 */

var makeDruidTimeseriesResult = function(measure, granularity) {
    var result = {
        status: 200,
        body: [
            { timestamp: makeStartTimestamp(), result: { } },
            { timestamp: makeEndTimestamp(granularity), result: { } }
        ]
    };
    result.body.map((item, idx) => {
        item.result[measure] = idx;
        return item;
    });
    return result;
}

var makeAqsTimeseriesResult = function(measure, granularity, project, editorType, pageType, activityLevel, pageId, editorId) {
  var result = {
      status: 200,
      body: { items: [ {
          project: project
      } ] }
  };
  if (editorType) {
      result.body.items[0]['editor-type'] = editorType;
  }
  if (pageType) {
      result.body.items[0]['page-type'] = pageType;
  }
  if (activityLevel) {
      result.body.items[0]['activity-level'] = activityLevel;
  }
  if (pageId) {
      result.body.items[0]['page-id'] = pageId;
  }
  if (editorId) {
      result.body.items[0]['editor-id'] = editorId;
  }
  result.body.items[0].granularity = granularity;
  result.body.items[0].results = [
      { timestamp: makeStartTimestamp() },
      { timestamp: makeEndTimestamp(granularity) }
  ];
  result.body.items[0].results.map((item, idx) => {
      item[measure] = idx;
      return item;
  });
  return result;
}


/*
 * Top helpers
 */

var makeDruidTopResult = function(dimension, measure, granularity) {
    var result = {
        status: 200,
        body: [
            { timestamp: makeStartTimestamp(), result: [] },
            { timestamp: makeEndTimestamp(granularity), result: [] }
        ]
    };
    result.body.map((item, idx) => {
        [...Array(idx + 1).keys()].forEach(ii => {
            var res = {};
            res[dimension] = dimension + ii.toString();
            res[measure] = ii;
            item.result.push(res);
        });
        return item;
    });
    return result;
}


var makeAqsTopResult = function(dimension, measure, granularity, project, editorType, pageType) {
    var result = {
        status: 200,
        body: { items: [ {
            project: project
        } ] }
    };
    if (editorType) {
        result.body.items[0]['editor-type'] = editorType;
    }
    if (pageType) {
        result.body.items[0]['page-type'] = pageType;
    }
    result.body.items[0].granularity = granularity;
    result.body.items[0].results = [
        { timestamp: makeStartTimestamp() },
        { timestamp: makeEndTimestamp(granularity) }
    ];
    result.body.items[0].results.map((item, idx) => {
        item.top = [];
        [...Array(idx + 1).keys()].forEach(ii => {
            var res = {};
            res[dimension] = dimension + ii.toString();
            res[measure] = ii;
            item.top.push(res);
        });
        return item;
    });
    return result;
}


/*****************************************
                 New Pages
******************************************/

var makeNewPagesDruidQuery = function(granularity, additionalFilters) {
  var defaultFilters = [
      { type: 'selector', dimension: 'event_entity', value: 'page' }
  ];
  return {
      queryType: 'timeseries',
      dataSource: 'mediawiki_history_reduced',
      granularity: granularity,
      filter: { type: 'and', fields: defaultFilters.concat(additionalFilters) },
      aggregations: [ {
          type: 'filtered',
          filter: { type: 'selector', dimension: 'event_type', value: 'create' },
          aggregator: { type: 'count', name: 'pages_created' }
      },
      {
          type: 'filtered',
          filter: { type: 'selector', dimension: 'event_type', value: 'delete' },
          aggregator: { type: 'count', name: 'pages_deleted' }
      },
      {
          type : 'filtered',
          filter : { type: 'selector', dimension: 'event_type', value: 'restore' },
          aggregator : { type: 'count', name: 'pages_restored' }
      } ],
    postAggregations: [
        {
            type : 'arithmetic',
            name : 'new_pages',
            fn : '-',
            fields : [
                {
                    type     : 'arithmetic',
                    name     : 'tmp',
                    fn         : '+',
                    fields : [
                        { type: 'fieldAccess', fieldName: 'pages_created' },
                        { type: 'fieldAccess', fieldName: 'pages_restored' }
                    ]
                },
                { type: 'fieldAccess', fieldName: 'pages_deleted' }
            ]
        }
      ],
      intervals: [ makeStartTimestamp(dateTime=false) + '/'
          + makeEndTimestamp(granularity, dateTime=false) ]
  };
}

var makeNewPagesDruidResult = function(granularity) {
    return makeDruidTimeseriesResult('new_pages', granularity);
}

var makeNewPagesAqsResult = function(project, editorType, pageType, granularity) {
    return makeAqsTimeseriesResult('new_pages', granularity, project, editorType, pageType);
}

var newPagesFixtures = [
    makeErrorFixture('return 400 for new-pages with typo in date', '/edited-pages/new/all-projects/all-editor-types/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for new-pages with invalid date (end before start)', '/edited-pages/new/all-projects/all-editor-types/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for new-pages with invalid granularity', '/edited-pages/new/all-projects/all-editor-types/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for new-pages with invalid page-type', '/edited-pages/new/all-projects/all-editor-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for new-pages with invalid editor-type', '/edited-pages/new/all-projects/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for new-pages with invalid project', '/edited-pages/new/bizarre|project$name/all-editor-types/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly new-pages and no full-month dates', '/edited-pages/new/all-projects/all-editor-types/all-page-types/monthly/2017010100/2017010200'),

    {
        describe: 'return 200 and results for new-pages daily without filters',
        aqsEndpoint: '/edited-pages/new/all-projects/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeNewPagesDruidQuery('day', []),
        druidResult: makeNewPagesDruidResult('day'),
        expectedAqsResult: makeNewPagesAqsResult('all-projects', 'all-editor-types', 'all-page-types',  'daily')
    },
    {
        describe: 'return 200 and results for new-pages monthly without filters nor hours',
        aqsEndpoint: '/edited-pages/new/all-projects/all-editor-types/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeNewPagesDruidQuery('month', []),
        druidResult: makeNewPagesDruidResult('month'),
        expectedAqsResult: makeNewPagesAqsResult('all-projects', 'all-editor-types', 'all-page-types',  'monthly')
    },
    {
        describe: 'return 200 with results for new-pages with uppercase project filter',
        aqsEndpoint: '/edited-pages/new/EN.wikipedia.org/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeNewPagesDruidQuery('day', [ { type: 'selector', dimension: 'project', value: 'en.wikipedia' } ]),
        druidResult: makeNewPagesDruidResult('day'),
        expectedAqsResult: makeNewPagesAqsResult('en.wikipedia', 'all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for new-pages with project and editor-type filters',
        aqsEndpoint: '/edited-pages/new/EN.wikipedia.org/user/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeNewPagesDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'user_type', value: 'user' }
        ]),
        druidResult: makeNewPagesDruidResult('day'),
        expectedAqsResult: makeNewPagesAqsResult('en.wikipedia', 'user', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for new-pages with project, editor-type and page-type filters',
        aqsEndpoint: '/edited-pages/new/en.wikipedia/anonymous/non-content/daily/2017010100/2017010200',
        expectedDruidQuery: makeNewPagesDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
             { type: 'selector', dimension: 'user_type', value: 'anonymous' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' }
        ]),
        druidResult: makeNewPagesDruidResult('day'),
        expectedAqsResult: makeNewPagesAqsResult('en.wikipedia', 'anonymous', 'non-content', 'daily')
    }
];


/*****************************************
                 New Registered Users
******************************************/

var makeNewRegisteredUsersDruidQuery = function(granularity, additionalFilters) {
  var defaultFilters = [
      { type: 'selector', dimension: 'event_entity', value: 'user' },
      { type: 'selector', dimension: 'event_type', value: 'create' },
      { type: 'selector', dimension: 'other_tags', value: 'self_created' }
  ];
  return {
      queryType: 'timeseries',
      dataSource: 'mediawiki_history_reduced',
      granularity: granularity,
      filter: { type: 'and', fields: defaultFilters.concat(additionalFilters) },
      aggregations: [ { type: 'longSum', name: 'new_registered_users', fieldName: 'events' } ],
    postAggregations: [],
      intervals: [ makeStartTimestamp(dateTime=false) + '/'
          + makeEndTimestamp(granularity, dateTime=false) ]
  };
}

var makeNewRegisteredUsersDruidResult = function(granularity) {
    return makeDruidTimeseriesResult('new_registered_users', granularity);
}

var makeNewRegisteredUsersAqsResult = function(project, granularity) {
    return makeAqsTimeseriesResult('new_registered_users', granularity, project);
}

var newRegisteredUsersFixtures = [
    makeErrorFixture('return 400 for new registered users with typo in date', '/registered-users/new/all-projects/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for new registered users with invalid date (end before start)', '/registered-users/new/all-projects/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for new registered users with invalid granularity', '/registered-users/new/all-projects/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly new registered users and no full-month dates', '/registered-users/new/all-projects/monthly/2017010100/2017010200'),

    {
        describe: 'return 200 and results for new registered users daily without filters',
        aqsEndpoint: '/registered-users/new/all-projects/daily/2017010100/2017010200',
        expectedDruidQuery: makeNewRegisteredUsersDruidQuery('day', []),
        druidResult: makeNewRegisteredUsersDruidResult('day'),
        expectedAqsResult: makeNewRegisteredUsersAqsResult('all-projects', 'daily')
    },
    {
        describe: 'return 200 and results for new registered users monthly without filters nor hours',
        aqsEndpoint: '/registered-users/new/all-projects/monthly/20170101/20170210',
        expectedDruidQuery: makeNewRegisteredUsersDruidQuery('month', []),
        druidResult: makeNewRegisteredUsersDruidResult('month'),
        expectedAqsResult: makeNewRegisteredUsersAqsResult('all-projects', 'monthly')
    },
    {
        describe: 'return 200 with results for new registered users with uppercase project filter',
        aqsEndpoint: '/registered-users/new/EN.wikipedia.org/daily/2017010100/2017010200',
        expectedDruidQuery: makeNewRegisteredUsersDruidQuery('day', [ { type: 'selector', dimension: 'project', value: 'en.wikipedia' } ]),
        druidResult: makeNewRegisteredUsersDruidResult('day'),
        expectedAqsResult: makeNewRegisteredUsersAqsResult('en.wikipedia', 'daily')
    }
];


/*****************************************
                 Edited Pages
******************************************/

var makeEditedPagesDruidQuery = function(granularity, additionalFilters) {
  var defaultFilters = [
      { type: 'selector', dimension: 'event_entity', value: 'page' },
      { type: 'selector', dimension: 'event_type', value: (granularity === 'day') ? 'daily_digest' : 'monthly_digest' },
      { type: 'selector', dimension: 'project', value: 'en.wikipedia' }
  ]

  return {
      queryType: 'timeseries',
      dataSource: 'mediawiki_history_reduced',
      granularity: granularity,
      filter: { type: 'and', fields: defaultFilters.concat(additionalFilters) },
      aggregations: [ { type: 'longSum', name: 'edited_pages', fieldName: 'events' } ],
      postAggregations: [],
      intervals: [ makeStartTimestamp(dateTime=false) + '/'
          + makeEndTimestamp(granularity, dateTime=false) ]
  };
}

var makeEditedPagesDruidResult = function(granularity) {
    return makeDruidTimeseriesResult('edited_pages', granularity);
}

var makeEditedPagesAqsResult = function(editorType, pageType, activityLevel, granularity) {
    return makeAqsTimeseriesResult('edited_pages', granularity, 'en.wikipedia', editorType, pageType, activityLevel);
}

var editedPagesFixtures = [
    makeErrorFixture('return 400 for edited-pages with all-projects filter', '/edited-pages/aggregate/all-projects/all-editor-types/all-page-types/all-activity-levels/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for edited-pages with typo in date', '/edited-pages/aggregate/en.wikipedia/all-editor-types/all-page-types/all-activity-levels/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for edited-pages with invalid date (end before start)', '/edited-pages/aggregate/en.wikipedia/all-editor-types/all-page-types/all-activity-levels/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for edited-pages with invalid granularity', '/edited-pages/aggregate/en.wikipedia/all-editor-types/all-page-types/all-activity-levels/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for edited-pages with invalid activity-level', '/edited-pages/aggregate/en.wikipedia/all-editor-types/all-page-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for edited-pages with invalid page-type', '/edited-pages/aggregate/en.wikipedia/all-editor-types/wrong/all-activity-levels/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for edited-pages with invalid user-type', '/edited-pages/aggregate/en.wikipedia/wrong/all-page-types/all-activity-levels/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly edited-pages and no full-month dates', '/edited-pages/aggregate/en.wikipedia/all-editor-types/all-page-types/all-activity-levels/monthly/2017010100/2017010200'),

    {
        describe: 'return 200 and results for edited-pages daily with uppercase and .org project filter',
        aqsEndpoint: '/edited-pages/aggregate/EN.wikipedia.org/all-editor-types/all-page-types/all-activity-levels/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditedPagesDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'all' },
            { type: 'selector', dimension: 'page_type', value: 'all' }
        ]),
        druidResult: makeEditedPagesDruidResult('day'),
        expectedAqsResult: makeEditedPagesAqsResult('all-editor-types', 'all-page-types', 'all-activity-levels', 'daily')
    },
    {
        describe: 'return 200 and results for edited-pages monthly with only project filter but no hour',
        aqsEndpoint: '/edited-pages/aggregate/en.wikipedia/all-editor-types/all-page-types/all-activity-levels/monthly/20170101/20170210',
        expectedDruidQuery: makeEditedPagesDruidQuery('month', [
            { type: 'selector', dimension: 'user_type', value: 'all' },
            { type: 'selector', dimension: 'page_type', value: 'all' }
        ]),
        druidResult: makeEditedPagesDruidResult('month'),
        expectedAqsResult: makeEditedPagesAqsResult('all-editor-types', 'all-page-types', 'all-activity-levels', 'monthly')
    },
    {
        describe: 'return 200 with results for edited-pages with project and editor-type filter',
        aqsEndpoint: '/edited-pages/aggregate/en.wikipedia/anonymous/all-page-types/all-activity-levels/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditedPagesDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'anonymous' },
            { type: 'selector', dimension: 'page_type', value: 'all' }
        ]),
        druidResult: makeEditedPagesDruidResult('day'),
        expectedAqsResult: makeEditedPagesAqsResult('anonymous', 'all-page-types', 'all-activity-levels', 'daily')
    },
    {
        describe: 'return 200 with results for edited-pages with project, editor-type and page-type filter',
        aqsEndpoint: '/edited-pages/aggregate/en.wikipedia/user/non-content/all-activity-levels/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditedPagesDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'user' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' },
        ]),
        druidResult: makeEditedPagesDruidResult('day'),
        expectedAqsResult: makeEditedPagesAqsResult('user', 'non-content', 'all-activity-levels', 'daily')
    },
    {
        describe: 'return 200 with results for edited-pages with project, editor-type, page-type and activity-level filter',
        aqsEndpoint: '/edited-pages/aggregate/en.wikipedia/group-bot/content/25..99-edits/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditedPagesDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'group_bot' },
            { type: 'selector', dimension: 'page_type', value: 'content' },
            { type: 'regex', dimension: 'revisions', pattern: '^(2[5-9]|[3-9]\\d)$' }
        ]),
        druidResult: makeEditedPagesDruidResult('day'),
        expectedAqsResult: makeEditedPagesAqsResult('group-bot', 'content', '25..99-edits', 'daily')
    }
];


/*****************************************
                 Editors
******************************************/



var makeEditorsDruidQuery = function(granularity, additionalFilters) {
  var defaultFilters = [
      { type: 'selector', dimension: 'event_entity', value: 'user' },
      { type: 'selector', dimension: 'event_type', value: (granularity === 'day') ? 'daily_digest' : 'monthly_digest' },
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' }
  ]

  return {
      queryType: 'timeseries',
      dataSource: 'mediawiki_history_reduced',
      granularity: granularity,
      filter: { type: 'and', fields: defaultFilters.concat(additionalFilters) },
      aggregations: [ { type: 'longSum', name: 'editors', fieldName: 'events' } ],
      postAggregations: [],
      intervals: [ makeStartTimestamp(dateTime=false) + '/'
          + makeEndTimestamp(granularity, dateTime=false) ]
  };
}

var makeEditorsDruidResult = function(granularity) {
    return makeDruidTimeseriesResult('editors', granularity);
}

var makeEditorsAqsResult = function(editorType, pageType, activityLevel, granularity) {
    return makeAqsTimeseriesResult('editors', granularity, 'en.wikipedia', editorType, pageType, activityLevel);
}

var editorsFixtures = [
    makeErrorFixture('return 400 for editors with all-projects filter', '/editors/aggregate/all-projects/all-editor-types/all-page-types/all-activity-levels/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for editors with typo in date', '/editors/aggregate/en.wikipedia/all-editor-types/all-page-types/all-activity-levels/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for editors with invalid date (end before start)', '/editors/aggregate/en.wikipedia/all-editor-types/all-page-types/all-activity-levels/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for editors with invalid granularity', '/editors/aggregate/en.wikipedia/all-editor-types/all-page-types/all-activity-levels/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for editors with invalid activity-level', '/editors/aggregate/en.wikipedia/all-editor-types/all-page-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for editors with invalid page-type', '/editors/aggregate/en.wikipedia/all-editor-types/wrong/all-activity-levels/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for editors with invalid user-type', '/editors/aggregate/en.wikipedia/wrong/all-page-types/all-activity-levels/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly editors and no full-month dates', '/editors/aggregate/en.wikipedia/all-editor-types/all-page-types/all-activity-levels/monthly/2017010100/2017010200'),

    {
        describe: 'return 200 and results for editors daily with uppercase and .org project filter',
        aqsEndpoint: '/editors/aggregate/EN.wikipedia.org/all-editor-types/all-page-types/all-activity-levels/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditorsDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'all' },
            { type: 'selector', dimension: 'page_type', value: 'all' }
        ]),
        druidResult: makeEditorsDruidResult('day'),
        expectedAqsResult: makeEditorsAqsResult('all-editor-types', 'all-page-types', 'all-activity-levels', 'daily')
    },
    {
        describe: 'return 200 and results for editors monthly with project filter but no nor hour',
        aqsEndpoint: '/editors/aggregate/en.wikipedia/all-editor-types/all-page-types/all-activity-levels/monthly/20170101/20170210',
        expectedDruidQuery: makeEditorsDruidQuery('month', [
            { type: 'selector', dimension: 'user_type', value: 'all' },
            { type: 'selector', dimension: 'page_type', value: 'all' }
        ]),
        druidResult: makeEditorsDruidResult('month'),
        expectedAqsResult: makeEditorsAqsResult('all-editor-types', 'all-page-types', 'all-activity-levels', 'monthly')
    },
    {
        describe: 'return 200 with results for editors with project and editor-type filter',
        aqsEndpoint: '/editors/aggregate/en.wikipedia/anonymous/all-page-types/all-activity-levels/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditorsDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'anonymous' },
            { type: 'selector', dimension: 'page_type', value: 'all' }
        ]),
        druidResult: makeEditorsDruidResult('day'),
        expectedAqsResult: makeEditorsAqsResult('anonymous', 'all-page-types', 'all-activity-levels', 'daily')
    },
    {
        describe: 'return 200 with results for editors with project, editor-type and page-type filter',
        aqsEndpoint: '/editors/aggregate/en.wikipedia/user/non-content/all-activity-levels/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditorsDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'user' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' }
        ]),
        druidResult: makeEditorsDruidResult('day'),
        expectedAqsResult: makeEditorsAqsResult('user', 'non-content', 'all-activity-levels', 'daily')
    },
    {
        describe: 'return 200 with results for editors with project, editor-type, page-type and activity-level filter',
        aqsEndpoint: '/editors/aggregate/en.wikipedia/group-bot/content/5..24-edits/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditorsDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'group_bot' },
            { type: 'selector', dimension: 'page_type', value: 'content' },
            { type: 'regex', dimension: 'revisions', pattern: '^([5-9]|1\\d|2[0-4])$' }
        ]),
        druidResult: makeEditorsDruidResult('day'),
        expectedAqsResult: makeEditorsAqsResult('group-bot', 'content', '5..24-edits', 'daily')
    }
];



/*****************************************
                 Edits
******************************************/

var makeRevisionsDruidQuery = function(aggType, granularity, additionalFilters) {
  var defaultFilters = [
      { type: 'selector', dimension: 'event_entity', value: 'revision' },
      { type: 'selector', dimension: 'event_type', value: 'create' }
  ];

  var agg;
  if (aggType === 'edits') {
    agg = { type: 'longSum', name: 'edits', fieldName: 'events' };
  } else if (aggType === 'net') {
    agg = { type: 'longSum', name: 'net_bytes_diff', fieldName: 'text_bytes_diff_sum' };
  } else {
    agg = { type: 'longSum', name: 'abs_bytes_diff', fieldName: 'text_bytes_diff_abs_sum' };
  }

  return {
      queryType: 'timeseries',
      dataSource: 'mediawiki_history_reduced',
      granularity: granularity,
      filter: { type: 'and', fields: defaultFilters.concat(additionalFilters) },
      aggregations: [ agg ],
      postAggregations: [],
      intervals: [ makeStartTimestamp(dateTime=false) + '/'
          + makeEndTimestamp(granularity, dateTime=false) ]
  };
}

var makeEditsDruidQuery = function(granularity, additionalFilters) {
  return makeRevisionsDruidQuery('edits', granularity, additionalFilters)
}


var makeEditsDruidResult = function(granularity) {
    return makeDruidTimeseriesResult('edits', granularity);
}

var makeEditsAqsResult = function(project, editorType, pageType, granularity) {
    return makeAqsTimeseriesResult('edits', granularity, project, editorType, pageType);
}

var editsFixtures = [
    makeErrorFixture('return 400 for edits with typo in date', '/edits/aggregate/all-projects/all-editor-types/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for edits with invalid date (end before start)', '/edits/aggregate/all-projects/all-editor-types/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for edits with invalid granularity', '/edits/aggregate/all-projects/all-editor-types/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for edits with invalid page-type', '/edits/aggregate/all-projects/all-editor-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for edits with invalid user-type', '/edits/aggregate/all-projects/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly edits and no full-month dates', '/edits/aggregate/all-projects/all-editor-types/all-page-types/monthly/2017010100/2017010200'),

    // Edits counts- Filters
    {
        describe: 'return 200 and results for edits daily without filters',
        aqsEndpoint: '/edits/aggregate/all-projects/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditsDruidQuery('day', []),
        druidResult: makeEditsDruidResult('day'),
        expectedAqsResult: makeEditsAqsResult('all-projects', 'all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for edits monthly without filters nor hours',
        aqsEndpoint: '/edits/aggregate/all-projects/all-editor-types/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeEditsDruidQuery('month', []),
        druidResult: makeEditsDruidResult('month'),
        expectedAqsResult: makeEditsAqsResult('all-projects', 'all-editor-types', 'all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for edits with uppercase project filter',
        aqsEndpoint: '/edits/aggregate/EN.wikipedia.org/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditsDruidQuery('day', [ { type: 'selector', dimension: 'project', value: 'en.wikipedia' } ]),
        druidResult: makeEditsDruidResult('day'),
        expectedAqsResult: makeEditsAqsResult('en.wikipedia', 'all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for edits with project and user-type filter',
        aqsEndpoint: '/edits/aggregate/en.wikipedia/user/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditsDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'user_type', value: 'user' }
        ]),
        druidResult: makeEditsDruidResult('day'),
        expectedAqsResult: makeEditsAqsResult('en.wikipedia', 'user', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for edits with project, user-type and page-type filter',
        aqsEndpoint: '/edits/aggregate/en.wikipedia/group-bot/non-content/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditsDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'user_type', value: 'group_bot' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' }
        ]),
        druidResult: makeEditsDruidResult('day'),
        expectedAqsResult: makeEditsAqsResult('en.wikipedia', 'group-bot', 'non-content', 'daily')
    }
];


/*****************************************
                 Edits Per Page
                 Reuses edits
******************************************/

var makeEditsPerPageAqsResult = function(editorType, granularity) {
    return makeAqsTimeseriesResult('edits', granularity, 'en.wikipedia', editorType, undefined, undefined, '1');
}

var editsPerPageFixtures = [
    makeErrorFixture('return 400 for edits per page with all-projects filter', '/edits/per-page/all-projects/1/all-editor-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for edits per page with typo in date', '/edits/per-page/en.wikipedia/1/all-editor-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for edits per page with invalid date (end before start)', '/edits/per-page/en.wikipedia/1/all-editor-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for edits per page with invalid granularity', '/edits/per-page/en.wikipedia/1/all-editor-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for edits per page with invalid editor-type', '/edits/per-page/en.wikipedia/1/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for edits per page with invalid page-id', '/edits/per-page/en.wikipedia/wrong/all-editor-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly edits per page and no full-month dates', '/edits/per-page/en.wikipedia/1/all-page-types/monthly/2017010100/2017010200'),

    // Edits per page counts- Filters
    {
        describe: 'return 200 and results for edits per page daily with only page-id and project filter',
        aqsEndpoint: '/edits/per-page/EN.wikipedia.org/1/all-editor-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditsDruidQuery('day', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'page_id', value: '1' }
        ]),
        druidResult: makeEditsDruidResult('day'),
        expectedAqsResult: makeEditsPerPageAqsResult('all-editor-types', 'daily')
    },
    {
        describe: 'return 200 and results for edits per page monthly with only page-id and project filter and no hours',
        aqsEndpoint: '/edits/per-page/en.wikipedia/1/all-editor-types/monthly/20170101/20170210',
        expectedDruidQuery: makeEditsDruidQuery('month', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'page_id', value: '1' }
        ]),
        druidResult: makeEditsDruidResult('month'),
        expectedAqsResult: makeEditsPerPageAqsResult('all-editor-types', 'monthly')
    },
    {
        describe: 'return 200 with results for edits per page with project, page-id and editor-type filter',
        aqsEndpoint: '/edits/per-page/en.wikipedia/1/user/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditsDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'user_type', value: 'user' },
            { type: 'selector', dimension: 'page_id', value: '1' }
        ]),
        druidResult: makeEditsDruidResult('day'),
        expectedAqsResult: makeEditsPerPageAqsResult('user', 'daily')
    },
];


/*****************************************
                 Edits Per editor
                 Reuses edits
******************************************/

var makeEditsPerEditorAqsResult = function(pageType, granularity) {
    return makeAqsTimeseriesResult('edits', granularity, 'en.wikipedia', undefined, pageType, undefined, undefined, '1');
}

var editsPerEditorFixtures = [
    makeErrorFixture('return 400 for edits per editor with all-projects filter', '/edits/per-editor/all-projects/1/all-page-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for edits per editor with typo in date', '/edits/per-editor/en.wikipedia/1/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for edits per editor with invalid date (end before start)', '/edits/per-editor/en.wikipedia/1/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for edits per editor with invalid granularity', '/edits/per-editor/en.wikipedia/1/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for edits per editor with invalid page-type', '/edits/per-editor/en.wikipedia/1/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for edits per editor with invalid editor-id', '/edits/per-editor/en.wikipedia/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly edits per editor and no full-month dates', '/edits/per-editor/en.wikipedia/1/all-page-types/monthly/2017010100/2017010200'),

    // Edits per editor counts- Filters
    {
        describe: 'return 200 and results for edits per editor daily with only project and editor-id filter',
        aqsEndpoint: '/edits/per-editor/EN.wikipedia.org/1/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditsDruidQuery('day', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'user_id', value: '1' }
        ]),
        druidResult: makeEditsDruidResult('day'),
        expectedAqsResult: makeEditsPerEditorAqsResult('all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for edits per editor monthly with only project and editor-id filter and no hours',
        aqsEndpoint: '/edits/per-editor/en.wikipedia/1/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeEditsDruidQuery('month', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'user_id', value: '1' }
        ]),
        druidResult: makeEditsDruidResult('month'),
        expectedAqsResult: makeEditsPerEditorAqsResult('all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for edits per editor with project, editor-id and page-type filter',
        aqsEndpoint: '/edits/per-editor/en.wikipedia/1/content/daily/2017010100/2017010200',
        expectedDruidQuery: makeEditsDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'page_type', value: 'content' },
            { type: 'selector', dimension: 'user_id', value: '1' }
        ]),
        druidResult: makeEditsDruidResult('day'),
        expectedAqsResult: makeEditsPerEditorAqsResult('content', 'daily')
    },
];


/*****************************************
                 Net Bytes Diff
******************************************/

var makeNetBytesDiffDruidQuery = function(granularity, additionalFilters) {
    return makeRevisionsDruidQuery('net', granularity, additionalFilters);
};

var makeNetBytesDiffDruidResult = function(granularity) {
    return makeDruidTimeseriesResult('net_bytes_diff', granularity);
}

var makeNetBytesDiffAqsResult = function(project, editorType, pageType, granularity) {
    return makeAqsTimeseriesResult('net_bytes_diff', granularity, project, editorType, pageType);
}


var netBytesDiffFixtures = [
    makeErrorFixture('return 400 for net bytes-difference with typo in date', '/bytes-difference/net/aggregate/all-projects/all-editor-types/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for net bytes-difference with invalid date (end before start)', '/bytes-difference/net/aggregate/all-projects/all-editor-types/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for net bytes-difference with invalid granularity', '/bytes-difference/net/aggregate/all-projects/all-editor-types/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for net bytes-difference with invalid page-type', '/bytes-difference/net/aggregate/all-projects/all-editor-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for net bytes-difference with invalid user-type', '/bytes-difference/net/aggregate/all-projects/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly net bytes-difference and no full-month dates', '/bytes-difference/net/aggregate/all-projects/all-editor-types/all-page-types/monthly/2017010100/2017010200'),

    // net bytes-difference - Filters
    {
        describe: 'return 200 and results for net bytes-difference daily without filters',
        aqsEndpoint: '/bytes-difference/net/aggregate/all-projects/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeNetBytesDiffDruidQuery('day', []),
        druidResult: makeNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeNetBytesDiffAqsResult('all-projects', 'all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for net bytes-difference monthly without filters nor hours',
        aqsEndpoint: '/bytes-difference/net/aggregate/all-projects/all-editor-types/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeNetBytesDiffDruidQuery('month', []),
        druidResult: makeNetBytesDiffDruidResult('month'),
        expectedAqsResult: makeNetBytesDiffAqsResult('all-projects', 'all-editor-types', 'all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for net bytes-difference with uppercase project filter',
        aqsEndpoint: '/bytes-difference/net/aggregate/EN.wikipedia.org/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeNetBytesDiffDruidQuery('day', [ { type: 'selector', dimension: 'project', value: 'en.wikipedia' } ]),
        druidResult: makeNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeNetBytesDiffAqsResult('en.wikipedia', 'all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for net bytes-difference with project and user-type filter',
        aqsEndpoint: '/bytes-difference/net/aggregate/en.wikipedia/user/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeNetBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'user_type', value: 'user' }
        ]),
        druidResult: makeNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeNetBytesDiffAqsResult('en.wikipedia', 'user', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for net bytes-difference with project, user-type and page-type filter',
        aqsEndpoint: '/bytes-difference/net/aggregate/en.wikipedia/group-bot/non-content/daily/2017010100/2017010200',
        expectedDruidQuery: makeNetBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'user_type', value: 'group_bot' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' }
        ]),
        druidResult: makeNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeNetBytesDiffAqsResult('en.wikipedia', 'group-bot', 'non-content', 'daily')
    }
];

/*****************************************
                 Net Bytes Diff Per Page
                 Reuses Net Bytes Diff
******************************************/

var makeNetBytesDiffPerPageAqsResult = function(editorType, granularity) {
    return makeAqsTimeseriesResult('net_bytes_diff', granularity, 'en.wikipedia', editorType, undefined, undefined, '1');
}

var netBytesDiffPerPageFixtures = [
    makeErrorFixture('return 400 for net bytes-difference per page with all-projects filter', '/bytes-difference/net/per-page/all-projects/1/all-editor-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for net bytes-difference per page with typo in date', '/bytes-difference/net/per-page/en.wikipedia/1/all-editor-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for net bytes-difference per page with invalid date (end before start)', '/bytes-difference/net/per-page/en.wikipedia/1/all-editor-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for net bytes-difference per page with invalid granularity', '/bytes-difference/net/per-page/en.wikipedia/1/all-editor-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for net bytes-difference per page with invalid editor-type', '/bytes-difference/net/per-page/en.wikipedia/1/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for net bytes-difference per page with invalid page-id', '/bytes-difference/net/per-page/en.wikipedia/wrong/all-editor-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly net bytes-difference per page and no full-month dates', '/bytes-difference/net/per-page/en.wikipedia/1/all-page-types/monthly/2017010100/2017010200'),

    // Edits per page counts- Filters
    {
        describe: 'return 200 and results for net bytes-difference per page daily with only page-id and project filter',
        aqsEndpoint: '/bytes-difference/net/per-page/EN.wikipedia.org/1/all-editor-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeNetBytesDiffDruidQuery('day', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'page_id', value: '1' }
        ]),
        druidResult: makeNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeNetBytesDiffPerPageAqsResult('all-editor-types', 'daily')
    },
    {
        describe: 'return 200 and results for net bytes-difference per page monthly with only page-id and project filter and no hours',
        aqsEndpoint: '/bytes-difference/net/per-page/en.wikipedia/1/all-editor-types/monthly/20170101/20170210',
        expectedDruidQuery: makeNetBytesDiffDruidQuery('month', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'page_id', value: '1' }
        ]),
        druidResult: makeNetBytesDiffDruidResult('month'),
        expectedAqsResult: makeNetBytesDiffPerPageAqsResult('all-editor-types', 'monthly')
    },
    {
        describe: 'return 200 with results for net bytes-difference per page with project, page-id and editor-type filter',
        aqsEndpoint: '/bytes-difference/net/per-page/en.wikipedia/1/user/daily/2017010100/2017010200',
        expectedDruidQuery: makeNetBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'user_type', value: 'user' },
            { type: 'selector', dimension: 'page_id', value: '1' }
        ]),
        druidResult: makeNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeNetBytesDiffPerPageAqsResult('user', 'daily')
    },
];


/*****************************************
                 Net Bytes Diff Per editor
                 Reuses Net Bytes Diff
******************************************/

var makeNetBytesDiffPerEditorAqsResult = function(pageType, granularity) {
    return makeAqsTimeseriesResult('net_bytes_diff', granularity, 'en.wikipedia', undefined, pageType, undefined, undefined, '1');
}

var netBytesDiffPerEditorFixtures = [
    makeErrorFixture('return 400 for net bytes-difference per editor with all-projects filter', '/bytes-difference/net/per-editor/all-projects/1/all-page-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for net bytes-difference per editor with typo in date', '/bytes-difference/net/per-editor/en.wikipedia/1/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for net bytes-difference per editor with invalid date (end before start)', '/bytes-difference/net/per-editor/en.wikipedia/1/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for net bytes-difference per editor with invalid granularity', '/bytes-difference/net/per-editor/en.wikipedia/1/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for net bytes-difference per editor with invalid page-type', '/bytes-difference/net/per-editor/en.wikipedia/1/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for net bytes-difference per editor with invalid editor-id', '/bytes-difference/net/per-editor/en.wikipedia/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly net bytes-difference per editor and no full-month dates', '/bytes-difference/net/per-editor/en.wikipedia/1/all-page-types/monthly/2017010100/2017010200'),

    // net bytes-difference per editor counts- Filters
    {
        describe: 'return 200 and results for net bytes-difference per editor daily with only project and editor-id filter',
        aqsEndpoint: '/bytes-difference/net/per-editor/EN.wikipedia.org/1/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeNetBytesDiffDruidQuery('day', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'user_id', value: '1' }
        ]),
        druidResult: makeNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeNetBytesDiffPerEditorAqsResult('all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for net bytes-difference per editor monthly with only project and editor-id filter and no hours',
        aqsEndpoint: '/bytes-difference/net/per-editor/en.wikipedia/1/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeNetBytesDiffDruidQuery('month', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'user_id', value: '1' }
        ]),
        druidResult: makeNetBytesDiffDruidResult('month'),
        expectedAqsResult: makeNetBytesDiffPerEditorAqsResult('all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for net bytes-difference per editor with project, editor-id and page-type filter',
        aqsEndpoint: '/bytes-difference/net/per-editor/en.wikipedia/1/content/daily/2017010100/2017010200',
        expectedDruidQuery: makeNetBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'page_type', value: 'content' },
            { type: 'selector', dimension: 'user_id', value: '1' }
        ]),
        druidResult: makeNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeNetBytesDiffPerEditorAqsResult('content', 'daily')
    },
];


/*****************************************
                 Abs Bytes Diff
                 Reuse NetBytesDiff
******************************************/


var makeAbsBytesDiffDruidQuery = function(granularity, additionalFilters) {
    return makeRevisionsDruidQuery('abs', granularity, additionalFilters);
};

var makeAbsBytesDiffDruidResult = function(granularity) {
    return makeDruidTimeseriesResult('abs_bytes_diff', granularity);
}

var makeAbsBytesDiffAqsResult = function(project, editorType, pageType, granularity) {
    return makeAqsTimeseriesResult('abs_bytes_diff', granularity, project, editorType, pageType);
}

var absBytesDiffFixtures = [
    makeErrorFixture('return 400 for absolute bytes-difference with typo in date', '/bytes-difference/absolute/aggregate/all-projects/all-editor-types/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for absolute bytes-difference with invalid date (end before start)', '/bytes-difference/absolute/aggregate/all-projects/all-editor-types/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for absolute bytes-difference with invalid granularity', '/bytes-difference/absolute/aggregate/all-projects/all-editor-types/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for absolute bytes-difference with invalid page-type', '/bytes-difference/absolute/aggregate/all-projects/all-editor-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for absolute bytes-difference with invalid user-type', '/bytes-difference/absolute/aggregate/all-projects/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly absolute bytes-difference and no full-month dates', '/bytes-difference/absolute/aggregate/all-projects/all-editor-types/all-page-types/monthly/2017010100/2017010200'),

    // absolute bytes-difference - Filters
    {
        describe: 'return 200 and results for absolute bytes-difference daily without filters',
        aqsEndpoint: '/bytes-difference/absolute/aggregate/all-projects/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeAbsBytesDiffDruidQuery('day', []),
        druidResult: makeAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeAbsBytesDiffAqsResult('all-projects', 'all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for absolute bytes-difference monthly without filters nor hours',
        aqsEndpoint: '/bytes-difference/absolute/aggregate/all-projects/all-editor-types/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeAbsBytesDiffDruidQuery('month', []),
        druidResult: makeAbsBytesDiffDruidResult('month'),
        expectedAqsResult: makeAbsBytesDiffAqsResult('all-projects', 'all-editor-types', 'all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for absolute bytes-difference with uppercase project filter',
        aqsEndpoint: '/bytes-difference/absolute/aggregate/EN.wikipedia.org/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeAbsBytesDiffDruidQuery('day', [ { type: 'selector', dimension: 'project', value: 'en.wikipedia' } ]),
        druidResult: makeAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeAbsBytesDiffAqsResult('en.wikipedia', 'all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for absolute bytes-difference with project and user-type filter',
        aqsEndpoint: '/bytes-difference/absolute/aggregate/en.wikipedia/user/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeAbsBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'user_type', value: 'user' }
        ]),
        druidResult: makeAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeAbsBytesDiffAqsResult('en.wikipedia', 'user', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for absolute bytes-difference with project, user-type and page-type filter',
        aqsEndpoint: '/bytes-difference/absolute/aggregate/en.wikipedia/group-bot/non-content/daily/2017010100/2017010200',
        expectedDruidQuery: makeAbsBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'user_type', value: 'group_bot' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' }
        ]),
        druidResult: makeAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeAbsBytesDiffAqsResult('en.wikipedia', 'group-bot', 'non-content', 'daily')
    }
];


/*****************************************
                 Abs Bytes Diff Per Page
                 Reuses Abs Bytes Diff
******************************************/

var makeAbsBytesDiffPerPageAqsResult = function(editorType, granularity) {
    return makeAqsTimeseriesResult('abs_bytes_diff', granularity, 'en.wikipedia', editorType, undefined, undefined, '1');
}

var absBytesDiffPerPageFixtures = [
    makeErrorFixture('return 400 for absolute bytes-difference per page with all-projects filter', '/bytes-difference/absolute/per-page/all-projects/1/all-editor-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for absolute bytes-difference per page with typo in date', '/bytes-difference/absolute/per-page/en.wikipedia/1/all-editor-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for absolute bytes-difference per page with invalid date (end before start)', '/bytes-difference/absolute/per-page/en.wikipedia/1/all-editor-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for absolute bytes-difference per page with invalid granularity', '/bytes-difference/absolute/per-page/en.wikipedia/1/all-editor-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for absolute bytes-difference per page with invalid editor-type', '/bytes-difference/absolute/per-page/en.wikipedia/1/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for absolute bytes-difference per page with invalid page-id', '/bytes-difference/absolute/per-page/en.wikipedia/wrong/all-editor-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly absolute bytes-difference per page and no full-month dates', '/bytes-difference/absolute/per-page/en.wikipedia/1/all-page-types/monthly/2017010100/2017010200'),

    // absolute bytes difference per page - Filters
    {
        describe: 'return 200 and results for absolute bytes-difference per page daily with only page-id and project filter',
        aqsEndpoint: '/bytes-difference/absolute/per-page/EN.wikipedia.org/1/all-editor-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeAbsBytesDiffDruidQuery('day', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'page_id', value: '1' }
        ]),
        druidResult: makeAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeAbsBytesDiffPerPageAqsResult('all-editor-types', 'daily')
    },
    {
        describe: 'return 200 and results for absolute bytes-difference per page monthly with only page-id and project filter and no hours',
        aqsEndpoint: '/bytes-difference/absolute/per-page/en.wikipedia/1/all-editor-types/monthly/20170101/20170210',
        expectedDruidQuery: makeAbsBytesDiffDruidQuery('month', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'page_id', value: '1' }
        ]),
        druidResult: makeAbsBytesDiffDruidResult('month'),
        expectedAqsResult: makeAbsBytesDiffPerPageAqsResult('all-editor-types', 'monthly')
    },
    {
        describe: 'return 200 with results for absolute bytes-difference per page with project, page-id and editor-type filter',
        aqsEndpoint: '/bytes-difference/absolute/per-page/en.wikipedia/1/user/daily/2017010100/2017010200',
        expectedDruidQuery: makeAbsBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'user_type', value: 'user' },
            { type: 'selector', dimension: 'page_id', value: '1' }
        ]),
        druidResult: makeAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeAbsBytesDiffPerPageAqsResult('user', 'daily')
    },
];


/*****************************************
                 Abs Bytes Diff Per editor
                 Reuses Abs Bytes Diff
******************************************/

var makeAbsBytesDiffPerEditorAqsResult = function(pageType, granularity) {
    return makeAqsTimeseriesResult('abs_bytes_diff', granularity, 'en.wikipedia', undefined, pageType, undefined, undefined, '1');
}

var absBytesDiffPerEditorFixtures = [
    makeErrorFixture('return 400 for absolute bytes-difference per editor with all-projects filter', '/bytes-difference/absolute/per-editor/all-projects/1/all-page-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for absolute bytes-difference per editor with typo in date', '/bytes-difference/absolute/per-editor/en.wikipedia/1/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for absolute bytes-difference per editor with invalid date (end before start)', '/bytes-difference/absolute/per-editor/en.wikipedia/1/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for absolute bytes-difference per editor with invalid granularity', '/bytes-difference/absolute/per-editor/en.wikipedia/1/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for absolute bytes-difference per editor with invalid page-type', '/bytes-difference/absolute/per-editor/en.wikipedia/1/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for absolute bytes-difference per editor with invalid editor-id', '/bytes-difference/absolute/per-editor/en.wikipedia/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly absolute bytes-difference per editor and no full-month dates', '/bytes-difference/absolute/per-editor/en.wikipedia/1/all-page-types/monthly/2017010100/2017010200'),

    // absolute bytes-difference per editor - Filters
    {
        describe: 'return 200 and results for absolute bytes-difference per editor daily with only project and editor-id filter',
        aqsEndpoint: '/bytes-difference/absolute/per-editor/EN.wikipedia.org/1/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeAbsBytesDiffDruidQuery('day', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'user_id', value: '1' }
        ]),
        druidResult: makeAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeAbsBytesDiffPerEditorAqsResult('all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for absolute bytes-difference per editor monthly with only project and editor-id filter and no hours',
        aqsEndpoint: '/bytes-difference/absolute/per-editor/en.wikipedia/1/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeAbsBytesDiffDruidQuery('month', [
          { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
          { type: 'selector', dimension: 'user_id', value: '1' }
        ]),
        druidResult: makeAbsBytesDiffDruidResult('month'),
        expectedAqsResult: makeAbsBytesDiffPerEditorAqsResult('all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for absolute bytes-difference per editor with project, editor-id and page-type filter',
        aqsEndpoint: '/bytes-difference/absolute/per-editor/en.wikipedia/1/content/daily/2017010100/2017010200',
        expectedDruidQuery: makeAbsBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'project', value: 'en.wikipedia' },
            { type: 'selector', dimension: 'page_type', value: 'content' },
            { type: 'selector', dimension: 'user_id', value: '1' }
        ]),
        druidResult: makeAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeAbsBytesDiffPerEditorAqsResult('content', 'daily')
    },
];


/*****************************************
                Top Edited Pages by Edits
******************************************/

var makeTopRevisionsDruidQuery = function(dimension, aggType, granularity, additionalFilters) {
  var defaultFilters = [
      { type: 'selector', dimension: 'event_entity', value: 'revision' },
      { type: 'selector', dimension: 'event_type', value: 'create' },
      { type: 'selector', dimension: 'project', value: 'en.wikipedia' }
  ];

  var agg;
  var metricName;
  if (aggType === 'edits') {
      metricName = 'edits';
      agg = { type: 'longSum', name: metricName, fieldName: 'events' };
  } else if (aggType === 'net') {
      metricName = 'net_bytes_diff';
      agg = { type: 'longSum', name: metricName, fieldName: 'text_bytes_diff_sum' };
  } else {
      metricName = 'abs_bytes_diff';
      agg = { type: 'longSum', name: metricName, fieldName: 'text_bytes_diff_abs_sum' };
  }

  return {
      queryType: 'topN',
      dataSource: 'mediawiki_history_reduced',
      granularity: granularity,
      dimension: dimension,
      threshold: 100,
      metric: metricName,
      filter: { type: 'and', fields: defaultFilters.concat(additionalFilters) },
      aggregations: [ agg ],
      postAggregations: [],
      intervals: [ makeStartTimestamp(dateTime=false) + '/'
          + makeEndTimestamp(granularity, dateTime=false) ]
  };
}

var makeTopEditedPagesPerEditsDruidQuery = function(granularity, additionalFilters) {
  return makeTopRevisionsDruidQuery('page_id', 'edits', granularity, additionalFilters)
}

var makeTopEditedPagesPerEditsDruidResult = function(granularity) {
    return makeDruidTopResult('page_id', 'edits', granularity);
}

var makeTopEditedPagesPerEditsAqsResult = function(editorType, pageType, granularity) {
    return makeAqsTopResult('page_id', 'edits', granularity, 'en.wikipedia', editorType, pageType);
}

var topEditedPagesPerEditsFixtures = [
    makeErrorFixture('return 400 for top-edited-pages-per-edits with all-projects filter', '/edited-pages/top-by-edits/all-projects/all-editor-types/all-page-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for top-edited-pages-per-edits with typo in date', '/edited-pages/top-by-edits/en.wikipedia/all-editor-types/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for top-edited-pages-per-edits with invalid date (end before start)', '/edited-pages/top-by-edits/en.wikipedia/all-editor-types/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for top-edited-pages-per-edits with invalid granularity', '/edited-pages/top-by-edits/en.wikipedia/all-editor-types/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-edited-pages-per-edits with invalid page-type', '/edited-pages/top-by-edits/en.wikipedia/all-editor-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-edited-pages-per-edits with invalid user-type', '/edited-pages/top-by-edits/en.wikipedia/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly top-edited-pages-per-edits and no full-month dates', '/edited-pages/top-by-edits/en.wikipedia/all-editor-types/all-page-types/monthly/2017010100/2017010200'),

    {
        describe: 'return 200 and results for top-edited-pages-per-edits daily with uppercase and .org project filter',
        aqsEndpoint: '/edited-pages/top-by-edits/EN.wikipedia.org/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditedPagesPerEditsDruidQuery('day', []),
        druidResult: makeTopEditedPagesPerEditsDruidResult('day'),
        expectedAqsResult: makeTopEditedPagesPerEditsAqsResult('all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for top-edited-pages-per-edits monthly with only project filter but no hour',
        aqsEndpoint: '/edited-pages/top-by-edits/en.wikipedia/all-editor-types/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeTopEditedPagesPerEditsDruidQuery('month', []),
        druidResult: makeTopEditedPagesPerEditsDruidResult('month'),
        expectedAqsResult: makeTopEditedPagesPerEditsAqsResult('all-editor-types', 'all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for top-edited-pages-per-edits with project and editor-type filter',
        aqsEndpoint: '/edited-pages/top-by-edits/en.wikipedia/anonymous/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditedPagesPerEditsDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'anonymous' },
        ]),
        druidResult: makeTopEditedPagesPerEditsDruidResult('day'),
        expectedAqsResult: makeTopEditedPagesPerEditsAqsResult('anonymous', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for top-edited-pages-per-edits with project, editor-type and page-type filter',
        aqsEndpoint: '/edited-pages/top-by-edits/en.wikipedia/user/non-content/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditedPagesPerEditsDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'user' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' },
        ]),
        druidResult: makeTopEditedPagesPerEditsDruidResult('day'),
        expectedAqsResult: makeTopEditedPagesPerEditsAqsResult('user', 'non-content', 'daily')
    }
];

/*****************************************
                Top Edited Pages by net-bytes-difference
                Reusing top edited pages by edits
******************************************/


var makeTopEditedPagesPerNetBytesDiffDruidQuery = function(granularity, additionalFilters) {
  return makeTopRevisionsDruidQuery('page_id', 'net', granularity, additionalFilters)
}

var makeTopEditedPagesPerNetBytesDiffDruidResult = function(granularity) {
    return makeDruidTopResult('page_id', 'net', granularity);
}

var makeTopEditedPagesPerNetBytesDiffAqsResult = function(editorType, pageType, granularity) {
    return makeAqsTopResult('page_id', 'net', granularity, 'en.wikipedia', editorType, pageType);
}

var topEditedPagesPerNetBytesDiffFixtures = [
    makeErrorFixture('return 400 for top-edited-pages-per-net-bytes-diff with all-projects filter', '/edited-pages/top-by-net-bytes-difference/all-projects/all-editor-types/all-page-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for top-edited-pages-per-net-bytes-diff with typo in date', '/edited-pages/top-by-net-bytes-difference/en.wikipedia/all-editor-types/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for top-edited-pages-per-net-bytes-diff with invalid date (end before start)', '/edited-pages/top-by-net-bytes-difference/en.wikipedia/all-editor-types/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for top-edited-pages-per-net-bytes-diff with invalid granularity', '/edited-pages/top-by-net-bytes-difference/en.wikipedia/all-editor-types/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-edited-pages-per-net-bytes-diff with invalid page-type', '/edited-pages/top-by-net-bytes-difference/en.wikipedia/all-editor-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-edited-pages-per-net-bytes-diff with invalid user-type', '/edited-pages/top-by-net-bytes-difference/en.wikipedia/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly top-edited-pages-per-net-bytes-diff and no full-month dates', '/edited-pages/top-by-net-bytes-difference/en.wikipedia/all-editor-types/all-page-types/monthly/2017010100/2017010200'),

    {
        describe: 'return 200 and results for top-edited-pages-per-net-bytes-diff daily with uppercase and .org project filter',
        aqsEndpoint: '/edited-pages/top-by-net-bytes-difference/EN.wikipedia.org/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditedPagesPerNetBytesDiffDruidQuery('day', []),
        druidResult: makeTopEditedPagesPerNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditedPagesPerNetBytesDiffAqsResult('all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for top-edited-pages-per-net-bytes-diff monthly with only project filter but no hour',
        aqsEndpoint: '/edited-pages/top-by-net-bytes-difference/en.wikipedia/all-editor-types/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeTopEditedPagesPerNetBytesDiffDruidQuery('month', []),
        druidResult: makeTopEditedPagesPerNetBytesDiffDruidResult('month'),
        expectedAqsResult: makeTopEditedPagesPerNetBytesDiffAqsResult('all-editor-types', 'all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for top-edited-pages-per-net-bytes-diff with project and editor-type filter',
        aqsEndpoint: '/edited-pages/top-by-net-bytes-difference/en.wikipedia/anonymous/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditedPagesPerNetBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'anonymous' },
        ]),
        druidResult: makeTopEditedPagesPerNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditedPagesPerNetBytesDiffAqsResult('anonymous', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for top-edited-pages-per-net-bytes-diff with project, editor-type and page-type filter',
        aqsEndpoint: '/edited-pages/top-by-net-bytes-difference/en.wikipedia/user/non-content/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditedPagesPerNetBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'user' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' },
        ]),
        druidResult: makeTopEditedPagesPerNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditedPagesPerNetBytesDiffAqsResult('user', 'non-content', 'daily')
    }
];


/*****************************************
                Top Edited Pages by abs-bytes-difference
                Reusing top edited pages by edits
******************************************/


var makeTopEditedPagesPerAbsBytesDiffDruidQuery = function(granularity, additionalFilters) {
  return makeTopRevisionsDruidQuery('page_id', 'abs', granularity, additionalFilters)
}

var makeTopEditedPagesPerAbsBytesDiffDruidResult = function(granularity) {
    return makeDruidTopResult('page_id', 'abs', granularity);
}

var makeTopEditedPagesPerAbsBytesDiffAqsResult = function(editorType, pageType, granularity) {
    return makeAqsTopResult('page_id', 'abs', granularity, 'en.wikipedia', editorType, pageType);
}

var topEditedPagesPerAbsBytesDiffFixtures = [
    makeErrorFixture('return 400 for top-edited-pages-per-absolute-bytes-diff with all-projects filter', '/edited-pages/top-by-absolute-bytes-difference/all-projects/all-editor-types/all-page-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for top-edited-pages-per-absolute-bytes-diff with typo in date', '/edited-pages/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for top-edited-pages-per-absolute-bytes-diff with invalid date (end before start)', '/edited-pages/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for top-edited-pages-per-absolute-bytes-diff with invalid granularity', '/edited-pages/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-edited-pages-per-absolute-bytes-diff with invalid page-type', '/edited-pages/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-edited-pages-per-absolute-bytes-diff with invalid user-type', '/edited-pages/top-by-absolute-bytes-difference/en.wikipedia/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly top-edited-pages-per-absolute-bytes-diff and no full-month dates', '/edited-pages/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/all-page-types/monthly/2017010100/2017010200'),

    {
        describe: 'return 200 and results for top-edited-pages-per-absolute-bytes-diff daily with uppercase and .org project filter',
        aqsEndpoint: '/edited-pages/top-by-absolute-bytes-difference/EN.wikipedia.org/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditedPagesPerAbsBytesDiffDruidQuery('day', []),
        druidResult: makeTopEditedPagesPerAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditedPagesPerAbsBytesDiffAqsResult('all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for top-edited-pages-per-absolute-bytes-diff monthly with only project filter but no hour',
        aqsEndpoint: '/edited-pages/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeTopEditedPagesPerAbsBytesDiffDruidQuery('month', []),
        druidResult: makeTopEditedPagesPerAbsBytesDiffDruidResult('month'),
        expectedAqsResult: makeTopEditedPagesPerAbsBytesDiffAqsResult('all-editor-types', 'all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for top-edited-pages-per-absolute-bytes-diff with project and editor-type filter',
        aqsEndpoint: '/edited-pages/top-by-absolute-bytes-difference/en.wikipedia/anonymous/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditedPagesPerAbsBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'anonymous' },
        ]),
        druidResult: makeTopEditedPagesPerAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditedPagesPerAbsBytesDiffAqsResult('anonymous', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for top-edited-pages-per-absolute-bytes-diff with project, editor-type and page-type filter',
        aqsEndpoint: '/edited-pages/top-by-absolute-bytes-difference/en.wikipedia/user/non-content/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditedPagesPerAbsBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'user' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' },
        ]),
        druidResult: makeTopEditedPagesPerAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditedPagesPerAbsBytesDiffAqsResult('user', 'non-content', 'daily')
    }
];

/*****************************************
                Top Editors by Edits
******************************************/

var makeTopEditorsPerEditsDruidQuery = function(granularity, additionalFilters) {
  return makeTopRevisionsDruidQuery('user_id', 'edits', granularity, additionalFilters)
}

var makeTopEditorsPerEditsDruidResult = function(granularity) {
    return makeDruidTopResult('user_id', 'edits', granularity);
}

var makeTopEditorsPerEditsAqsResult = function(editorType, pageType, granularity) {
    return makeAqsTopResult('user_id', 'edits', granularity, 'en.wikipedia', editorType, pageType);
}

var topEditorsPerEditsFixtures = [
    makeErrorFixture('return 400 for top-editors-per-edits with all-projects filter', '/editors/top-by-edits/all-projects/all-editor-types/all-page-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for top-editors-per-edits with typo in date', '/editors/top-by-edits/en.wikipedia/all-editor-types/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for top-editors-per-edits with invalid date (end before start)', '/editors/top-by-edits/en.wikipedia/all-editor-types/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for top-editors-per-edits with invalid granularity', '/editors/top-by-edits/en.wikipedia/all-editor-types/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-editors-per-edits with invalid page-type', '/editors/top-by-edits/en.wikipedia/all-editor-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-editors-per-edits with invalid user-type', '/editors/top-by-edits/en.wikipedia/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly top-editors-per-edits and no full-month dates', '/editors/top-by-edits/en.wikipedia/all-editor-types/all-page-types/monthly/2017010100/2017010200'),

    {
        describe: 'return 200 and results for top-editors-per-edits daily with uppercase and .org project filter',
        aqsEndpoint: '/editors/top-by-edits/EN.wikipedia.org/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditorsPerEditsDruidQuery('day', []),
        druidResult: makeTopEditorsPerEditsDruidResult('day'),
        expectedAqsResult: makeTopEditorsPerEditsAqsResult('all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for top-editors-per-edits monthly with only project filter but no hour',
        aqsEndpoint: '/editors/top-by-edits/en.wikipedia/all-editor-types/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeTopEditorsPerEditsDruidQuery('month', []),
        druidResult: makeTopEditorsPerEditsDruidResult('month'),
        expectedAqsResult: makeTopEditorsPerEditsAqsResult('all-editor-types', 'all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for top-editors-per-edits with project and editor-type filter',
        aqsEndpoint: '/editors/top-by-edits/en.wikipedia/anonymous/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditorsPerEditsDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'anonymous' },
        ]),
        druidResult: makeTopEditorsPerEditsDruidResult('day'),
        expectedAqsResult: makeTopEditorsPerEditsAqsResult('anonymous', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for top-editors-per-edits with project, editor-type and page-type filter',
        aqsEndpoint: '/editors/top-by-edits/en.wikipedia/user/non-content/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditorsPerEditsDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'user' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' },
        ]),
        druidResult: makeTopEditorsPerEditsDruidResult('day'),
        expectedAqsResult: makeTopEditorsPerEditsAqsResult('user', 'non-content', 'daily')
    }
];

/*****************************************
                Top Editors by net-bytes-difference
                Reusing top editors by edits
******************************************/


var makeTopEditorsPerNetBytesDiffDruidQuery = function(granularity, additionalFilters) {
  return makeTopRevisionsDruidQuery('user_id', 'net', granularity, additionalFilters)
}

var makeTopEditorsPerNetBytesDiffDruidResult = function(granularity) {
    return makeDruidTopResult('user_id', 'net', granularity);
}

var makeTopEditorsPerNetBytesDiffAqsResult = function(editorType, pageType, granularity) {
    return makeAqsTopResult('user_id', 'net', granularity, 'en.wikipedia', editorType, pageType);
}

var topEditorsPerNetBytesDiffFixtures = [
    makeErrorFixture('return 400 for top-editors-per-net-bytes-diff with all-projects filter', '/editors/top-by-net-bytes-difference/all-projects/all-editor-types/all-page-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for top-editors-per-net-bytes-diff with typo in date', '/editors/top-by-net-bytes-difference/en.wikipedia/all-editor-types/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for top-editors-per-net-bytes-diff with invalid date (end before start)', '/editors/top-by-net-bytes-difference/en.wikipedia/all-editor-types/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for top-editors-per-net-bytes-diff with invalid granularity', '/editors/top-by-net-bytes-difference/en.wikipedia/all-editor-types/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-editors-per-net-bytes-diff with invalid page-type', '/editors/top-by-net-bytes-difference/en.wikipedia/all-editor-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-editors-per-net-bytes-diff with invalid user-type', '/editors/top-by-net-bytes-difference/en.wikipedia/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly top-editors-per-net-bytes-diff and no full-month dates', '/editors/top-by-net-bytes-difference/en.wikipedia/all-editor-types/all-page-types/monthly/2017010100/2017010200'),

    {
        describe: 'return 200 and results for top-editors-per-net-bytes-diff daily with uppercase and .org project filter',
        aqsEndpoint: '/editors/top-by-net-bytes-difference/EN.wikipedia.org/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditorsPerNetBytesDiffDruidQuery('day', []),
        druidResult: makeTopEditorsPerNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditorsPerNetBytesDiffAqsResult('all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for top-editors-per-net-bytes-diff monthly with only project filter but no hour',
        aqsEndpoint: '/editors/top-by-net-bytes-difference/en.wikipedia/all-editor-types/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeTopEditorsPerNetBytesDiffDruidQuery('month', []),
        druidResult: makeTopEditorsPerNetBytesDiffDruidResult('month'),
        expectedAqsResult: makeTopEditorsPerNetBytesDiffAqsResult('all-editor-types', 'all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for top-editors-per-net-bytes-diff with project and editor-type filter',
        aqsEndpoint: '/editors/top-by-net-bytes-difference/en.wikipedia/anonymous/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditorsPerNetBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'anonymous' },
        ]),
        druidResult: makeTopEditorsPerNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditorsPerNetBytesDiffAqsResult('anonymous', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for top-editors-per-net-bytes-diff with project, editor-type and page-type filter',
        aqsEndpoint: '/editors/top-by-net-bytes-difference/en.wikipedia/user/non-content/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditorsPerNetBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'user' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' },
        ]),
        druidResult: makeTopEditorsPerNetBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditorsPerNetBytesDiffAqsResult('user', 'non-content', 'daily')
    }
];


/*****************************************
                Top Edited Pages by abs-bytes-difference
                Reusing top edited pages by edits
******************************************/


var makeTopEditorsPerAbsBytesDiffDruidQuery = function(granularity, additionalFilters) {
  return makeTopRevisionsDruidQuery('user_id', 'abs', granularity, additionalFilters)
}

var makeTopEditorsPerAbsBytesDiffDruidResult = function(granularity) {
    return makeDruidTopResult('user_id', 'abs', granularity);
}

var makeTopEditorsPerAbsBytesDiffAqsResult = function(editorType, pageType, granularity) {
    return makeAqsTopResult('user_id', 'abs', granularity, 'en.wikipedia', editorType, pageType);
}

var topEditorsPerAbsBytesDiffFixtures = [
    makeErrorFixture('return 400 for top-editors-per-absolute-bytes-diff with all-projects filter', '/editors/top-by-absolute-bytes-difference/all-projects/all-editor-types/all-page-types/daily/2017010100/201701000'),
    makeErrorFixture('return 400 for top-editors-per-absolute-bytes-diff with typo in date', '/editors/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/all-page-types/daily/2017010100/2017010a00'),
    makeErrorFixture('return 400 for top-editors-per-absolute-bytes-diff with invalid date (end before start)', '/editors/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/all-page-types/daily/2017010200/2017010100'),
    makeErrorFixture('return 400 for top-editors-per-absolute-bytes-diff with invalid granularity', '/editors/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/all-page-types/wrong/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-editors-per-absolute-bytes-diff with invalid page-type', '/editors/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/wrong/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for top-editors-per-absolute-bytes-diff with invalid user-type', '/editors/top-by-absolute-bytes-difference/en.wikipedia/wrong/all-page-types/daily/2017010100/2017010200'),
    makeErrorFixture('return 400 for monthly top-editors-per-absolute-bytes-diff and no full-month dates', '/editors/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/all-page-types/monthly/2017010100/2017010200'),

    {
        describe: 'return 200 and results for top-editors-per-absolute-bytes-diff daily with uppercase and .org project filter',
        aqsEndpoint: '/editors/top-by-absolute-bytes-difference/EN.wikipedia.org/all-editor-types/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditorsPerAbsBytesDiffDruidQuery('day', []),
        druidResult: makeTopEditorsPerAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditorsPerAbsBytesDiffAqsResult('all-editor-types', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 and results for top-editors-per-absolute-bytes-diff monthly with only project filter but no hour',
        aqsEndpoint: '/editors/top-by-absolute-bytes-difference/en.wikipedia/all-editor-types/all-page-types/monthly/20170101/20170210',
        expectedDruidQuery: makeTopEditorsPerAbsBytesDiffDruidQuery('month', []),
        druidResult: makeTopEditorsPerAbsBytesDiffDruidResult('month'),
        expectedAqsResult: makeTopEditorsPerAbsBytesDiffAqsResult('all-editor-types', 'all-page-types', 'monthly')
    },
    {
        describe: 'return 200 with results for top-editors-per-absolute-bytes-diff with project and editor-type filter',
        aqsEndpoint: '/editors/top-by-absolute-bytes-difference/en.wikipedia/anonymous/all-page-types/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditorsPerAbsBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'anonymous' },
        ]),
        druidResult: makeTopEditorsPerAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditorsPerAbsBytesDiffAqsResult('anonymous', 'all-page-types', 'daily')
    },
    {
        describe: 'return 200 with results for top-editors-per-absolute-bytes-diff with project, editor-type and page-type filter',
        aqsEndpoint: '/editors/top-by-absolute-bytes-difference/en.wikipedia/user/non-content/daily/2017010100/2017010200',
        expectedDruidQuery: makeTopEditorsPerAbsBytesDiffDruidQuery('day', [
            { type: 'selector', dimension: 'user_type', value: 'user' },
            { type: 'selector', dimension: 'page_type', value: 'non_content' },
        ]),
        druidResult: makeTopEditorsPerAbsBytesDiffDruidResult('day'),
        expectedAqsResult: makeTopEditorsPerAbsBytesDiffAqsResult('user', 'non-content', 'daily')
    }
];




exports.values = []
    .concat(newPagesFixtures)
    .concat(editedPagesFixtures)
    .concat(newRegisteredUsersFixtures)
    .concat(editorsFixtures)
    .concat(editsFixtures)
    .concat(editsPerPageFixtures)
    .concat(editsPerEditorFixtures)
    .concat(netBytesDiffFixtures)
    .concat(netBytesDiffPerPageFixtures)
    .concat(netBytesDiffPerEditorFixtures)
    .concat(absBytesDiffFixtures)
    .concat(absBytesDiffPerPageFixtures)
    .concat(absBytesDiffPerEditorFixtures)
    .concat(topEditedPagesPerEditsFixtures)
    .concat(topEditedPagesPerNetBytesDiffFixtures)
    .concat(topEditedPagesPerAbsBytesDiffFixtures)
    .concat(topEditorsPerEditsFixtures)
    .concat(topEditorsPerNetBytesDiffFixtures)
    .concat(topEditorsPerAbsBytesDiffFixtures)
    ;