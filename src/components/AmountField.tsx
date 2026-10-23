import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { groupDigits, parseAmount } from '../core/format';
import type { LocalePack } from '../model/localePack';
import { useFormat } from '../app/context';

interface Props {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  pack: LocalePack;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** false 時不顯示預設的輸入提示（只顯示解讀結果或錯誤），讓外層統一顯示一次 */
  showHint?: boolean;
}

/** 金額輸入：支援「600萬」「35k」等寫法，並即時顯示解讀結果 */
export function AmountField({ value, onChange, pack, label, placeholder, autoFocus, showHint = true }: Props) {
  const { t } = useTranslation();
  const fmt = useFormat(pack);
  const id = useId();
  const [text, setText] = useState(value === undefined ? '' : groupDigits(String(value)));
  const inputRef = useRef<HTMLInputElement>(null);
  // 加上千分位後要放回的游標位置
  const caret = useRef<number | null>(null);

  // 外部改變數值（例如切換模式）時同步文字
  useEffect(() => {
    const parsed = parseAmount(text, pack.inputUnitAliases);
    if ((parsed ?? undefined) !== value) setText(value === undefined ? '' : groupDigits(String(value)));
  }, [value]);

  useLayoutEffect(() => {
    if (caret.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [text]);

  const parsed = parseAmount(text, pack.inputUnitAliases);
  const invalid = text.trim() !== '' && parsed === null;

  return (
    <div className="amount-field">
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        ref={inputRef}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder ?? t('amount.placeholder')}
        value={text}
        aria-invalid={invalid}
        onChange={(e) => {
          const raw = e.target.value;
          const shown = groupDigits(raw);
          if (shown !== raw) {
            // 游標前有幾個非逗號字元，加上千分位後就放在同樣的字元之後
            const before = raw.slice(0, e.target.selectionStart ?? raw.length).replace(/[,\s，]/g, '').length;
            let pos = 0;
            for (let n = 0; pos < shown.length && n < before; pos++) if (shown[pos] !== ',') n++;
            caret.current = pos;
          }
          setText(shown);
          const v = parseAmount(raw, pack.inputUnitAliases);
          onChange(v ?? undefined);
        }}
      />
      <div className={invalid ? 'field-hint error' : 'field-hint'}>
        {invalid ? t('amount.invalid') : parsed !== null && parsed >= 10_000 ? `= ${fmt.money(parsed)}` : showHint ? t('amount.hint') : ''}
      </div>
    </div>
  );
}
