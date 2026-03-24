## 2025-05-15 - SQLite JSON filtering vs JS filtering
**Learning:** Using SQLite's built-in JSON functions like `json_each` and `json_array_length` to filter data at the database layer is significantly faster (~35-45% in this case) than fetching all records and filtering them in JavaScript. This reduces both CPU time for JSON parsing and memory overhead from fetching unnecessary records.
**Action:** Always prefer database-side filtering with JSON functions when working with `better-sqlite3` and SQLite 3.38+ for column-based JSON arrays.
