import React, { useEffect, useState } from 'react';
import { Settings, X, Palette, FolderCog, Bell, FileText, Bot, Keyboard, Save } from 'lucide-react';
import { useUiStore } from '../../stores/useUiStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSettingsStore, resolveTheme } from '../../stores/useSettingsStore';
import { toast } from '../../stores/useToastStore';
import { updateProjectConfig } from '../../lib/tauri-api';
import { sendSystemNotification } from '../../lib/notifications';
import { DEMO_PROJECT_PATH } from '../../lib/demo-data';
import { AiSettingsModal } from '../ai/AiSettingsModal';
import type { GlobalConfig } from '../../../shared/types';

type Section = 'appearance' | 'analysis' | 'notifications' | 'reports' | 'ai' | 'shortcuts';

const SECTIONS: Array<{ id: Section; label: string; Icon: typeof Settings }> = [
  { id: 'appearance', label: 'Apariencia', Icon: Palette },
  { id: 'analysis', label: 'Análisis del proyecto', Icon: FolderCog },
  { id: 'notifications', label: 'Notificaciones', Icon: Bell },
  { id: 'reports', label: 'Informes', Icon: FileText },
  { id: 'ai', label: 'Inteligencia Artificial', Icon: Bot },
  { id: 'shortcuts', label: 'Atajos de teclado', Icon: Keyboard },
];

export const KEYBOARD_SHORTCUTS: Array<[string, string]> = [
  ['Ctrl+K  /  Ctrl+Shift+P', 'Paleta de comandos'],
  ['Ctrl+,', 'Configuración'],
  ['Ctrl+O', 'Abrir proyecto'],
  ['Ctrl+Shift+A', 'Analizar proyecto'],
  ['Ctrl+Shift+E', 'Exportar informe (Markdown)'],
  ['Ctrl+B', 'Mostrar/ocultar explorador'],
  ['Ctrl+J', 'Mostrar/ocultar panel inferior'],
  ['Ctrl+Shift+R', 'Mostrar/ocultar inspector'],
  ['Alt+1 … Alt+4', 'Niveles C4'],
  ['Esc', 'Limpiar selección'],
];

const linesToList = (text: string) =>
  text
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

const inputClass =
  'w-full bg-[var(--bg)] text-[11px] text-[var(--text)] px-2.5 py-1.5 rounded border border-[var(--border)] focus:outline-none focus:border-[var(--purple)] font-sans';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block space-y-1">
    <span className="font-semibold text-[var(--text)]">{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-[var(--muted-2)]">{hint}</span>}
  </label>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({
  checked,
  onChange,
  label,
  hint,
}) => (
  <label className="flex items-start space-x-2.5 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 accent-[var(--purple)]"
    />
    <span className="space-y-0.5">
      <span className="block font-semibold text-[var(--text)]">{label}</span>
      {hint && <span className="block text-[10px] text-[var(--muted-2)]">{hint}</span>}
    </span>
  </label>
);

export const SettingsModal: React.FC = () => {
  const { settingsOpen, setSettingsOpen, setTheme } = useUiStore();
  const { projectPath, projectConfig, setProjectConfig } = useProjectStore();
  const { config, save } = useSettingsStore();

  const [section, setSection] = useState<Section>('appearance');
  const [draft, setDraft] = useState<GlobalConfig>(config);
  const [ignorePatterns, setIgnorePatterns] = useState('');
  const [ignoreExtensions, setIgnoreExtensions] = useState('');
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(1);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const projectEditable = Boolean(projectPath && projectPath !== DEMO_PROJECT_PATH && projectConfig);

  useEffect(() => {
    if (!settingsOpen) return;
    setDraft(config);
    setIgnorePatterns(projectConfig?.ignorePatterns.join('\n') ?? '');
    setIgnoreExtensions(projectConfig?.ignoreExtensions.join('\n') ?? '');
    setMaxFileSizeMb(projectConfig?.maxFileSizeMb ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isAiModalOpen) setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen, isAiModalOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  const patch = (p: Partial<GlobalConfig>) => setDraft((d) => ({ ...d, ...p }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await save(draft);
      setTheme(resolveTheme(draft.defaultTheme));

      if (projectEditable && projectPath) {
        const nextProjectConfig = {
          ignorePatterns: linesToList(ignorePatterns),
          ignoreExtensions: linesToList(ignoreExtensions).map((ext) =>
            ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
          ),
          maxFileSizeMb: Math.max(0.1, Number(maxFileSizeMb) || 1),
        };
        setProjectConfig(await updateProjectConfig(projectPath, nextProjectConfig));
      }

      toast.success('Configuración guardada');
      setSettingsOpen(false);
    } catch (err) {
      toast.error('No se pudo guardar la configuración', String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = async () => {
    const sent = await sendSystemNotification('SAAC', 'Así se verá el aviso al terminar un análisis largo.');
    if (!sent) toast.error('Sin permiso para notificaciones', 'Habilítalas para SAAC en la configuración del sistema.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans select-none text-xs">
      <div className="w-[760px] max-w-[92vw] h-[540px] max-h-[88vh] bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg)] border-b border-[var(--border)]">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-[var(--purple)]" />
            <span className="font-bold">Configuración</span>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1 text-[var(--muted)] hover:text-[var(--text)] rounded hover:bg-[var(--border-soft)] transition"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Nav */}
          <nav className="w-[190px] shrink-0 bg-[var(--panel-2)] border-r border-[var(--border)] p-2 space-y-0.5">
            {SECTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-left transition ${
                  section === id
                    ? 'bg-[var(--purple-soft)] text-[var(--purple)] font-semibold'
                    : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-3)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 select-text">
            {section === 'appearance' && (
              <Field label="Tema" hint="«Sistema» sigue el modo claro/oscuro de Windows o macOS.">
                <select
                  value={draft.defaultTheme}
                  onChange={(e) => patch({ defaultTheme: e.target.value as GlobalConfig['defaultTheme'] })}
                  className={inputClass}
                >
                  <option value="dark">Oscuro</option>
                  <option value="light">Claro</option>
                  <option value="system">Sistema</option>
                </select>
              </Field>
            )}

            {section === 'analysis' &&
              (projectEditable ? (
                <>
                  <p className="text-[11px] text-[var(--muted)]">
                    Se guarda en <code className="font-mono">.saac/config.json</code> del proyecto abierto y se aplica
                    en el próximo análisis. Los patrones de <code className="font-mono">.saacignore</code> también se
                    respetan.
                  </p>
                  <Field label="Patrones ignorados (glob, uno por línea)" hint="Ej.: **/node_modules/**, **/*.generated.ts">
                    <textarea
                      value={ignorePatterns}
                      onChange={(e) => setIgnorePatterns(e.target.value)}
                      rows={7}
                      className={`${inputClass} font-mono resize-y`}
                    />
                  </Field>
                  <Field label="Extensiones ignoradas (una por línea)" hint="Ej.: .min.js, .map">
                    <textarea
                      value={ignoreExtensions}
                      onChange={(e) => setIgnoreExtensions(e.target.value)}
                      rows={3}
                      className={`${inputClass} font-mono resize-y`}
                    />
                  </Field>
                  <Field label="Tamaño máximo por archivo (MB)">
                    <input
                      type="number"
                      min={0.1}
                      step={0.5}
                      value={maxFileSizeMb}
                      onChange={(e) => setMaxFileSizeMb(Number(e.target.value))}
                      className={`${inputClass} w-32`}
                    />
                  </Field>
                </>
              ) : (
                <p className="text-[var(--muted)]">
                  Abre un proyecto real (no el modo demo) para editar su configuración de análisis.
                </p>
              ))}

            {section === 'notifications' && (
              <>
                <Toggle
                  checked={draft.notifyOnAnalysisComplete}
                  onChange={(v) => patch({ notifyOnAnalysisComplete: v })}
                  label="Avisar al terminar un análisis largo"
                  hint="Si SAAC está en segundo plano se envía una notificación del sistema; si no, un aviso dentro de la app."
                />
                <Field label="Duración mínima para avisar (segundos)">
                  <input
                    type="number"
                    min={0}
                    value={draft.notifyMinDurationSecs}
                    disabled={!draft.notifyOnAnalysisComplete}
                    onChange={(e) => patch({ notifyMinDurationSecs: Math.max(0, Number(e.target.value) || 0) })}
                    className={`${inputClass} w-32 disabled:opacity-40`}
                  />
                </Field>
                <button
                  onClick={handleTestNotification}
                  className="px-3 py-1.5 rounded bg-[var(--panel-2)] hover:bg-[var(--panel-3)] border border-[var(--border-soft)] transition"
                >
                  Probar notificación
                </button>
              </>
            )}

            {section === 'reports' && (
              <Field label="Autor de los informes" hint="Aparece en la portada de los informes exportados.">
                <input
                  type="text"
                  value={draft.reportAuthor}
                  onChange={(e) => patch({ reportAuthor: e.target.value })}
                  placeholder="Nombre / equipo"
                  className={inputClass}
                />
              </Field>
            )}

            {section === 'ai' && (
              <>
                <Toggle
                  checked={draft.autoCheckAi}
                  onChange={(v) => patch({ autoCheckAi: v })}
                  label="Comprobar el proveedor de IA al iniciar"
                />
                <div className="p-3 rounded border border-[var(--border)] bg-[var(--panel-2)] space-y-2">
                  <p className="text-[11px] text-[var(--muted)]">
                    Proveedor, endpoint, modelo y API key. La key se guarda en el almacén de credenciales del sistema
                    operativo, nunca en archivos de la app.
                  </p>
                  <button
                    onClick={() => setIsAiModalOpen(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[var(--purple-soft)] text-[var(--purple)] border border-[var(--purple-border)] hover:bg-[var(--purple)] hover:text-white transition font-semibold"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>Configurar proveedor de IA…</span>
                  </button>
                </div>
              </>
            )}

            {section === 'shortcuts' && (
              <table className="w-full text-[11px]">
                <tbody>
                  {KEYBOARD_SHORTCUTS.map(([keys, action]) => (
                    <tr key={keys} className="border-b border-[var(--border-soft)]">
                      <td className="py-1.5 pr-4 font-mono text-[var(--purple)] whitespace-nowrap">{keys}</td>
                      <td className="py-1.5 text-[var(--text)]">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 bg-[var(--bg)] border-t border-[var(--border)]">
          <button
            onClick={() => setSettingsOpen(false)}
            className="px-3 py-1.5 rounded text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)] transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-[var(--purple)] text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Guardando…' : 'Guardar'}</span>
          </button>
        </div>
      </div>

      <AiSettingsModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </div>
  );
};
