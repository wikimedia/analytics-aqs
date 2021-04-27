
CREATE KEYSPACE "local_group_default_T_pageviews_per_project_v2" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_pageviews_per_project_v2".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_pageviews_per_project_v2".data (
    "_domain" text,
    project text,
    access text,
    agent text,
    granularity text,
    timestamp text,
    "_tid" timeuuid,
    "_del" timeuuid,
    v bigint,
    views int,
    PRIMARY KEY (("_domain", project, access, agent, granularity), timestamp, "_tid")
) WITH CLUSTERING ORDER BY (timestamp ASC, "_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE KEYSPACE "local_group_default_T_mediarequest_top_files" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_mediarequest_top_files".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_mediarequest_top_files".data (
    "_domain" text,
    referer text,
    media_type text,
    year text,
    month text,
    day text,
    "_tid" timeuuid,
    "_del" timeuuid,
    "filesJSON" text,
    PRIMARY KEY (("_domain", referer, media_type, year, month, day), "_tid")
) WITH CLUSTERING ORDER BY ("_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE KEYSPACE "local_group_default_T_lgc_pagecounts_per_project" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_lgc_pagecounts_per_project".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_lgc_pagecounts_per_project".data (
    "_domain" text,
    project text,
    "access-site" text,
    granularity text,
    timestamp text,
    "_tid" timeuuid,
    "_del" timeuuid,
    count bigint,
    PRIMARY KEY (("_domain", project, "access-site", granularity), timestamp, "_tid")
) WITH CLUSTERING ORDER BY (timestamp ASC, "_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE KEYSPACE "local_group_default_T_mediarequest_per_file" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_mediarequest_per_file".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_mediarequest_per_file".data (
    "_domain" text,
    referer text,
    file_path text,
    granularity text,
    timestamp text,
    "_tid" timeuuid,
    "_del" timeuuid,
    spider int,
    user int,
    PRIMARY KEY (("_domain", referer, file_path, granularity), timestamp, "_tid")
) WITH CLUSTERING ORDER BY (timestamp ASC, "_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'chunk_length_kb': '256', 'sstable_compression': 'org.apache.cassandra.io.compress.DeflateCompressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE KEYSPACE "local_group_default_T_top_pageviews" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_top_pageviews".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_top_pageviews".data (
    "_domain" text,
    project text,
    access text,
    year text,
    month text,
    day text,
    "_tid" timeuuid,
    "_del" timeuuid,
    articles text,
    "articlesJSON" text,
    PRIMARY KEY (("_domain", project, access, year, month, day), "_tid")
) WITH CLUSTERING ORDER BY ("_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE KEYSPACE "local_group_default_T_top_percountry" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_top_percountry".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_top_percountry".data (
    "_domain" text,
    country text,
    access text,
    year text,
    month text,
    day text,
    "_tid" timeuuid,
    "_del" timeuuid,
    articles text,
    PRIMARY KEY (("_domain", country, access, year, month, day), "_tid")
) WITH CLUSTERING ORDER BY ("_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE KEYSPACE "local_group_default_T_editors_bycountry" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_editors_bycountry".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_editors_bycountry".data (
    "_domain" text,
    project text,
    "activity-level" text,
    year text,
    month text,
    "_tid" timeuuid,
    "_del" timeuuid,
    "countriesJSON" text,
    PRIMARY KEY (("_domain", project, "activity-level", year, month), "_tid")
) WITH CLUSTERING ORDER BY ("_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE KEYSPACE "local_group_default_T_top_pageviews_bycountry" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE KEYSPACE "local_group_default_T_mediarequest_per_referer" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_mediarequest_per_referer".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_mediarequest_per_referer".data (
    "_domain" text,
    referer text,
    media_type text,
    agent text,
    granularity text,
    timestamp text,
    "_tid" timeuuid,
    "_del" timeuuid,
    requests bigint,
    PRIMARY KEY (("_domain", referer, media_type, agent, granularity), timestamp, "_tid")
) WITH CLUSTERING ORDER BY (timestamp ASC, "_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE KEYSPACE "local_group_default_T_unique_devices" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_unique_devices".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_unique_devices".data (
    "_domain" text,
    project text,
    "access-site" text,
    granularity text,
    timestamp text,
    "_tid" timeuuid,
    "_del" timeuuid,
    devices bigint,
    offset bigint,
    underestimate bigint,
    PRIMARY KEY (("_domain", project, "access-site", granularity), timestamp, "_tid")
) WITH CLUSTERING ORDER BY (timestamp ASC, "_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE KEYSPACE "local_group_default_T_pageviews_per_article_flat" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_pageviews_per_article_flat".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_pageviews_per_article_flat".data (
    "_domain" text,
    project text,
    article text,
    granularity text,
    timestamp text,
    "_tid" timeuuid,
    "_del" timeuuid,
    aa int,
    ab int,
    as int,
    au int,
    da int,
    db int,
    ds int,
    du int,
    maa int,
    mab int,
    mas int,
    mau int,
    mwa int,
    mwb int,
    mws int,
    mwu int,
    PRIMARY KEY (("_domain", project, article, granularity), timestamp, "_tid")
) WITH CLUSTERING ORDER BY (timestamp ASC, "_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'chunk_length_kb': '256', 'sstable_compression': 'org.apache.cassandra.io.compress.DeflateCompressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE KEYSPACE "local_group_default_T_top_bycountry" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_top_bycountry".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_top_bycountry".data (
    "_domain" text,
    project text,
    access text,
    year text,
    month text,
    "_tid" timeuuid,
    "_del" timeuuid,
    "countriesJSON" text,
    PRIMARY KEY (("_domain", project, access, year, month), "_tid")
) WITH CLUSTERING ORDER BY ("_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE KEYSPACE "local_group_default_T_pageviews_per_project" WITH replication = {'class': 'NetworkTopologyStrategy', 'eqiad': '3'}  AND durable_writes = true;

CREATE TABLE "local_group_default_T_pageviews_per_project".meta (
    key text,
    tid timeuuid,
    "_del" timeuuid,
    value text,
    PRIMARY KEY (key, tid)
) WITH CLUSTERING ORDER BY (tid DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

CREATE TABLE "local_group_default_T_pageviews_per_project".data (
    "_domain" text,
    project text,
    access text,
    agent text,
    granularity text,
    timestamp text,
    "_tid" timeuuid,
    "_del" timeuuid,
    v bigint,
    views int,
    PRIMARY KEY (("_domain", project, access, agent, granularity), timestamp, "_tid")
) WITH CLUSTERING ORDER BY (timestamp ASC, "_tid" DESC)
    AND bloom_filter_fp_chance = 0.1
    AND caching = '{"keys":"ALL", "rows_per_partition":"NONE"}'
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}
    AND compression = {'sstable_compression': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND dclocal_read_repair_chance = 0.1
    AND default_time_to_live = 0
    AND gc_grace_seconds = 864000
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair_chance = 0.0
    AND speculative_retry = '99.0PERCENTILE';

