// Central Supabase API service for Multi-Tenant Pathology SaaS
import { supabase } from './supabase';

let currentTenantId = null;

export const setApiTenantId = (id) => {
  currentTenantId = id;
};

export const getApiTenantId = async () => {
  if (currentTenantId) return currentTenantId;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', session.user.id)
    .maybeSingle();
  currentTenantId = profile?.tenant_id || null;
  return currentTenantId;
};

export const api = {
  supabase,

  // Helper to ensure tenant ID is resolved
  async getActiveTenantId(providedTenantId = null) {
    if (providedTenantId) {
      currentTenantId = providedTenantId;
      return providedTenantId;
    }
    return await getApiTenantId();
  },

  // -----------------------------------------------------------------------
  // TENANT SETTINGS & BRANDING
  // -----------------------------------------------------------------------
  async getSettings(tenantId = null) {
    const tid = await this.getActiveTenantId(tenantId);
    let query = supabase.from('tenant_settings').select('*');
    if (tid) {
      query = query.eq('tenant_id', tid);
    }
    const { data, error } = await query.maybeSingle();
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
    }
    const res = data || {};
    // Backward-compatibility aliasing for print views
    return {
      ...res,
      logo_path: res.logo_url || res.logo_path || '',
      signatory_signature_path: res.signature_url || res.signatory_signature_path || '',
    };
  },

  async updateSettings(settingsData, tenantId = null) {
    const tid = await this.getActiveTenantId(tenantId);
    const logoUrl = settingsData.logo_url || settingsData.logo_path || '';
    const sigUrl = settingsData.signature_url || settingsData.signatory_signature_path || '';

    const { data, error } = await supabase
      .from('tenant_settings')
      .update({
        clinic_name: settingsData.clinic_name,
        tagline: settingsData.tagline,
        address: settingsData.address,
        phone: settingsData.phone,
        email: settingsData.email,
        reg_no: settingsData.reg_no,
        signatory_name: settingsData.signatory_name,
        signatory_degree: settingsData.signatory_degree,
        signatory_designation: settingsData.signatory_designation,
        logo_url: logoUrl,
        signature_url: sigUrl,
        letterhead_mode: settingsData.letterhead_mode || 'digital',
        letterhead_top_margin: settingsData.letterhead_top_margin || 35,
        report_number_prefix: settingsData.report_number_prefix || 'AP-',
        next_report_number: settingsData.next_report_number || 1,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tid)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      logo_path: data.logo_url || '',
      signatory_signature_path: data.signature_url || '',
    };
  },

  // -----------------------------------------------------------------------
  // REFERENCE DOCTORS
  // -----------------------------------------------------------------------
  async getDoctors(tenantId = null) {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addDoctor(name, tenantId = null) {
    const tid = await this.getActiveTenantId(tenantId);
    const { data, error } = await supabase
      .from('doctors')
      .insert({ tenant_id: tid, name: name.trim() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateDoctor(id, name) {
    const { data, error } = await supabase
      .from('doctors')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteDoctor(id) {
    const { error } = await supabase.from('doctors').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // -----------------------------------------------------------------------
  // TESTS & PARAMETERS CATALOG
  // -----------------------------------------------------------------------
  async getTests(category = null) {
    let query = supabase.from('tests').select('*').eq('is_active', true);
    if (category) {
      query = query.eq('category', category);
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getTestWithParameters(testId) {
    const { data: test, error: testErr } = await supabase
      .from('tests')
      .select('*')
      .eq('id', testId)
      .single();
    if (testErr) throw testErr;

    const { data: parameters, error: paramErr } = await supabase
      .from('test_parameters')
      .select('*')
      .eq('test_id', testId)
      .order('display_order', { ascending: true });
    if (paramErr) throw paramErr;

    return { ...test, parameters: parameters || [] };
  },

  async addTest(category, name, price, department = 'Pathology', tenantId = null) {
    const tid = await this.getActiveTenantId(tenantId);
    const { data, error } = await supabase
      .from('tests')
      .insert({
        tenant_id: tid,
        category,
        name: name.trim(),
        price: parseFloat(price) || 0,
        department,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTest(id, name, price) {
    const { data, error } = await supabase
      .from('tests')
      .update({ name: name.trim(), price: parseFloat(price) || 0 })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTest(id) {
    const { error } = await supabase.from('tests').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async addParameter(testId, param, tenantId = null) {
    const tid = await this.getActiveTenantId(tenantId);
    const { data, error } = await supabase
      .from('test_parameters')
      .insert({
        tenant_id: tid,
        test_id: testId,
        name: param.name.trim(),
        unit: param.unit || '',
        normal_range: param.normal_range || '',
        min_val: param.min_val !== '' && param.min_val !== null ? parseFloat(param.min_val) : null,
        max_val: param.max_val !== '' && param.max_val !== null ? parseFloat(param.max_val) : null,
        display_order: parseInt(param.display_order) || 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateParameter(paramId, param) {
    const { data, error } = await supabase
      .from('test_parameters')
      .update({
        name: param.name.trim(),
        unit: param.unit || '',
        normal_range: param.normal_range || '',
        min_val: param.min_val !== '' && param.min_val !== null ? parseFloat(param.min_val) : null,
        max_val: param.max_val !== '' && param.max_val !== null ? parseFloat(param.max_val) : null,
        display_order: parseInt(param.display_order) || 0,
      })
      .eq('id', paramId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteParameter(paramId) {
    const { error } = await supabase.from('test_parameters').delete().eq('id', paramId);
    if (error) throw error;
    return true;
  },

  // -----------------------------------------------------------------------
  // PATIENTS
  // -----------------------------------------------------------------------
  async searchPatients(queryStr) {
    if (!queryStr || !queryStr.trim()) return [];
    const term = `%${queryStr.trim()}%`;
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .or(`name.ilike.${term},phone.ilike.${term}`)
      .order('updated_at', { ascending: false })
      .limit(15);
    if (error) throw error;
    return data || [];
  },

  async getPatientById(id) {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getPatientHistory(patientId) {
    const { data: reports, error } = await supabase
      .from('reports')
      .select(`
        *,
        report_services (service_name)
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (reports || []).map(r => ({
      ...r,
      services_summary: (r.report_services || []).map(s => s.service_name).join(', ')
    }));
  },

  // -----------------------------------------------------------------------
  // REPORT REGISTRATION & NUMBER GENERATION
  // -----------------------------------------------------------------------
  async generateNextReportNumber(tenantId = null) {
    const tid = await this.getActiveTenantId(tenantId);
    try {
      const { data, error } = await supabase.rpc('generate_next_report_number', {
        target_tenant_id: tid,
      });
      if (error) throw error;
      return { reportNumber: data };
    } catch (err) {
      // Fallback: Read tenant_settings directly if RPC not available
      const settings = await this.getSettings(tid);
      const prefix = settings.report_number_prefix || 'AP-';
      const digits = settings.report_number_digits || 6;
      const nextNum = settings.next_report_number || 1;
      const formatted = `${prefix}${String(nextNum).padStart(digits, '0')}`;
      return { reportNumber: formatted };
    }
  },

  async createRegistration({ patientData, selectedServices, billingData, tenantId = null }) {
    const tid = await this.getActiveTenantId(tenantId);

    // 1. Find or create patient within this tenant
    let patientId = patientData.id;
    if (!patientId) {
      const { data: existing } = await supabase
        .from('patients')
        .select('id')
        .eq('phone', patientData.phone.trim())
        .limit(1)
        .maybeSingle();

      if (existing) {
        patientId = existing.id;
        await supabase
          .from('patients')
          .update({
            name: patientData.name.trim(),
            age: parseInt(patientData.age),
            gender: patientData.gender,
            updated_at: new Date().toISOString(),
          })
          .eq('id', patientId);
      } else {
        const { data: newPatient, error: pErr } = await supabase
          .from('patients')
          .insert({
            tenant_id: tid,
            name: patientData.name.trim(),
            age: parseInt(patientData.age),
            gender: patientData.gender,
            phone: patientData.phone.trim(),
          })
          .select()
          .single();
        if (pErr) throw pErr;
        patientId = newPatient.id;
      }
    }

    // 2. Generate report number
    const { reportNumber } = await this.generateNextReportNumber(tid);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    // 3. Create Report Record
    const { data: report, error: repErr } = await supabase
      .from('reports')
      .insert({
        tenant_id: tid,
        report_number: reportNumber,
        patient_id: patientId,
        patient_name: patientData.name.trim(),
        patient_age: parseInt(patientData.age),
        patient_gender: patientData.gender,
        patient_phone: patientData.phone.trim(),
        doctor_name: patientData.doctor_name || 'Self / Direct',
        registration_date: dateStr,
        registration_time: timeStr,
        status: 'draft',
        total_amount: parseFloat(billingData.total_amount) || 0,
        paid_amount: parseFloat(billingData.paid_amount) || 0,
        pending_amount: parseFloat(billingData.pending_amount) || 0,
        payment_status: billingData.payment_status || 'Pending',
        notes: billingData.notes || '',
      })
      .select()
      .single();

    if (repErr) throw repErr;
    const reportId = report.id;

    // 4. Insert Selected Services and Initialize Templates
    for (const service of selectedServices) {
      await supabase.from('report_services').insert({
        tenant_id: tid,
        report_id: reportId,
        service_type: service.category,
        service_id: service.id,
        service_name: service.name,
        price: service.price,
      });

      if (service.category === 'blood') {
        const { data: params } = await supabase
          .from('test_parameters')
          .select('*')
          .eq('test_id', service.id)
          .order('display_order', { ascending: true });

        if (params && params.length > 0) {
          const rows = params.map(p => ({
            tenant_id: tid,
            report_id: reportId,
            test_id: service.id,
            test_name: service.name,
            parameter_id: p.id,
            parameter_name: p.name,
            result: '',
            unit: p.unit || '',
            normal_range: p.normal_range || '',
            is_abnormal: false,
            display_order: p.display_order,
          }));
          await supabase.from('report_test_results').insert(rows);
        }
      } else if (service.category === 'xray') {
        await supabase.from('report_xray_results').insert({
          tenant_id: tid,
          report_id: reportId,
          xray_id: service.id,
          xray_name: service.name,
          findings: '',
          impression: '',
          remarks: '',
        });
      }
    }

    return { reportId, reportNumber };
  },

  // -----------------------------------------------------------------------
  // REPORT DETAILS & RESULT ENTRY
  // -----------------------------------------------------------------------
  async getReportDetails(reportId) {
    const { data: report, error: repErr } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();
    if (repErr) throw repErr;

    const { data: services } = await supabase
      .from('report_services')
      .select('*')
      .eq('report_id', reportId);

    const { data: testResults } = await supabase
      .from('report_test_results')
      .select('*')
      .eq('report_id', reportId)
      .order('display_order', { ascending: true });

    const { data: xrayResults } = await supabase
      .from('report_xray_results')
      .select('*')
      .eq('report_id', reportId);

    // Group test results by test_id
    const groupedTests = {};
    (testResults || []).forEach(res => {
      if (!groupedTests[res.test_id]) {
        groupedTests[res.test_id] = {
          testId: res.test_id,
          testName: res.test_name,
          parameters: [],
        };
      }
      groupedTests[res.test_id].parameters.push(res);
    });

    return {
      report,
      services: services || [],
      testResults: Object.values(groupedTests),
      rawTestResults: testResults || [],
      xrayResults: xrayResults || [],
    };
  },

  async saveReportMedicalData(reportId, testResultsUpdates, xrayResultsUpdates, status = 'completed') {
    // Update blood test parameters
    for (const item of testResultsUpdates) {
      await supabase
        .from('report_test_results')
        .update({
          result: item.result || '',
          is_abnormal: Boolean(item.is_abnormal),
        })
        .eq('id', item.id)
        .eq('report_id', reportId);
    }

    // Update X-ray findings
    for (const item of xrayResultsUpdates) {
      await supabase
        .from('report_xray_results')
        .update({
          findings: item.findings || '',
          impression: item.impression || '',
          remarks: item.remarks || '',
        })
        .eq('id', item.id)
        .eq('report_id', reportId);
    }

    // Update Report Status
    const { data, error } = await supabase
      .from('reports')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateReportBilling(reportId, { paid_amount, pending_amount, payment_status }) {
    const { data, error } = await supabase
      .from('reports')
      .update({
        paid_amount: parseFloat(paid_amount) || 0,
        pending_amount: parseFloat(pending_amount) || 0,
        payment_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // -----------------------------------------------------------------------
  // REPORTS LIST & FILTERING
  // -----------------------------------------------------------------------
  async getReportsList({ search = '', status = 'all', startDate = null, endDate = null, limit = 50 }) {
    let query = supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('registration_date', startDate);
    }

    if (endDate) {
      query = query.lte('registration_date', endDate);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`patient_name.ilike.${term},report_number.ilike.${term},patient_phone.ilike.${term}`);
    }

    const { data: reports, error } = await query;
    if (error) throw error;

    // Attach services summary to each report
    if (reports && reports.length > 0) {
      for (const rep of reports) {
        const { data: servList } = await supabase
          .from('report_services')
          .select('service_name')
          .eq('report_id', rep.id);
        rep.services_summary = (servList || []).map(s => s.service_name).join(', ');
      }
    }

    return reports || [];
  },

  // -----------------------------------------------------------------------
  // DASHBOARD STATISTICS
  // -----------------------------------------------------------------------
  async getDashboardStats() {
    const today = new Date().toISOString().split('T')[0];

    // Reports created today
    const { count: reportsToday } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('registration_date', today);

    // Patients today
    const { data: todayReports } = await supabase
      .from('reports')
      .select('patient_id')
      .eq('registration_date', today);
    const uniquePatientIds = new Set((todayReports || []).map(r => r.patient_id));

    // Pending Payments
    const { data: duesData } = await supabase
      .from('reports')
      .select('pending_amount')
      .gt('pending_amount', 0);
    const pendingTotal = (duesData || []).reduce((sum, r) => sum + (parseFloat(r.pending_amount) || 0), 0);

    // Completed Reports
    const { count: completedCount } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    // Recent Reports
    const { data: recentReports } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);

    if (recentReports) {
      for (const rep of recentReports) {
        const { data: sList } = await supabase
          .from('report_services')
          .select('service_name')
          .eq('report_id', rep.id);
        rep.services_summary = (sList || []).map(s => s.service_name).join(', ');
      }
    }

    return {
      patientsToday: uniquePatientIds.size || 0,
      reportsToday: reportsToday || 0,
      pendingPayments: pendingTotal || 0,
      completedReports: completedCount || 0,
      recentReports: recentReports || [],
    };
  },

  // -----------------------------------------------------------------------
  // STORAGE (SUPABASE STORAGE BUCKET: lab-assets)
  // -----------------------------------------------------------------------
  async uploadAsset(file, type = 'logo', tenantId = null) {
    const tid = await this.getActiveTenantId(tenantId);
    if (!file || !tid) throw new Error('File and Tenant ID are required');

    const ext = file.name.split('.').pop() || 'png';
    const filePath = `${tid}/${type}_${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('lab-assets')
      .upload(filePath, file, { upsert: true });

    if (error) throw error;

    const { data: pubData } = supabase.storage
      .from('lab-assets')
      .getPublicUrl(filePath);

    return pubData.publicUrl;
  },

  // Interactive browser file picker fallback
  selectImage(category = 'logo') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return resolve(null);
        try {
          const publicUrl = await api.uploadAsset(file, category);
          resolve({ success: true, dataUrl: publicUrl, publicUrl });
        } catch (err) {
          console.error('Asset upload error:', err);
          reject(err);
        }
      };
      input.click();
    });
  },

  // -----------------------------------------------------------------------
  // WEB PRINTING & PDF EXPORT
  // -----------------------------------------------------------------------
  printReport() {
    window.print();
    return { success: true };
  },

  exportPDF() {
    window.print();
    return { success: true };
  },

  // -----------------------------------------------------------------------
  // CLOUD DATA EXPORT & BACKUP
  // -----------------------------------------------------------------------
  async exportTenantData(tenantId = null) {
    const tid = await this.getActiveTenantId(tenantId);
    const { data: patients } = await supabase.from('patients').select('*');
    const { data: reports } = await supabase.from('reports').select('*');
    const { data: tests } = await supabase.from('tests').select('*');
    const { data: doctors } = await supabase.from('doctors').select('*');
    const { data: settings } = await supabase.from('tenant_settings').select('*');

    return {
      exported_at: new Date().toISOString(),
      tenant_id: tid,
      settings: settings?.[0] || {},
      counts: {
        patients: patients?.length || 0,
        reports: reports?.length || 0,
        tests: tests?.length || 0,
        doctors: doctors?.length || 0,
      },
      data: {
        patients: patients || [],
        reports: reports || [],
        tests: tests || [],
        doctors: doctors || [],
      }
    };
  },

  async createBackup() {
    try {
      const dump = await this.exportTenantData();
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `pathology-saas-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true, path: link.download };
    } catch (err) {
      console.error('Backup export error:', err);
      return { success: false, error: err.message };
    }
  },

  // Compatibility helper for legacy queries
  async query(sqlStr, params = []) {
    if (sqlStr && sqlStr.toLowerCase().includes('report_services') && params?.[0]) {
      const { data } = await supabase
        .from('report_services')
        .select('*')
        .eq('report_id', params[0]);
      return data || [];
    }
    return [];
  },

  // -----------------------------------------------------------------------
  // SUPER ADMIN & TENANT MANAGEMENT METHODS
  // -----------------------------------------------------------------------
  async getAllTenants() {
    const { data, error } = await supabase
      .from('tenants')
      .select(`
        *,
        tenant_subscriptions (*),
        tenant_settings (clinic_name, phone, email)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async provisionTenant({
    name,
    slug,
    phone,
    email,
    address,
    plan_type = 'monthly',
    subscription_source = 'payment',
    duration_days = 30,
    is_unlimited = false,
    is_test_lab = false,
    notes = '',
    adminUserId = null,
  }) {
    const { data, error } = await supabase.rpc('provision_new_tenant', {
      p_name: name,
      p_slug: slug,
      p_phone: phone || '',
      p_email: email || '',
      p_address: address || '',
      p_plan_type: plan_type,
      p_subscription_source: subscription_source,
      p_duration_days: duration_days,
      p_is_unlimited: is_unlimited,
      p_is_test_lab: is_test_lab,
      p_notes: notes,
      p_admin_user_id: adminUserId,
    });
    if (error) throw error;
    return data;
  },

  async updateTenantStatus(tenantId, status) {
    const { data, error } = await supabase
      .from('tenants')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async activatePaidSubscription({ tenantId = null, planType = 'monthly', notes = 'Online Subscription Activation' }) {
    const tid = await this.getActiveTenantId(tenantId);
    const { data, error } = await supabase.rpc('activate_paid_subscription', {
      target_tenant_id: tid,
      p_plan_type: planType,
      p_payment_notes: notes,
    });
    if (error) throw error;
    return data;
  },

  async updateTenantSubscription(subscriptionId, updates) {
    const { data, error } = await supabase
      .from('tenant_subscriptions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getTenantStaff(tenantId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async manageStaffAccount({ action, targetUserId, newPassword, fullName, email, role, isActive }) {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !sessionData?.session?.access_token) {
      throw new Error('Your session has expired. Please sign in again.');
    }

    const res = await fetch('/.netlify/functions/manage-staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        action,
        targetUserId,
        newPassword,
        fullName,
        email,
        role,
        isActive,
      }),
    });

    let payload = {};
    try {
      payload = await res.json();
    } catch {
      payload = {};
    }

    if (!res.ok) {
      // Fallback for toggle_active if SUPABASE_SERVICE_ROLE_KEY is not configured yet
      if (payload?.code === 'MISSING_SERVICE_ROLE' && action === 'toggle_active' && typeof isActive === 'boolean') {
        const { error: updateErr } = await supabase
          .from('user_profiles')
          .update({ is_active: isActive, updated_at: new Date().toISOString() })
          .eq('id', targetUserId);
        if (!updateErr) {
          return { success: true, is_active: isActive, fallback: true };
        }
      }
      throw new Error(payload?.error || `Staff management request failed (${res.status})`);
    }

    return payload;
  },
};
