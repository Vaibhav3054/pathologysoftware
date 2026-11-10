// Database & IPC API service for Acharya Pathology

const isElectron = typeof window !== 'undefined' && window.api !== undefined;

export const api = {
  isElectron,

  // Direct queries
  async query(sql, params = []) {
    if (isElectron) {
      return await window.api.dbQuery(sql, params);
    }
    console.warn('Running outside Electron. Simulated query:', sql);
    return [];
  },

  async get(sql, params = []) {
    if (isElectron) {
      return await window.api.dbGet(sql, params);
    }
    return null;
  },

  async run(sql, params = []) {
    if (isElectron) {
      return await window.api.dbRun(sql, params);
    }
    return { lastInsertRowid: Date.now(), changes: 1 };
  },

  async exec(sql) {
    if (isElectron) {
      return await window.api.dbExec(sql);
    }
    return [];
  },

  // Settings
  async getSettings() {
    const res = await this.get('SELECT * FROM settings WHERE id = 1');
    return res || {};
  },

  async updateSettings(data) {
    return await this.run(`
      UPDATE settings SET
        clinic_name = ?,
        tagline = ?,
        address = ?,
        phone = ?,
        email = ?,
        reg_no = ?,
        signatory_name = ?,
        signatory_degree = ?,
        signatory_designation = ?,
        signatory_signature_path = ?,
        logo_path = ?,
        letterhead_mode = ?,
        letterhead_top_margin = ?,
        report_number_prefix = ?,
        next_report_number = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      data.clinic_name || 'ACHARYA PATHOLOGY',
      data.tagline || '',
      data.address || '',
      data.phone || '',
      data.email || '',
      data.reg_no || '',
      data.signatory_name || '',
      data.signatory_degree || '',
      data.signatory_designation || '',
      data.signatory_signature_path || '',
      data.logo_path || '',
      data.letterhead_mode || 'digital',
      data.letterhead_top_margin || 35,
      data.report_number_prefix || 'AP-',
      data.next_report_number || 1
    ]);
  },

  // Doctors
  async getDoctors() {
    return await this.query('SELECT * FROM doctors ORDER BY name ASC');
  },

  async addDoctor(name) {
    return await this.run('INSERT INTO doctors (name) VALUES (?)', [name.trim()]);
  },

  async deleteDoctor(id) {
    return await this.run('DELETE FROM doctors WHERE id = ?', [id]);
  },

  async updateDoctor(id, name) {
    return await this.run('UPDATE doctors SET name = ? WHERE id = ?', [name.trim(), id]);
  },

  // Tests & X-Rays
  async getTests(category = null) {
    if (category) {
      return await this.query('SELECT * FROM tests WHERE category = ? AND is_active = 1 ORDER BY name ASC', [category]);
    }
    return await this.query('SELECT * FROM tests WHERE is_active = 1 ORDER BY category ASC, name ASC');
  },

  async getTestWithParameters(testId) {
    const test = await this.get('SELECT * FROM tests WHERE id = ?', [testId]);
    if (!test) return null;
    const parameters = await this.query(
      'SELECT * FROM test_parameters WHERE test_id = ? ORDER BY display_order ASC, id ASC',
      [testId]
    );
    return { ...test, parameters };
  },

  async addTest(category, name, price, department = 'Pathology') {
    return await this.run(
      'INSERT INTO tests (category, name, price, department) VALUES (?, ?, ?, ?)',
      [category, name.trim(), parseFloat(price) || 0, department]
    );
  },

  async updateTest(id, name, price) {
    return await this.run(
      'UPDATE tests SET name = ?, price = ? WHERE id = ?',
      [name.trim(), parseFloat(price) || 0, id]
    );
  },

  async deleteTest(id) {
    // Delete parameters and soft or hard delete test
    await this.run('DELETE FROM test_parameters WHERE test_id = ?', [id]);
    return await this.run('DELETE FROM tests WHERE id = ?', [id]);
  },

  // Parameters
  async addParameter(testId, param) {
    return await this.run(`
      INSERT INTO test_parameters (test_id, name, unit, normal_range, min_val, max_val, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      testId,
      param.name.trim(),
      param.unit || '',
      param.normal_range || '',
      param.min_val !== '' && param.min_val !== null ? parseFloat(param.min_val) : null,
      param.max_val !== '' && param.max_val !== null ? parseFloat(param.max_val) : null,
      parseInt(param.display_order) || 0
    ]);
  },

  async updateParameter(paramId, param) {
    return await this.run(`
      UPDATE test_parameters SET
        name = ?,
        unit = ?,
        normal_range = ?,
        min_val = ?,
        max_val = ?,
        display_order = ?
      WHERE id = ?
    `, [
      param.name.trim(),
      param.unit || '',
      param.normal_range || '',
      param.min_val !== '' && param.min_val !== null ? parseFloat(param.min_val) : null,
      param.max_val !== '' && param.max_val !== null ? parseFloat(param.max_val) : null,
      parseInt(param.display_order) || 0,
      paramId
    ]);
  },

  async deleteParameter(paramId) {
    return await this.run('DELETE FROM test_parameters WHERE id = ?', [paramId]);
  },

  // Patients
  async searchPatients(queryStr) {
    const term = `%${queryStr.trim()}%`;
    return await this.query(
      'SELECT * FROM patients WHERE name LIKE ? OR phone LIKE ? ORDER BY updated_at DESC LIMIT 15',
      [term, term]
    );
  },

  async getPatientById(id) {
    return await this.get('SELECT * FROM patients WHERE id = ?', [id]);
  },

  async getPatientHistory(patientId) {
    return await this.query(
      'SELECT * FROM reports WHERE patient_id = ? ORDER BY id DESC',
      [patientId]
    );
  },

  // Unique Report Number Generator
  async generateNextReportNumber() {
    const settings = await this.getSettings();
    const prefix = settings.report_number_prefix || 'AP-';
    const digits = settings.report_number_digits || 6;
    let nextNum = settings.next_report_number || 1;

    // Verify uniqueness against existing reports in DB
    while (true) {
      const candidate = `${prefix}${String(nextNum).padStart(digits, '0')}`;
      const existing = await this.get('SELECT id FROM reports WHERE report_number = ?', [candidate]);
      if (!existing) {
        return { reportNumber: candidate, numericVal: nextNum };
      }
      nextNum++;
    }
  },

  // Patient Registration & New Report Creation
  async createRegistration({ patientData, selectedServices, billingData }) {
    // 1. Find or create patient
    let patientId = patientData.id;
    if (!patientId) {
      // Check if phone matches exactly
      const existing = await this.get('SELECT id FROM patients WHERE phone = ? LIMIT 1', [patientData.phone.trim()]);
      if (existing) {
        patientId = existing.id;
        await this.run(
          'UPDATE patients SET name = ?, age = ?, gender = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [patientData.name.trim(), parseInt(patientData.age), patientData.gender, patientId]
        );
      } else {
        const res = await this.run(
          'INSERT INTO patients (name, age, gender, phone) VALUES (?, ?, ?, ?)',
          [patientData.name.trim(), parseInt(patientData.age), patientData.gender, patientData.phone.trim()]
        );
        patientId = res.lastInsertRowid;
      }
    }

    // 2. Generate unique report number
    const { reportNumber, numericVal } = await this.generateNextReportNumber();

    // Current Date and Time
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    // 3. Insert report
    const reportRes = await this.run(`
      INSERT INTO reports (
        report_number, patient_id, patient_name, patient_age, patient_gender, patient_phone,
        doctor_name, registration_date, registration_time, status,
        total_amount, paid_amount, pending_amount, payment_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
    `, [
      reportNumber,
      patientId,
      patientData.name.trim(),
      parseInt(patientData.age),
      patientData.gender,
      patientData.phone.trim(),
      patientData.doctor_name || 'Self',
      dateStr,
      timeStr,
      parseFloat(billingData.total_amount) || 0,
      parseFloat(billingData.paid_amount) || 0,
      parseFloat(billingData.pending_amount) || 0,
      billingData.payment_status || 'Pending',
      billingData.notes || ''
    ]);

    const reportId = reportRes.lastInsertRowid;

    // 4. Increment settings next_report_number
    await this.run('UPDATE settings SET next_report_number = ? WHERE id = 1', [numericVal + 1]);

    // 5. Insert selected services and initialize template results
    for (const service of selectedServices) {
      await this.run(
        'INSERT INTO report_services (report_id, service_type, service_id, service_name, price) VALUES (?, ?, ?, ?, ?)',
        [reportId, service.category, service.id, service.name, service.price]
      );

      if (service.category === 'blood') {
        // Load test parameters and initialize empty test result records
        const params = await this.query(
          'SELECT * FROM test_parameters WHERE test_id = ? ORDER BY display_order ASC, id ASC',
          [service.id]
        );
        for (const p of params) {
          await this.run(`
            INSERT INTO report_test_results (
              report_id, test_id, test_name, parameter_id, parameter_name,
              result, unit, normal_range, is_abnormal, display_order
            ) VALUES (?, ?, ?, ?, ?, '', ?, ?, 0, ?)
          `, [reportId, service.id, service.name, p.id, p.name, p.unit, p.normal_range, p.display_order]);
        }
      } else if (service.category === 'xray') {
        // Initialize empty X-ray record
        await this.run(`
          INSERT INTO report_xray_results (report_id, xray_id, xray_name, findings, impression, remarks)
          VALUES (?, ?, ?, '', '', '')
        `, [reportId, service.id, service.name]);
      }
    }

    return { reportId, reportNumber };
  },

  // Get full report details for viewing or result entry
  async getReportDetails(reportId) {
    const report = await this.get('SELECT * FROM reports WHERE id = ?', [reportId]);
    if (!report) return null;

    const services = await this.query('SELECT * FROM report_services WHERE report_id = ?', [reportId]);
    const testResults = await this.query('SELECT * FROM report_test_results WHERE report_id = ? ORDER BY test_id, display_order, id', [reportId]);
    const xrayResults = await this.query('SELECT * FROM report_xray_results WHERE report_id = ?', [reportId]);

    // Group test results by test_id and test_name
    const groupedTests = {};
    for (const res of testResults) {
      if (!groupedTests[res.test_id]) {
        groupedTests[res.test_id] = {
          testId: res.test_id,
          testName: res.test_name,
          parameters: []
        };
      }
      groupedTests[res.test_id].parameters.push(res);
    }

    return {
      report,
      services,
      testResults: Object.values(groupedTests),
      rawTestResults: testResults,
      xrayResults
    };
  },

  // Save report test results and xray findings
  async saveReportMedicalData(reportId, testResultsUpdates, xrayResultsUpdates, status = 'completed') {
    // Update blood test results
    for (const item of testResultsUpdates) {
      await this.run(
        'UPDATE report_test_results SET result = ?, is_abnormal = ? WHERE id = ? AND report_id = ?',
        [item.result || '', item.is_abnormal ? 1 : 0, item.id, reportId]
      );
    }

    // Update X-ray results
    for (const item of xrayResultsUpdates) {
      await this.run(
        'UPDATE report_xray_results SET findings = ?, impression = ?, remarks = ? WHERE id = ? AND report_id = ?',
        [item.findings || '', item.impression || '', item.remarks || '', item.id, reportId]
      );
    }

    // Update report status
    await this.run('UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, reportId]);

    return { success: true };
  },

  // Update payment info for a report
  async updateReportPayment(reportId, paidAmount, paymentStatus) {
    const report = await this.get('SELECT total_amount FROM reports WHERE id = ?', [reportId]);
    if (!report) return;

    const total = parseFloat(report.total_amount) || 0;
    const paid = parseFloat(paidAmount) || 0;
    const pending = Math.max(0, total - paid);

    return await this.run(`
      UPDATE reports SET
        paid_amount = ?,
        pending_amount = ?,
        payment_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [paid, pending, paymentStatus, reportId]);
  },

  // Reports Register List with search & filters
  async getReportsList({ search = '', status = 'all', paymentStatus = 'all', date = '' } = {}) {
    let sql = 'SELECT * FROM reports WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (report_number LIKE ? OR patient_name LIKE ? OR patient_phone LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (paymentStatus && paymentStatus !== 'all') {
      sql += ' AND payment_status = ?';
      params.push(paymentStatus);
    }

    if (date) {
      sql += ' AND registration_date = ?';
      params.push(date);
    }

    sql += ' ORDER BY id DESC LIMIT 200';

    const reports = await this.query(sql, params);

    // Fetch services string for each report
    for (const rep of reports) {
      const sList = await this.query('SELECT service_name FROM report_services WHERE report_id = ?', [rep.id]);
      rep.services_summary = sList.map(s => s.service_name).join(', ');
    }

    return reports;
  },

  // Dashboard Metrics
  async getDashboardStats() {
    const today = new Date().toISOString().split('T')[0];

    const patientsToday = await this.get(
      'SELECT COUNT(DISTINCT patient_id) as count FROM reports WHERE registration_date = ?',
      [today]
    );

    const reportsToday = await this.get(
      'SELECT COUNT(*) as count FROM reports WHERE registration_date = ?',
      [today]
    );

    const pendingPayments = await this.get(
      'SELECT SUM(pending_amount) as total FROM reports WHERE pending_amount > 0'
    );

    const completedReports = await this.get(
      'SELECT COUNT(*) as count FROM reports WHERE status = "completed"'
    );

    const recentReports = await this.query(
      'SELECT * FROM reports ORDER BY id DESC LIMIT 6'
    );

    for (const rep of recentReports) {
      const sList = await this.query('SELECT service_name FROM report_services WHERE report_id = ?', [rep.id]);
      rep.services_summary = sList.map(s => s.service_name).join(', ');
    }

    return {
      patientsToday: patientsToday?.count || 0,
      reportsToday: reportsToday?.count || 0,
      pendingPayments: pendingPayments?.total || 0,
      completedReports: completedReports?.count || 0,
      recentReports
    };
  },

  // Desktop Native Features
  async printReport() {
    if (isElectron) {
      return await window.api.printReport();
    }
    window.print();
    return { success: true };
  },

  async exportPDF(suggestedName) {
    if (isElectron) {
      return await window.api.exportPDF(suggestedName);
    }
    window.print();
    return { success: true };
  },

  async createBackup() {
    if (isElectron) {
      return await window.api.createBackup();
    }
    alert('Backups are available in the desktop application.');
    return { canceled: true };
  },

  async restoreBackup() {
    if (isElectron) {
      return await window.api.restoreBackup();
    }
    alert('Restore is available in the desktop application.');
    return { canceled: true };
  },

  async selectImage(category) {
    if (isElectron) {
      return await window.api.selectAndSaveImage(category);
    }
    return { canceled: true };
  }
};
