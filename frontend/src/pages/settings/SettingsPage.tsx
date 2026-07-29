import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cpu, Tag, MapPin } from 'lucide-react';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Card, Badge } from '../../components/ui';

export const SettingsPage: React.FC = () => {
  const { data: oems } = useQuery({
    queryKey: ['oems'],
    queryFn: async () => (await api.get('/inventory/oems')).data.data,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api.get('/inventory/locations')).data.data,
  });

  return (
    <Layout title="System Settings & Master Data">
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
                <span className="text-xs text-slate-600 font-semibold">{loc.city}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};
