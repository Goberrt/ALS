/**
 * ALS AF1 Sample Data Generator for Google Sheets
 * 
 * How to use:
 * 1. Open Google Sheets
 * 2. Go to Extensions → Apps Script
 * 3. Copy and paste this entire code
 * 4. Save the project
 * 5. Go back to Google Sheets and refresh the page
 * 6. Use the "ALS Data" menu to generate sample data
 */

// ============================================
// MENU SETUP
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('ALS Data')
    .addItem('Generate 10 Sample Learners', 'generateSampleData')
    .addItem('Generate 25 Sample Learners', 'generateSampleData25')
    .addItem('Generate 50 Sample Learners', 'generateSampleData50')
    .addSeparator()
    .addItem('Clear All Data', 'clearSheetData')
    .addItem('Validate Data', 'validateData')
    .addToUi();
}

// ============================================
// SAMPLE DATA GENERATORS
// ============================================

function generateSampleData() {
  generateLearnerData(10);
}

function generateSampleData25() {
  generateLearnerData(25);
}

function generateSampleData50() {
  generateLearnerData(50);
}

function generateLearnerData(count) {
  const sheet = SpreadsheetApp.getActiveSheet();
  
  // Clear existing data (keep headers)
  if (sheet.getLastRow() > 1) {
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    range.clearContent();
  }
  
  // Set up headers if they don't exist
  const headers = [
    'Last Name', 'First Name', 'Middle Name', 'Name Extension', 'Sex',
    'Date of Birth', 'Age', 'IP', 'Religion', 'Mother Tongue',
    'House Number', 'Street', 'Sitio/Purok', 'Barangay', 'Municipality/City',
    'Province', 'Contact Number', "Father's Name", "Mother's Name",
    'Last Grade Completed', 'Interested in ALS', 'ALS Status',
    'Preferred Program', 'Learner Type Class'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Generate sample data
  const learners = [];
  for (let i = 0; i < count; i++) {
    learners.push(generateRandomLearner());
  }
  
  // Write data to sheet
  sheet.getRange(2, 1, learners.length, headers.length).setValues(learners);
  
  // Format the sheet
  formatSheet();
  
  SpreadsheetApp.getUi().alert(`Successfully generated ${count} sample learners!`);
}

// ============================================
// DATA GENERATORS
// ============================================

function generateRandomLearner() {
  const lastNames = [
    'Cruz', 'Dela Cruz', 'Santos', 'Reyes', 'Mercado', 'Aquino', 'Lim',
    'Tapia', 'Rosales', 'Villegas', 'Garcia', 'Lopez', 'Martinez', 'Hernandez',
    'Gonzales', 'Fernandez', 'Ramos', 'Chavez', 'Morales', 'Torres', 'Gutierrez',
    'Cabrera', 'Rojas', 'Flores', 'Castro', 'Mendoza', 'Diaz', 'Vega',
    'Soto', 'Romero'
  ];
  
  const firstNames = [
    'Maria', 'Juan', 'Angela', 'Roberto', 'Carmen', 'Vincent', 'Rachel',
    'Oscar', 'Diana', 'Eduardo', 'Ana', 'Miguel', 'Sofia', 'Francisco',
    'Rosa', 'Antonio', 'Josefina', 'Pedro', 'Isabella', 'Manuel', 'Elena',
    'Luis', 'Carmen', 'Diego', 'Lucia', 'Rafael', 'Patricia', 'Carlos',
    'Sandra', 'Jose'
  ];
  
  const middleNames = [
    'Santos', 'Carlos', 'Lopez', 'Morales', 'Torres', 'Ramos', 'Gonzales',
    'Fernandez', 'Cabrera', 'Chavez', 'Garcia', 'Martinez', 'Hernandez',
    'Gutierrez', 'Rojas', 'Flores', 'Castro', 'Mendoza', 'Diaz', 'Vega'
  ];
  
  const extensions = ['Jr.', 'Sr.', 'III', 'II', 'IV', ''];
  const sexes = ['Male', 'Female'];
  const ips = ['Dayawon', 'Sumulong', 'Tagayas', 'Dumagat', 'Igorot', 'Bikolano', 'Tagalog'];
  const religions = ['Catholic', 'Christian', 'Iglesia ni Cristo', 'Methodist', 'Adventist', 'Baptist', 'Muslim', 'None'];
  const motherTongues = ['Tagalog', 'Ilokano', 'Bikolano', 'Kapampangan', 'Panay Bukidnon', 'Waray', 'Maguindanao'];
  const streets = [
    'Main Street', 'Rizal Avenue', 'Gomez Street', 'Macarthur Avenue', 'EDSA',
    'Quezon Boulevard', 'Maharlika Street', 'Andres Soriano', 'Osmena Avenue',
    'Luna Street', 'Emilio Aguinaldo', 'Aguinaldo Street', 'Bonifacio Avenue',
    'Zamora Street', 'Aguirre Street', 'Marcos Street', 'Reyes Street'
  ];
  const barangays = [
    'Santa Cruz', 'Punta', 'Makibat', 'Baras', 'Dayap', 'Magtanggol',
    'Talipapa', 'Tabuyoc', 'Tambo', 'Tangkal', 'Tibig', 'Nayon', 'Sicalao'
  ];
  const grades = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'High School'];
  const alsStatuses = ['Active', 'Inactive', 'New', 'Completed', 'Dropped'];
  const programs = ['ABE', 'A&E', 'Literacy', 'Numeracy'];
  const learnerTypes = ['Out-of-School Youth', 'Student', 'Senior Citizen', 'PWD', 'Returnee'];
  
  const lastName = randomElement(lastNames);
  const firstName = randomElement(firstNames);
  const middleName = randomElement(middleNames);
  const extension = randomElement(extensions);
  const sex = randomElement(sexes);
  const dob = randomDateOfBirth();
  const age = calculateAge(dob);
  const ip = randomElement(ips);
  const religion = randomElement(religions);
  const motherTongue = randomElement(motherTongues);
  const houseNumber = Math.floor(Math.random() * 1000).toString();
  const street = randomElement(streets);
  const sitioPurok = Math.random() > 0.5 ? `Purok ${Math.floor(Math.random() * 5) + 1}` : `Sitio ${randomElement(['Maliit', 'Ligaya', 'Centro', 'Laya', 'Pangarap'])}`;
  const barangay = randomElement(barangays);
  const municipality = 'Laguna';
  const province = 'Laguna';
  const contactNumber = generatePhoneNumber();
  const fatherName = randomElement(firstNames) + ' ' + lastName;
  const motherName = randomElement(firstNames) + ' ' + randomElement(middleNames);
  const gradeCompleted = randomElement(grades);
  const interestedInALS = Math.random() > 0.1 ? 'Yes' : 'No';
  const alsStatus = randomElement(alsStatuses);
  const program = randomElement(programs);
  const learnerType = randomElement(learnerTypes);
  
  return [
    lastName,
    firstName,
    middleName,
    extension,
    sex,
    dob,
    age,
    ip,
    religion,
    motherTongue,
    houseNumber,
    street,
    sitioPurok,
    barangay,
    municipality,
    province,
    contactNumber,
    fatherName,
    motherName,
    gradeCompleted,
    interestedInALS,
    alsStatus,
    program,
    learnerType
  ];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomDateOfBirth() {
  // Generate DOB between 1960 and 2010
  const startYear = 1960;
  const endYear = 2010;
  const year = startYear + Math.floor(Math.random() * (endYear - startYear + 1));
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1; // Use day 1-28 to avoid month-end issues
  
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');
  
  return `${year}-${monthStr}-${dayStr}`;
}

function calculateAge(dobString) {
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}

function generatePhoneNumber() {
  // Generate Philippine mobile numbers (09XX-XXX-XXXX)
  const prefix = ['09173', '09175', '09176', '09178', '09179', '09088', '09089', '09090', '09091', '09092'];
  const randomPrefix = randomElement(prefix);
  const remaining = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return randomPrefix + remaining;
}

// ============================================
// SHEET UTILITIES
// ============================================

function formatSheet() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange.setBackground('#1f4788');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, lastCol);
  
  // Format Date of Birth column (column F, index 6)
  if (lastRow > 1) {
    const dobRange = sheet.getRange(2, 6, lastRow - 1, 1);
    dobRange.setNumberFormat('YYYY-MM-DD');
  }
  
  // Center align Sex column (column E, index 5)
  if (lastRow > 1) {
    const sexRange = sheet.getRange(2, 5, lastRow - 1, 1);
    sexRange.setHorizontalAlignment('center');
  }
}

function clearSheetData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Are you sure you want to clear all data? This cannot be undone.',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    range.clearContent();
    ui.alert('Data cleared!');
  }
}

// ============================================
// DATA VALIDATION
// ============================================

function validateData() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  
  let errors = [];
  let warnings = [];
  
  data.forEach((row, index) => {
    const lineNum = index + 2;
    
    // Check required fields
    if (!row[0] || row[0].toString().trim() === '') {
      errors.push(`Row ${lineNum}: Last Name is required`);
    }
    if (!row[1] || row[1].toString().trim() === '') {
      errors.push(`Row ${lineNum}: First Name is required`);
    }
    if (!row[13] || row[13].toString().trim() === '') {
      errors.push(`Row ${lineNum}: Barangay is required`);
    }
    if (!row[14] || row[14].toString().trim() === '') {
      errors.push(`Row ${lineNum}: Municipality/City is required`);
    }
    if (!row[15] || row[15].toString().trim() === '') {
      errors.push(`Row ${lineNum}: Province is required`);
    }
    if (!row[20] || row[20].toString().trim() === '') {
      errors.push(`Row ${lineNum}: Interested in ALS is required`);
    }
    
    // Validate Interested in ALS
    const interestedValue = row[20].toString().toLowerCase();
    if (interestedValue !== 'yes' && interestedValue !== 'no') {
      warnings.push(`Row ${lineNum}: Interested in ALS should be 'Yes' or 'No' (found: '${row[20]}')`);
    }
    
    // Validate contact number format
    if (row[16] && row[16].toString().trim() !== '') {
      const contactNum = row[16].toString().trim();
      if (!/^09\d{9}$/.test(contactNum) && !/^\d{10,11}$/.test(contactNum)) {
        warnings.push(`Row ${lineNum}: Contact number format looks unusual: '${contactNum}'`);
      }
    }
  });
  
  let message = '';
  if (errors.length === 0 && warnings.length === 0) {
    message = '✓ All data looks good!';
  } else {
    if (errors.length > 0) {
      message += 'ERRORS:\n' + errors.slice(0, 5).join('\n');
      if (errors.length > 5) {
        message += `\n... and ${errors.length - 5} more errors`;
      }
    }
    if (warnings.length > 0) {
      message += '\n\nWARNINGS:\n' + warnings.slice(0, 5).join('\n');
      if (warnings.length > 5) {
        message += `\n... and ${warnings.length - 5} more warnings`;
      }
    }
  }
  
  SpreadsheetApp.getUi().alert(message);
}
