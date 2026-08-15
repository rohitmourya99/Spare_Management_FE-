import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cpu, MapPin, Building2, Plus, X, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Card, Badge } from '../../components/ui';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuthStore } from '../../store/useAuthStore';

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { organizations, selectedOrg, setSelectedOrg, refetchOrganizations } = useOrganization();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', primaryWarehouseName: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: oems } = useQuery({
    queryKey: ['oems'],
    queryFn: async () => (await api.get('/inventory/oems')).data.data,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api.get('/inventory/locations')).data.data,
  });

  const handleAddOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setSuccessMsg(null);

    const cleanName = formData.name.trim();
    const cleanCode = formData.code.trim();
    const cleanWarehouse = formData.primaryWarehouseName.trim();

    if (!cleanName || !cleanCode) {
      setModalError('Organization Name and Code are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/organizations', {
        name: cleanName,
        code: cleanCode,
        primaryWarehouseName: cleanWarehouse || undefined,
      });

      if (res.data?.success || res.status === 201 || res.status === 200) {
        const createdOrg = res.data?.organization || res.data?.data;
        const newOrgId = createdOrg?.id || cleanCode.toUpperCase();

        await refetchOrganizations();
        setIsAddModalOpen(false);
        setFormData({ name: '', code: '', primaryWarehouseName: '' });
        setSuccessMsg(`Organization '${cleanName}' created successfully!`);

        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setModalError(res.data?.message || 'Failed to create organization.');
      }
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || err?.message || 'Failed to create organization.';
      setModalError(serverMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout title="System Settings & Master Data">
      <div className="space-y-6">
        {/* Success Alert */}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-xs font-bold shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-black">✕</button>
          </div>
        )}

        {/* Section 1: Organization Management */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Organization Management</h3>
                <p className="text-xs font-medium text-slate-500">Configure multi-tenant clients & storage hubs</p>
              </div>
            </div>

            {isSuperAdmin && (
              <button
                onClick={() => { setModalError(null); setIsAddModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl shadow-sm text-xs font-black transition-all duration-200 active:scale-95 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Organization</span>
              </button>
            )}
          </div>

          {/* Organizations Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Organization Name</th>
                  <th className="py-3 px-4">Org Code</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {(organizations || []).map((org) => {
                  const isCurrent = org.id === selectedOrg;
                  return (
                    <tr key={org.id} className={`hover:bg-slate-50/60 transition-colors ${isCurrent ? 'bg-indigo-50/40' : ''}`}>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>{org.name}</span>
                        {isCurrent && (
                          <span className="ml-2 px-2 py-0.5 text-[10px] font-black bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                            Active Session
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-600 uppercase">{org.code || org.id}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {org.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isCurrent ? (
                          <span className="text-xs font-bold text-indigo-600">Selected</span>
                        ) : (
                          <button
                            onClick={() => setSelectedOrg(org.id)}
                            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            Switch Context
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Master Data (OEMs & Warehouses) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Registered OEMs" subtitle="Supported equipment manufacturers">
            <div className="flex flex-wrap gap-2 mt-2">
              {(oems || []).map((oem: any) => (
                <Badge key={oem.id} variant="info" size="md">
                  <Cpu className="w-3.5 h-3.5 mr-1.5 inline text-indigo-600" />
                  {oem.name}
                </Badge>
              ))}
            </div>
          </Card>

          <Card title="Warehouse Locations" subtitle="Configured storage hubs">
            <div className="space-y-2 mt-2">
              {(locations || []).map((loc: any) => (
                <div key={loc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-slate-900 text-sm">{loc.name}</span>
                  </div>
                  <span className="text-xs text-slate-600 font-semibold">{loc.city || 'Main Store'}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Modal: + Add Organization */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Add New Organization</h3>
                  <p className="text-xs text-slate-500 font-medium">Create a multi-tenant client profile</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddOrgSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Organization Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tata Motors"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Organization Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TATA"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2 text-xs font-semibold uppercase bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primary Warehouse Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pune Hub / Main Warehouse"
                  value={formData.primaryWarehouseName}
                  onChange={(e) => setFormData({ ...formData, primaryWarehouseName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};
