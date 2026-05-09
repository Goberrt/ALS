# ALS AF1 Sample Data for Google Sheets Import

Copy the data below and paste it into Google Sheets. The data includes all 27 form fields and represents realistic learner information for testing the CSV import feature.

## CSV Data (Ready to Paste into Google Sheets)

```
Last Name,First Name,Middle Name,Name Extension,Sex,Date of Birth,Age,IP,Religion,Mother Tongue,House Number,Street,Sitio/Purok,Barangay,Municipality/City,Province,Contact Number,Father's Name,Mother's Name,Last Grade Completed,Interested in ALS,ALS Status,Preferred Program,Learner Type Class,Region,Division,District,Calendar Year
Cruz,Maria,Santos,,Female,1995-06-15,30,Dayawon,Catholic,Tagalog,123,Main Street,Purok 1,Santa Cruz,Laguna,Laguna,09123456789,Juan Cruz,Rosa Santos,Grade 6,Yes,Active,ABE,Out-of-School Youth,4-A,Laguna,Santa Cruz,2026
Dela Cruz,Juan,Carlos,Jr.,Male,1998-03-22,27,Dayawon,Christian,Tagalog,456,Rizal Avenue,Purok 2,Punta,Laguna,Laguna,09234567890,Pedro Dela Cruz,Maria Garcia,Grade 5,Yes,Inactive,A&E,Out-of-School Youth,4-A,Laguna,Santa Cruz,2026
Santos,Angela,Lopez,,Female,1997-11-08,28,Dayawon,Catholic,Tagalog,789,Gomez Street,Sitio Maliit,Makibat,Laguna,Laguna,09345678901,Antonio Santos,Sofia Lopez,Grade 4,Yes,Active,Literacy,Out-of-School Youth,4-A,Laguna,Santa Cruz,2026
Reyes,Roberto,Morales,Sr.,Male,1970-05-30,55,Tagalog,Iglesia ni Cristo,Tagalog,321,Macarthur Avenue,Purok 3,Santa Cruz,Laguna,Laguna,09456789012,Francisco Reyes,Josefina Morales,Grade 3,Yes,Active,ABE,Senior Citizen,4-A,Laguna,Santa Cruz,2026
Mercado,Carmen,Torres,,Female,1999-08-17,26,Sumulong,Catholic,Tagalog,654,EDSA,Purok A,Baras,Laguna,Laguna,09567890123,Rafael Mercado,Theresa Torres,Grade 6,Yes,New,A&E,Out-of-School Youth,4-A,Laguna,Santa Cruz,2026
Aquino,Vincent,Ramos,,Male,1996-12-25,29,Tayabas,Catholic,Tagalog,987,Quezon Boulevard,Sitio Centro,Punta,Laguna,Laguna,09678901234,Ernesto Aquino,Vivian Ramos,Grade 5,No,Inactive,Numeracy,Out-of-School Youth,4-A,Laguna,Santa Cruz,2026
Lim,Rachel,Gonzales,,Female,2005-02-14,20,Dayawon,Methodist,Tagalog,111,Maharlika Street,Purok B,Makibat,Laguna,Laguna,09789012345,Henry Lim,Rebecca Gonzales,Grade 6,Yes,Active,Literacy,Student,4-A,Laguna,Santa Cruz,2026
Tapia,Oscar,Fernandez,III,Male,1992-09-10,33,Sumulong,Adventist,Ilokano,222,Andres Soriano,Purok 4,Santa Cruz,Laguna,Laguna,09890123456,Mariano Tapia,Claudia Fernandez,Grade 4,Yes,Active,ABE,Out-of-School Youth,4-A,Laguna,Santa Cruz,2026
Rosales,Diana,Cabrera,,Female,2000-07-03,25,Dayawon,Catholic,Tagalog,333,Osmena Avenue,Sitio Ligaya,Baras,Laguna,Laguna,09901234567,Gabriel Rosales,Patricia Cabrera,Grade 5,Yes,New,A&E,Student,4-A,Laguna,Santa Cruz,2026
Villegas,Eduardo,Chavez,,Male,1994-01-28,32,Sumulong,Catholic,Tagalog,444,Luna Street,Purok C,Punta,Laguna,Laguna,09012345678,Miguel Villegas,Sandra Chavez,Grade 6,Yes,Active,Literacy,Out-of-School Youth,4-A,Laguna,Santa Cruz,2026
```

## Field Descriptions

| Field Name | Format | Example | Notes |
|---|---|---|---|
| Last Name | Text | Cruz | Required |
| First Name | Text | Maria | Required |
| Middle Name | Text | Santos | Optional |
| Name Extension | Text | Jr., Sr., III | Optional |
| Sex | Text | Male/Female | Dropdown values |
| Date of Birth | Date | YYYY-MM-DD format | Optional |
| Age | Number | 30 | Auto-calculated from DOB |
| IP | Text | Dayawon, Sumulong, Tagayas | IP (Indigenous Peoples) group |
| Religion | Text | Catholic, Christian, etc. | Optional |
| Mother Tongue | Text | Tagalog, Ilokano, etc. | Optional |
| House Number | Text | 123 | Optional |
| Street | Text | Main Street | Optional |
| Sitio/Purok | Text | Purok 1, Sitio Maliit | Optional |
| Barangay | Text | Santa Cruz, Punta, etc. | Required |
| Municipality/City | Text | Laguna | Required |
| Province | Text | Laguna | Required |
| Contact Number | Text | 09123456789 | Optional |
| Father's Name | Text | Juan Cruz | Optional |
| Mother's Name | Text | Rosa Santos | Optional |
| Last Grade Completed | Text | Grade 1-6 | Dropdown values |
| Interested in ALS | Text | Yes/No | Required |
| ALS Status | Text | Active, Inactive, New | Dropdown values |
| Preferred Program | Text | ABE, A&E, Literacy, Numeracy | Dropdown values |
| Learner Type Class | Text | Out-of-School Youth, Student, Senior Citizen, etc. | Dropdown values |
| Region | Text | 4-A | Will be auto-filled from import settings |
| Division | Text | Laguna | Will be auto-filled from import settings |
| District | Text | Santa Cruz | Will be auto-filled from import settings |
| Calendar Year | Number | 2026 | Will be auto-filled from import settings |

## How to Use

1. **Create a new Google Sheet** or open an existing one
2. **Copy the CSV data** from above (everything between the ``` marks)
3. **Paste into your Google Sheet** starting at cell A1
4. **Download as CSV** (File → Download → CSV)
5. **Upload to the ALS System** via the CSV Import feature
6. **Configure Import Settings** when prompted:
   - Region: 4-A
   - Division: Laguna
   - District: Santa Cruz
   - Calendar Year Start: 2025
   - Calendar Year End: 2026

## Alternative: Generate Your Own Sample Data

You can modify the data above by:
- Changing names to match your actual learner pool
- Using real contact numbers
- Adjusting ages and dates of birth
- Varying the IP groups, religions, and programs
- Adding or removing rows as needed

## Important Notes

- **Column Order Matters**: The CSV columns must be in the order shown above
- **Required Fields**: Last Name, First Name, Barangay, Municipality/City, Province, Interested in ALS
- **Admin Fields**: Region, Division, District, Calendar Year will be overridden by your import settings
- **Date Format**: Use YYYY-MM-DD for dates (2026-01-15)
- **Boolean Values**: Use "Yes"/"No" or "True"/"False" for interested_in_als
- **Dropdown Fields**: Use exact values from the dropdown lists in the form

## Sample Variations You Can Try

### Test Case 1: Minimal Data
Import only required fields and use defaults for optional ones.

### Test Case 2: Full Data
Import all fields to test complete learner profiles.

### Test Case 3: Mixed Statuses
Include Active, Inactive, and New ALS statuses to test filtering.

### Test Case 4: Different Programs
Mix ABE, A&E, Literacy, and Numeracy preferences to test program distribution.
