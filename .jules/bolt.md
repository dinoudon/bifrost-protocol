## 2025-05-14 - SQLite JSON filtering optimization
**Learning:** Offloading JSON array filtering to SQLite using `json_each` and `EXISTS` provides a ~60% performance boost compared to in-memory JavaScript filtering (from ~31ms to ~11ms for 10,000 tasks). This reduces both CPU usage in the main thread and memory overhead from transferring unneeded records.
**Action:** Always prefer database-level JSON operations (`json_each`, `json_array_length`, `json_extract`) for filtering or aggregating data stored in SQLite JSON columns.
