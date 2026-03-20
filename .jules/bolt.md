## 2025-05-15 - SQLite JSON filtering optimization
**Learning:** SQLite 3.38+ supports JSON functions like `json_each` and `json_array_length`. Using these functions to filter data in the database layer instead of the application layer (JavaScript) significantly reduces data transfer and improves performance.
**Action:** Always check if JSON data can be filtered using SQLite's built-in functions before pulling all records into memory.
