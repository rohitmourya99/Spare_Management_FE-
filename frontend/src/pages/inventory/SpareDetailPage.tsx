import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Package, MapPin, Tag, Hash, Calendar, Clock,
  MessageSquare, History, Truck, RotateCcw, Send, Edit2, Check, X,
  AlertTriangle, CheckCircle2, User, Activity,
} from 'lucide-react';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Button, Card, Badge } from '../../components/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { Comment, InventoryMovement } from '../../types';

const statusVariant = (s: string): 'success' | 'danger' | 'warning' | 'default' =>
  s === 'AVAILABLE' ? 'success' : s === 'DISPATCHED' ? 'danger' : 'warning';

const movementTypeColor = (type: string) => {
  if (type === 'DISPATCH') return 'text-rose-400';
  if (type === 'PICKUP' || type === 'IMPORT') return 'text-emerald-400';
  return 'text-blue-400';
};

export const SpareDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [activeTab, setActiveTab] = useState<'comments' | 'movements' | 'dispatches' | 'pickups'>('comments');

  const { data: item, isLoading, error } = useQuery({
    queryKey: ['inventory-item', id],
    queryFn: async () => {
      const res = await api.get(`/inventory/${id}`);
      return res.data.data;
    },
  });

  const { data: commentsData } = useQuery({
    queryKey: ['item-comments', id],
    queryFn: async () => {
      const res = await api.get(`/inventory/${id}/comments`);
      return res.data.data as Comment[];
    },
    enabled: !!id,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      const res = await api.post(`/inventory/${id}/comments`, { comment });
      return res.data.data;
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['item-comments', id] });
    },
  });

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, comment }: { commentId: string; comment: string }) => {
      const res = await api.put(`/inventory/comments/${commentId}`, { comment });
      return res.data.data;
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditText('');
      queryClient.invalidateQueries({ queryKey: ['item-comments', id] });
    },
  });

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment.trim());
  };

  const handleEditStart = (c: Comment) => {
    setEditingCommentId(c.id);
    setEditText(c.comment);
  };

  const handleEditSave = () => {
    if (!editText.trim() || !editingCommentId) return;
    editCommentMutation.mutate({ commentId: editingCommentId, comment: editText });
  };

  if (isLoading) {
    return (
      <Layout title="Spare Details">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !item) {
    return (
      <Layout title="Spare Details">
        <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
          Spare part not found or error loading data.
        </div>
      </Layout>
    );
  }

  const comments = commentsData || [];

  return (
    <Layout title={`${item.spareId} — Spare Details`}>
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/inventory')}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Inventory
      </button>

      {/* Header Card */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-brand-900/30 to-slate-900 border border-slate-800 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-brand-400 font-bold text-sm">{item.spareId}</span>
              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
              <Badge variant={item.isSerialized ? 'info' : 'default'}>
                {item.isSerialized ? 'Serialized' : 'Non-Serialized'}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-white">{item.productName}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{item.oem?.name} · {item.category?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold text-white">{item.availableQuantity}</p>
            <p className="text-xs text-slate-500">available / {item.quantity} total {item.unit}</p>
            {item.availableQuantity <= 2 && (
              <p className="text-xs text-amber-400 flex items-center gap-1 justify-end mt-1">
                <AlertTriangle className="w-3 h-3" /> Low Stock
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Spare Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Spare Information */}
        <Card title="Spare Information" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-1">
            {[
              { label: 'Part Code', value: item.partCode || '—', icon: Hash },
              { label: 'Model', value: item.model || '—', icon: Tag },
              { label: 'Serial Number', value: item.serialNumber || 'N/A (Bulk)', icon: Hash },
              { label: 'Category', value: item.category?.name || '—', icon: Tag },
              { label: 'Store', value: item.store, icon: MapPin },
              { label: 'Location', value: item.location?.name || '—', icon: MapPin },
              { label: 'Rack / Bin', value: `${item.rack || '—'} / ${item.bin || '—'}`, icon: Package },
              { label: 'Condition', value: item.condition || '—', icon: CheckCircle2 },
              { label: 'Purchase Date', value: item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString('en-IN') : '—', icon: Calendar },
              { label: 'Warranty Start', value: item.warrantyStart ? new Date(item.warrantyStart).toLocaleDateString('en-IN') : '—', icon: Calendar },
              { label: 'Warranty End', value: item.warrantyEnd ? new Date(item.warrantyEnd).toLocaleDateString('en-IN') : '—', icon: Calendar },
              { label: 'Created At', value: new Date(item.createdAt).toLocaleDateString('en-IN'), icon: Clock },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-start gap-2">
                <Icon className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-medium text-slate-200">{value}</p>
                </div>
              </div>
            ))}
          </div>
          {item.description && (
            <div className="mt-4 pt-3 border-t border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm text-slate-300">{item.description}</p>
            </div>
          )}
          {item.remarks && (
            <div className="mt-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Remarks</p>
              <p className="text-sm text-slate-400 italic">{item.remarks}</p>
            </div>
          )}
        </Card>

        {/* Stock & Quick Actions */}
        <div className="space-y-4">
          <Card title="Stock Summary">
            <div className="space-y-2 mt-1">
              {[
                { label: 'Total Quantity', value: item.quantity, color: 'text-white' },
                { label: 'Available Qty', value: item.availableQuantity, color: item.availableQuantity <= 2 ? 'text-amber-400' : 'text-emerald-400' },
                { label: 'Reserved / Dispatched', value: item.quantity - item.availableQuantity, color: 'text-rose-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/50">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className={`font-bold text-sm ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Quick Actions">
            <div className="space-y-2 mt-1">
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                icon={<Truck className="w-3.5 h-3.5" />}
                onClick={() => navigate(`/dispatch?itemId=${item.id}`)}
                disabled={item.availableQuantity === 0}
              >
                Dispatch This Spare
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => navigate(`/pickup?itemId=${item.id}`)}
              >
                Pickup From Site
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Tabs: Comments / Movements / Dispatches / Pickups */}
      <Card>
        <div className="flex gap-1 mb-4 pb-3 border-b border-slate-800 overflow-x-auto">
          {[
            { key: 'comments', label: `Comments (${comments.length})`, icon: MessageSquare },
            { key: 'movements', label: `Movement History (${item.movements?.length || 0})`, icon: History },
            { key: 'dispatches', label: `Dispatches (${item.dispatches?.length || 0})`, icon: Truck },
            { key: 'pickups', label: `Pickups (${item.pickups?.length || 0})`, icon: RotateCcw },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div className="space-y-3">
            {/* Add comment */}
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {user?.name?.[0] || 'U'}
              </div>
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment about this spare part... (mandatory notes, issues, observations)"
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
                />
                <div className="flex justify-end mt-1.5">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAddComment}
                    isLoading={addCommentMutation.isPending}
                    disabled={!newComment.trim()}
                    icon={<Send className="w-3.5 h-3.5" />}
                  >
                    Post Comment
                  </Button>
                </div>
              </div>
            </div>

            {/* Comment list */}
            {comments.length === 0 ? (
              <div className="text-center py-6">
                <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No comments yet. Be the first to add one.</p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                    {c.user?.name?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{c.user?.name}</span>
                        <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{c.user?.role?.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">{new Date(c.createdAt).toLocaleString('en-IN')}</span>
                        {c.userId === user?.id && editingCommentId !== c.id && (
                          <button
                            onClick={() => handleEditStart(c)}
                            className="text-slate-500 hover:text-brand-400 transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {editingCommentId === c.id ? (
                      <div>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500 resize-none"
                        />
                        <div className="flex gap-2 mt-1.5">
                          <Button size="sm" variant="primary" onClick={handleEditSave} isLoading={editCommentMutation.isPending} icon={<Check className="w-3 h-3" />}>
                            Save
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => { setEditingCommentId(null); setEditText(''); }} icon={<X className="w-3 h-3" />}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-300">{c.comment}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Movements Tab */}
        {activeTab === 'movements' && (
          <div className="space-y-2">
            {(!item.movements || item.movements.length === 0) ? (
              <p className="text-sm text-slate-500 text-center py-6">No movement history</p>
            ) : (
              item.movements.map((m: InventoryMovement) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Activity className={`w-4 h-4 ${movementTypeColor(m.type)} shrink-0`} />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        <span className={movementTypeColor(m.type)}>{m.type}</span>
                        {m.referenceId && <span className="text-slate-400 font-mono text-xs ml-2">#{m.referenceId}</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        By {m.performedBy?.name} · {new Date(m.createdAt).toLocaleString('en-IN')}
                      </p>
                      {m.remarks && <p className="text-xs text-slate-400 mt-0.5">{m.remarks}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{m.previousStock} → {m.newStock}</p>
                    <p className={`text-xs font-medium ${m.newStock > m.previousStock ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {m.newStock > m.previousStock ? '+' : ''}{m.newStock - m.previousStock} units
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Dispatches Tab */}
        {activeTab === 'dispatches' && (
          <div className="space-y-2">
            {(!item.dispatches || item.dispatches.length === 0) ? (
              <p className="text-sm text-slate-500 text-center py-6">No dispatch history</p>
            ) : (
              item.dispatches.map((d: any) => (
                <div key={d.id} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-brand-400 font-semibold">{d.dispatchNo}</span>
                    <Badge variant="danger">{d.status}</Badge>
                  </div>
                  <p className="text-sm text-slate-200"><span className="font-semibold">{d.site?.siteName}</span> · {d.site?.city}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Qty: {d.quantity} · {d.courierName || 'No courier'} · {d.trackingNo || 'No tracking'}
                  </p>
                  <p className="text-xs text-slate-500">By {d.createdBy?.name} · {new Date(d.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pickups Tab */}
        {activeTab === 'pickups' && (
          <div className="space-y-2">
            {(!item.pickups || item.pickups.length === 0) ? (
              <p className="text-sm text-slate-500 text-center py-6">No pickup history</p>
            ) : (
              item.pickups.map((p: any) => (
                <div key={p.id} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-emerald-400 font-semibold">{p.pickupNo}</span>
                    <Badge variant={p.receivedConfirmed ? 'success' : 'warning'}>{p.status}</Badge>
                  </div>
                  <p className="text-sm text-slate-200"><span className="font-semibold">{p.site?.siteName}</span> · {p.site?.city}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Qty: {p.quantity} · {p.courierName || 'No courier'} · {p.trackingNo || 'No tracking'}
                  </p>
                  {p.faultDescription && <p className="text-xs text-amber-400 mt-0.5">Fault: {p.faultDescription}</p>}
                  <p className="text-xs text-slate-500">By {p.createdBy?.name} · {new Date(p.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </Layout>
  );
};
