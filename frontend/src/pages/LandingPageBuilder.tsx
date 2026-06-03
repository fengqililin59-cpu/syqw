import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchLandingPage, updateLandingPage, publishLandingPage, fetchLandingPageStats, type LandingPageRecord, type LandingSection, type FormField } from '@/api/landingPage';

const SECTION_TYPES: { type: LandingSection['type']; label: string; icon: string }[] = [
  { type: 'hero', label: '头部横幅', icon: '🏠' },
  { type: 'features', label: '特性展示', icon: '✨' },
  { type: 'form', label: '留资表单', icon: '📋' },
  { type: 'cta', label: '行动号召', icon: '🎯' },
  { type: 'testimonials', label: '客户见证', icon: '💬' },
  { type: 'faq', label: '常见问题', icon: '❓' },
  { type: 'image', label: '图片展示', icon: '🖼' },
  { type: 'text', label: '文本内容', icon: '📝' },
  { type: 'footer', label: '页脚', icon: '🔽' },
];

const defaultSection = (type: LandingSection['type']): LandingSection => {
  const base = { id: `s-${Date.now()}`, type, title: '', subtitle: '', backgroundColor: '#ffffff', textColor: '#1F2937' };
  switch (type) {
    case 'hero': return { ...base, title: '让获客更简单', subtitle: 'AI 驱动的企微私域 CRM，从广告点击到成交转化，一站式管理', content: '立即免费试用', imageUrl: '' };
    case 'features': return { ...base, title: '核心功能', items: [{ title: '智能获客', description: '多渠道引流，自动加好友' }, { title: 'AI 跟进', description: '智能话术，自动提醒' }, { title: '数据分析', description: '漏斗分析，ROI 追踪' }] };
    case 'form': return { ...base, title: '获取专属方案', subtitle: '留下联系方式，我们将在 24 小时内联系您' };
    case 'cta': return { ...base, title: '准备好提升转化了吗？', content: '立即免费试用', backgroundColor: '#534AB7', textColor: '#ffffff' };
    case 'testimonials': return { ...base, title: '客户怎么说', items: [{ title: '张总', description: '使用后客户转化率提升了 40%' }] };
    case 'faq': return { ...base, title: '常见问题', items: [{ title: '如何开始使用？', description: '注册即可免费试用 14 天' }] };
    case 'footer': return { ...base, title: '', content: '© 2026 ZhiFlow. All rights reserved.' };
    default: return base;
  }
};

export default function LandingPageBuilder() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [lp, setLp] = useState<LandingPageRecord | null>(null);
  const [sections, setSections] = useState<LandingSection[]>([]);
  const [settings, setSettings] = useState({ title: '', slug: '', description: '', bg_color: '#ffffff', primary_color: '#534AB7', enable_form: true, form_title: '获取专属方案', submit_btn_text: '立即咨询', success_msg: '提交成功，我们会尽快联系您！', qrcode_url: '', qrcode_text: '扫码添加专属顾问', logo_url: '' });
  const [formFields, setFormFields] = useState<FormField[]>([{ key: 'name', label: '姓名', type: 'text', required: true }, { key: 'phone', label: '手机号', type: 'tel', required: true }]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'settings' | 'stats'>('edit');
  const [stats, setStats] = useState<any>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await fetchLandingPage(Number(id));
    setLp(data);
    setSections(data.content?.sections || []);
    setSettings({
      title: data.title, slug: data.slug, description: data.description || '',
      bg_color: data.bg_color, primary_color: data.primary_color,
      enable_form: data.enable_form, form_title: data.form_title || '获取专属方案',
      submit_btn_text: data.submit_btn_text, success_msg: data.success_msg,
      qrcode_url: data.qrcode_url || '', qrcode_text: data.qrcode_text || '扫码添加专属顾问',
      logo_url: data.logo_url || '',
    });
    setFormFields(data.form_fields || []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const save = async (status?: string) => {
    setSaving(true);
    setSaveMsg('');
    try {
      await updateLandingPage(Number(id), {
        ...settings,
        content: { sections },
        form_fields: formFields,
      });
      if (status === 'publish') {
        await publishLandingPage(Number(id));
        setSaveMsg('已发布！');
      } else {
        setSaveMsg('已保存');
      }
      await load();
    } catch (e: any) { setSaveMsg(e?.message || '保存失败'); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 2000); }
  };

  const loadStats = async () => {
    if (!id) return;
    const s = await fetchLandingPageStats(Number(id));
    setStats(s);
  };

  const addSection = (type: LandingSection['type']) => {
    setSections(prev => [...prev, defaultSection(type)]);
  };

  const removeSection = (sid: string) => {
    setSections(prev => prev.filter(s => s.id !== sid));
  };

  const moveSection = (sid: string, dir: -1 | 1) => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === sid);
      if (idx < 0) return prev;
      const arr = [...prev];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return arr;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const updateSection = (sid: string, data: Partial<LandingSection>) => {
    setSections(prev => prev.map(s => s.id === sid ? { ...s, ...data } : s));
  };

  const addFormField = () => {
    setFormFields(prev => [...prev, { key: `field_${Date.now()}`, label: '新字段', type: 'text', required: false }]);
  };

  const renderSectionPreview = (s: LandingSection) => {
    const isEditing = editingSection === s.id;
    const bg = s.backgroundColor || '#ffffff';
    const tc = s.textColor || '#1F2937';

    return (
      <div key={s.id} style={{ position: 'relative', padding: '40px 24px', background: bg, color: tc, borderBottom: '1px solid #E5E7EB', minHeight: 60 }}>
        {/* 操作栏 */}
        <div style={{ position: 'absolute', top: 4, right: 8, display: 'flex', gap: 4, zIndex: 10, opacity: 0.7 }}>
          <button onClick={() => moveSection(s.id, -1)} style={btnSm} title="上移">↑</button>
          <button onClick={() => moveSection(s.id, 1)} style={btnSm} title="下移">↓</button>
          <button onClick={() => setEditingSection(isEditing ? null : s.id)} style={{ ...btnSm, color: '#534AB7' }}>✎</button>
          <button onClick={() => removeSection(s.id)} style={{ ...btnSm, color: '#EF4444' }}>✕</button>
        </div>

        {isEditing ? (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <input value={s.title || ''} onChange={e => updateSection(s.id, { title: e.target.value })}
              placeholder="标题" style={inputStyle} />
            <input value={s.subtitle || ''} onChange={e => updateSection(s.id, { subtitle: e.target.value })}
              placeholder="副标题" style={inputStyle} />
            {(s.type === 'hero' || s.type === 'cta' || s.type === 'footer') && (
              <input value={s.content || ''} onChange={e => updateSection(s.id, { content: e.target.value })}
                placeholder="按钮文案/内容" style={inputStyle} />
            )}
            <input value={s.imageUrl || ''} onChange={e => updateSection(s.id, { imageUrl: e.target.value })}
              placeholder="图片URL（可选）" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <label style={{ fontSize: 12 }}>背景色 <input type="color" value={bg} onChange={e => updateSection(s.id, { backgroundColor: e.target.value })} style={{ width: 40 }} /></label>
              <label style={{ fontSize: 12 }}>文字色 <input type="color" value={tc} onChange={e => updateSection(s.id, { textColor: e.target.value })} style={{ width: 40 }} /></label>
            </div>
            {s.items && (
              <div style={{ marginTop: 8 }}>
                <strong style={{ fontSize: 12 }}>列表项：</strong>
                {s.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <input value={item.title} onChange={e => {
                      const items = [...(s.items || [])];
                      items[i] = { ...items[i], title: e.target.value };
                      updateSection(s.id, { items });
                    }} placeholder="标题" style={{ flex: 1, ...inputStyle }} />
                    <input value={item.description} onChange={e => {
                      const items = [...(s.items || [])];
                      items[i] = { ...items[i], description: e.target.value };
                      updateSection(s.id, { items });
                    }} placeholder="描述" style={{ flex: 1, ...inputStyle }} />
                    <button onClick={() => {
                      const items = (s.items || []).filter((_, j) => j !== i);
                      updateSection(s.id, { items });
                    }} style={btnSm}>✕</button>
                  </div>
                ))}
                <button onClick={() => {
                  const items = [...(s.items || []), { title: '', description: '' }];
                  updateSection(s.id, { items });
                }} style={{ ...btnSm, marginTop: 4 }}>+ 添加项</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: s.type === 'hero' || s.type === 'cta' ? 'center' : 'left' }}>
            {s.title && <h2 style={{ fontSize: s.type === 'hero' ? 28 : 20, fontWeight: 700, margin: '0 0 8px' }}>{s.title}</h2>}
            {s.subtitle && <p style={{ fontSize: 15, opacity: 0.8, margin: '0 0 16px', lineHeight: 1.6 }}>{s.subtitle}</p>}
            {s.type === 'hero' && s.content && <button style={{ background: settings.primary_color, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>{s.content}</button>}
            {s.type === 'cta' && s.content && <button style={{ background: '#fff', color: settings.primary_color, border: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>{s.content}</button>}
            {s.items && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                {s.items.map((item, i) => (
                  <div key={i} style={{ padding: 16, background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>{item.title}</h4>
                    <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>{item.description}</p>
                  </div>
                ))}
              </div>
            )}
            {s.imageUrl && <img src={s.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginTop: 12 }} />}
          </div>
        )}
        {/* 类型标签 */}
        <div style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 10, color: '#9CA3AF' }}>
          {SECTION_TYPES.find(t => t.type === s.type)?.icon} {SECTION_TYPES.find(t => t.type === s.type)?.label}
        </div>
      </div>
    );
  };

  const previewUrl = lp ? `${window.location.origin}/lp/${lp.slug}` : '';

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #E5E7EB', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => nav('/app/landing-pages')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>←</button>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{lp?.title || '加载中...'}</span>
          {lp?.status === 'published' && <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 100, fontSize: 11 }}>已发布</span>}
          {lp?.status === 'draft' && <span style={{ background: '#F3F4F6', color: '#6B7280', padding: '2px 8px', borderRadius: 100, fontSize: 11 }}>草稿</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setActiveTab(activeTab === 'edit' ? 'settings' : 'edit')}
            style={{ padding: '6px 14px', border: '1px solid #D1D5DB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            {activeTab === 'edit' ? '⚙ 页面设置' : '📄 编辑内容'}
          </button>
          {activeTab === 'edit' ? (
            <>
              <button onClick={() => save()} disabled={saving}
                style={{ padding: '6px 14px', border: '1px solid #534AB7', borderRadius: 6, background: '#fff', color: '#534AB7', cursor: 'pointer', fontSize: 13 }}>💾 保存</button>
              <button onClick={() => save('publish')} disabled={saving}
                style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: '#10B981', color: '#fff', cursor: 'pointer', fontSize: 13 }}>🚀 发布</button>
            </>
          ) : (
            <button onClick={() => setActiveTab('edit')}
              style={{ padding: '6px 14px', border: '1px solid #D1D5DB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>返回编辑</button>
          )}
          <button onClick={() => window.open(previewUrl, '_blank')}
            style={{ padding: '6px 14px', border: '1px solid #3B82F6', borderRadius: 6, background: '#fff', color: '#3B82F6', cursor: 'pointer', fontSize: 13 }}>预览</button>
        </div>
        {saveMsg && <span style={{ fontSize: 12, color: '#10B981', marginLeft: 8 }}>{saveMsg}</span>}
      </div>

      {activeTab === 'edit' ? (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 左侧组件面板 */}
          <div style={{ width: 180, borderRight: '1px solid #E5E7EB', padding: 12, background: '#F9FAFB', overflowY: 'auto', flexShrink: 0 }}>
            <h4 style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>添加区块</h4>
            {SECTION_TYPES.map(st => (
              <button key={st.type} onClick={() => addSection(st.type)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, marginBottom: 4 }}>
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          {/* 中间预览区 */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#F3F4F6' }}>
            <div style={{ maxWidth: 800, margin: '20px auto', background: '#fff', minHeight: 400, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              {sections.length === 0 && (
                <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
                  <p style={{ fontSize: 16 }}>空白落地页</p>
                  <p style={{ fontSize: 13 }}>从左侧拖拽添加区块开始构建</p>
                </div>
              )}
              {sections.map(s => renderSectionPreview(s))}
            </div>
          </div>
        </div>
      ) : activeTab === 'settings' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 700, margin: '0 auto' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>页面设置</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ fontSize: 13 }}>页面标题 <input value={settings.title} onChange={e => setSettings({ ...settings, title: e.target.value })} style={inputStyle} /></label>
            <label style={{ fontSize: 13 }}>URL 路径 <input value={settings.slug} onChange={e => setSettings({ ...settings, slug: e.target.value })} style={inputStyle} /></label>
            <label style={{ fontSize: 13 }}>SEO 描述 <input value={settings.description} onChange={e => setSettings({ ...settings, description: e.target.value })} style={inputStyle} /></label>
            <label style={{ fontSize: 13 }}>Logo URL <input value={settings.logo_url} onChange={e => setSettings({ ...settings, logo_url: e.target.value })} style={inputStyle} /></label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ fontSize: 13 }}>背景色 <input type="color" value={settings.bg_color} onChange={e => setSettings({ ...settings, bg_color: e.target.value })} /></label>
              <label style={{ fontSize: 13 }}>主题色 <input type="color" value={settings.primary_color} onChange={e => setSettings({ ...settings, primary_color: e.target.value })} /></label>
            </div>
            <hr />
            <h4 style={{ fontSize: 14, fontWeight: 600 }}>留资表单设置</h4>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={settings.enable_form} onChange={e => setSettings({ ...settings, enable_form: e.target.checked })} /> 启用留资表单
            </label>
            <label style={{ fontSize: 13 }}>表单标题 <input value={settings.form_title} onChange={e => setSettings({ ...settings, form_title: e.target.value })} style={inputStyle} /></label>
            <label style={{ fontSize: 13 }}>提交按钮 <input value={settings.submit_btn_text} onChange={e => setSettings({ ...settings, submit_btn_text: e.target.value })} style={inputStyle} /></label>
            <label style={{ fontSize: 13 }}>成功提示 <input value={settings.success_msg} onChange={e => setSettings({ ...settings, success_msg: e.target.value })} style={inputStyle} /></label>
            <label style={{ fontSize: 13 }}>企微二维码URL <input value={settings.qrcode_url} onChange={e => setSettings({ ...settings, qrcode_url: e.target.value })} style={inputStyle} /></label>
            <label style={{ fontSize: 13 }}>二维码引导文案 <input value={settings.qrcode_text} onChange={e => setSettings({ ...settings, qrcode_text: e.target.value })} style={inputStyle} /></label>

            <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 16 }}>表单字段</h4>
            {formFields.map((f, i) => (
              <div key={f.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={f.label} onChange={e => {
                  const arr = [...formFields]; arr[i] = { ...arr[i], label: e.target.value }; setFormFields(arr);
                }} style={{ flex: 1, ...inputStyle }} placeholder="标签" />
                <select value={f.type} onChange={e => {
                  const arr = [...formFields]; arr[i] = { ...arr[i], type: e.target.value as any }; setFormFields(arr);
                }} style={{ ...inputStyle, width: 100 }}>
                  <option value="text">文本</option>
                  <option value="tel">手机</option>
                  <option value="email">邮箱</option>
                  <option value="textarea">多行</option>
                  <option value="select">下拉</option>
                </select>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={f.required} onChange={e => {
                    const arr = [...formFields]; arr[i] = { ...arr[i], required: e.target.checked }; setFormFields(arr);
                  }} /> 必填
                </label>
                <button onClick={() => setFormFields(formFields.filter((_, j) => j !== i))} style={btnSm}>✕</button>
              </div>
            ))}
            <button onClick={addFormField} style={{ ...btnSm, alignSelf: 'flex-start' }}>+ 添加字段</button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 600, margin: '0 auto' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>数据统计</h3>
          <button onClick={loadStats} style={{ padding: '8px 16px', border: '1px solid #534AB7', borderRadius: 6, background: '#534AB7', color: '#fff', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}>加载数据</button>
          {stats && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: '#F0FDF4', padding: 16, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#10B981' }}>{stats.view_count}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>访问量</div>
                </div>
                <div style={{ background: '#EEF2FF', padding: 16, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#534AB7' }}>{stats.submit_count}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>留资量</div>
                </div>
              </div>
              {stats.recent_submissions?.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>最近留资</h4>
                  {stats.recent_submissions.map((sub: any) => (
                    <div key={sub.id} style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                      {sub.data && Object.entries(sub.data).map(([k, v]) => (
                        <span key={k} style={{ marginRight: 12 }}><strong>{k}:</strong> {String(v)}</span>
                      ))}
                      <span style={{ color: '#9CA3AF', fontSize: 12, marginLeft: 8 }}>{sub.created_at?.slice(0, 16)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, marginTop: 4,
  boxSizing: 'border-box' as any,
};

const btnSm: React.CSSProperties = {
  border: '1px solid #D1D5DB', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 11, padding: '2px 6px',
};
