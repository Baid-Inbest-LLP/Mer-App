import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import ExpenseForm from '../../components/forms/ExpenseForm';
import PageBanner from '../../components/common/PageBanner';

export default function ExpenseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { current, loading } = useSelector((state) => state.expense);
  const { companies, loading: companiesLoading } = useSelector((state) => state.companies);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(fetchCompanies({ isActive: true, limit: 100 }));
  }, [dispatch]);

  useEffect(() => {
    if (isEdit) dispatch(fetchExpense(id));
    return () => dispatch(clearCurrent());
  }, [dispatch, id, isEdit]);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    const result = isEdit
      ? await dispatch(updateExpense({ id, ...data }))
      : await dispatch(createExpense(data));

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

  return (
    <>
      <PageBanner
        className="mb-4"
        title={
          isEdit
            ? current?.isDraft
              ? 'Edit Draft Entry'
              : 'Edit Expense Entry'
            : 'New Expense Entry'
        }
      />
      <ExpenseForm
        key={id}
        initialData={current}
        onSubmit={handleSubmit}
        loading={submitting}
        companies={companies}
        companiesLoading={companiesLoading}
      />
    </>
  );
}
