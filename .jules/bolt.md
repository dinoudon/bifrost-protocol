## 2025-05-15 - SQLite JSON performance optimization
**Learning:** Using `json_each` and `json_array_length` in SQLite to offload filtering from JavaScript to the database layer resulted in a ~50% performance improvement for task retrieval (from ~21.75ms to ~10.64ms for 10k tasks).
**Action:** Always consider offloading complex filtering on JSON columns to the database layer when using `better-sqlite3`.
