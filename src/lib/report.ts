/**
 * report.ts — Informe de arquitectura exportable (Markdown / PDF).
 *
 * `buildReport` arma un documento neutro (bloques); `renderMarkdown` y
 * `renderPdf` lo serializan, así ambos formatos tienen el mismo contenido.
 */

import type {
  AnalysisHistory,
  Antipattern,
  ArchitectureModelGraph,
  FitnessEvaluationResult,
  Module,
  ProjectAnnotations,
  Severity,
} from '../../shared/types';

export type ReportBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'keyValue'; rows: Array<[string, string]> }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'list'; items: string[] };

export interface ArchitectureReport {
  title: string;
  fileStem: string;
  blocks: ReportBlock[];
}

export interface ReportInput {
  amg: ArchitectureModelGraph;
  projectPath: string | null;
  fitness: FitnessEvaluationResult | null;
  annotations: ProjectAnnotations | null;
  history: AnalysisHistory | null;
  author?: string;
  generatedAt?: Date;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
  info: 'Info',
};
const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const ANTIPATTERN_LABEL: Record<string, string> = {
  'circular-dependency': 'Dependencia circular',
  'god-module': 'God Module',
  'layer-violation': 'Violación de capas',
  'shotgun-surgery': 'Shotgun Surgery',
  'feature-envy': 'Feature Envy',
  'lollipop-problem': 'Lollipop Problem',
  'concrete-class-dependency': 'Dependencia de clase concreta',
};

const ADR_STATUS_LABEL: Record<string, string> = {
  Proposed: 'Propuesta',
  Accepted: 'Aceptada',
  Rejected: 'Rechazada',
  Deprecated: 'Obsoleta',
  Superseded: 'Reemplazada',
};

const TOP_RISK_MODULES = 15;
const HISTORY_RUNS = 10;

const fmt = (n: number, digits = 2) => (Number.isFinite(n) ? n.toFixed(digits) : '—');
const int = (n: number) =>
  Number.isFinite(n) ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—';
const date = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es');
};

function makeRelative(projectPath: string | null) {
  const root = projectPath?.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return (id: string) => {
    const normalized = id.replace(/\\/g, '/');
    if (root && normalized.toLowerCase().startsWith(`${root}/`)) return normalized.slice(root.length + 1);
    return normalized;
  };
}

/** Riesgo relativo de un módulo: baja mantenibilidad, alta complejidad y alto acoplamiento eferente. */
function moduleRisk(m: Module): number {
  return (
    (100 - Math.min(100, m.metrics.maintainabilityIndex)) * 1.0 +
    m.metrics.cyclomaticComplexityMax * 1.5 +
    m.metrics.ce * 2 +
    m.metrics.distance * 20
  );
}

export function buildReport(input: ReportInput): ArchitectureReport {
  const { amg, fitness, annotations, history } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const rel = makeRelative(input.projectPath);
  const moduleName = new Map(amg.modules.map((m) => [m.id, rel(m.id)]));
  const nameOf = (id: string) => moduleName.get(id) ?? rel(id);
  const blocks: ReportBlock[] = [];
  const h = (level: 1 | 2 | 3, text: string) => blocks.push({ type: 'heading', level, text });
  const p = (text: string) => blocks.push({ type: 'paragraph', text });

  const title = `Informe de Arquitectura — ${amg.projectName}`;
  h(1, title);
  blocks.push({
    type: 'keyValue',
    rows: [
      ['Proyecto', amg.projectName],
      ...(input.projectPath ? [['Ruta', input.projectPath] as [string, string]] : []),
      ['Generado', generatedAt.toLocaleString('es')],
      ...(input.author?.trim() ? [['Autor', input.author.trim()] as [string, string]] : []),
      ['Fecha del análisis', date(amg.analyzedAt)],
      ['Corrida', amg.analysisRunId],
      ['Tipo de proyecto', amg.detectedType],
      ['Estilo arquitectónico', `${amg.detectedStyle} (confianza ${Math.round(amg.styleConfidence * 100)}%)`],
    ],
  });

  // ── Resumen ──
  const active = amg.antipatterns.filter((a) => !a.ignored);
  const ignored = amg.antipatterns.filter((a) => a.ignored);
  const bySeverity = SEVERITY_ORDER.map((s) => [s, active.filter((a) => a.severity === s).length] as const).filter(
    ([, n]) => n > 0
  );
  const fitnessScore =
    fitness?.fitnessScore ??
    history?.runs.find((r) => r.runId === amg.analysisRunId)?.fitnessScore ??
    amg.metrics.fitnessScore;

  h(2, '1. Resumen ejecutivo');
  p(
    `El proyecto tiene ${int(amg.metrics.totalModules)} módulos, ${int(amg.metrics.totalLoc)} líneas de código y ` +
      `${int(amg.metrics.totalDependencies)} dependencias internas. El Fitness Score es ${fmt(fitnessScore, 1)}/100` +
      (fitness ? ` (${fitness.passedRules} de ${fitness.totalRules} reglas cumplidas)` : '') +
      ` y el índice de mantenibilidad promedio es ${fmt(amg.metrics.maintainabilityIndexAvg, 1)}.`
  );
  p(
    active.length === 0
      ? 'No se detectaron antipatrones activos.'
      : `Se detectaron ${active.length} antipatrones activos (` +
          bySeverity.map(([s, n]) => `${n} ${SEVERITY_LABEL[s].toLowerCase()}`).join(', ') +
          `)` +
          (ignored.length ? ` y ${ignored.length} ignorados con justificación.` : '.')
  );

  // ── Métricas ──
  const m = amg.metrics;
  h(2, '2. Métricas del proyecto');
  blocks.push({
    type: 'table',
    columns: ['Métrica', 'Valor'],
    rows: [
      ['Fitness Score', `${fmt(fitnessScore, 1)} / 100`],
      ['Índice de mantenibilidad promedio', fmt(m.maintainabilityIndexAvg, 1)],
      ['Módulos', int(m.totalModules)],
      ['Clases', int(m.totalClasses)],
      ['Funciones', int(m.totalFunctions)],
      ['LOC / LLOC', `${int(m.totalLoc)} / ${int(m.totalLloc)}`],
      ['Dependencias internas', int(m.totalDependencies)],
      ['Dependencias cíclicas', int(m.cyclicDependencyCount)],
      ['Complejidad ciclomática promedio', fmt(m.avgCyclomaticComplexity)],
      ['Inestabilidad promedio (I)', fmt(m.avgInstability)],
      ['Abstracción promedio (A)', fmt(m.avgAbstractness)],
      ['Distancia a la secuencia principal (D)', fmt(m.avgDistance)],
      ['Cuantos arquitectónicos', int(m.quantumCount)],
    ],
  });

  // ── Fitness ──
  h(2, '3. Fitness functions');
  if (fitness && fitness.evaluations.length) {
    p(`${fitness.passedRules} reglas cumplidas y ${fitness.failedRules} incumplidas de ${fitness.totalRules}.`);
    blocks.push({
      type: 'table',
      columns: ['Regla', 'Severidad', 'Peso', 'Resultado', 'Detalle'],
      rows: fitness.evaluations.map((e) => [
        e.ruleName,
        SEVERITY_LABEL[e.severity as Severity] ?? e.severity,
        fmt(e.weight, 1),
        e.passed ? 'Cumple' : 'No cumple',
        e.message,
      ]),
    });
  } else {
    p('No hay evaluación de reglas disponible para este análisis.');
  }

  // ── Antipatrones ──
  h(2, '4. Antipatrones');
  if (!amg.antipatterns.length) {
    p('No se detectaron antipatrones.');
  } else {
    const sorted = [...active].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
    );
    if (sorted.length) {
      blocks.push({
        type: 'table',
        columns: ['Severidad', 'Tipo', 'Antipatrón', 'Módulos afectados'],
        rows: sorted.map((a) => [
          SEVERITY_LABEL[a.severity],
          ANTIPATTERN_LABEL[a.antipatternType] ?? a.antipatternType,
          a.name,
          String(a.affectedModuleIds.length),
        ]),
      });
      sorted.forEach((a, i) => describeAntipattern(a, `4.${i + 1}`));
    }
    if (ignored.length) {
      h(3, 'Antipatrones ignorados');
      const justification = new Map(annotations?.ignoredAntipatterns.map((x) => [x.antipatternId, x]) ?? []);
      blocks.push({
        type: 'table',
        columns: ['Antipatrón', 'Severidad', 'Justificación', 'Autor'],
        rows: ignored.map((a) => {
          const j = justification.get(a.id);
          return [a.name, SEVERITY_LABEL[a.severity], j?.justification ?? a.ignoreJustification ?? '—', j?.author ?? '—'];
        }),
      });
    }
  }

  function describeAntipattern(a: Antipattern, number: string) {
    h(3, `${number} ${a.name} (${SEVERITY_LABEL[a.severity]})`);
    p(a.description);
    if (a.cyclePath?.length) p(`Ciclo: ${a.cyclePath.map(nameOf).join(' → ')}`);
    if (a.suggestedBreakPoint) p(`Punto de quiebre sugerido: ${a.suggestedBreakPoint}`);
    if (a.refactorSuggestion) p(`Refactorización sugerida: ${a.refactorSuggestion}`);
    if (a.affectedModuleIds.length && !a.cyclePath?.length) {
      blocks.push({ type: 'list', items: a.affectedModuleIds.slice(0, 20).map(nameOf) });
      if (a.affectedModuleIds.length > 20) p(`… y ${a.affectedModuleIds.length - 20} módulos más.`);
    }
  }

  // ── Módulos de mayor riesgo ──
  h(2, '5. Módulos con mayor riesgo');
  p(
    'Ordenados por una combinación de baja mantenibilidad, complejidad ciclomática máxima, acoplamiento eferente (Ce) y distancia a la secuencia principal.'
  );
  const moduleRow = (mod: Module) => [
    nameOf(mod.id),
    mod.language,
    int(mod.loc),
    fmt(mod.metrics.maintainabilityIndex, 0),
    String(mod.metrics.ca),
    String(mod.metrics.ce),
    fmt(mod.metrics.instability),
    fmt(mod.metrics.distance),
    String(mod.metrics.cyclomaticComplexityMax),
  ];
  const moduleColumns = ['Módulo', 'Lenguaje', 'LOC', 'MI', 'Ca', 'Ce', 'I', 'D', 'CC máx.'];
  blocks.push({
    type: 'table',
    columns: moduleColumns,
    rows: [...amg.modules].sort((a, b) => moduleRisk(b) - moduleRisk(a)).slice(0, TOP_RISK_MODULES).map(moduleRow),
  });

  // ── C4 ──
  h(2, '6. Contenedores y sistemas externos');
  if (amg.containers.length) {
    blocks.push({
      type: 'table',
      columns: ['Contenedor', 'Tipo', 'Tecnología', 'Módulos'],
      rows: amg.containers.map((c) => [c.name, c.containerType, c.technology, String(c.moduleIds.length)]),
    });
  } else {
    p('No se identificaron contenedores.');
  }
  if (amg.externalSystems.length) {
    blocks.push({
      type: 'table',
      columns: ['Sistema externo', 'Tipo', 'Protocolo', 'Detectado vía'],
      rows: amg.externalSystems.map((s) => [s.name, s.systemType, s.protocol, s.detectedVia]),
    });
  }

  // ── ADRs ──
  h(2, '7. Decisiones de arquitectura (ADRs)');
  const adrs = [...(annotations?.adrs ?? [])].sort((a, b) => a.number - b.number);
  if (!adrs.length) {
    p('No hay ADRs registrados para este proyecto.');
  } else {
    blocks.push({
      type: 'table',
      columns: ['N.º', 'Título', 'Estado', 'Fecha'],
      rows: adrs.map((a) => [
        `ADR-${String(a.number).padStart(3, '0')}`,
        a.title,
        ADR_STATUS_LABEL[a.status] ?? a.status,
        a.date,
      ]),
    });
    for (const adr of adrs) {
      h(3, `ADR-${String(adr.number).padStart(3, '0')}: ${adr.title}`);
      blocks.push({
        type: 'keyValue',
        rows: [
          ['Estado', ADR_STATUS_LABEL[adr.status] ?? adr.status],
          ['Fecha', adr.date],
          ['Autor', adr.author || '—'],
        ],
      });
      p(`Contexto: ${adr.context || '—'}`);
      p(`Decisión: ${adr.decision || '—'}`);
      p(`Consecuencias: ${adr.consequences || '—'}`);
    }
  }

  // ── Riesgos ──
  h(2, '8. Riesgos registrados');
  const risks = annotations?.risks ?? [];
  if (!risks.length) {
    p('No hay riesgos registrados.');
  } else {
    blocks.push({
      type: 'table',
      columns: ['Riesgo', 'Severidad', 'Descripción', 'Mitigación', 'Módulos'],
      rows: risks.map((r) => [r.title, r.severity, r.description, r.mitigation, String(r.affectedModuleIds.length)]),
    });
  }

  // ── Historial ──
  h(2, '9. Historial de análisis');
  const runs = [...(history?.runs ?? [])]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, HISTORY_RUNS);
  if (!runs.length) {
    p('No hay corridas previas registradas.');
  } else {
    blocks.push({
      type: 'table',
      columns: ['Fecha', 'Archivos', 'Módulos', 'Dependencias', 'Antipatrones', 'Fitness', 'Duración'],
      rows: runs.map((r) => [
        date(r.timestamp),
        `${r.successful}/${r.totalFiles}`,
        String(r.moduleCount),
        String(r.dependencyCount),
        String(r.antipatternCount),
        fmt(r.fitnessScore, 1),
        `${fmt(r.durationMs / 1000, 1)} s`,
      ]),
    });
  }

  // ── Anexo ──
  h(2, 'Anexo A. Catálogo de módulos');
  blocks.push({
    type: 'table',
    columns: moduleColumns,
    rows: [...amg.modules].sort((a, b) => nameOf(a.id).localeCompare(nameOf(b.id))).map(moduleRow),
  });

  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())}`;
  return { title, fileStem: `informe-arquitectura-${amg.projectName}-${stamp}`, blocks };
}

// ── Markdown ──

const mdCell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function renderMarkdown(report: ArchitectureReport): string {
  const out: string[] = [];
  for (const block of report.blocks) {
    switch (block.type) {
      case 'heading':
        out.push(`${'#'.repeat(block.level)} ${block.text}`, '');
        break;
      case 'paragraph':
        out.push(block.text, '');
        break;
      case 'keyValue':
        out.push(...block.rows.map(([k, v]) => `- **${k}:** ${v}`), '');
        break;
      case 'list':
        out.push(...block.items.map((item) => `- ${item}`), '');
        break;
      case 'table':
        out.push(
          `| ${block.columns.map(mdCell).join(' | ')} |`,
          `| ${block.columns.map(() => '---').join(' | ')} |`,
          ...block.rows.map((row) => `| ${row.map(mdCell).join(' | ')} |`),
          ''
        );
        break;
    }
  }
  out.push('---', '', '_Generado con SAAC — Sistema de Análisis de Arquitectura de Código._', '');
  return out.join('\n');
}

// ── PDF ──

/** Las fuentes estándar de jsPDF solo cubren Latin-1 (incluye tildes y ñ). */
function pdfText(s: string): string {
  return s
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/•/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

const ACCENT: [number, number, number] = [124, 108, 255];

export async function renderPdf(report: ArchitectureReport): Promise<Uint8Array> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const lastTableY = () => (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;

  const writeLines = (text: string, size: number, style: 'normal' | 'bold', gapAfter: number, indent = 0) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(pdfText(text), contentWidth - indent);
    const lineHeight = size * 1.35;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin + indent, y + size);
      y += lineHeight;
    }
    y += gapAfter;
  };

  const tableBase = {
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, overflow: 'linebreak' as const },
    headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: [245, 244, 255] as [number, number, number] },
  };

  for (const block of report.blocks) {
    switch (block.type) {
      case 'heading': {
        const size = block.level === 1 ? 18 : block.level === 2 ? 13 : 10.5;
        ensureSpace(size * 3);
        if (block.level === 2) y += 8;
        doc.setTextColor(block.level === 3 ? 40 : ACCENT[0], block.level === 3 ? 40 : ACCENT[1], block.level === 3 ? 40 : ACCENT[2]);
        writeLines(block.text, size, 'bold', block.level === 1 ? 10 : 4);
        doc.setTextColor(30, 30, 30);
        if (block.level === 2) {
          doc.setDrawColor(...ACCENT);
          doc.setLineWidth(0.6);
          doc.line(margin, y - 2, pageWidth - margin, y - 2);
          y += 6;
        }
        break;
      }
      case 'paragraph':
        writeLines(block.text, 9.5, 'normal', 6);
        break;
      case 'list':
        for (const item of block.items) writeLines(`- ${item}`, 9, 'normal', 1, 8);
        y += 5;
        break;
      case 'keyValue':
        autoTable(doc, {
          ...tableBase,
          startY: y,
          theme: 'plain',
          body: block.rows.map(([k, v]) => [pdfText(k), pdfText(v)]),
          styles: { ...tableBase.styles, fontSize: 9 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 140 } },
        });
        y = lastTableY() + 10;
        break;
      case 'table':
        autoTable(doc, {
          ...tableBase,
          startY: y,
          theme: 'striped',
          head: [block.columns.map(pdfText)],
          body: block.rows.map((row) => row.map(pdfText)),
        });
        y = lastTableY() + 12;
        break;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text(pdfText(report.title), margin, pageHeight - 24);
    doc.text(`Página ${i} de ${pages}`, pageWidth - margin, pageHeight - 24, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
