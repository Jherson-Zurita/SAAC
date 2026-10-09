import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useProjectStore } from '../stores/useProjectStore';
import { useAnalysisHistoryStore } from '../stores/useAnalysisHistoryStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { toast } from '../stores/useToastStore';
import { buildReport, renderMarkdown, renderPdf } from './report';
import { saveReport } from './tauri-api';

export type ReportFormat = 'markdown' | 'pdf';

let exporting = false;

/** Genera el informe del proyecto abierto y lo guarda donde elija el usuario. */
export async function exportArchitectureReport(format: ReportFormat): Promise<void> {
  const { amg, projectPath, fitnessResult, annotations } = useProjectStore.getState();
  if (!amg) {
    toast.info('No hay análisis para exportar', 'Abre y analiza un proyecto primero.');
    return;
  }
  if (exporting) return;
  exporting = true;

  try {
    const report = buildReport({
      amg,
      projectPath,
      fitness: fitnessResult,
      annotations,
      history: useAnalysisHistoryStore.getState().history,
      author: useSettingsStore.getState().config.reportAuthor,
    });
    const bytes =
      format === 'pdf' ? await renderPdf(report) : new TextEncoder().encode(renderMarkdown(report));

    const savedPath = await saveReport(format, report.fileStem, bytes);
    if (!savedPath) return;
    toast.success(`Informe ${format === 'pdf' ? 'PDF' : 'Markdown'} exportado`, savedPath, {
      label: 'Mostrar en carpeta',
      onClick: () => {
        revealItemInDir(savedPath).catch((err) => console.warn('No se pudo abrir la carpeta:', err));
      },
    });
  } catch (err) {
    console.error('Error al exportar el informe:', err);
    toast.error('No se pudo exportar el informe', String(err));
  } finally {
    exporting = false;
  }
}
