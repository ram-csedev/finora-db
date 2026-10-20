import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  PlusCircle,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  Users,
  ShieldCheck,
  Building,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  X,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Percent,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input, Select } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { api } from '../api/client';
import { Account, AccountHolder, Branch, Customer, Nominee } from '../types';

export const AccountsPage: React.FC = () => {
  // State: Data & Filtering
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');

  // Status & Loading
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [isOpenAccountModal, setIsOpenAccountModal] = useState(false);
  const [isDetailsModal, setIsDetailsModal] = useState(false);
  const [isEditStatusModal, setIsEditStatusModal] = useState(false);
  const [isDeleteModal, setIsDeleteModal] = useState(false);

  // Active / Selected Account
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountHolders, setAccountHolders] = useState<AccountHolder[]>([]);
  const [accountNominees, setAccountNominees] = useState<Nominee[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Form State: Open New Account
  const [createForm, setCreateForm] = useState({
    b_id: '',
    cid: '',
    acc_type: 'SAVINGS',
    balance: '1000.00',
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form State: Add Joint Holder
  const [newHolderCid, setNewHolderCid] = useState('');
  const [newHolderRole, setNewHolderRole] = useState<'JOINT' | 'SECONDARY' | 'GUARDIAN'>('JOINT');
  const [newHolderShare, setNewHolderShare] = useState('50.00');
  const [isAddingHolder, setIsAddingHolder] = useState(false);

  // Form State: Edit Account Status
  const [editStatus, setEditStatus] = useState<Account['status']>('ACTIVE');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Delete State
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load auxiliary lists (branches & customers for selectors)
  useEffect(() => {
    async function loadAux() {
      try {
        const [bRes, cRes] = await Promise.all([
          api.listBranches({ limit: 50 }).catch(() => ({ data: [] })),
          api.listCustomers({ limit: 100 }).catch(() => ({ data: [] })),
        ]);
        setBranches(bRes.data || []);
        setCustomers(cRes.data || []);
        if (bRes.data?.length > 0 && !createForm.b_id) {
          setCreateForm((prev) => ({ ...prev, b_id: String(bRes.data[0].b_id) }));
        }
        if (cRes.data?.length > 0 && !createForm.cid) {
          setCreateForm((prev) => ({ ...prev, cid: String(cRes.data[0].cid) }));
        }
      } catch (err) {
        // non-blocking
      }
    }
    loadAux();
  }, []);

  // Fetch Accounts with pagination & filtering
  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: currentPage,
        limit: pageSize,
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedBranchId && selectedBranchId !== 'all') params.b_id = selectedBranchId;
      if (selectedStatus && selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedType && selectedType !== 'all') params.acc_type = selectedType;

      const res = await api.listAccounts(params);
      setAccounts(res.data || []);
      setTotalRecords(Number(res.pagination?.totalRecords) || 0);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load accounts.' });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, selectedBranchId, selectedStatus, selectedType]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Open Details Modal & fetch M:N account holders
  const openDetails = async (acc: Account) => {
    setSelectedAccount(acc);
    setIsDetailsModal(true);
    setIsLoadingDetails(true);
    setNewHolderCid(customers[0]?.cid ? String(customers[0].cid) : '');
    try {
      const [holdersRes, nomineesRes] = await Promise.all([
        api.listAccountHolders({ acc_id: acc.acc_id }).catch(() => ({ data: [] })),
        api.get<any>('/entities/nominee', { acc_id: acc.acc_id }).catch(() => ({ data: [] })),
      ]);
      setAccountHolders(holdersRes.data || []);
      setAccountNominees(nomineesRes.data || []);
    } catch (err) {
      // non-blocking
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Add Joint Account Holder (Demonstrates M:N relationship)
  const handleAddJointHolder = async () => {
    if (!selectedAccount || !newHolderCid) return;
    setIsAddingHolder(true);
    try {
      await api.createAccountHolder({
        acc_id: selectedAccount.acc_id,
        cid: newHolderCid,
        ownership_role: newHolderRole,
        is_primary: false,
        share_percentage: parseFloat(newHolderShare) || 50.0,
      });
      // Refresh holders
      const res = await api.listAccountHolders({ acc_id: selectedAccount.acc_id });
      setAccountHolders(res.data || []);
      setStatusMessage({ type: 'success', text: `Added customer CUST-${newHolderCid} as joint holder on ACC-${selectedAccount.acc_id}.` });
    } catch (err: any) {
      alert(err.message || 'Failed to attach joint holder.');
    } finally {
      setIsAddingHolder(false);
    }
  };

  // Submit Open Account
  const handleOpenAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCreate(true);
    setCreateError(null);
    try {
      if (!createForm.b_id) throw new Error('Please select a home branch.');
      if (!createForm.cid) throw new Error('Please select a primary customer holder.');

      const bal = parseFloat(createForm.balance) || 0;
      if (bal < 0) throw new Error('Initial balance cannot be negative.');

      // 1. Create account record
      const accRes = await api.createAccount({
        b_id: createForm.b_id,
        acc_type: createForm.acc_type,
        balance: bal,
        status: 'ACTIVE',
      });

      const newAccId = accRes.data?.acc_id;

      // 2. Link primary account holder in account_holder table
      if (newAccId) {
        await api.createAccountHolder({
          acc_id: String(newAccId),
          cid: createForm.cid,
          ownership_role: 'PRIMARY',
          is_primary: true,
          share_percentage: 100.0,
        });
      }

      setIsOpenAccountModal(false);
      setStatusMessage({ type: 'success', text: `Account ACC-${newAccId || 'CREATED'} opened successfully.` });
      fetchAccounts();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to open account.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Update Account Status
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setIsSubmittingStatus(true);
    try {
      await api.updateAccount(selectedAccount.acc_id, { status: editStatus });
      setIsEditStatusModal(false);
      setStatusMessage({ type: 'success', text: `Account ACC-${selectedAccount.acc_id} status updated to ${editStatus}.` });
      fetchAccounts();
    } catch (err: any) {
      alert(err.message || 'Failed to update account status.');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Delete Account
  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete<any>(`/accounts/${selectedAccount.acc_id}`);
      setIsDeleteModal(false);
      setStatusMessage({ type: 'success', text: `Account ACC-${selectedAccount.acc_id} deleted successfully.` });
      fetchAccounts();
    } catch (err: any) {
      setDeleteError(err.message || 'Deletion rejected. Account must have zero balance and zero transaction history.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getBranchName = (bId?: string) => {
    const b = branches.find((branch) => String(branch.b_id) === String(bId));
    return b ? `${b.branch_name} (${b.city})` : `Branch #${bId || '—'}`;
  };

  const getCustomerName = (cid?: string) => {
    const c = customers.find((cust) => String(cust.cid) === String(cid));
    return c ? `${c.first_name} ${c.last_name || ''} (CUST-${c.cid})` : `Customer #${cid || '—'}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Alert Banner */}
      {statusMessage && (
        <div
          className={`px-4 py-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-obsidian-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            Accounts & Joint Ownership
          </h2>
          <p className="text-xs text-obsidian-400 mt-1">
            Deposit portfolios, status lifecycles, and M:N joint account holdings in CockroachDB
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchAccounts}
            disabled={isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCreateError(null);
              setIsOpenAccountModal(true);
            }}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            Open Account
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 border-obsidian-750">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Input
              icon={<Search className="w-4 h-4 text-obsidian-400" />}
              placeholder="Search account type, status..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div>
            <Select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.b_id} value={b.b_id}>
                  {b.branch_name} ({b.city})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Account Types</option>
              <option value="SAVINGS">SAVINGS</option>
              <option value="CURRENT">CURRENT</option>
              <option value="SALARY">SALARY</option>
              <option value="FIXED_DEPOSIT">FIXED_DEPOSIT</option>
            </Select>
          </div>

          <div>
            <Select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DORMANT">DORMANT</option>
              <option value="FROZEN">FROZEN</option>
              <option value="CLOSED">CLOSED</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Accounts Data Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <CardTitle>Account Portfolio</CardTitle>
              <Badge variant="emerald" size="xs">
                {totalRecords} Total Accounts
              </Badge>
            </div>
            <div className="text-xs text-obsidian-400 font-mono">
              Page {currentPage} of {totalPages || 1}
            </div>
          </div>
        </CardHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account No.</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Branch Office</TableHead>
              <TableHead>Balance (INR)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Opened Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-obsidian-400 text-xs">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>Loading account ledgers from CockroachDB...</span>
                  </div>
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <TableEmpty message="No banking accounts match the selected filters." colSpan={7} />
            ) : (
              accounts.map((acc) => (
                <TableRow key={acc.acc_id}>
                  <TableCell className="font-mono font-semibold text-cyan-400">
                    ACC-{acc.acc_id}
                  </TableCell>
                  <TableCell>
                    <Badge variant={acc.acc_type === 'SAVINGS' ? 'cyan' : acc.acc_type === 'CURRENT' ? 'violet' : 'amber'} size="xs">
                      {acc.acc_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-obsidian-200 text-xs">
                    {getBranchName(acc.b_id)}
                  </TableCell>
                  <TableCell className="font-mono font-bold text-emerald-400 text-sm">
                    ₹{parseFloat(String(acc.balance)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={acc.status === 'ACTIVE' ? 'emerald' : acc.status === 'DORMANT' ? 'amber' : 'rose'}
                      size="xs"
                      dot
                    >
                      {acc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-obsidian-400 font-mono">
                    {acc.created_at ? new Date(acc.created_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openDetails(acc)}
                        className="p-1.5 rounded-lg text-obsidian-400 hover:text-cyan-400 hover:bg-obsidian-800 transition-colors"
                        title="View Holders & Nominees"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAccount(acc);
                          setEditStatus(acc.status);
                          setIsEditStatusModal(true);
                        }}
                        className="p-1.5 rounded-lg text-obsidian-400 hover:text-amber-400 hover:bg-obsidian-800 transition-colors"
                        title="Change Account Status"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAccount(acc);
                          setDeleteError(null);
                          setIsDeleteModal(true);
                        }}
                        className="p-1.5 rounded-lg text-obsidian-400 hover:text-rose-400 hover:bg-obsidian-800 transition-colors"
                        title="Close / Delete Account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-obsidian-900/60 border-t border-obsidian-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-obsidian-400">
          <div className="flex items-center gap-3">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-obsidian-800 border border-obsidian-700 rounded px-2 py-1 text-obsidian-200 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              Showing {accounts.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
              {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} accounts
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1 || isLoading}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <span className="font-mono px-2 text-obsidian-200">
              {currentPage} / {totalPages || 1}
            </span>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages || isLoading}
              iconRight={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW DETAILS & JOINT ACCOUNT HOLDERS (M:N RELATION) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDetailsModal}
        onClose={() => setIsDetailsModal(false)}
        title={`Account Structure: ACC-${selectedAccount?.acc_id}`}
        description="M:N Joint Ownership relation (account_holder) & Nominee succession designations"
        size="lg"
      >
        {selectedAccount && (
          <div className="space-y-6">
            {/* Account Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-obsidian-950 border border-obsidian-800">
              <div>
                <span className="text-[10px] uppercase font-mono text-obsidian-500">Balance</span>
                <p className="text-base font-mono font-bold text-emerald-400">
                  ₹{parseFloat(String(selectedAccount.balance)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-obsidian-500">Account Type</span>
                <p className="text-xs font-semibold text-white">{selectedAccount.acc_type}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-obsidian-500">Branch</span>
                <p className="text-xs text-obsidian-200">{getBranchName(selectedAccount.b_id)}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-obsidian-500">Status</span>
                <div>
                  <Badge variant={selectedAccount.status === 'ACTIVE' ? 'emerald' : 'amber'} size="xs" dot>
                    {selectedAccount.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Account Holders (M:N account_holder) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  Account Holders (account_holder M:N)
                </h4>
                <span className="text-[11px] text-obsidian-400 font-mono">
                  {accountHolders.length} Registered Holders
                </span>
              </div>

              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-3">
                <div className="space-y-2">
                  {accountHolders.map((h, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-obsidian-900 border border-obsidian-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-300 font-semibold">CUST-{h.cid}</span>
                        <span className="text-white font-medium">{getCustomerName(h.cid)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={h.is_primary ? 'emerald' : 'violet'} size="xs">
                          {h.ownership_role}
                        </Badge>
                        <span className="text-obsidian-400 font-mono text-[11px]">
                          {h.share_percentage}% Share
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inline Add Joint Holder */}
                <div className="pt-3 border-t border-obsidian-800/80 space-y-2">
                  <span className="text-[11px] font-semibold text-obsidian-300">
                    Add Joint Holder to Account (Demonstrates M:N Relationship):
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <Select
                      value={newHolderCid}
                      onChange={(e) => setNewHolderCid(e.target.value)}
                      className="text-xs py-1"
                    >
                      {customers.map((c) => (
                        <option key={c.cid} value={c.cid}>
                          {c.first_name} {c.last_name || ''} (CUST-{c.cid})
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={newHolderRole}
                      onChange={(e) => setNewHolderRole(e.target.value as any)}
                      className="text-xs py-1"
                    >
                      <option value="JOINT">JOINT</option>
                      <option value="SECONDARY">SECONDARY</option>
                      <option value="GUARDIAN">GUARDIAN</option>
                    </Select>
                    <Input
                      placeholder="Share % (e.g. 50)"
                      value={newHolderShare}
                      onChange={(e) => setNewHolderShare(e.target.value)}
                      className="text-xs py-1"
                    />
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={handleAddJointHolder}
                      disabled={isAddingHolder || !newHolderCid}
                    >
                      {isAddingHolder ? 'Attaching...' : 'Add Holder'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Nominees */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                Nominee Designations (nominee 1:N)
              </h4>
              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                {accountNominees.length === 0 ? (
                  <p className="text-xs text-obsidian-500 italic">No nominee currently assigned to this account.</p>
                ) : (
                  <div className="space-y-1.5">
                    {accountNominees.map((n, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-obsidian-800/60 last:border-0">
                        <span className="text-white font-medium">{n.first_name} {n.last_name || ''}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-obsidian-400 font-mono text-[11px]">{n.relationship}</span>
                          <span className="text-obsidian-400 font-mono text-[11px]">{n.contact_phone || '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: OPEN NEW ACCOUNT */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isOpenAccountModal}
        onClose={() => setIsOpenAccountModal(false)}
        title="Open New Banking Account"
        description="Creates a deposit account and links primary ownership in CockroachDB"
        size="md"
      >
        <form onSubmit={handleOpenAccount} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}

          <Select
            label="Home Branch *"
            value={createForm.b_id}
            onChange={(e) => setCreateForm({ ...createForm, b_id: e.target.value })}
            required
          >
            {branches.map((b) => (
              <option key={b.b_id} value={b.b_id}>
                {b.branch_name} ({b.city}) — IFSC: {b.ifsc}
              </option>
            ))}
          </Select>

          <Select
            label="Primary Customer Holder *"
            value={createForm.cid}
            onChange={(e) => setCreateForm({ ...createForm, cid: e.target.value })}
            required
          >
            {customers.map((c) => (
              <option key={c.cid} value={c.cid}>
                {c.first_name} {c.last_name || ''} (CUST-{c.cid}, PAN: {c.pan})
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Account Type *"
              value={createForm.acc_type}
              onChange={(e) => setCreateForm({ ...createForm, acc_type: e.target.value })}
            >
              <option value="SAVINGS">SAVINGS</option>
              <option value="CURRENT">CURRENT</option>
              <option value="SALARY">SALARY</option>
              <option value="FIXED_DEPOSIT">FIXED_DEPOSIT</option>
            </Select>

            <Input
              label="Initial Deposit Balance (INR) *"
              type="number"
              step="0.01"
              min="0"
              value={createForm.balance}
              onChange={(e) => setCreateForm({ ...createForm, balance: e.target.value })}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-obsidian-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsOpenAccountModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmittingCreate}>
              Open Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT ACCOUNT STATUS */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditStatusModal}
        onClose={() => setIsEditStatusModal(false)}
        title={`Update Status: ACC-${selectedAccount?.acc_id}`}
        description="Update operational lifecycle state of the account"
        size="sm"
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          <Select
            label="Operational Status"
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value as any)}
          >
            <option value="ACTIVE">ACTIVE (Normal Operations)</option>
            <option value="DORMANT">DORMANT (Inactivity Flag)</option>
            <option value="FROZEN">FROZEN (Security Hold)</option>
            <option value="CLOSED">CLOSED (Terminated)</option>
          </Select>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-obsidian-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsEditStatusModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmittingStatus}>
              Save Status
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION & LIFECYCLE MANAGEMENT (CLOSE / DELETE) */}
      {/* ========================================================================= */}
      {selectedAccount && (
        <DeleteConfirmModal
          isOpen={isDeleteModal}
          onClose={() => setIsDeleteModal(false)}
          entityType="account"
          entityId={String(selectedAccount.acc_id)}
          entityTitle={`Account ACC-${selectedAccount.acc_id} (${selectedAccount.acc_type})`}
          onSuccess={(msg) => {
            setStatusMessage({ type: 'success', text: msg });
            fetchAccounts();
          }}
        />
      )}
    </div>
  );
};
