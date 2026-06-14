import React, { useState } from 'react';
import { FileText, Play, ChevronRight, ChevronDown, Folder, FolderOpen, Settings, Search, GitBranch } from 'lucide-react';

const AdvertisingSandbox = () => {
  const [selectedFile, setSelectedFile] = useState('campaign.ts');
  const [expandedFolders, setExpandedFolders] = useState(['src', 'effects', 'campaigns']);
  const [code, setCode] = useState(`// Campaign Configuration
import { Campaign, Effect } from './types';

const formulaECampaign: Campaign = {
  targetCell: {
    name: 'attend_formula_e',
    requiredPower: 0.60
  },
  effects: [
    {
      id: 'visual-cheetah',
      carrier: {
        type: 'visual',
        asset: 'cheetah-running-4k.mp4',
        transform: { colorGrade: 'natural', motion: 'tracking' }
      },
      shift: {
        mechanism: 'A',
        sourceRegion: 'electric_car_generic',
        targetRegion: 'μ_speed',
        affinity: {
          targetCell: 'attend_formula_e',
          vsCell: 'ignore_formula_e',
          direction: 'closer'
        }
      },
      power: 0.30
    },
    {
      id: 'auditory-engine',
      carrier: {
        type: 'auditory',
        asset: 'formula-e-motor.mp3',
        transform: { tempo: 'accelerating', volume: 'crescendo' }
      },
      shift: {
        mechanism: 'A',
        sourceRegion: 'electric_car_generic',
        targetRegion: 'μ_power',
        affinity: {
          targetCell: 'attend_formula_e',
          vsCell: 'ignore_formula_e',
          direction: 'closer'
        }
      },
      power: 0.35
    },
    {
      id: 'temporal-race',
      carrier: {
        type: 'temporal',
        transform: { rhythm: 'accelerating', cuts: 'rapid' }
      },
      shift: {
        mechanism: 'C',
        sourceRegion: 'electric_car_generic',
        targetRegion: 'μ_competition',
        affinity: {
          targetCell: 'attend_formula_e',
          vsCell: 'ignore_formula_e',
          direction: 'closer'
        }
      },
      power: 0.25
    }
  ],
  timeline: [
    { start: 0, duration: 2, effectIndex: 0, regime: 'turbulent' },
    { start: 2, duration: 3, effectIndex: 0, regime: 'aperture' },
    { start: 5, duration: 10, effectIndex: 1, regime: 'cascade' },
    { start: 15, duration: 10, effectIndex: 2, regime: 'coherent' },
    { start: 25, duration: 5, effectIndex: 2, regime: 'phase-locked' }
  ]
};

export default formulaECampaign;`);

  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const fileTree = {
    name: 'advertising-engine',
    type: 'folder',
    children: [
      {
        name: 'src',
        type: 'folder',
        children: [
          {
            name: 'campaigns',
            type: 'folder',
            children: [
              { name: 'campaign.ts', type: 'file', icon: '📄' },
              { name: 'formula-e.ts', type: 'file', icon: '🏎️' },
              { name: 'tequila.ts', type: 'file', icon: '🥃' }
            ]
          },
          {
            name: 'effects',
            type: 'folder',
            children: [
              { name: 'library.ts', type: 'file', icon: '📚' },
              { name: 'coherence.ts', type: 'file', icon: '🔺' },
              { name: 'power.ts', type: 'file', icon: '⚡' }
            ]
          },
          {
            name: 'validators',
            type: 'folder',
            children: [
              { name: 'coherence-validator.ts', type: 'file', icon: '✓' },
              { name: 'power-calculator.ts', type: 'file', icon: '🧮' }
            ]
          },
          { name: 'types.ts', type: 'file', icon: '📋' },
          { name: 'index.ts', type: 'file', icon: '🎯' }
        ]
      },
      {
        name: 'assets',
        type: 'folder',
        children: [
          { name: 'cheetah-running-4k.mp4', type: 'file', icon: '🎥' },
          { name: 'formula-e-motor.mp3', type: 'file', icon: '🔊' }
        ]
      },
      { name: 'package.json', type: 'file', icon: '📦' },
      { name: 'tsconfig.json', type: 'file', icon: '⚙️' },
      { name: 'README.md', type: 'file', icon: '📖' }
    ]
  };

  const toggleFolder = (folderName) => {
    setExpandedFolders(prev =>
      prev.includes(folderName)
        ? prev.filter(f => f !== folderName)
        : [...prev, folderName]
    );
  };

  const renderFileTree = (node, depth = 0) => {
    if (node.type === 'file') {
      return (
        <div
          key={node.name}
          className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-700 ${
            selectedFile === node.name ? 'bg-gray-700' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedFile(node.name)}
        >
          <span className="text-sm">{node.icon}</span>
          <span className="text-sm text-gray-300">{node.name}</span>
        </div>
      );
    }

    const isExpanded = expandedFolders.includes(node.name);

    return (
      <div key={node.name}>
        <div
          className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-700"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => toggleFolder(node.name)}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-blue-400" />
          ) : (
            <Folder className="w-4 h-4 text-blue-400" />
          )}
          <span className="text-sm text-gray-300">{node.name}</span>
        </div>
        {isExpanded && node.children && (
          <div>
            {node.children.map(child => renderFileTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const runAnalysis = () => {
    setIsRunning(true);
    setOutput('Running campaign analysis...\n\n');

    setTimeout(() => {
      const analysisOutput = `✓ Campaign validation started

📊 Effect Analysis:
─────────────────────────────────────────────────
Effect 1: visual-cheetah
  Mechanism: A (Re-perception)
  Power: κ₁ = 0.30
  Shift: electric_car_generic → μ_speed
  Status: ✓ Valid

Effect 2: auditory-engine
  Mechanism: A (Re-perception)
  Power: κ₂ = 0.35
  Shift: electric_car_generic → μ_power
  Status: ✓ Valid

Effect 3: temporal-race
  Mechanism: C (Re-framing)
  Power: κ₃ = 0.25
  Shift: electric_car_generic → μ_competition
  Status: ✓ Valid

🔺 Coherence Validation:
─────────────────────────────────────────────────
Building support graph...
  visual-cheetah ⊢ auditory-engine
  auditory-engine ⊢ temporal-race
  temporal-race ⊢ visual-cheetah

Detecting cycles...
  Found 3-cycle: [visual-cheetah → auditory-engine → temporal-race]
  ✓ Coherence Triangle satisfied

⚡ Power Calculation:
─────────────────────────────────────────────────
κ_composite = 1 - ∏(1 - κᵢ)
            = 1 - (1 - 0.30)(1 - 0.35)(1 - 0.25)
            = 1 - (0.70)(0.65)(0.75)
            = 1 - 0.34125
            = 0.65875

✓ Composite power: 65.9%
✓ Exceeds target requirement: 60.0%

🎯 Regime Transitions:
─────────────────────────────────────────────────
[0-2s]   Turbulent → Aperture (visual-cheetah)
[2-5s]   Aperture installation
[5-15s]  Cascade (auditory-engine)
[15-25s] Coherent (temporal-race)
[25-30s] Phase-locked

Total duration: 30 seconds

📈 Expected Outcomes:
─────────────────────────────────────────────────
Initial R_ens: 0.15 (turbulent)
Target R_ens: ≥ 0.95 (phase-locked)

Predicted R_ens: 0.97 ± 0.02
Confidence: 94%

✓ Campaign is valid and ready for rendering
✓ All coherence constraints satisfied
✓ Sufficient catalytic power to reach target cell

💾 Ready to export to Remotion`;

      setOutput(analysisOutput);
      setIsRunning(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-mono">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm font-semibold text-blue-400">Advertising Effect Sandbox</span>
        </div>
        <div className="flex items-center gap-4">
          <Search className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-200" />
          <GitBranch className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-200" />
          <Settings className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-200" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* File Explorer */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-gray-700">
            Explorer
          </div>
          <div className="py-2">
            {renderFileTree(fileTree)}
          </div>
        </div>

        {/* Code Editor */}
        <div className="flex-1 flex flex-col bg-gray-900">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-sm">{selectedFile}</span>
            </div>
            <button
              onClick={runAnalysis}
              disabled={isRunning}
              className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm transition-colors"
            >
              <Play className="w-3 h-3" />
              {isRunning ? 'Running...' : 'Run Analysis'}
            </button>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 p-4 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
            style={{ tabSize: 2 }}
            spellCheck={false}
          />
          <div className="px-4 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
            Line 1, Col 1 • TypeScript • UTF-8 • LF
          </div>
        </div>

        {/* Output Panel */}
        <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm font-semibold">
            Analysis Output
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
              {output || 'Click "Run Analysis" to validate campaign...'}
            </pre>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-blue-600 text-white text-xs">
        <div className="flex items-center gap-4">
          <span>⚡ Remotion Engine</span>
          <span>•</span>
          <span>Effects: 3</span>
          <span>•</span>
          <span>κ_composite: 65.9%</span>
        </div>
        <div className="flex items-center gap-4">
          <span>✓ Coherent</span>
          <span>•</span>
          <span>Ready</span>
        </div>
      </div>
    </div>
  );
};

export default AdvertisingSandbox;
