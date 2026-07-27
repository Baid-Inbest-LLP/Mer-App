import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader, Center } from '@mantine/core';
import { useDispatch, useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import {
  createExpense,
  updateExpense,
  fetchExpense,
  clearCurrent,
} from '../../store/slices/expenseSlice';
import { fetchCompanies } from '../../store/slices/companiesSlice';
import { purchaseOrderApi } from '../../api/purchaseOrder.api';
import ExpenseForm from '../../components/forms/ExpenseForm';
import PageBanner from '../../components/common/PageBanner';

export default function ExpenseFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const fromPoId = searchParams.get('fromPo');
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { current, loading } = useSelector((state) => state.expense);
  const { companies, loading: companiesLoading } = useSelector((state) => state.companies);
  const [submitting, setSubmitting] = useState(false);
  const [poDraft, setPoDraft] = useState(null);
  const [poMeta, setPoMeta] = useState(null);
  const [loadedPoId, setLoadedPoId] = useState(null);
  const poDraftLoading = Boolean(fromPoId) && !isEdit && loadedPoId !== fromPoId;

  useEffect(() => {
    dispatch(fetchCompanies({ isActive: true, limit: 100 }));
  }, [dispatch]);

  useEffect(() => {
    if (isEdit) dispatch(fetchExpense(id));
    return () => dispatch(clearCurrent());
  }, [dispatch, id, isEdit]);

  useEffect(() => {
    if (isEdit || !fromPoId) return undefined;

    let cancelled = false;

    purchaseOrderApi
      .getExpenseDraft(fromPoId)
      .then(({ data }) => {
        if (cancelled) return;
        setPoDraft(data.data.draft);
        setPoMeta(data.data.po);
        setLoadedPoId(fromPoId);
      })
      .catch((err) => {
        if (cancelled) return;
        notifications.show({
          message: err.response?.data?.message || 'Failed to load purchase order',
          color: 'red',
        });
        navigate('/entries', { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [fromPoId, isEdit, navigate]);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    const payload = poDraft
      ? {
          ...data,
          purchaseOrderId: poDraft.purchaseOrderId,
          poNumber: poDraft.poNumber,
          source: 'purchase_order',
          vendor: data.vendor || poDraft.vendor,
        }
      : data;

    const result = isEdit
      ? await dispatch(updateExpense({ id, ...payload }))
      : await dispatch(createExpense(payload));

    setSubmitting(false);
    if (createExpense.fulfilled.match(result) || updateExpense.fulfilled.match(result)) {
      const saved = result.payload;

      if (data.isDraft) {
        notifications.show({ message: 'Draft saved', color: 'green' });
        navigate(`/entries/${saved._id}/edit`);
        return;
      }

      notifications.show({
        message: isEdit
          ? current?.isDraft
            ? 'Entry submitted — pending admin approval'
            : 'Entry updated'
          : poDraft
            ? `Expense created from PO ${poDraft.poNumber} — pending admin approval`
            : 'Entry submitted — pending admin approval',
        color: 'green',
      });
      navigate('/entries');
    } else {
      notifications.show({
        message: result.payload || 'Save failed',
        color: 'red',
      });
    }
  };

  if (isEdit && (loading || !current || current._id !== id)) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (!isEdit && poDraftLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  const formInitialData = isEdit ? current : poDraft;

  return (
    <>
      <PageBanner
        className="mb-4"
        title={
          isEdit
            ? current?.isDraft
              ? 'Edit Draft Expense'
              : 'Edit Expense'
            : poMeta
              ? `New Expense/Bill from PO ${poMeta.poNumber}`
              : 'New Expense/Bill'
        }
        subtitle={
          poMeta
            ? `Vendor: ${poMeta.vendor || '—'} · Amount: ₹${Number(poMeta.totalAmount || 0).toLocaleString('en-IN')}`
            : undefined
        }
      />
      <ExpenseForm
        key={id || fromPoId || 'new'}
        initialData={formInitialData}
        onSubmit={handleSubmit}
        loading={submitting}
        companies={companies}
        companiesLoading={companiesLoading}
      />
    </>
  );
}
