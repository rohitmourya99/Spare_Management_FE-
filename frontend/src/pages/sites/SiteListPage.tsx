import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, MapPin, Phone, Mail, User, Upload, FileUp, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Card, Button, Modal } from '../../components/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { useOrganization } from '../../context/OrganizationContext';
import { Site } from '../../types';

export const SiteListPage: React.FC = () => {
  const { user } = useAuthStore();
  const { selectedOrg, organizations } = useOrganization();
  const activeOrgObj = organizations.find((o) => o.id === selectedOrg) || { id: 'BHEL', name: 'BHEL' };

  const [search, setSearch] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sites', search, selectedOrg],
    queryFn: async () => {
      const res = await api.get('/sites', { params: { search, limit: 100 } });
      return res.data;
    },
  });

  const sites: Site[] = data?.data || [];

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportSummary(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/sites/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportSummary(res.data?.data || { imported: 0, created: 0 });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to import site excel file');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Layout title={`${activeOrgObj.name} Site Master Directory`}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder={`Search ${activeOrgObj.name} Site, City, Code...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 font-medium"
          />
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => { setImportSummary(null); setImportModalOpen(true); }}
              icon={<Upload className="w-3.5 h-3.5" />}
            >
              Import Sites (SPOC Excel)
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full p-12 text-center text-slate-500 font-semibold">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            Loading BHEL sites...
          </div>
        ) : sites.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500 font-semibold">
            No site records found. Import the SPOC details Excel file to populate sites.
          </div>
        ) : (
          sites.map((site) => (
            <Card key={site.id} className="hover:border-indigo-300 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                  {site.siteName}
                </h3>
                {site.siteCode && (
                  <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                    {site.siteCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mb-3 border-b border-slate-200 pb-2.5 leading-relaxed font-medium">
                {site.fullAddress || `${site.city || ''}, ${site.state || ''}`}
              </p>
              <div className="space-y-1.5 text-xs text-slate-800 font-medium">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-900">{site.contactPerson || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono text-slate-700 font-bold">{site.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-700 font-semibold truncate">{site.email || '—'}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Import Modal */}
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title="Import BHEL SPOC Master Excel" maxWidth="md">
        <div className="space-y-4">
          <p className="text-xs text-slate-600 font-medium">
            Upload the BHEL SPOC details Excel spreadsheet (`SPOC details.xlsx`). The system will import sites and their contact information.
          </p>

          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-600 transition-colors bg-slate-50"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">Click to select SPOC Excel file</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">Supports .xlsx and .xls</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileImport}
          />

          {isImporting && (
            <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              <span className="text-sm font-bold text-indigo-900">Importing sites...</span>
            </div>
          )}

          {importSummary && !importSummary.error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sites Imported Successfully
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Total Rows</p>
                  <p className="font-bold text-slate-900">{importSummary.totalRows}</p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Imported / Created</p>
                  <p className="font-bold text-emerald-600">{importSummary.imported}</p>
                </div>
              </div>
            </div>
          )}

          {importSummary?.error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <p className="text-sm font-bold text-rose-800">{importSummary.error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="secondary" size="sm" onClick={() => setImportModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};
