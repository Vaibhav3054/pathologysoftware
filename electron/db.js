const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

let db = null;
let dbFilePath = null;
let isDirty = false;
let saveTimeout = null;

// Ensure persistent directory and load/create SQLite database
async function initDatabase(userDataPath) {
  const dbDir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbFilePath = path.join(dbDir, 'acharya.db');
  const SQL = await initSqlJs();

  if (fs.existsSync(dbFilePath)) {
    try {
      const fileBuffer = fs.readFileSync(dbFilePath);
      db = new SQL.Database(fileBuffer);
      console.log('Existing SQLite database loaded from:', dbFilePath);
    } catch (err) {
      console.error('Error reading existing DB file, creating new one:', err);
      db = new SQL.Database();
    }
  } else {
    console.log('Creating new SQLite database at:', dbFilePath);
    db = new SQL.Database();
  }

  // Ensure tables and seed data
  setupSchemaAndSeeds();
  persistDbImmediately();

  return db;
}

function persistDbImmediately() {
  if (!db || !dbFilePath) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
    isDirty = false;
  } catch (err) {
    console.error('Failed to persist SQLite DB:', err);
  }
}

function scheduleSave() {
  isDirty = true;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    persistDbImmediately();
  }, 100);
}

function setupSchemaAndSeeds() {
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      clinic_name TEXT DEFAULT 'Acharya Pathology',
      tagline TEXT DEFAULT 'Diagnostic & Imaging Centre',
      address TEXT DEFAULT 'Silwani, Dist. Raisen, Madhya Pradesh - 464886',
      phone TEXT DEFAULT '+91 98765 43210',
      email TEXT DEFAULT 'contact@acharyapathology.com',
      reg_no TEXT DEFAULT 'REG/MP/SIL/2026/042',
      signatory_name TEXT DEFAULT 'Dr. S. K. Acharya',
      signatory_degree TEXT DEFAULT 'M.B.B.S., M.D. (Pathology)',
      signatory_designation TEXT DEFAULT 'Consultant Pathologist',
      signatory_signature_path TEXT DEFAULT '',
      logo_path TEXT DEFAULT '',
      letterhead_mode TEXT DEFAULT 'digital',
      letterhead_top_margin INTEGER DEFAULT 35,
      report_number_prefix TEXT DEFAULT 'AP-',
      report_number_digits INTEGER DEFAULT 6,
      next_report_number INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT 'blood',
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      department TEXT DEFAULT 'Pathology',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS test_parameters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      unit TEXT DEFAULT '',
      normal_range TEXT DEFAULT '',
      min_val REAL,
      max_val REAL,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_number TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      patient_name TEXT NOT NULL,
      patient_age INTEGER NOT NULL,
      patient_gender TEXT NOT NULL,
      patient_phone TEXT NOT NULL,
      doctor_name TEXT DEFAULT 'Self',
      registration_date TEXT NOT NULL,
      registration_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      pending_amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'Pending',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS report_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      service_type TEXT NOT NULL,
      service_id INTEGER NOT NULL,
      service_name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS report_test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      test_id INTEGER NOT NULL,
      test_name TEXT NOT NULL,
      parameter_id INTEGER,
      parameter_name TEXT NOT NULL,
      result TEXT DEFAULT '',
      unit TEXT DEFAULT '',
      normal_range TEXT DEFAULT '',
      is_abnormal INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS report_xray_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      xray_id INTEGER NOT NULL,
      xray_name TEXT NOT NULL,
      findings TEXT DEFAULT '',
      impression TEXT DEFAULT '',
      remarks TEXT DEFAULT ''
    );
  `);

  // Ensure initial settings row
  const checkSettings = db.exec("SELECT COUNT(*) AS count FROM settings");
  const count = checkSettings[0]?.values[0][0] || 0;
  if (count === 0) {
    db.run(`
      INSERT INTO settings (id, clinic_name, tagline, address, phone, reg_no, signatory_name, signatory_degree, signatory_designation, next_report_number)
      VALUES (1, 'ACHARYA PATHOLOGY', 'Diagnostic, Clinical Laboratory & X-Ray Centre', 'Silwani, Dist. Raisen, Madhya Pradesh - 464886', '+91 98765 43210', 'REG/MP/SIL/2026/042', 'Dr. S. K. Acharya', 'M.B.B.S., M.D. (Pathology)', 'Consultant Pathologist', 1);
    `);
  }

  // Seed reference doctors if empty
  const checkDoctors = db.exec("SELECT COUNT(*) AS count FROM doctors");
  if ((checkDoctors[0]?.values[0][0] || 0) === 0) {
    db.run(`
      INSERT INTO doctors (name) VALUES 
        ('Self / Direct'),
        ('Dr. R. K. Sharma (M.B.B.S., Silwani)'),
        ('Dr. Anita Verma (M.S., Gynae)'),
        ('Dr. M. P. Singh (M.D., Physician)'),
        ('Dr. S. Patel (B.A.M.S.)');
    `);
  }

  // Seed standard Indian pathology tests and X-rays if empty
  const checkTests = db.exec("SELECT COUNT(*) AS count FROM tests");
  if ((checkTests[0]?.values[0][0] || 0) === 0) {
    seedStandardCatalog();
  }
}

function seedStandardCatalog() {
  const testsData = [
    {
      category: 'blood',
      name: 'Complete Blood Count (CBC)',
      price: 350,
      params: [
        { name: 'Hemoglobin (Hb)', unit: 'g/dL', normal: '13.0 - 17.0 (M) / 12.0 - 15.0 (F)', min: 12.0, max: 17.0 },
        { name: 'Total Leukocyte Count (TLC / WBC)', unit: '/µL', normal: '4,000 - 11,000', min: 4000, max: 11000 },
        { name: 'Neutrophils', unit: '%', normal: '40 - 70', min: 40, max: 70 },
        { name: 'Lymphocytes', unit: '%', normal: '20 - 45', min: 20, max: 45 },
        { name: 'Eosinophils', unit: '%', normal: '1 - 6', min: 1, max: 6 },
        { name: 'Monocytes', unit: '%', normal: '2 - 8', min: 2, max: 8 },
        { name: 'Basophils', unit: '%', normal: '0 - 1', min: 0, max: 1 },
        { name: 'Platelet Count', unit: 'Lakh/µL', normal: '1.50 - 4.50', min: 1.5, max: 4.5 },
        { name: 'Total RBC Count', unit: 'million/µL', normal: '4.5 - 5.5', min: 4.5, max: 5.5 },
        { name: 'Packed Cell Volume (PCV / HCT)', unit: '%', normal: '36 - 50', min: 36, max: 50 },
        { name: 'MCV', unit: 'fL', normal: '80 - 100', min: 80, max: 100 },
        { name: 'MCH', unit: 'pg', normal: '27 - 32', min: 27, max: 32 },
        { name: 'MCHC', unit: 'g/dL', normal: '32 - 36', min: 32, max: 36 },
        { name: 'ESR (Westergren)', unit: 'mm/1st hr', normal: '0 - 15 (M) / 0 - 20 (F)', min: 0, max: 20 }
      ]
    },
    {
      category: 'blood',
      name: 'Blood Glucose (Fasting)',
      price: 100,
      params: [
        { name: 'Fasting Blood Sugar (FBS)', unit: 'mg/dL', normal: '70 - 100', min: 70, max: 100 }
      ]
    },
    {
      category: 'blood',
      name: 'Blood Glucose (Post Prandial)',
      price: 100,
      params: [
        { name: 'Post Prandial Blood Sugar (PPBS)', unit: 'mg/dL', normal: '70 - 140', min: 70, max: 140 }
      ]
    },
    {
      category: 'blood',
      name: 'Blood Glucose (Random)',
      price: 80,
      params: [
        { name: 'Random Blood Sugar (RBS)', unit: 'mg/dL', normal: '70 - 140', min: 70, max: 140 }
      ]
    },
    {
      category: 'blood',
      name: 'HbA1c (Glycated Hemoglobin)',
      price: 450,
      params: [
        { name: 'HbA1c', unit: '%', normal: '< 5.7 Normal, 5.7-6.4 Prediabetic, >= 6.5 Diabetic', min: 4.0, max: 5.7 },
        { name: 'Estimated Average Glucose (eAG)', unit: 'mg/dL', normal: '90 - 120', min: 90, max: 120 }
      ]
    },
    {
      category: 'blood',
      name: 'Lipid Profile',
      price: 600,
      params: [
        { name: 'Total Cholesterol', unit: 'mg/dL', normal: '< 200 Desirable', min: 100, max: 200 },
        { name: 'Triglycerides', unit: 'mg/dL', normal: '< 150 Normal', min: 50, max: 150 },
        { name: 'HDL Cholesterol (Good)', unit: 'mg/dL', normal: '> 40 (M) / > 50 (F)', min: 40, max: 60 },
        { name: 'LDL Cholesterol (Bad)', unit: 'mg/dL', normal: '< 100 Optimal', min: 50, max: 100 },
        { name: 'VLDL Cholesterol', unit: 'mg/dL', normal: '10 - 30', min: 10, max: 30 },
        { name: 'Total / HDL Ratio', unit: 'ratio', normal: '< 4.5', min: 2.0, max: 4.5 }
      ]
    },
    {
      category: 'blood',
      name: 'Liver Function Test (LFT)',
      price: 650,
      params: [
        { name: 'Serum Bilirubin (Total)', unit: 'mg/dL', normal: '0.2 - 1.2', min: 0.2, max: 1.2 },
        { name: 'Serum Bilirubin (Direct)', unit: 'mg/dL', normal: '0.0 - 0.3', min: 0.0, max: 0.3 },
        { name: 'Serum Bilirubin (Indirect)', unit: 'mg/dL', normal: '0.2 - 0.9', min: 0.2, max: 0.9 },
        { name: 'SGOT / AST', unit: 'U/L', normal: '5 - 40', min: 5, max: 40 },
        { name: 'SGPT / ALT', unit: 'U/L', normal: '5 - 45', min: 5, max: 45 },
        { name: 'Serum Alkaline Phosphatase (ALP)', unit: 'U/L', normal: '30 - 120', min: 30, max: 120 },
        { name: 'Serum Total Protein', unit: 'g/dL', normal: '6.0 - 8.3', min: 6.0, max: 8.3 },
        { name: 'Serum Albumin', unit: 'g/dL', normal: '3.5 - 5.0', min: 3.5, max: 5.0 },
        { name: 'Serum Globulin', unit: 'g/dL', normal: '2.0 - 3.5', min: 2.0, max: 3.5 },
        { name: 'A:G Ratio', unit: 'ratio', normal: '1.2 - 2.2', min: 1.2, max: 2.2 }
      ]
    },
    {
      category: 'blood',
      name: 'Kidney Function Test (KFT / RFT)',
      price: 650,
      params: [
        { name: 'Blood Urea', unit: 'mg/dL', normal: '15 - 40', min: 15, max: 40 },
        { name: 'Serum Creatinine', unit: 'mg/dL', normal: '0.6 - 1.2', min: 0.6, max: 1.2 },
        { name: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL', normal: '7 - 20', min: 7, max: 20 },
        { name: 'Serum Uric Acid', unit: 'mg/dL', normal: '3.5 - 7.2 (M) / 2.6 - 6.0 (F)', min: 2.6, max: 7.2 },
        { name: 'Serum Calcium', unit: 'mg/dL', normal: '8.5 - 10.5', min: 8.5, max: 10.5 },
        { name: 'Serum Sodium (Na+)', unit: 'mEq/L', normal: '135 - 145', min: 135, max: 145 },
        { name: 'Serum Potassium (K+)', unit: 'mEq/L', normal: '3.5 - 5.1', min: 3.5, max: 5.1 }
      ]
    },
    {
      category: 'blood',
      name: 'Thyroid Profile (Total T3, T4, TSH)',
      price: 500,
      params: [
        { name: 'Total Triiodothyronine (T3)', unit: 'ng/dL', normal: '70 - 200', min: 70, max: 200 },
        { name: 'Total Thyroxine (T4)', unit: 'µg/dL', normal: '4.5 - 12.0', min: 4.5, max: 12.0 },
        { name: 'TSH (Thyroid Stimulating Hormone)', unit: 'µIU/mL', normal: '0.35 - 4.94', min: 0.35, max: 4.94 }
      ]
    },
    {
      category: 'blood',
      name: 'Widal Slide Agglutination',
      price: 200,
      params: [
        { name: 'Salmonella Typhi "O"', unit: 'Titre', normal: '< 1:80 (Negative)', min: null, max: null },
        { name: 'Salmonella Typhi "H"', unit: 'Titre', normal: '< 1:80 (Negative)', min: null, max: null },
        { name: 'Salmonella Paratyphi "AH"', unit: 'Titre', normal: '< 1:80 (Negative)', min: null, max: null },
        { name: 'Salmonella Paratyphi "BH"', unit: 'Titre', normal: '< 1:80 (Negative)', min: null, max: null }
      ]
    },
    {
      category: 'blood',
      name: 'Urine Routine & Microscopic (Urine R/M)',
      price: 150,
      params: [
        { name: 'Colour', unit: '', normal: 'Pale Yellow', min: null, max: null },
        { name: 'Appearance', unit: '', normal: 'Clear', min: null, max: null },
        { name: 'Reaction / pH', unit: '', normal: '5.0 - 7.5', min: 5.0, max: 7.5 },
        { name: 'Specific Gravity', unit: '', normal: '1.010 - 1.025', min: 1.010, max: 1.025 },
        { name: 'Protein / Albumin', unit: '', normal: 'Nil', min: null, max: null },
        { name: 'Sugar / Glucose', unit: '', normal: 'Nil', min: null, max: null },
        { name: 'Ketone Bodies', unit: '', normal: 'Absent', min: null, max: null },
        { name: 'Pus Cells', unit: '/HPF', normal: '1 - 5', min: 0, max: 5 },
        { name: 'Epithelial Cells', unit: '/HPF', normal: '1 - 4', min: 0, max: 4 },
        { name: 'Red Blood Cells (RBCs)', unit: '/HPF', normal: 'Nil', min: 0, max: 0 },
        { name: 'Crystals', unit: '', normal: 'Nil', min: null, max: null },
        { name: 'Casts', unit: '', normal: 'Nil', min: null, max: null }
      ]
    },
    {
      category: 'blood',
      name: 'Dengue Serology (NS1 + IgM + IgG)',
      price: 700,
      params: [
        { name: 'Dengue NS1 Antigen', unit: '', normal: 'Negative', min: null, max: null },
        { name: 'Dengue IgM Antibody', unit: '', normal: 'Negative', min: null, max: null },
        { name: 'Dengue IgG Antibody', unit: '', normal: 'Negative', min: null, max: null }
      ]
    },
    {
      category: 'blood',
      name: 'Malaria Antigen (Pv / Pf Rapid)',
      price: 250,
      params: [
        { name: 'Plasmodium vivax (Pv)', unit: '', normal: 'Negative', min: null, max: null },
        { name: 'Plasmodium falciparum (Pf)', unit: '', normal: 'Negative', min: null, max: null }
      ]
    },
    {
      category: 'blood',
      name: 'Serum Electrolytes (Na+, K+, Cl-)',
      price: 400,
      params: [
        { name: 'Sodium (Na+)', unit: 'mEq/L', normal: '135 - 145', min: 135, max: 145 },
        { name: 'Potassium (K+)', unit: 'mEq/L', normal: '3.5 - 5.1', min: 3.5, max: 5.1 },
        { name: 'Chloride (Cl-)', unit: 'mEq/L', normal: '96 - 106', min: 96, max: 106 }
      ]
    }
  ];

  const xrayData = [
    { name: 'Chest X-Ray (PA View)', price: 400 },
    { name: 'Chest X-Ray (AP View)', price: 400 },
    { name: 'X-Ray Cervical Spine (AP & Lat)', price: 600 },
    { name: 'X-Ray Lumbar Spine (AP & Lat)', price: 600 },
    { name: 'X-Ray Knee Joint (AP & Lat)', price: 500 },
    { name: 'X-Ray Hand / Wrist (AP & Oblique)', price: 450 },
    { name: 'X-Ray Foot / Ankle (AP & Lat)', price: 450 },
    { name: 'X-Ray Pelvis (AP View)', price: 500 },
    { name: 'X-Ray Skull (AP & Lat)', price: 600 },
    { name: 'X-Ray Abdomen (Erect / KUB)', price: 450 }
  ];

  for (const test of testsData) {
    db.run("INSERT INTO tests (category, name, price, department) VALUES ('blood', ?, ?, 'Pathology')", [test.name, test.price]);
    const res = db.exec("SELECT last_insert_rowid() AS id");
    const testId = res[0].values[0][0];

    test.params.forEach((p, idx) => {
      db.run(
        "INSERT INTO test_parameters (test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [testId, p.name, p.unit, p.normal, p.min, p.max, idx]
      );
    });
  }

  for (const xray of xrayData) {
    db.run("INSERT INTO tests (category, name, price, department) VALUES ('xray', ?, ?, 'Radiology')", [xray.name, xray.price]);
  }
}

// Convert sql.js exec output to array of objects
function transformResult(res) {
  if (!res || res.length === 0) return [];
  const columns = res[0].columns;
  const values = res[0].values;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

const dbManager = {
  init: initDatabase,

  query(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (err) {
      console.error('db.query error:', err, 'SQL:', sql, 'params:', params);
      throw err;
    }
  },

  get(sql, params = []) {
    const rows = dbManager.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  },

  run(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    try {
      db.run(sql, params);
      const res = db.exec("SELECT last_insert_rowid() as id, changes() as changes");
      const lastInsertRowid = res[0]?.values[0][0];
      const changes = res[0]?.values[0][1];
      scheduleSave();
      return { lastInsertRowid, changes };
    } catch (err) {
      console.error('db.run error:', err, 'SQL:', sql, 'params:', params);
      throw err;
    }
  },

  exec(sql) {
    if (!db) throw new Error('Database not initialized');
    try {
      const res = db.exec(sql);
      scheduleSave();
      return transformResult(res);
    } catch (err) {
      console.error('db.exec error:', err, 'SQL:', sql);
      throw err;
    }
  },

  exportBackup(destFilePath) {
    if (!db) throw new Error('Database not initialized');
    try {
      persistDbImmediately();
      fs.copyFileSync(dbFilePath, destFilePath);
      return { success: true, path: destFilePath };
    } catch (err) {
      console.error('Backup error:', err);
      return { success: false, error: err.message };
    }
  },

  async restoreBackup(sourceFilePath) {
    try {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(sourceFilePath);
      // Validate valid SQLite format by trying to open
      const testDb = new SQL.Database(fileBuffer);
      const testQuery = testDb.exec("SELECT count(*) FROM sqlite_master");
      if (!testQuery || testQuery.length === 0) {
        throw new Error('Selected file is not a valid SQLite database.');
      }
      testDb.close();

      // Close current db and overwrite
      if (db) db.close();
      fs.copyFileSync(sourceFilePath, dbFilePath);
      db = new SQL.Database(fileBuffer);
      return { success: true };
    } catch (err) {
      console.error('Restore error:', err);
      return { success: false, error: err.message };
    }
  },

  close() {
    if (db) {
      persistDbImmediately();
      db.close();
      db = null;
    }
  }
};

module.exports = dbManager;
