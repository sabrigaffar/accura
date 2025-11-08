import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createAdminClient } from '../lib/supabase';

interface PendingDriver {
  id: string;
  id_image_url: string | null;
  approval_status: string;
  created_at?: string;
  vehicle_type?: string | null;
  vehicle_model?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  full_name?: string | null;
  phone_number?: string | null;
}

interface PendingMerchantProfile {
  owner_id: string;
  id_document_url: string | null;
  commercial_record_url: string | null;
  approval_status: string;
  created_at?: string;
  owner_name?: string | null;
  owner_phone?: string | null;
}

const JoinRequestsPage: React.FC = () => {
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [merchants, setMerchants] = useState<PendingMerchantProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const adminClient = useMemo(() => createAdminClient(), []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: dps }, { data: mps }] = await Promise.all([
        supabase
          .from('driver_profiles')
          .select('id, id_image_url, approval_status, created_at, vehicle_type, vehicle_model, license_number, license_expiry')
          .eq('approval_status', 'pending'),
        supabase
          .from('merchant_profiles')
          .select('owner_id, id_document_url, commercial_record_url, approval_status, created_at')
          .eq('approval_status', 'pending'),
      ]);

      // Enrich drivers with account info
      let pendingDrivers = (dps || []) as PendingDriver[];
      const driverIds = Array.from(new Set(pendingDrivers.map((d) => d.id)));
      if (driverIds.length > 0) {
        const { data: driverOwners } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number')
          .in('id', driverIds);
        const dmap: Record<string, { full_name: string | null; phone_number: string | null }> = {};
        (driverOwners || []).forEach((o: any) => (dmap[o.id] = { full_name: o.full_name, phone_number: o.phone_number }));
        pendingDrivers = pendingDrivers.map((d) => ({
          ...d,
          full_name: dmap[d.id]?.full_name ?? null,
          phone_number: dmap[d.id]?.phone_number ?? null,
        }));
      }

      // Enrich merchant profiles with owner info
      let pendingMerchants = (mps || []) as PendingMerchantProfile[];
      const ownerIds = Array.from(new Set(pendingMerchants.map((m) => m.owner_id)));
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number')
          .in('id', ownerIds);
        const map: Record<string, { name: string | null; phone: string | null }> = {};
        (owners || []).forEach((o: any) => (map[o.id] = { name: o.full_name, phone: o.phone_number }));
        pendingMerchants = pendingMerchants.map((m) => ({
          ...m,
          owner_name: map[m.owner_id]?.name ?? null,
          owner_phone: map[m.owner_id]?.phone ?? null,
        }));
      }

      setDrivers(pendingDrivers);
      setMerchants(pendingMerchants);
    } catch (e) {
      console.error('loadData error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const makeSignedUrl = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    try {
      // Prefer service key if provided
      const { data, error } = await (adminClient ?? supabase).storage
        .from('kyc-images')
        .createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    } catch (e) {
      console.warn('signed url error', e);
      return null;
    }
  };

  const handleDriverAction = async (driverId: string, action: 'approve' | 'reject') => {
    try {
      setActioning(`${driverId}:${action}`);
      const { error } = await supabase.rpc('admin_update_driver_approval', {
        p_driver_id: driverId,
        p_action: action,
        p_notes: null,
      });
      if (error) throw error;
      await loadData();
      alert(action === 'approve' ? 'تمت الموافقة على السائق' : 'تم رفض السائق');
    } catch (e: any) {
      alert(e.message || 'فشل تنفيذ العملية');
    } finally {
      setActioning(null);
    }
  };

  const handleMerchantAction = async (ownerId: string, action: 'approve' | 'reject') => {
    try {
      setActioning(`${ownerId}:${action}`);
      const { error } = await supabase.rpc('admin_update_merchant_profile_approval', {
        p_owner_id: ownerId,
        p_action: action,
        p_notes: null,
      });
      if (error) throw error;
      await loadData();
      alert(action === 'approve' ? 'تمت الموافقة على المتجر' : 'تم رفض المتجر');
    } catch (e: any) {
      alert(e.message || 'فشل تنفيذ العملية');
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">طلبات الانضمام</h1>
        <p className="mt-2 text-gray-600">مراجعة واعتماد طلبات السائقين والتجار</p>
      </div>

      {/* Drivers */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">السائقون بانتظار الموافقة</h2>
        {loading ? (
          <div>جاري التحميل...</div>
        ) : drivers.length === 0 ? (
          <div className="text-gray-500">لا توجد طلبات معلّقة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المعرف</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاسم/الهاتف</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">مستند الهوية</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المركبة</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الرخصة</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ الطلب</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {drivers.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2 font-mono text-sm">{d.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2">
                      <div className="text-sm text-gray-800">{d.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-500">{d.phone_number ?? ''}</div>
                    </td>
                    <td className="px-4 py-2">
                      {d.id_image_url ? (
                        <button
                          className="text-primary underline"
                          onClick={async () => {
                            const url = await makeSignedUrl(d.id_image_url);
                            if (url) window.open(url, '_blank');
                            else alert('تعذر فتح المستند');
                          }}
                        >
                          عرض المستند
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">{d.vehicle_type ?? '—'} {d.vehicle_model ? `- ${d.vehicle_model}` : ''}</td>
                    <td className="px-4 py-2 text-sm">{d.license_number ?? '—'}{d.license_expiry ? ` (حتى ${new Date(d.license_expiry).toLocaleDateString()})` : ''}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{d.created_at ? new Date(d.created_at).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-left">
                      <div className="flex gap-2 justify-start">
                        <button
                          className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                          onClick={() => handleDriverAction(d.id, 'approve')}
                          disabled={!!actioning}
                        >
                          موافقة
                        </button>
                        <button
                          className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50"
                          onClick={() => handleDriverAction(d.id, 'reject')}
                          disabled={!!actioning}
                        >
                          رفض
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Merchants */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">التجّار بانتظار الموافقة</h2>
        {loading ? (
          <div>جاري التحميل...</div>
        ) : merchants.length === 0 ? (
          <div className="text-gray-500">لا توجد طلبات معلّقة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">صاحب الحساب</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">مالك المتجر</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الهوية</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">السجل التجاري</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ الطلب</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {merchants.map((m) => (
                  <tr key={m.owner_id}>
                    <td className="px-4 py-2">
                      <div className="text-sm text-gray-800">{m.owner_name ?? '—'}</div>
                      <div className="text-xs text-gray-500">{m.owner_phone ?? ''}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-xs text-gray-500">{m.owner_id}</div>
                    </td>
                    <td className="px-4 py-2">
                      {m.id_document_url ? (
                        <button
                          className="text-primary underline"
                          onClick={async () => {
                            const url = await makeSignedUrl(m.id_document_url);
                            if (url) window.open(url, '_blank');
                            else alert('تعذر فتح المستند');
                          }}
                        >
                          عرض المستند
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {m.commercial_record_url ? (
                        <button
                          className="text-primary underline"
                          onClick={async () => {
                            const url = await makeSignedUrl(m.commercial_record_url);
                            if (url) window.open(url, '_blank');
                            else alert('تعذر فتح المستند');
                          }}
                        >
                          عرض المستند
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{m.created_at ? new Date(m.created_at).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-left">
                      <div className="flex gap-2 justify-start">
                        <button
                          className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                          onClick={() => handleMerchantAction(m.owner_id, 'approve')}
                          disabled={!!actioning}
                        >
                          موافقة
                        </button>
                        <button
                          className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50"
                          onClick={() => handleMerchantAction(m.owner_id, 'reject')}
                          disabled={!!actioning}
                        >
                          رفض
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinRequestsPage;
