import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useProjectStore } from './stores/useProjectStore';
import { useAiStore } from './stores/useAiStore';
import { useUiStore } from './stores/useUiStore';
import { useAnalysisHistoryStore } from './stores/useAnalysisHistoryStore';
import { useDiagramStore } from './stores/useDiagramStore';
import { useRecentProjectsStore } from './stores/useRecentProjectsStore';
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
  const { theme } = useUiStore();
  const { setHistory } = useAnalysisHistoryStore();
  const { resetDiagram } = useDiagramStore();
  const { addRecentProject } = useRecentProjectsStore();

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

  // Suscripción a eventos de progreso en tiempo real y chequeo de IA
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function initListeners() {
      // 1. Escuchar eventos de progreso de análisis desde Rust (project://progress)
      unlisten = await onProjectProgress((event) => {
        setProgress(event);
      });

      // 2. Verificar disponibilidad de IA local (Ollama / Mock)
      try {
        const status = await checkAiStatus();
        setAiStatus(status);
      } catch (err) {
        console.warn('AI status check failed:', err);
      }
    }

    initListeners();

    return () => {
      if (unlisten) unlisten();
    };
  }, [setProgress, setAiStatus]);

  // Ejecutar el análisis AST para una ruta específica
  const runAnalysisForPath = async (targetPath: string) => {
    if (!targetPath) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeProject(targetPath);
      setLastAnalysisResult(result);

      if (result.amg) {
        resetDiagram();
        setAmg(result.amg);

        let calculatedFitnessScore: number | undefined;
        let fitnessData = null;

        // Evaluar reglas de arquitectura y actualizar Fitness Score
        try {
          fitnessData = await evaluateFitnessRules(targetPath, result.amg);
          setFitnessResult(fitnessData);
          calculatedFitnessScore = fitnessData.fitnessScore;
        } catch (e) {
          console.warn('Error al evaluar reglas:', e);
        }

        // Guardar resultado del análisis en la caché local
        saveCachedProjectData(targetPath, result.amg, fitnessData);

        // Actualizar historial
        try {
          const updatedHistory = await getAnalysisHistory(targetPath);
          setHistory(updatedHistory);
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
      alert(`Error en el análisis: ${err}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Abrir proyecto desde una ruta específica (cargando caché si existe o analizando si no)
  const handleOpenProjectByPath = async (targetPath: string) => {
    if (!targetPath) return;

    try {
      await openProject(targetPath);
      setProjectPath(targetPath);

      // Cargar metadatos y configuraciones del proyecto
      try {
        const config = await getProjectConfig(targetPath);
        setProjectConfig(config);

        const annotations = await loadProjectAnnotations(targetPath);
        setAnnotations(annotations);

        const historyData = await getAnalysisHistory(targetPath);
        setHistory(historyData);
      } catch (e) {
        console.warn('Error al cargar metadatos pre-frontend:', e);
      }

      // 1. Intentar cargar el análisis guardado previamente en caché
      const cached = loadCachedProjectData(targetPath);
      if (cached.amg) {
        resetDiagram();
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
      alert(`No se pudo abrir la ruta: ${targetPath}`);
    }
  };

  // Manejador para abrir diálogo nativo de selección de carpeta
  const handleOpenProject = async () => {
    let targetPath: string | null = null;

    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Seleccionar Carpeta de Proyecto para Análisis SAAC v2.0',
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
  const handleCloseProject = () => {
    resetProject();
    resetDiagram();
  };

  // Manejador para re-ejecutar el análisis AST manualmente desde la TopBar
  const handleAnalyzeProject = async () => {
    if (!projectPath) return;
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
  });

  return (
    <AppShell
      onOpenProject={handleOpenProject}
      onOpenProjectByPath={handleOpenProjectByPath}
      onCloseProject={handleCloseProject}
      onAnalyzeProject={handleAnalyzeProject}
      onCancelAnalysis={handleCancelAnalysis}
    />
  );
}

export default App;
