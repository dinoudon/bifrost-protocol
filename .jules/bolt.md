<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
## 2025-02-14 - Database Performance in Bifrost
**Learning:** The initial schema in `db.ts` lacked indexes for frequent queries on `status`, `priority`, and `last_heartbeat`. `availableTasks` also performed in-memory filtering of all unassigned tasks, which scaled poorly as the task backlog grew. Moving skill filtering to SQL using `json_each` significantly improves performance.
**Action:** Added targeted indexes to `tasks`, `agents`, and `locks` tables. Optimized `availableTasks` to use SQL-level filtering with JSON functions.

## 2025-05-15 - Optimizing Collection Filtering with SQLite JSON functions
**Learning:** Offloading JSON array filtering from JavaScript to SQLite using `json_each` and `json_array_length` significantly improves performance (approx. 6x in benchmarks with 10k rows) by reducing data transfer and leveraging the database's optimized processing.
**Action:** Use SQLite 3.38+ JSON functions to handle collection filtering at the database layer whenever possible in `bifrost-protocol`.

## 2025-05-22 - Initial Bolt Optimization in Bifrost Protocol
**Learning:** SQLite 3.38+ supports powerful JSON filtering that can offload intensive JavaScript filtering back to the database.
**Action:** Use `json_each` and `json_array_length` for skill-based filtering in `availableTasks` to reduce row fetching and manual filtering overhead.

## 2025-05-15 - SQLite JSON filtering optimization (PR #5)
**Learning:** SQLite 3.38+ supports JSON functions like `json_each` and `json_array_length`. Using these functions to filter data in the database layer instead of the application layer (JavaScript) significantly reduces data transfer and improves performance.
**Action:** Always check if JSON data can be filtered using SQLite's built-in functions before pulling all records into memory.

## 2025-05-15 - JSON Filtering in SQLite (PR #6)
**Learning:** SQLite 3.38+ supports powerful JSON functions like `json_each` and `json_array_length`. Using these functions to perform filtering on JSON columns directly in the database can significantly reduce data transfer and memory overhead in the application layer. In this project, offloading task skill filtering to SQLite resulted in a ~20-35% performance improvement for task retrieval.
**Action:** Always check if complex filtering on JSON columns can be moved to the database layer using SQLite's JSON functions instead of filtering in JavaScript.
=======
## 2025-05-15 - SQLite JSON filtering optimization
**Learning:** Fetching all rows from a SQLite table to filter JSON array columns in JavaScript is a significant performance bottleneck as the dataset grows. Using SQLite's built-in `json_each` and `json_array_length` functions to perform filtering at the database layer reduces data transfer and leverages SQLite's optimized C implementation. In this codebase, offloading task skill matching to SQL resulted in a ~55% performance improvement for task retrieval with 5000 records.
**Action:** Always prefer database-level filtering for JSON columns using `json_each` or `json_extract` instead of manual filtering in Node.js when using `better-sqlite3`.
>>>>>>> origin/bolt-sqlite-json-opt-5378626762207854724

## 2025-05-15 - SQLite JSON filtering optimization (PR #7)
**Learning:** Fetching all rows from a SQLite table to filter JSON array columns in JavaScript is a significant performance bottleneck as the dataset grows. Using SQLite's built-in `json_each` and `json_array_length` functions to perform filtering at the database layer reduces data transfer and leverages SQLite's optimized C implementation. In this codebase, offloading task skill matching to SQL resulted in a ~55% performance improvement for task retrieval with 5000 records.
**Action:** Always prefer database-level filtering for JSON columns using `json_each` or `json_extract` instead of manual filtering in Node.js when using `better-sqlite3`.
=======
## 2025-05-14 - SQLite JSON filtering optimization
**Learning:** Offloading JSON array filtering to SQLite using `json_each` and `EXISTS` provides a ~60% performance boost compared to in-memory JavaScript filtering (from ~31ms to ~11ms for 10,000 tasks). This reduces both CPU usage in the main thread and memory overhead from transferring unneeded records.
**Action:** Always prefer database-level JSON operations (`json_each`, `json_array_length`, `json_extract`) for filtering or aggregating data stored in SQLite JSON columns.
>>>>>>> origin/bolt-optimize-available-tasks-sqlite-json-filtering-20250514-061343-261486-8200248643781046706

## 2025-05-14 - SQLite JSON filtering optimization (PR #8)
**Learning:** Offloading JSON array filtering to SQLite using `json_each` and `EXISTS` provides a ~60% performance boost compared to in-memory JavaScript filtering (from ~31ms to ~11ms for 10,000 tasks). This reduces both CPU usage in the main thread and memory overhead from transferring unneeded records.
**Action:** Always prefer database-level JSON operations (`json_each`, `json_array_length`, `json_extract`) for filtering or aggregating data stored in SQLite JSON columns.
=======
## 2025-05-15 - SQLite JSON filtering vs JS filtering
**Learning:** Using SQLite's built-in JSON functions like `json_each` and `json_array_length` to filter data at the database layer is significantly faster (~35-45% in this case) than fetching all records and filtering them in JavaScript. This reduces both CPU time for JSON parsing and memory overhead from fetching unnecessary records.
**Action:** Always prefer database-side filtering with JSON functions when working with `better-sqlite3` and SQLite 3.38+ for column-based JSON arrays.
>>>>>>> origin/bolt-optimize-task-filtering-13396244736116197897

## 2025-05-15 - SQLite JSON filtering vs JS filtering (PR #9)
**Learning:** Using SQLite's built-in JSON functions like `json_each` and `json_array_length` to filter data at the database layer is significantly faster (~35-45% in this case) than fetching all records and filtering them in JavaScript. This reduces both CPU time for JSON parsing and memory overhead from fetching unnecessary records.
**Action:** Always prefer database-side filtering with JSON functions when working with `better-sqlite3` and SQLite 3.38+ for column-based JSON arrays.
=======
## 2025-05-15 - SQLite JSON Filtering vs JS Filtering
**Learning:** Offloading JSON skill filtering from JavaScript to SQLite using `json_each` and `json_array_length` resulted in a ~20% performance improvement in `availableTasks` even with 10,000 tasks. While in-memory benchmarks showed slight overhead from adding indices (likely due to seeding/maintenance cost in memory), indices on `(status, priority)` are critical for production disk-based SQLite to prevent full table scans as the task list grows.
**Action:** Always prefer SQL-level filtering for JSON columns when using `better-sqlite3`, as it reduces data transfer between SQLite and the Node.js main thread.
>>>>>>> origin/bolt-optimize-task-retrieval-15699818811518261994

## 2025-05-15 - SQLite JSON Filtering vs JS Filtering (PR #10)
**Learning:** Offloading JSON skill filtering from JavaScript to SQLite using `json_each` and `json_array_length` resulted in a ~20% performance improvement in `availableTasks` even with 10,000 tasks. While in-memory benchmarks showed slight overhead from adding indices, indices on `(status, priority)` are critical for production disk-based SQLite to prevent full table scans as the task list grows.
**Action:** Always prefer SQL-level filtering for JSON columns when using `better-sqlite3`, as it reduces data transfer between SQLite and the Node.js main thread.
=======
## 2025-05-15 - SQLite JSON performance optimization
**Learning:** Using `json_each` and `json_array_length` in SQLite to offload filtering from JavaScript to the database layer resulted in a ~50% performance improvement for task retrieval (from ~21.75ms to ~10.64ms for 10k tasks).
**Action:** Always consider offloading complex filtering on JSON columns to the database layer when using `better-sqlite3`.
>>>>>>> origin/bolt-optimize-task-retrieval-9838418585780869144

## 2025-05-15 - SQLite JSON performance optimization (PR #11)
**Learning:** Using `json_each` and `json_array_length` in SQLite to offload filtering from JavaScript to the database layer resulted in a ~50% performance improvement for task retrieval (from ~21.75ms to ~10.64ms for 10k tasks).
**Action:** Always consider offloading complex filtering on JSON columns to the database layer when using `better-sqlite3`.
=======
## 2025-05-15 - SQLite JSON filtering optimization
**Learning:** Moving complex filtering logic (like JSON array intersections) from JavaScript to the SQLite database layer using `json_each` and `json_array_length` can significantly reduce latency and memory overhead, especially when dealing with large datasets. In this case, it reduced `availableTasks` latency by ~20-50% depending on the number of unassigned tasks.

**Action:** Always check if JSON data stored in SQLite can be filtered or processed using SQLite's native JSON functions before pulling all records into memory.

## 2025-05-15 - Multi-column indexing for state-based queries
**Learning:** Adding indexes on `(status, priority)` for tasks and `(status, last_heartbeat)` for agents provides immediate performance gains for the most frequent query patterns in a coordination system like Bifrost.

**Action:** Identify the most frequent `WHERE` and `ORDER BY` clauses and ensure appropriate covering indexes are in place during schema initialization.
>>>>>>> origin/bolt-sqlite-opt-6750013195375293513

## 2025-05-15 - SQLite JSON filtering optimization (PR #12)
**Learning:** Moving complex filtering logic (like JSON array intersections) from JavaScript to the SQLite database layer using `json_each` and `json_array_length` can significantly reduce latency and memory overhead. In this case, it reduced `availableTasks` latency by ~20-50% depending on the number of unassigned tasks.
**Action:** Always check if JSON data stored in SQLite can be filtered or processed using SQLite's native JSON functions before pulling all records into memory.

## 2025-05-15 - Multi-column indexing for state-based queries (PR #12)
**Learning:** Adding indexes on `(status, priority)` for tasks and `(status, last_heartbeat)` for agents provides immediate performance gains for the most frequent query patterns in a coordination system like Bifrost.
**Action:** Add composite indexes on columns used in WHERE + ORDER BY clauses for frequently queried tables.
