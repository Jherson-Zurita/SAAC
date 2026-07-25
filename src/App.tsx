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
      // 1. Escuchar eventos de progreso de análisis desde Rust
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
  }, []);

  // Manejador para abrir diálogo de carpeta de proyecto
  const handleOpenProject = async () => {
    const prompted = window.prompt(
      'Ingrese la ruta absoluta del directorio del proyecto a analizar:',
      projectPath || 'd:/Elvis/Semestre 2-2026/SAAC'
    );
    if (!prompted) return;
    const targetPath = prompted.trim();

    try {
      const res = await openProject(targetPath);
      if (res.success) {
        setProjectPath(targetPath);
        // Cargar configuraciones del proyecto
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

  // Manejador para cancelar análisis
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
