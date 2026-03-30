## 2025-02-14 - Database Performance in Bifrost
**Learning:** The initial schema in `db.ts` lacked indexes for frequent queries on `status`, `priority`, and `last_heartbeat`. `availableTasks` also performed in-memory filtering of all unassigned tasks, which scaled poorly as the task backlog grew. Moving skill filtering to SQL using `json_each` significantly improves performance.
**Action:** Added targeted indexes to `tasks`, `agents`, and `locks` tables. Optimized `availableTasks` to use SQL-level filtering with JSON functions.

## 2025-05-15 - Optimizing Collection Filtering with SQLite JSON functions
**Learning:** Offloading JSON array filtering from JavaScript to SQLite using `json_each` and `json_array_length` significantly improves performance (approx. 6x in benchmarks with 10k rows) by reducing data transfer and leveraging the database's optimized processing.
**Action:** Use SQLite 3.38+ JSON functions to handle collection filtering at the database layer whenever possible in `bifrost-protocol`.

## 2025-05-22 - Initial Bolt Optimization in Bifrost Protocol
**Learning:** SQLite 3.38+ supports powerful JSON filtering that can offload intensive JavaScript filtering back to the database.
**Action:** Use `json_each` and `json_array_length` for skill-based filtering in `availableTasks` to reduce row fetching and manual filtering overhead.
