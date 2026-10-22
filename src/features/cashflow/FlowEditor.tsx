import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../app/context';
import { CategoryPicker, ChipPicker, EditorShell, LabelField, MoneyField, Toggle } from '../../components/EditorParts';
import { blankToUnknown } from '../../core/estimate';
import type { ExpenseCategory, ExpenseItem, Frequency, IncomeCategory, IncomeItem } from '../../model/types';

const FREQUENCIES: Frequency[] = ['monthly', 'yearly', 'quarterly', 'weekly'];
/** 預設為非必要的支出類別 */
const NON_ESSENTIAL: ExpenseCategory[] = ['leisure_travel', 'shopping'];

type Draft<T> = Omit<T, 'id' | 'householdId' | 'createdAt' | 'updatedAt'>;

export function flowName(item: IncomeItem | ExpenseItem, kind: 'income' | 'expense', t: (k: string) => string): string {
  return item.label || t(`category.${kind}.${item.category}`);
}

export function FlowEditor({ kind }: { kind: 'income' | 'expense' }) {
  const { id } = useParams();
  return kind === 'income' ? <IncomeEditor id={id} /> : <ExpenseEditor id={id} />;
}

function FrequencyPicker({ value, onChange }: { value: Frequency; onChange: (f: Frequency) => void }) {
  const { t } = useTranslation();
  return (
    <ChipPicker legend={t('cashflow.frequency')} options={FREQUENCIES.map((f) => ({ key: f, label: t(`frequency.${f}`) }))} value={value} onChange={onChange} />
  );
}

function IncomeEditor({ id }: { id?: string }) {
  const { data, pack, repo } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const existing = id ? data.incomes.find((x) => x.id === id && !x.archivedAt) : undefined;
  const [draft, setDraft] = useState<Draft<IncomeItem>>(
    () =>
      existing ?? {
        ownerId: 'joint',
        category: 'salary',
        amount: { estimate: { mode: 'range', low: 0, high: 0 }, currency: pack.baseCurrency },
        frequency: 'monthly',
        isRecurring: true,
        basis: 'net',
      },
  );
  if (id && !existing) return <Navigate to="/cashflow" replace />;

  const setCategory = (category: IncomeCategory) =>
    setDraft((d) => ({ ...d, category, isRecurring: category !== 'bonus', frequency: category === 'bonus' ? 'yearly' : d.frequency }));

  return (
    <EditorShell
      title={existing ? flowName(existing, 'income', t) : t('cashflow.add.income')}
      onSave={async () => {
        await repo.saveIncome(data.household.id, { ...draft, amount: { ...draft.amount, estimate: blankToUnknown(draft.amount.estimate) }, id: existing?.id });
        navigate('/cashflow');
      }}
      onDelete={
        existing
          ? async () => {
              if (!confirm(t('editor.confirmDelete'))) return;
              await repo.archiveIncome(existing.id);
              navigate('/cashflow');
            }
          : undefined
      }
    >
      <CategoryPicker defs={pack.categories.income} value={draft.category} onChange={setCategory} />
      <LabelField value={draft.label} onChange={(label) => setDraft((d) => ({ ...d, label }))} placeholder={t('cashflow.labelPlaceholder.income')} />
      <FrequencyPicker value={draft.frequency} onChange={(frequency) => setDraft((d) => ({ ...d, frequency }))} />
      <MoneyField
        label={t(`cashflow.amountPer.${draft.frequency}`)}
        hint={t('cashflow.netHint')}
        value={draft.amount}
        onChange={(amount) => setDraft((d) => ({ ...d, amount }))}
        bracketsKey={draft.frequency === 'monthly' ? 'monthly_income' : undefined}
      />
      <Toggle
        checked={draft.isRecurring}
        onChange={(isRecurring) => setDraft((d) => ({ ...d, isRecurring }))}
        label={t('cashflow.recurring')}
        hint={t('cashflow.recurringHint')}
      />
    </EditorShell>
  );
}

function ExpenseEditor({ id }: { id?: string }) {
  const { data, pack, repo } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const existing = id ? data.expenses.find((x) => x.id === id && !x.archivedAt) : undefined;
  const [draft, setDraft] = useState<Draft<ExpenseItem>>(
    () =>
      existing ?? {
        ownerId: 'joint',
        category: 'food',
        amount: { estimate: { mode: 'range', low: 0, high: 0 }, currency: pack.baseCurrency },
        frequency: 'monthly',
        essential: true,
      },
  );
  if (id && !existing) return <Navigate to="/cashflow" replace />;

  const setCategory = (category: ExpenseCategory) =>
    setDraft((d) => ({
      ...d,
      category,
      essential: !NON_ESSENTIAL.includes(category),
      frequency: category === 'annual_irregular' ? 'yearly' : d.frequency,
    }));

  return (
    <EditorShell
      title={existing ? flowName(existing, 'expense', t) : t('cashflow.add.expense')}
      onSave={async () => {
        await repo.saveExpense(data.household.id, { ...draft, amount: { ...draft.amount, estimate: blankToUnknown(draft.amount.estimate) }, id: existing?.id });
        navigate('/cashflow');
      }}
      onDelete={
        existing
          ? async () => {
              if (!confirm(t('editor.confirmDelete'))) return;
              await repo.archiveExpense(existing.id);
              navigate('/cashflow');
            }
          : undefined
      }
    >
      <CategoryPicker defs={pack.categories.expense} value={draft.category} onChange={setCategory} />
      {draft.category === 'housing' && <p className="muted small">{t('cashflow.housingHint')}</p>}
      {draft.category === 'insurance' && <p className="muted small">{t('cashflow.insuranceHint')}</p>}
      <LabelField value={draft.label} onChange={(label) => setDraft((d) => ({ ...d, label }))} placeholder={t('cashflow.labelPlaceholder.expense')} />
      <FrequencyPicker value={draft.frequency} onChange={(frequency) => setDraft((d) => ({ ...d, frequency }))} />
      <MoneyField
        label={t(`cashflow.amountPer.${draft.frequency}`)}
        value={draft.amount}
        onChange={(amount) => setDraft((d) => ({ ...d, amount }))}
        bracketsKey={draft.frequency === 'monthly' ? 'monthly_expense' : undefined}
      />
      <Toggle
        checked={draft.essential}
        onChange={(essential) => setDraft((d) => ({ ...d, essential }))}
        label={t('cashflow.essential')}
        hint={t('cashflow.essentialHint')}
      />
    </EditorShell>
  );
}
