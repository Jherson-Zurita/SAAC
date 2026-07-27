import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useProjectStore } from './stores/useProjectStore';
import { useAiStore } from './stores/useAiStore';
import { useAnalysisHistoryStore } from './stores/useAnalysisHistoryStore';
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
  } = useProjectStore();

  const { setAiStatus } = useAiStore();
  const { setHistory } = useAnalysisHistoryStore();

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

    if (!targetPath) return;

    try {
      const res = await openProject(targetPath);
      if (res.success) {
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
      }
    } catch (err) {
      console.error('Error al abrir proyecto:', err);
      alert(`No se pudo abrir la ruta: ${targetPath}`);
    }
  };

  // Manejador para ejecutar el análisis AST end-to-end
  const handleAnalyzeProject = async () => {
    if (!projectPath) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeProject(projectPath);
      setLastAnalysisResult(result);

      if (result.amg) {
        setAmg(result.amg);

        // Evaluar reglas de arquitectura y actualizar Fitness Score
        try {
          const fitness = await evaluateFitnessRules(projectPath, result.amg);
          setFitnessResult(fitness);
        } catch (e) {
          console.warn('Error al evaluar reglas:', e);
        }

        // Actualizar historial
        try {
          const updatedHistory = await getAnalysisHistory(projectPath);
          setHistory(updatedHistory);
        } catch (e) {
          console.warn('Error al actualizar historial:', e);
        }
      }
    } catch (err) {
      console.error('Error durante el análisis del proyecto:', err);
      alert(`Error en el análisis: ${err}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Manejador para cancelar análisis activo
  const handleCancelAnalysis = async () => {
    try {
      await cancelAnalysis();
    } catch (err) {
      console.error('Error al cancelar:', err);
    }
  };

  return (
    <AppShell
      onOpenProject={handleOpenProject}
      onAnalyzeProject={handleAnalyzeProject}
      onCancelAnalysis={handleCancelAnalysis}
    />
  );
}

export default App;
