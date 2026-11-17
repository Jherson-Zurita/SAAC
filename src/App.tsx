import { useEffect, useRef } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useProjectStore } from './stores/useProjectStore';
import { useAiStore } from './stores/useAiStore';
import { useUiStore } from './stores/useUiStore';
import { useAnalysisHistoryStore } from './stores/useAnalysisHistoryStore';
import { useSelectionStore } from './stores/useSelectionStore';
import { useDiagramStore } from './stores/useDiagramStore';
import { useRecentProjectsStore } from './stores/useRecentProjectsStore';
import { useSettingsStore, resolveTheme } from './stores/useSettingsStore';
import { toast } from './stores/useToastStore';
import { sendSystemNotification } from './lib/notifications';
import { exportArchitectureReport } from './lib/export-report';
import type { ProjectAnalysisResult } from '../shared/types';
import {
  analyzeProject,
  cancelAnalysis,
  openProject,
  onProjectProgress,
  checkAiStatus,
  getProjectConfig,
  loadProjectAnnotations,
  evaluateFitnessRules,
  getAnalysisHistory,
} from './lib/tauri-api';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { saveCachedProjectData, loadCachedProjectData } from './lib/project-cache';
import { generateAnalysisSummary } from './lib/analysis-summary';
import {
  DEMO_AMG,
  DEMO_FITNESS_RESULT,
  DEMO_ANNOTATIONS,
  DEMO_ANALYSIS_RESULT,
  DEMO_PROJECT_PATH,
} from './lib/demo-data';

export function App() {
  const {
    projectPath,
    setProjectPath,
    setAmg,
    setIsAnalyzing,
    setProgress,
    setLastAnalysisResult,
    setProjectConfig,
    setAnnotations,
    setFitnessResult,
    resetProject,
  } = useProjectStore();

  const { setAiStatus } = useAiStore();
  const { theme, setTheme, setActiveMainTab } = useUiStore();
  const themePreference = useSettingsStore((s) => s.config.defaultTheme);
  const { setHistory } = useAnalysisHistoryStore();
  const { resetDiagram } = useDiagramStore();
  const { addRecentProject } = useRecentProjectsStore();
  const { clearSelection } = useSelectionStore();

  // Cada apertura de proyecto incrementa `sessionRef`; las respuestas async
  // (análisis, metadatos) de una sesión anterior se descartan al llegar.
  const sessionRef = useRef(0);
  // Análisis en curso, para esperar a que termine tras cancelarlo antes de
  // iniciar otro (el backend admite uno a la vez).
  const analysisRef = useRef<Promise<void> | null>(null);

  const stopRunningAnalysis = async () => {
    const running = analysisRef.current;
    if (!running) return;
    try {
      await cancelAnalysis();
    } catch (err) {
      console.warn('No se pudo cancelar el análisis en curso:', err);
    }
    await running.catch(() => undefined);
  };

  const resetWorkspace = () => {
    sessionRef.current += 1;
    resetProject();
    resetDiagram();
    clearSelection();
    setHistory(null);
  };

  // Aplicar tema al documento root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, [theme]);

  // Con tema «Sistema», seguir los cambios de modo claro/oscuro del SO
  useEffect(() => {
    if (themePreference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(resolveTheme('system'));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [themePreference, setTheme]);

  // Suscripción a eventos de progreso, configuración global y chequeo de IA
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    async function initListeners() {
      // 1. Escuchar eventos de progreso de análisis desde Rust (project://progress)
      const stop = await onProjectProgress((event) => {
        setProgress(event);
      });
      if (disposed) stop();
      else unlisten = stop;

      // 2. Configuración global persistida (tema, notificaciones, IA)
      const settings = await useSettingsStore.getState().load();
      if (disposed) return;
      setTheme(resolveTheme(settings.defaultTheme));

      // 3. Verificar disponibilidad de IA local (Ollama / Mock)
      if (!settings.autoCheckAi) return;
      try {
        const status = await checkAiStatus();
        if (!disposed) setAiStatus(status);
      } catch (err) {
        console.warn('AI status check failed:', err);
      }
    }

    initListeners();

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [setProgress, setAiStatus, setTheme]);

  /** Avisa del fin de un análisis largo: notificación del SO si la app no tiene el foco, toast si lo tiene. */
  const notifyAnalysisFinished = (result: ProjectAnalysisResult | null, error?: unknown) => {
    const { notifyOnAnalysisComplete, notifyMinDurationSecs } = useSettingsStore.getState().config;
    const durationMs = result?.durationMs ?? 0;
    if (!notifyOnAnalysisComplete || durationMs < notifyMinDurationSecs * 1000) return;

    const seconds = (durationMs / 1000).toFixed(1);
    const name = result?.amg?.projectName ?? useProjectStore.getState().projectName ?? 'Proyecto';
    const title = error
      ? 'El análisis falló'
      : result?.cancelled
        ? 'Análisis cancelado'
        : `Análisis completado: ${name}`;
    const body = error
      ? String(error)
      : result?.cancelled
        ? `Se detuvo tras ${seconds} s.`
        : `${result?.successful ?? 0} de ${result?.totalFiles ?? 0} archivos en ${seconds} s` +
          (result?.amg ? ` · ${result.amg.antipatterns.length} antipatrones` : '');

    if (!document.hasFocus()) {
      sendSystemNotification(title, body).then((sent) => {
        if (!sent) toast.info(title, body);
      });
    } else if (!error) {
      toast.success(title, body, result?.amg ? { label: 'Ver dashboard', onClick: () => setActiveMainTab('dashboard') } : undefined);
    }
  };

  // Ejecutar el análisis AST para una ruta específica
  const runAnalysisForPath = (targetPath: string): Promise<void> => {
    if (!targetPath) return Promise.resolve();
    if (analysisRef.current) return analysisRef.current;

    const session = sessionRef.current;
    const run = executeAnalysis(targetPath, session).finally(() => {
      if (analysisRef.current === run) analysisRef.current = null;
    });
    analysisRef.current = run;
    return run;
  };

  const executeAnalysis = async (targetPath: string, session: number) => {
    const isCurrent = () =>
      sessionRef.current === session && useProjectStore.getState().projectPath === targetPath;

    setIsAnalyzing(true);
    const startedAt = Date.now();
    try {
      const result = await analyzeProject(targetPath);
      if (!isCurrent()) return;
      setLastAnalysisResult(result);
      notifyAnalysisFinished(result);

      // Un análisis cancelado no trae AMG: se conserva el que ya estaba en pantalla.
      // Si terminó sin cancelar y sin AMG (p. ej. worker caído), avisar: antes
      // solo se creaba `.saac/` y la UI quedaba vacía sin explicación.
      if (!result.amg && !result.cancelled) {
        const failed = result.failed ?? 0;
        const successful = result.successful ?? 0;
        toast.error(
          'Análisis sin resultados',
          successful + failed === 0
            ? 'No se encontraron archivos de código analizables en el proyecto.'
            : `Se procesaron archivos pero no se pudo construir el modelo (${failed} fallidos, ${successful} ok). Revisa que el worker de Python esté disponible.`
        );
      }
      if (result.amg) {
        resetDiagram();
        setAmg(result.amg);

        let calculatedFitnessScore: number | undefined;
        let fitnessData = null;

        // Evaluar reglas de arquitectura y actualizar Fitness Score
        try {
          fitnessData = await evaluateFitnessRules(targetPath, result.amg);
          if (!isCurrent()) return;
          setFitnessResult(fitnessData);
          calculatedFitnessScore = fitnessData.fitnessScore;
        } catch (e) {
          console.warn('Error al evaluar reglas:', e);
        }

        // Guardar resultado del análisis en la caché local y generar JSON resumen de diagnóstico
        saveCachedProjectData(targetPath, result.amg, fitnessData);
        generateAnalysisSummary(targetPath, result, fitnessData);

        // Actualizar historial
        try {
          const updatedHistory = await getAnalysisHistory(targetPath);
          if (isCurrent()) setHistory(updatedHistory);
        } catch (e) {
          console.warn('Error al actualizar historial:', e);
        }

        // Actualizar registro en useRecentProjectsStore con métricas
        addRecentProject({
          path: targetPath,
          name: result.amg.projectName,
          fitnessScore: calculatedFitnessScore ?? result.amg.metrics.fitnessScore,
          moduleCount: result.amg.modules.length,
          loc: result.amg.metrics.totalLoc,
          antipatternCount: result.amg.antipatterns.length,
        });
      }
    } catch (err) {
      console.error('Error durante el análisis del proyecto:', err);
      if (isCurrent()) {
        toast.error('Error en el análisis', String(err));
        notifyAnalysisFinished({ durationMs: Date.now() - startedAt } as ProjectAnalysisResult, err);
      }
    } finally {
      if (sessionRef.current === session) setIsAnalyzing(false);
    }
  };

  // Abrir proyecto desde una ruta específica (cargando caché si existe o analizando si no)
  const handleOpenProjectByPath = async (targetPath: string) => {
    if (!targetPath) return;

    await stopRunningAnalysis();
    // Limpiar el proyecto anterior antes de cargar el nuevo, para que no
    // queden su AMG, fitness, anotaciones o selección visibles bajo la ruta nueva.
    resetWorkspace();
    const session = sessionRef.current;
    const isCurrent = () => sessionRef.current === session;

    try {
      await openProject(targetPath);
      if (!isCurrent()) return;
      setProjectPath(targetPath);

      // Cargar metadatos y configuraciones del proyecto
      const [config, annotations, historyData] = await Promise.allSettled([
        getProjectConfig(targetPath),
        loadProjectAnnotations(targetPath),
        getAnalysisHistory(targetPath),
      ]);
      if (!isCurrent()) return;
      if (config.status === 'fulfilled') setProjectConfig(config.value);
      if (annotations.status === 'fulfilled') setAnnotations(annotations.value);
      if (historyData.status === 'fulfilled') setHistory(historyData.value);
      for (const failed of [config, annotations, historyData]) {
        if (failed.status === 'rejected') {
          console.warn('Error al cargar metadatos pre-frontend:', failed.reason);
        }
      }

      // 1. Intentar cargar el análisis guardado previamente en caché
      const cached = loadCachedProjectData(targetPath);
      if (cached.amg) {
        setAmg(cached.amg);
        if (cached.fitnessResult) {
          setFitnessResult(cached.fitnessResult);
        }
        addRecentProject({
          path: targetPath,
          name: cached.amg.projectName,
          fitnessScore: cached.fitnessResult?.fitnessScore ?? cached.amg.metrics.fitnessScore,
          moduleCount: cached.amg.modules.length,
          loc: cached.amg.metrics.totalLoc,
          antipatternCount: cached.amg.antipatterns.length,
        });
      } else {
        // 2. Si no hay análisis previo guardado para este proyecto, ejecutar análisis AST
        await runAnalysisForPath(targetPath);
      }
    } catch (err) {
      console.error('Error al abrir proyecto:', err);
      if (isCurrent()) alert(`No se pudo abrir la ruta: ${targetPath}`);
    }
  };

  // Manejador para abrir diálogo nativo de selección de carpeta
  const handleOpenProject = async () => {
    let targetPath: string | null = null;

    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Seleccionar Carpeta de Proyecto para Análisis SAAC',
      });

      if (typeof selected === 'string') {
        targetPath = selected;
      }
    } catch {
      // Fallback si dialog nativo no está disponible en entorno web
      const prompted = window.prompt(
        'Ingrese la ruta absoluta del directorio del proyecto a analizar:',
        projectPath || 'd:/Elvis/Semestre 2-2026/SAAC'
      );
      if (prompted) {
        targetPath = prompted.trim();
      }
    }

    if (targetPath) {
      await handleOpenProjectByPath(targetPath);
    }
  };

  // Manejador para cerrar el proyecto actual y volver a la pantalla de bienvenida
  const handleCloseProject = async () => {
    await stopRunningAnalysis();
    resetWorkspace();
  };

  // 🧪 MODO DEMO — Carga datos sintéticos para capturas de pantalla y documentación
  const handleLoadDemo = async () => {
    await stopRunningAnalysis();
    resetWorkspace();
    setProjectPath(DEMO_PROJECT_PATH, DEMO_AMG.projectName);
    setAmg(DEMO_AMG);
    setFitnessResult(DEMO_FITNESS_RESULT);
    setAnnotations(DEMO_ANNOTATIONS);
    setLastAnalysisResult(DEMO_ANALYSIS_RESULT);
    addRecentProject({
      path: DEMO_PROJECT_PATH,
      name: DEMO_AMG.projectName,
      fitnessScore: DEMO_FITNESS_RESULT.fitnessScore,
      moduleCount: DEMO_AMG.modules.length,
      loc: DEMO_AMG.metrics.totalLoc,
      antipatternCount: DEMO_AMG.antipatterns.length,
    });
  };

  // Manejador para re-ejecutar el análisis AST manualmente desde la TopBar
  const handleAnalyzeProject = async () => {
    if (!projectPath || projectPath === DEMO_PROJECT_PATH) return;
    await runAnalysisForPath(projectPath);
  };

  // Manejador para cancelar análisis activo
  const handleCancelAnalysis = async () => {
    try {
      await cancelAnalysis();
    } catch (err) {
      console.error('Error al cancelar:', err);
    }
  };

  // Registrar atajos de teclado globales del IDE (Ctrl+O, Ctrl+Shift+A, Ctrl+B, Esc, etc.)
  useKeyboardShortcuts({
    onOpenProject: handleOpenProject,
    onAnalyzeProject: handleAnalyzeProject,
    onExportReport: () => void exportArchitectureReport('markdown'),
  });

  return (
    <AppShell
      onOpenProject={handleOpenProject}
      onOpenProjectByPath={handleOpenProjectByPath}
      onCloseProject={handleCloseProject}
      onAnalyzeProject={handleAnalyzeProject}
      onCancelAnalysis={handleCancelAnalysis}
      onLoadDemo={handleLoadDemo}
    />
  );
}

export default App;
