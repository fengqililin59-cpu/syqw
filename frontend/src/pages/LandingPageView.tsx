import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicLandingPage, recordLandingView, submitLandingForm, type LandingPageRecord, type LandingSection, type FormField } from '@/api/landingPage';

export default function LandingPageView() {
  const { slug } = useParams<{ slug: string }>();
  const [lp, setLp] = useState<LandingPageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const data = await fetchPublicLandingPage(slug);
        setLp(data);
        document.title = data.meta_title || data.title || 'ZhiFlow';
        if (data.favicon_url) {
          const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (link) link.href = data.favicon_url;
        }
        recordLandingView(slug).catch(() => {});
      } catch (e: any) {
        setError(e?.message || '页面加载失败');
      } finally { setLoading(false); }
    })();

    return () => { document.title = 'ZhiFlow CRM'; };
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lp) return;
    setSubmitting(true);
    try {
      await submitLandingForm(lp.slug, formData);
      setSubmitted(true);
    } catch (e: any) {
      alert(e?.message || '提交失败');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#9CA3AF' }}>加载中...</div>;
  if (error) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#EF4444', flexDirection: 'column' }}><h1>404</h1><p>{error}</p></div>;
  if (!lp) return null;

  const renderSection = (s: LandingSection) => {
    const bg = s.backgroundColor || '#ffffff';
    const tc = s.textColor || '#1F2937';

    switch (s.type) {
      case 'hero':
        return (
          <section style={{ background: bg, color: tc, padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ maxWidth: 700, margin: '0 auto' }}>
              {lp.logo_url && <img src={lp.logo_url} alt="" style={{ height: 40, marginBottom: 24 }} />}
              {s.title && <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 16px', lineHeight: 1.3 }}>{s.title}</h1>}
              {s.subtitle && <p style={{ fontSize: 18, opacity: 0.85, margin: '0 0 32px', lineHeight: 1.6 }}>{s.subtitle}</p>}
              {s.content && <a href="#form-section" style={{ display: 'inline-block', background: lp.primary_color, color: '#fff', textDecoration: 'none', padding: '14px 36px', borderRadius: 8, fontSize: 17, fontWeight: 600 }}>{s.content}</a>}
              {s.imageUrl && <img src={s.imageUrl} alt="" style={{ maxWidth: '100%', marginTop: 32, borderRadius: 12 }} />}
            </div>
          </section>
        );
      case 'features':
        return (
          <section style={{ background: bg, color: tc, padding: '64px 24px' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
              {s.title && <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', margin: '0 0 8px' }}>{s.title}</h2>}
              {s.subtitle && <p style={{ textAlign: 'center', opacity: 0.7, margin: '0 0 40px', fontSize: 15 }}>{s.subtitle}</p>}
              {s.items && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                  {s.items.map((item, i) => (
                    <div key={i} style={{ padding: 24, background: 'rgba(0,0,0,0.03)', borderRadius: 12, textAlign: 'center' }}>
                      <h4 style={{ margin: '0 0 8px', fontSize: 16 }}>{item.title}</h4>
                      <p style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>{item.description}</p>
                    </div>
                  ))}
                </div>
              )}
              {s.imageUrl && <img src={s.imageUrl} alt="" style={{ maxWidth: '100%', marginTop: 24, borderRadius: 12 }} />}
            </div>
          </section>
        );
      case 'form':
        return (
          <section id="form-section" style={{ background: bg, color: tc, padding: '64px 24px' }}>
            <div style={{ maxWidth: 500, margin: '0 auto' }}>
              {s.title && <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', margin: '0 0 8px' }}>{s.title}</h2>}
              {s.subtitle && <p style={{ textAlign: 'center', opacity: 0.7, margin: '0 0 32px', fontSize: 15 }}>{s.subtitle}</p>}
              {!lp.enable_form ? (
                <p style={{ textAlign: 'center', color: '#9CA3AF' }}>表单已关闭</p>
              ) : submitted ? (
                <div style={{ textAlign: 'center', padding: 40, background: '#F0FDF4', borderRadius: 12 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{lp.success_msg}</h3>
                  {lp.qrcode_url && (
                    <div style={{ marginTop: 20 }}>
                      <img src={lp.qrcode_url} alt="企微二维码" style={{ width: 160, height: 160, borderRadius: 8 }} />
                      <p style={{ fontSize: 13, color: '#6B7280' }}>{lp.qrcode_text || '扫码添加专属顾问'}</p>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 28, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px', textAlign: 'center' }}>{lp.form_title || '获取专属方案'}</h3>
                  {lp.form_fields?.map((f: FormField) => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{f.label}{f.required && ' *'}</label>
                      {f.type === 'textarea' ? (
                        <textarea required={f.required} value={formData[f.key] || ''} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                          style={fieldStyle} rows={3} placeholder={f.placeholder} />
                      ) : (
                        <input type={f.type} required={f.required} value={formData[f.key] || ''} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                          style={fieldStyle} placeholder={f.placeholder} />
                      )}
                    </div>
                  ))}
                  <button type="submit" disabled={submitting}
                    style={{ width: '100%', background: lp.primary_color, color: '#fff', border: 'none', padding: '12px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                    {submitting ? '提交中...' : lp.submit_btn_text}
                  </button>
                  {lp.qrcode_url && (
                    <div style={{ marginTop: 20, textAlign: 'center' }}>
                      <img src={lp.qrcode_url} alt="企微二维码" style={{ width: 120, height: 120, borderRadius: 8 }} />
                      <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>{lp.qrcode_text || '扫码添加专属顾问'}</p>
                    </div>
                  )}
                </form>
              )}
            </div>
          </section>
        );
      case 'cta':
        return (
          <section style={{ background: bg, color: tc, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              {s.title && <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 16px' }}>{s.title}</h2>}
              {s.subtitle && <p style={{ fontSize: 16, opacity: 0.8, margin: '0 0 32px' }}>{s.subtitle}</p>}
              {s.content && <a href="#form-section" style={{ display: 'inline-block', background: '#fff', color: lp.primary_color, textDecoration: 'none', padding: '14px 36px', borderRadius: 8, fontSize: 17, fontWeight: 600 }}>{s.content}</a>}
            </div>
          </section>
        );
      case 'testimonials':
        return (
          <section style={{ background: bg, color: tc, padding: '64px 24px' }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              {s.title && <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', margin: '0 0 40px' }}>{s.title}</h2>}
              {s.items && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                  {s.items.map((item, i) => (
                    <div key={i} style={{ padding: 24, background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                      <p style={{ fontSize: 14, fontStyle: 'italic', opacity: 0.8, margin: '0 0 12px' }}>"{item.description}"</p>
                      <strong style={{ fontSize: 14 }}>{item.title}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      case 'faq':
        return (
          <section style={{ background: bg, color: tc, padding: '64px 24px' }}>
            <div style={{ maxWidth: 700, margin: '0 auto' }}>
              {s.title && <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', margin: '0 0 40px' }}>{s.title}</h2>}
              {s.items?.map((item, i) => (
                <details key={i} style={{ marginBottom: 12, padding: '16px 20px', background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                  <summary style={{ fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>{item.title}</summary>
                  <p style={{ margin: '12px 0 0', fontSize: 14, opacity: 0.7 }}>{item.description}</p>
                </details>
              ))}
            </div>
          </section>
        );
      case 'image':
        return (
          <section style={{ background: bg, padding: s.imageUrl ? '40px 24px' : '0', textAlign: 'center' }}>
            {s.imageUrl && <img src={s.imageUrl} alt={s.title || ''} style={{ maxWidth: '100%', borderRadius: 8 }} />}
            {s.title && <p style={{ marginTop: 8, fontSize: 14, color: tc, opacity: 0.7 }}>{s.title}</p>}
          </section>
        );
      case 'text':
        return (
          <section style={{ background: bg, color: tc, padding: '40px 24px' }}>
            <div style={{ maxWidth: 700, margin: '0 auto' }}>
              {s.title && <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>{s.title}</h2>}
              {s.content && <p style={{ fontSize: 15, lineHeight: 1.8, opacity: 0.8, whiteSpace: 'pre-wrap' }}>{s.content}</p>}
            </div>
          </section>
        );
      case 'footer':
        return (
          <footer style={{ background: bg, color: tc, padding: '32px 24px', textAlign: 'center', fontSize: 13, opacity: 0.7 }}>
            {s.content && <p style={{ margin: 0 }}>{s.content}</p>}
          </footer>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', minHeight: '100vh', background: lp.bg_color }}>
      {lp.content?.sections?.map(s => renderSection(s))}
      {/* 如果没有 form section 但启用了表单，自动追加 */}
      {lp.enable_form && !lp.content?.sections?.some(s => s.type === 'form') && (
        renderSection({ id: 'auto-form', type: 'form', title: lp.form_title || '获取专属方案', subtitle: '', backgroundColor: '#F9FAFB', textColor: '#1F2937' })
      )}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14,
  boxSizing: 'border-box', fontFamily: 'inherit',
};
