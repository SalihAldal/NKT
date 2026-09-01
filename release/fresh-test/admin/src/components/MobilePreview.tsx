interface MobilePreviewProps {
  type: string;
  prompt: string;
  difficulty: number;
}

export function MobilePreview({ type, prompt, difficulty }: MobilePreviewProps) {
  const badge = type === 'challenge' ? '🔥 GÖREV' : type === 'performance' ? '🎭 PERFORMANS' : '🧠 SORU';
  return (
    <div className="mobile-preview">
      <div className="preview-phone">
        <div className="preview-header">NKT Oyun Önizleme</div>
        <div className="preview-body">
          <span className="preview-badge">{badge}</span>
          <p className="preview-prompt">{prompt || 'Prompt burada görünür...'}</p>
          <span className="preview-meta">Zorluk: {difficulty} · {type}</span>
          {type === 'question' ? (
            <div className="preview-options">
              <button type="button" className="preview-opt">Seçenek A</button>
              <button type="button" className="preview-opt">Seçenek B</button>
            </div>
          ) : (
            <button type="button" className="preview-cta">Tamamladım ✓</button>
          )}
        </div>
      </div>
    </div>
  );
}
