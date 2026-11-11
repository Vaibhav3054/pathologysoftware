-- =========================================================================
-- MIGRATION 004: Standard Indian Diagnostic Catalog Seeder & Sequence Generator
-- =========================================================================

-- 1. Atomic Report Number Generator Function
CREATE OR REPLACE FUNCTION public.generate_next_report_number(target_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_digits INT;
  v_next INT;
  v_result TEXT;
BEGIN
  -- Lock settings row for target tenant to avoid race conditions
  SELECT report_number_prefix, report_number_digits, next_report_number
  INTO v_prefix, v_digits, v_next
  FROM public.tenant_settings
  WHERE tenant_id = target_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_prefix := 'AP-';
    v_digits := 6;
    v_next := 1;
  END IF;

  v_result := v_prefix || LPAD(v_next::TEXT, v_digits, '0');

  -- Increment for next report
  UPDATE public.tenant_settings
  SET next_report_number = v_next + 1,
      updated_at = now()
  WHERE tenant_id = target_tenant_id;

  RETURN v_result;
END;
$$;

-- 2. Tenant Catalog Auto-Seeder Function (CBC, LFT, KFT, Sugars, Urine, X-Rays)
CREATE OR REPLACE FUNCTION public.seed_tenant_catalog(target_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cbc_id UUID;
  v_fbs_id UUID;
  v_ppbs_id UUID;
  v_rbs_id UUID;
  v_hba1c_id UUID;
  v_lipid_id UUID;
  v_lft_id UUID;
  v_kft_id UUID;
  v_thyroid_id UUID;
  v_widal_id UUID;
  v_urine_id UUID;
  v_dengue_id UUID;
  v_malaria_id UUID;
  v_lytes_id UUID;
BEGIN
  -- Insert Standard Reference Doctors
  INSERT INTO public.doctors (tenant_id, name) VALUES
    (target_tenant_id, 'Self / Direct'),
    (target_tenant_id, 'Dr. R. K. Sharma (M.B.B.S.)'),
    (target_tenant_id, 'Dr. Anita Verma (M.S., Gynae)'),
    (target_tenant_id, 'Dr. M. P. Singh (M.D., Physician)')
  ON CONFLICT DO NOTHING;

  -- 1. Complete Blood Count (CBC)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Complete Blood Count (CBC)', 350.00, 'Pathology')
  RETURNING id INTO v_cbc_id;

  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_cbc_id, 'Hemoglobin (Hb)', 'g/dL', '13.0 - 17.0 (M) / 12.0 - 15.0 (F)', 12.0, 17.0, 1),
    (target_tenant_id, v_cbc_id, 'Total Leukocyte Count (TLC / WBC)', '/µL', '4,000 - 11,000', 4000, 11000, 2),
    (target_tenant_id, v_cbc_id, 'Neutrophils', '%', '40 - 70', 40, 70, 3),
    (target_tenant_id, v_cbc_id, 'Lymphocytes', '%', '20 - 45', 20, 45, 4),
    (target_tenant_id, v_cbc_id, 'Eosinophils', '%', '1 - 6', 1, 6, 5),
    (target_tenant_id, v_cbc_id, 'Monocytes', '%', '2 - 8', 2, 8, 6),
    (target_tenant_id, v_cbc_id, 'Basophils', '%', '0 - 1', 0, 1, 7),
    (target_tenant_id, v_cbc_id, 'Platelet Count', 'Lakh/µL', '1.50 - 4.50', 1.5, 4.5, 8),
    (target_tenant_id, v_cbc_id, 'Total RBC Count', 'million/µL', '4.5 - 5.5', 4.5, 5.5, 9),
    (target_tenant_id, v_cbc_id, 'Packed Cell Volume (PCV / HCT)', '%', '36 - 50', 36, 50, 10),
    (target_tenant_id, v_cbc_id, 'MCV', 'fL', '80 - 100', 80, 100, 11),
    (target_tenant_id, v_cbc_id, 'MCH', 'pg', '27 - 32', 27, 32, 12),
    (target_tenant_id, v_cbc_id, 'MCHC', 'g/dL', '32 - 36', 32, 36, 13),
    (target_tenant_id, v_cbc_id, 'ESR (Westergren)', 'mm/1st hr', '0 - 15 (M) / 0 - 20 (F)', 0, 20, 14);

  -- 2. Fasting Blood Sugar (FBS)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Blood Glucose (Fasting)', 100.00, 'Pathology')
  RETURNING id INTO v_fbs_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_fbs_id, 'Fasting Blood Sugar (FBS)', 'mg/dL', '70 - 100', 70, 100, 1);

  -- 3. Post Prandial Blood Sugar (PPBS)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Blood Glucose (Post Prandial)', 100.00, 'Pathology')
  RETURNING id INTO v_ppbs_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_ppbs_id, 'Post Prandial Blood Sugar (PPBS)', 'mg/dL', '70 - 140', 70, 140, 1);

  -- 4. Random Blood Sugar (RBS)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Blood Glucose (Random)', 80.00, 'Pathology')
  RETURNING id INTO v_rbs_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_rbs_id, 'Random Blood Sugar (RBS)', 'mg/dL', '70 - 140', 70, 140, 1);

  -- 5. HbA1c
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'HbA1c (Glycated Hemoglobin)', 450.00, 'Pathology')
  RETURNING id INTO v_hba1c_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_hba1c_id, 'HbA1c', '%', '< 5.7 Normal, 5.7-6.4 Prediabetic, >= 6.5 Diabetic', 4.0, 5.7, 1),
    (target_tenant_id, v_hba1c_id, 'Estimated Average Glucose (eAG)', 'mg/dL', '90 - 120', 90, 120, 2);

  -- 6. Lipid Profile
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Lipid Profile', 600.00, 'Pathology')
  RETURNING id INTO v_lipid_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_lipid_id, 'Total Cholesterol', 'mg/dL', '< 200 Desirable', 100, 200, 1),
    (target_tenant_id, v_lipid_id, 'Triglycerides', 'mg/dL', '< 150 Normal', 50, 150, 2),
    (target_tenant_id, v_lipid_id, 'HDL Cholesterol (Good)', 'mg/dL', '> 40 (M) / > 50 (F)', 40, 60, 3),
    (target_tenant_id, v_lipid_id, 'LDL Cholesterol (Bad)', 'mg/dL', '< 100 Optimal', 50, 100, 4),
    (target_tenant_id, v_lipid_id, 'VLDL Cholesterol', 'mg/dL', '10 - 30', 10, 30, 5),
    (target_tenant_id, v_lipid_id, 'Total / HDL Ratio', 'ratio', '< 4.5', 2.0, 4.5, 6);

  -- 7. Liver Function Test (LFT)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Liver Function Test (LFT)', 650.00, 'Pathology')
  RETURNING id INTO v_lft_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_lft_id, 'Serum Bilirubin (Total)', 'mg/dL', '0.2 - 1.2', 0.2, 1.2, 1),
    (target_tenant_id, v_lft_id, 'Serum Bilirubin (Direct)', 'mg/dL', '0.0 - 0.3', 0.0, 0.3, 2),
    (target_tenant_id, v_lft_id, 'Serum Bilirubin (Indirect)', 'mg/dL', '0.2 - 0.9', 0.2, 0.9, 3),
    (target_tenant_id, v_lft_id, 'SGOT / AST', 'U/L', '5 - 40', 5, 40, 4),
    (target_tenant_id, v_lft_id, 'SGPT / ALT', 'U/L', '5 - 45', 5, 45, 5),
    (target_tenant_id, v_lft_id, 'Serum Alkaline Phosphatase (ALP)', 'U/L', '30 - 120', 30, 120, 6),
    (target_tenant_id, v_lft_id, 'Serum Total Protein', 'g/dL', '6.0 - 8.3', 6.0, 8.3, 7),
    (target_tenant_id, v_lft_id, 'Serum Albumin', 'g/dL', '3.5 - 5.0', 3.5, 5.0, 8),
    (target_tenant_id, v_lft_id, 'Serum Globulin', 'g/dL', '2.0 - 3.5', 2.0, 3.5, 9),
    (target_tenant_id, v_lft_id, 'A:G Ratio', 'ratio', '1.2 - 2.2', 1.2, 2.2, 10);

  -- 8. Kidney Function Test (KFT / RFT)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Kidney Function Test (KFT / RFT)', 650.00, 'Pathology')
  RETURNING id INTO v_kft_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_kft_id, 'Blood Urea', 'mg/dL', '15 - 40', 15, 40, 1),
    (target_tenant_id, v_kft_id, 'Serum Creatinine', 'mg/dL', '0.6 - 1.2', 0.6, 1.2, 2),
    (target_tenant_id, v_kft_id, 'Blood Urea Nitrogen (BUN)', 'mg/dL', '7 - 20', 7, 20, 3),
    (target_tenant_id, v_kft_id, 'Serum Uric Acid', 'mg/dL', '3.5 - 7.2 (M) / 2.6 - 6.0 (F)', 2.6, 7.2, 4),
    (target_tenant_id, v_kft_id, 'Serum Calcium', 'mg/dL', '8.5 - 10.5', 8.5, 10.5, 5),
    (target_tenant_id, v_kft_id, 'Serum Sodium (Na+)', 'mEq/L', '135 - 145', 135, 145, 6),
    (target_tenant_id, v_kft_id, 'Serum Potassium (K+)', 'mEq/L', '3.5 - 5.1', 3.5, 5.1, 7);

  -- 9. Thyroid Profile
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Thyroid Profile (Total T3, T4, TSH)', 500.00, 'Pathology')
  RETURNING id INTO v_thyroid_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_thyroid_id, 'Total Triiodothyronine (T3)', 'ng/dL', '70 - 200', 70, 200, 1),
    (target_tenant_id, v_thyroid_id, 'Total Thyroxine (T4)', 'µg/dL', '4.5 - 12.0', 4.5, 12.0, 2),
    (target_tenant_id, v_thyroid_id, 'TSH (Thyroid Stimulating Hormone)', 'µIU/mL', '0.35 - 4.94', 0.35, 4.94, 3);

  -- 10. Widal Test
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Widal Slide Agglutination', 200.00, 'Pathology')
  RETURNING id INTO v_widal_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_widal_id, 'Salmonella Typhi "O"', 'Titre', '< 1:80 (Negative)', NULL, NULL, 1),
    (target_tenant_id, v_widal_id, 'Salmonella Typhi "H"', 'Titre', '< 1:80 (Negative)', NULL, NULL, 2),
    (target_tenant_id, v_widal_id, 'Salmonella Paratyphi "AH"', 'Titre', '< 1:80 (Negative)', NULL, NULL, 3),
    (target_tenant_id, v_widal_id, 'Salmonella Paratyphi "BH"', 'Titre', '< 1:80 (Negative)', NULL, NULL, 4);

  -- 11. Urine Routine & Microscopic
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Urine Routine & Microscopic (Urine R/M)', 150.00, 'Pathology')
  RETURNING id INTO v_urine_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_urine_id, 'Colour', '', 'Pale Yellow', NULL, NULL, 1),
    (target_tenant_id, v_urine_id, 'Appearance', '', 'Clear', NULL, NULL, 2),
    (target_tenant_id, v_urine_id, 'Reaction / pH', '', '5.0 - 7.5', 5.0, 7.5, 3),
    (target_tenant_id, v_urine_id, 'Specific Gravity', '', '1.010 - 1.025', 1.010, 1.025, 4),
    (target_tenant_id, v_urine_id, 'Protein / Albumin', '', 'Nil', NULL, NULL, 5),
    (target_tenant_id, v_urine_id, 'Sugar / Glucose', '', 'Nil', NULL, NULL, 6),
    (target_tenant_id, v_urine_id, 'Ketone Bodies', '', 'Absent', NULL, NULL, 7),
    (target_tenant_id, v_urine_id, 'Pus Cells', '/HPF', '1 - 5', 0, 5, 8),
    (target_tenant_id, v_urine_id, 'Epithelial Cells', '/HPF', '1 - 4', 0, 4, 9),
    (target_tenant_id, v_urine_id, 'Red Blood Cells (RBCs)', '/HPF', 'Nil', 0, 0, 10),
    (target_tenant_id, v_urine_id, 'Crystals', '', 'Nil', NULL, NULL, 11),
    (target_tenant_id, v_urine_id, 'Casts', '', 'Nil', NULL, NULL, 12);

  -- 12. Dengue Combo
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Dengue Serology (NS1 + IgM + IgG)', 700.00, 'Pathology')
  RETURNING id INTO v_dengue_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_dengue_id, 'Dengue NS1 Antigen', '', 'Negative', NULL, NULL, 1),
    (target_tenant_id, v_dengue_id, 'Dengue IgM Antibody', '', 'Negative', NULL, NULL, 2),
    (target_tenant_id, v_dengue_id, 'Dengue IgG Antibody', '', 'Negative', NULL, NULL, 3);

  -- 13. Malaria Antigen
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Malaria Antigen (Pv / Pf Rapid)', 250.00, 'Pathology')
  RETURNING id INTO v_malaria_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_malaria_id, 'Plasmodium vivax (Pv)', '', 'Negative', NULL, NULL, 1),
    (target_tenant_id, v_malaria_id, 'Plasmodium falciparum (Pf)', '', 'Negative', NULL, NULL, 2);

  -- 14. Serum Electrolytes
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Serum Electrolytes (Na+, K+, Cl-)', 400.00, 'Pathology')
  RETURNING id INTO v_lytes_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_lytes_id, 'Sodium (Na+)', 'mEq/L', '135 - 145', 135, 145, 1),
    (target_tenant_id, v_lytes_id, 'Potassium (K+)', 'mEq/L', '3.5 - 5.1', 3.5, 5.1, 2),
    (target_tenant_id, v_lytes_id, 'Chloride (Cl-)', 'mEq/L', '96 - 106', 96, 106, 3);

  -- Standard Radiology / X-Ray Services
  INSERT INTO public.tests (tenant_id, category, name, price, department) VALUES
    (target_tenant_id, 'xray', 'Chest X-Ray (PA View)', 400.00, 'Radiology'),
    (target_tenant_id, 'xray', 'Chest X-Ray (AP View)', 400.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Cervical Spine (AP & Lat)', 600.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Lumbar Spine (AP & Lat)', 600.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Knee Joint (AP & Lat)', 500.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Hand / Wrist (AP & Oblique)', 450.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Foot / Ankle (AP & Lat)', 450.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Pelvis (AP View)', 500.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Skull (AP & Lat)', 600.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Abdomen (Erect / KUB)', 450.00, 'Radiology');
END;
$$;
