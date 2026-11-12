import React, { useState } from 'react';
import { ShieldCheck, FileText, RotateCcw, ArrowLeft, Lock, Mail } from 'lucide-react';

export const LEGAL_META = {
  platformName: 'Pathology SaaS',
  supportEmail: 'support@pathologysaas.com',
  effectiveDate: 'November 2026',
  jurisdiction: 'India (Digital Personal Data Protection Act, 2023)',
};

export default function LegalPagesView({ initialTab = 'terms', onClose, isModal = false }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const content = (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden max-w-4xl w-full mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-sky-950 p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Legal & Compliance Policies</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold mt-0.5">{LEGAL_META.platformName} — Policies & Agreements</h2>
          <p className="text-[11px] text-sky-200/80 mt-0.5">
            Effective {LEGAL_META.effectiveDate} • Governed under {LEGAL_META.jurisdiction}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition self-start sm:self-auto cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isModal ? 'Close' : 'Back'}</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 px-5 pt-4 pb-3 border-b border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={() => setActiveTab('terms')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'terms' ? 'bg-sky-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Terms of Service</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('privacy')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'privacy' ? 'bg-sky-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Privacy Policy (DPDP)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('refund')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'refund' ? 'bg-sky-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refund & Cancellation</span>
        </button>
      </div>

      {/* Document Body */}
      <div className="p-5 sm:p-8 space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed max-h-[70vh] overflow-y-auto">
        {activeTab === 'terms' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">1. Platform Subscription & License</h3>
            <p>
              {LEGAL_META.platformName} provides cloud-based multi-tenant pathology and diagnostic laboratory software (&quot;Service&quot;) for patient registration, billing, test report entry, and A4 diagnostic report printing. Each registered laboratory receives an isolated tenant workspace protected by PostgreSQL Row-Level Security (RLS).
            </p>

            <h3 className="text-base font-bold text-slate-900">2. Clinical Responsibility & Verification</h3>
            <p>
              The Service is a laboratory workflow and documentation tool. Qualified laboratory owners, pathologists, and authorized personnel remain solely responsible for verifying specimen integrity, reference ranges, instrument results, clinical interpretations, and authorized signatures prior to issuing any patient report.
            </p>

            <h3 className="text-base font-bold text-slate-900">3. Accounts, Roles & Security</h3>
            <p>
              Laboratory Owners are responsible for managing Receptionist credentials, maintaining strong passwords, and promptly deactivating access for former staff. Unauthorized attempts to bypass tenant isolation, manipulate pricing/billing controls, or share credentials across different legal entities are strictly prohibited.
            </p>

            <h3 className="text-base font-bold text-slate-900">4. Free Trial & Paid Plans</h3>
            <p>
              Every newly registered laboratory receives a 3-day full-access free trial. Continued usage after trial expiry requires an active Monthly (₹999) or Annual (₹9,999) subscription unless complimentary/demo access has been explicitly granted by platform administration.
            </p>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">1. Data Roles Under India&apos;s DPDP Act</h3>
            <p>
              Each subscriber Pathology Laboratory acts as the <strong>Data Fiduciary</strong> for patient records it collects. {LEGAL_META.platformName} acts strictly as a <strong>Data Processor</strong> storing and processing patient demographic details, test selections, diagnostic parameters, and invoices on behalf of that laboratory.
            </p>

            <h3 className="text-base font-bold text-slate-900">2. Multi-Tenant Isolation & Security Controls</h3>
            <p>
              All database tables enforce strict tenant isolation via PostgreSQL Row-Level Security (`tenant_id`), role-based access control separating Owner vs. Receptionist privileges, encrypted HTTPS transport, and immutable database audit logging of sensitive record modifications.
            </p>

            <h3 className="text-base font-bold text-slate-900">3. Data Sharing & Retention</h3>
            <p>
              We do not sell, rent, or use patient diagnostic records or laboratory pricing lists for advertising or third-party analytics. Laboratory Owners can export structured JSON backups at any time and request account/tenant data deletion by contacting {LEGAL_META.supportEmail}.
            </p>
          </div>
        )}

        {activeTab === 'refund' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">1. 3-Day Free Evaluation Period</h3>
            <p>
              New laboratories receive a 3-day free trial with full workflow access before making any subscription payment. We encourage evaluating test catalogs, report layouts, and mobile usability during the trial period prior to purchasing a plan.
            </p>

            <h3 className="text-base font-bold text-slate-900">2. Cancellations & Non-Renewal</h3>
            <p>
              You may cancel renewal before your next billing cycle ends. Upon expiration of the active Monthly or Annual term, workspace access pauses automatically while existing laboratory data remains safely preserved for renewal.
            </p>

            <h3 className="text-base font-bold text-slate-900">3. Eligible Refunds</h3>
            <p>
              Duplicate charges or failed transactions where payment was debited without subscription activation are eligible for a full refund to the original payment method within 5–7 business days upon verification. For billing disputes or GST invoices, email <span className="font-mono font-semibold text-sky-700">{LEGAL_META.supportEmail}</span> with your registered lab email and payment reference ID.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
          <Mail className="w-4 h-4 text-sky-600 shrink-0" />
          <span>Questions or data requests? Contact <strong className="text-slate-700">{LEGAL_META.supportEmail}</strong></span>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        {content}
      </div>
    );
  }

  return <div className="py-2">{content}</div>;
}
