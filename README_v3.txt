HOI THAO - V3

Fixes:
- Confirmation modal accepts both current and legacy API response shapes, preventing blank details/code.
- Confirmation opens immediately after successful save; registration-status refresh runs in background.
- Employee list uses 10-minute browser cache for faster subsequent loads.
- Loading overlay includes a "Tải lại dữ liệu" button that clears browser employee cache and reloads.
- QR verification URL preserves the Apps Script /exec path correctly.
- Existing Code.gs/admin.html from V2 retained.

Deploy all 3 files, then create a new Apps Script deployment version.
Do not run doPost() directly; use testRouting() if testing routing inside Apps Script.
