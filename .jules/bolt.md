## 2025-02-14 - Database Performance in Bifrost
**Learning:** The initial schema in `db.ts` lacked indexes for frequent queries on `status`, `priority`, and `last_heartbeat`. `availableTasks` also performed in-memory filtering of all unassigned tasks, which scaled poorly as the task backlog grew. Moving skill filtering to SQL using `json_each` significantly improves performance.
**Action:** Added targeted indexes to `tasks`, `agents`, and `locks` tables. Optimized `availableTasks` to use SQL-level filtering with JSON functions.

## 2025-05-14 - SQLite JSON filtering: ~60% performance improvement
**Learning:** Offloading JSON array filtering to SQLite using `json_each` and `EXISTS` provides a ~60% performance boost compared to in-memory JavaScript filtering (from ~31ms to ~11ms for 10,000 tasks). This reduces both CPU usage in the main thread and memory overhead from transferring unneeded records.
**Action:** Always prefer database-level JSON operations (`json_each`, `json_array_length`, `json_extract`) for filtering or aggregating data stored in SQLite JSON columns.

## 2025-05-15 - SQLite JSON filtering: benchmarked results
**Learning:** Fetching all rows to filter JSON array columns in JavaScript is a significant bottleneck. Offloading to SQLite using `json_each` and `json_array_length` yields: ~20-35% improvement (5k tasks), ~35-45% (10k tasks), ~50-55% (10k tasks, disk-based DB). The `json_each(?)` pattern passing skills as a JSON string avoids SQLite's SQLITE_LIMIT_VARIABLE_NUMBER limit.
**Action:** Always prefer database-side JSON filtering with `json_each` when using `better-sqlite3` and SQLite 3.38+. Pass skill arrays as `JSON.stringify(array)` to a single `?` parameter.

## 2025-05-15 - Multi-column indexing for state-based queries
**Learning:** Adding indexes on `(status, priority)` for tasks and `(status, last_heartbeat)` for agents provides immediate performance gains for the most frequent query patterns in a coordination system like Bifrost. Note: `json_each` subqueries cannot be indexed by SQLite; the status index eliminates non-candidate rows before JSON scanning.
**Action:** Add composite indexes on columns used in WHERE + ORDER BY clauses during schema initialization. For disk-based production DBs, these indexes are critical to prevent full table scans.

## 2025-05-22 - Optimizing Task Retrieval: O(N) JS filtering bottleneck
**Learning:** Retrieving all unassigned tasks and filtering them in JavaScript is an O(N) bottleneck as the task list grows. SQLite 3.38+ JSON functions allow offloading this to the database layer, reducing both data transfer and parse overhead.
**Action:** Use `json_each` and `json_array_length` to filter JSON skill arrays in SQL. Implement composite indexes for common query patterns like `status` and `priority`.

## 2026-03-29 - Optimize availableTasks with SQLite JSON filtering (final)
**Learning:** SQLite's `json_each` and `json_array_length` are significantly more efficient than filtering JSON columns in JavaScript. Using `EXISTS` with `json_each` allows clean and fast intersection checks directly in the database.
**Action:** Always consider offloading JSON array filtering to SQLite using `json_each` and indexes when performance is a concern.
