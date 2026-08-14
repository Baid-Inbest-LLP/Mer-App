import WhatsAppIcon from './WhatsAppIcon';

export default function WhatsAppShareButton({
  onClick,
  disabled = false,
  withLabel = false,
  className = '',
}) {
  if (withLabel) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`whatsapp-share-btn ${className}`}
        title="Share Via Whatsapp"
        aria-label="Share Via Whatsapp"
      >
        <WhatsAppIcon size={18} />
        Share Via Whatsapp
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`whatsapp-share-icon-btn ${className}`}
      title="Share Via Whatsapp"
      aria-label="Share Via Whatsapp"
    >
      <WhatsAppIcon size={18} />
    </button>
  );
}
