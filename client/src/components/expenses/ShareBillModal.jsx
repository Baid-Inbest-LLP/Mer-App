import { useEffect, useMemo, useState } from 'react';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import WhatsAppIcon from './WhatsAppIcon';
import { notifications } from '@mantine/notifications';
import { expenseApi } from '../../api/expense.api';
import Skeleton from '../common/Skeleton';
import { buildBillShareMessage, openWhatsAppShare } from '../../utils/whatsappShare';

function WhatsAppMessagePreview({ text }) {
  const nodes = [];
  const re = /(\*[^*]+\*|_[^_]+_)/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const inner = token.slice(1, -1);
    nodes.push(
      token.startsWith('*') ? (
        <strong key={key}>{inner}</strong>
      ) : (
        <em key={key}>{inner}</em>
      ),
    );
    key += 1;
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <div className="wa-chat__text">{nodes}</div>;
}

function formatNow() {
  return new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function ShareBillModal({ open, expense: seed, onClose }) {
  const [expense, setExpense] = useState(seed || null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return undefined;
    }

    setExpense(seed || null);

    const id = seed?._id;
    if (!id) return undefined;

    let cancelled = false;
    setLoading(true);
    expenseApi
      .get(id)
      .then(({ data }) => {
        if (!cancelled) setExpense(data?.data || seed);
      })
      .catch(() => {
        if (!cancelled) setExpense(seed || null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, seed]);

  const message = useMemo(() => buildBillShareMessage(expense), [expense]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      notifications.show({ message: 'Bill message copied', color: 'green' });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      notifications.show({ message: 'Could not copy message', color: 'red' });
    }
  };

  const handleShare = () => {
    if (!expense || expense.isDraft) {
      notifications.show({ message: 'Draft bills cannot be shared', color: 'red' });
      return;
    }
    openWhatsAppShare({ text: message });
  };

  return (
    <div className="share-bill-modal-overlay" onClick={onClose}>
      <div
        className={`share-bill-modal ${visible ? 'share-bill-modal--visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-bill-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-bill-modal__header">
          <div className="share-bill-modal__header-icon">
            <WhatsAppIcon size={20} />
          </div>
          <h2 id="share-bill-title" className="share-bill-modal__title">
            Share On Whatsapp
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="share-bill-modal__close"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="share-bill-modal__body">
          {loading && !expense ? (
            <Skeleton className="h-full min-h-[28rem] w-full rounded-none" />
          ) : expense ? (
            <div className="wa-chat" aria-label="WhatsApp message preview">
              <div className="wa-chat__thread">
                <div className="wa-chat__bubble">
                  <WhatsAppMessagePreview text={message} />
                  <span className="wa-chat__meta">
                    {formatNow()}
                    <svg className="wa-chat__ticks" viewBox="0 0 16 11" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M11.07 0.34L5.5 6.3 3.43 4.34 2.2 5.57l3.3 3.3 6.8-7.3z"
                      />
                      <path
                        fill="currentColor"
                        d="M14.57 0.34L9 6.3 8.2 5.5l-1.23 1.23 2.03 2.14 6.8-7.3z"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Could not load this bill.</p>
          )}
        </div>

        <div className="share-bill-modal__footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCopy}
            disabled={!message}
          >
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            className="whatsapp-share-btn flex-1 justify-center"
            onClick={handleShare}
            disabled={!expense || expense.isDraft || (loading && !message)}
          >
            <WhatsAppIcon size={18} />
            Send to Whatsapp
          </button>
        </div>
      </div>
    </div>
  );
}

export function useShareBill() {
  const [target, setTarget] = useState(null);

  return {
    openShare: (expense) => {
      if (!expense || expense.isDraft) {
        notifications.show({ message: 'Draft bills cannot be shared', color: 'amber' });
        return;
      }
      setTarget(expense);
    },
    shareModal: (
      <ShareBillModal open={Boolean(target)} expense={target} onClose={() => setTarget(null)} />
    ),
  };
}
