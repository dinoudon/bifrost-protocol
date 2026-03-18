## 2025-05-15 - Optimizing Collection Filtering with SQLite JSON functions
**Learning:** Offloading JSON array filtering from JavaScript to SQLite using `json_each` and `json_array_length` significantly improves performance (approx. 6x in benchmarks with 10k rows) by reducing data transfer and leveraging the database's optimized processing.
**Action:** Use SQLite 3.38+ JSON functions to handle collection filtering at the database layer whenever possible in `bifrost-protocol`.
