# ACHARYA PATHOLOGY — Diagnostic & Laboratory Management System

**Location:** Silwani, Dist. Raisen, Madhya Pradesh, India  
**Platform:** Offline Windows Desktop Application  
**Technology:** Electron • React • JavaScript • SQLite • Tailwind CSS

---

## 🚀 Quick Launch (How to Open the Application)

You can launch **Acharya Pathology** directly without typing any commands:

1. Double-click **`Start-Acharya-Pathology.bat`** in the application folder, OR
2. Run the packaged executable in the `release/` folder:
   - **`Acharya-Pathology-Portable.exe`** (Run immediately from desktop or USB drive without installing)
   - **`Acharya Pathology Setup 1.0.0.exe`** (Standard Windows installer with desktop shortcut)

---

## ✨ Key Features & Clinical Workflow

### 1. Dashboard
- Real-time statistics: Total Patients Today, Total Reports Created Today, Total Pending Dues, Completed Reports.
- Quick action buttons to register new patients, view all reports, or search previous records.
- Recent patient reports with 1-click View, Edit, and Print shortcuts.

### 2. New Patient Registration (`+ New Entry`)
- **Unique Report Numbering:** Automatically generates sequential numbers (`AP-000001`, `AP-000002`...).
- **Patient Details:** Name, Age, Gender, Phone Number, and Reference Doctor.
- **Smart Returning Patient Auto-suggest:** As phone number is typed, existing patients appear for 1-click auto-fill, linking their diagnostic history.
- **Service Selection:** Select Blood Tests, X-Ray services, or both.
- **Live Automatic Billing:** Instant calculation of individual test charges, Total Amount, Paid Amount, and Pending Due.
- **Payment Options:** Paid, Partially Paid (with remaining balance auto-calculated), or Pending.

### 3. Medical Report & Results Entry
- Automatically generates report parameter tables for every selected blood test.
- Pre-seeded with complete Indian clinical reference ranges (CBC, Blood Sugar FBS/PPBS/RBS, HbA1c, Lipid Profile, LFT, KFT/RFT, Thyroid, Widal, Urine Routine, Dengue, Malaria, Electrolytes).
- **Automatic Abnormal Value Detection:** Values outside the biological reference range are visually flagged in red and bolded on the final printed report.
- Dedicated multi-line areas for X-Ray Findings, Impressions, and Remarks.
- **Save Draft:** Save incomplete results safely and finish later.
- **Save Report:** Mark as completed.

### 4. Combined A4 Medical Report & Billing Statement
- **Guaranteed Full Signature & Footer:** The Authorized Signature and clinic footer are strictly protected with page-break rules (`break-inside: avoid`), ensuring they are never clipped or cut off at the bottom of the page when printed physically or saved to PDF.
- **Optional Print Payment Display Modal:** When clicking `🖨 Print A4 Report` or `Export PDF`, a modal allows staff to choose how payment details appear on that specific printout without altering the database:
  1. *Complete Payment Information:* Total, Paid, Pending Due, and Payment Status.
  2. *Show as Fully Paid:* Displays receipt as Paid in full with ₹0 pending for this printout.
  3. *Show Only Total Amount:* Displays test charges and Total Amount only; completely hides Paid, Pending, and Status.
  4. *Hide All Payment Details:* Omits the billing section entirely, printing only medical test results and radiological reports.
- **Combined on Same Document:** Clinical test results, radiological findings, and itemized billing are printed on the same document as required.
- **Multi-page A4 Support:** Professional print stylesheet (`@media print` and `@page`) prevents awkward line breaks across pages.
- **Dual Stationery Modes:**
  - *Plain A4 Paper:* Prints full digital clinic header with logo, address, and registration info.
  - *Pre-printed Letterhead Pads:* Option in Settings or Print Preview to suppress the header and leave a configurable top blank margin for physical clinic letterhead pads.
- **Dual Export:** 1-click physical printing via Windows system printer dialog, plus 1-click direct export to **PDF**.
- **Authorized Signatory:** Displays Dr. S. K. Acharya (M.B.B.S., M.D. Pathology) with digital signature image or manual sign line.

### 5. Patients Directory & Visit History
- Search patient by name or phone number.
- View demographic profile and complete history of all past diagnostic visits.
- 1-click action to view, print, or register a new test for any returning patient.

### 6. Reports Register
- Complete log of all registered reports with search and multi-criteria filters (Status: Draft/Completed, Payment: Paid/Pending/Partial, Date).

### 7. Tests & X-Rays Management
- Full management for all laboratory tests and X-ray services.
- Add new tests, edit service prices, and customize test parameters, units, and normal ranges.

### 8. Reference Doctors
- Manage referring physicians and surgeons appearing in registration dropdowns.
- Quick inline "+ Add Doctor" option in the registration form.

### 9. Database Safety & USB Backup
- Active database lives in `%APPDATA%\AcharyaPathology\data\acharya.db`, separate from code.
- Software updates will **never** wipe patient records.
- 1-click **Create Manual Backup** prompts to choose any folder or external USB flash drive.
- 1-click **Restore Backup** safely restores patient records from any backup file.
