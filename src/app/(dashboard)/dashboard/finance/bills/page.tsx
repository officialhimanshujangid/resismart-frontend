"use client";

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, Filter, TrendingUp, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';

export default function FinanceDashboardBills() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalBilled: 0, totalCollected: 0, overdueCount: 0, overdueAmount: 0 });
  const [bills, setBills] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');

  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sumRes, billsRes] = await Promise.all([
        api.get('/finance/society/bills/summary', { params: { period } }),
        api.get('/finance/society/bills', { params: { period } })
      ]);
      setSummary(sumRes.data);
      setBills(billsRes.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch financial data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBills = async () => {
    if (!window.confirm(`Are you sure you want to generate bills for ${period}? This action cannot be easily undone.`)) {
      return;
    }

    try {
      setGenerating(true);
      const res = await api.post('/finance/society/bills/generate', { period });
      toast.success(`Generated ${res.data.created} bills. Skipped ${res.data.skipped} existing.`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate bills');
    } finally {
      setGenerating(false);
    }
  };

  const filteredBills = bills.filter((b: any) =>
    b.flatNumber.toLowerCase().includes(search.toLowerCase()) ||
    b.billNumber.toLowerCase().includes(search.toLowerCase()) ||
    b.primaryOwnerName?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Paid</Badge>;
      case 'PARTIALLY_PAID': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Partially Paid</Badge>;
      case 'PENDING_CONFIRMATION': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Confirming</Badge>;
      case 'UNPAID': return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Unpaid</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-auto mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bills & Collections</h1>
          <p className="text-slate-500 mt-1">Manage society invoices and track collections</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-40"
          />
          <Button onClick={handleGenerateBills} disabled={generating || loading}>
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Generate Bills
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Billed</p>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">₹{(summary.totalBilled / 100).toLocaleString('en-IN')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground">Collected</p>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-green-600">₹{(summary.totalCollected / 100).toLocaleString('en-IN')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground">Overdue Amount</p>
                  <TrendingUp className="h-4 w-4 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-red-600">₹{(summary.overdueAmount / 100).toLocaleString('en-IN')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground">Overdue Invoices</p>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-red-600">{summary.overdueCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row justify-between items-center bg-slate-50/50">
              <CardTitle className="text-lg">Invoices ({filteredBills.length})</CardTitle>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by flat, bill #..."
                  className="pl-8 w-[250px]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredBills.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No bills found for the selected period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground bg-slate-50/80 border-b uppercase">
                      <tr>
                        <th className="px-6 py-4 font-medium">Flat</th>
                        <th className="px-6 py-4 font-medium">Bill Number</th>
                        <th className="px-6 py-4 font-medium">Description</th>
                        <th className="px-6 py-4 font-medium">Due Date</th>
                        <th className="px-6 py-4 font-medium">Amount</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredBills.map((bill: any) => (
                        <tr key={bill._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{bill.flatNumber}</td>
                          <td className="px-6 py-4 font-mono text-slate-500">{bill.billNumber}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-700">{bill.billTemplateName}</div>
                            <div className="text-xs text-muted-foreground">{bill.category}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {new Date(bill.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="px-6 py-4 font-medium">
                            ₹{(bill.totalAmountPaise / 100).toLocaleString('en-IN')}
                            {bill.lateFeeAmountPaise > 0 && <span className="text-red-500 text-xs ml-1">(+LF)</span>}
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(bill.status)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 hover:bg-blue-50">View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
