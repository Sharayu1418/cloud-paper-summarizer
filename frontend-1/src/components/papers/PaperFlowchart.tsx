'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Loader2, AlertCircle, Volume2, Pause, Tag, Users, Building2, Calendar, MapPin, Hash } from 'lucide-react';
import { getPaperInsights, synthesizeText } from '@/lib/api';
import { PaperInsights } from '@/lib/types';
import clsx from 'clsx';

interface PaperFlowchartProps {
  documentId: string;
  paperTitle: string;
}

// Custom node component with TTS
function CustomFlowNode({ data }: NodeProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleSpeak = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If playing, pause it
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // If audio already loaded but paused, resume
    if (audioRef.current && !isPlaying) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error resuming audio:', error);
      }
      return;
    }

    // Otherwise, load and play new audio
    if (isLoading) return;

    try {
      setIsLoading(true);
      const textToSpeak = `${data.label}. ${data.description || ''}`;
      const response = await synthesizeText(textToSpeak);
      
      const audioData = `data:${response.content_type};base64,${response.audio_base64}`;
      const audio = new Audio(audioData);
      audioRef.current = audio;
      
      audio.onplay = () => {
        setIsPlaying(true);
        setIsLoading(false);
      };
      
      audio.onpause = () => {
        setIsPlaying(false);
      };
      
      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
        audioRef.current = null;
      };
      
      await audio.play();
    } catch (error) {
      console.error('TTS error:', error);
      setIsLoading(false);
      audioRef.current = null;
    }
  };

  const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
    input: { bg: '#dcfce7', border: '#16a34a', text: '#166534' },
    process: { bg: '#dbeafe', border: '#2563eb', text: '#1e40af' },
    output: { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
    decision: { bg: '#fce7f3', border: '#db2777', text: '#9d174d' },
    problem: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
    method: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    results: { bg: '#dcfce7', border: '#10b981', text: '#065f46' },
    conclusion: { bg: '#f3e8ff', border: '#8b5cf6', text: '#5b21b6' },
    custom: { bg: '#f3f4f6', border: '#6b7280', text: '#374151' },
    default: { bg: '#f3f4f6', border: '#6b7280', text: '#374151' },
  };

  const colors = nodeColors[data.nodeType] || nodeColors.default;

  return (
    <div
      className="px-4 py-3 rounded-lg shadow-md border-2 min-w-[180px] max-w-[250px] relative"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-semibold text-sm" style={{ color: colors.text }}>
            {data.label}
          </div>
          {data.description && (
            <div className="text-xs mt-1 text-gray-600 line-clamp-3">
              {data.description}
            </div>
          )}
        </div>
        
        <button
          onClick={handleSpeak}
          disabled={isLoading}
          className={clsx(
            'p-1.5 rounded-full transition-colors flex-shrink-0',
            isPlaying
              ? 'bg-[var(--color-forest)] text-white'
              : 'bg-white/50 text-gray-500 hover:bg-white hover:text-[var(--color-forest)]'
          )}
          title={isPlaying ? 'Pause' : 'Listen to this step'}
        >
          {isLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={12} />
          ) : (
            <Volume2 size={12} />
          )}
        </button>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

const nodeTypes = {
  custom: CustomFlowNode,
};

export default function PaperFlowchart({ documentId, paperTitle }: PaperFlowchartProps) {
  const [insights, setInsights] = useState<PaperInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await getPaperInsights(documentId);
        setInsights(response.insights);
      } catch (err) {
        console.error('Failed to fetch insights:', err);
        setError(err instanceof Error ? err.message : 'Failed to load insights');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsights();
  }, [documentId]);

  useEffect(() => {
    if (!insights?.methodology_flowchart) return;

    const { nodes: flowNodes, edges: flowEdges } = insights.methodology_flowchart;

    // Convert to ReactFlow format with layout
    const spacing = { x: 300, y: 120 };
    const startX = 150;
    const startY = 50;

    const reactFlowNodes: Node[] = flowNodes.map((node: any, index) => {
      // Backend returns nodes with data nested, handle both formats
      const nodeData = node.data || node;
      const nodePosition = node.position || {
        x: startX + (index % 2) * 50,
        y: startY + index * spacing.y,
      };
      
      return {
        id: node.id,
        type: 'custom',
        position: nodePosition,
        data: {
          label: nodeData.label || nodeData.title || node.id,
          description: nodeData.description || '',
          nodeType: nodeData.nodeType || node.id || 'default',
        },
      };
    });

    const reactFlowEdges: Edge[] = flowEdges.map((edge: any, index) => ({
      id: edge.id || `e${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: edge.animated !== false,
      type: edge.type || 'smoothstep',
      style: edge.style || { stroke: '#6b7280' },
    }));

    setNodes(reactFlowNodes);
    setEdges(reactFlowEdges);
  }, [insights, setNodes, setEdges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-forest)] mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading methodology...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-[var(--color-error)] mx-auto mb-2" />
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-xs text-gray-400 mt-1">Insights may not be available for this paper yet</p>
        </div>
      </div>
    );
  }

  if (!insights || !insights.methodology_flowchart || nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No methodology flowchart available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[var(--color-parchment)] overflow-hidden">
      <div className="p-3 border-b border-[var(--color-parchment)] bg-[var(--color-cream)]">
        <h4 className="font-medium text-sm text-[var(--color-ink)]">
          Methodology Flowchart
        </h4>
      </div>

      <div className="h-[400px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <Background color="#e5e7eb" gap={16} />
        </ReactFlow>
      </div>

      {/* Summary */}
      {insights.summary && (
        <div className="p-3 border-t border-[var(--color-parchment)] bg-[var(--color-ivory)]">
          <h5 className="font-medium text-xs text-[var(--color-slate)] mb-1">Summary</h5>
          <p className="text-xs text-[var(--color-stone)] line-clamp-3">{insights.summary}</p>
        </div>
      )}

      {/* NLP Analysis from Comprehend */}
      {insights.nlp_analysis && (
        <div className="border-t border-[var(--color-parchment)]">
          {/* Key Phrases */}
          {insights.nlp_analysis.key_phrases && insights.nlp_analysis.key_phrases.length > 0 && (
            <div className="p-3 border-b border-[var(--color-parchment)]">
              <div className="flex items-center gap-1.5 mb-2">
                <Tag size={12} className="text-[var(--color-forest)]" />
                <h5 className="font-medium text-xs text-[var(--color-slate)]">Key Phrases</h5>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {insights.nlp_analysis.key_phrases.slice(0, 10).map((phrase, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[var(--color-parchment)] text-[var(--color-ink)]"
                    title={`Confidence: ${Math.round(phrase.score * 100)}%`}
                  >
                    {phrase.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Entities */}
          {insights.nlp_analysis.entities && Object.keys(insights.nlp_analysis.entities).length > 0 && (
            <div className="p-3 border-b border-[var(--color-parchment)]">
              <div className="flex items-center gap-1.5 mb-2">
                <Hash size={12} className="text-[var(--color-amber)]" />
                <h5 className="font-medium text-xs text-[var(--color-slate)]">Named Entities</h5>
              </div>
              <div className="space-y-2">
                {Object.entries(insights.nlp_analysis.entities).slice(0, 4).map(([entityType, entities]) => {
                  const entityIcons: Record<string, React.ReactNode> = {
                    PERSON: <Users size={10} className="text-blue-500" />,
                    ORGANIZATION: <Building2 size={10} className="text-purple-500" />,
                    DATE: <Calendar size={10} className="text-green-500" />,
                    LOCATION: <MapPin size={10} className="text-red-500" />,
                  };
                  const topEntities = (entities as Array<{text: string; score: number}>).slice(0, 3);
                  
                  return (
                    <div key={entityType} className="flex items-start gap-2">
                      <div className="flex items-center gap-1 min-w-[80px]">
                        {entityIcons[entityType] || <Tag size={10} className="text-gray-400" />}
                        <span className="text-xs text-[var(--color-stone)] capitalize">
                          {entityType.toLowerCase()}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {topEntities.map((entity, idx) => (
                          <span
                            key={idx}
                            className="text-xs text-[var(--color-ink)] bg-gray-100 px-1.5 py-0.5 rounded"
                          >
                            {entity.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sentiment */}
          {insights.nlp_analysis.sentiment && (
            <div className="p-3 bg-[var(--color-ivory)]">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-xs text-[var(--color-slate)]">Paper Tone</h5>
                <span className={clsx(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  insights.nlp_analysis.sentiment.sentiment === 'POSITIVE' && 'bg-green-100 text-green-700',
                  insights.nlp_analysis.sentiment.sentiment === 'NEGATIVE' && 'bg-red-100 text-red-700',
                  insights.nlp_analysis.sentiment.sentiment === 'NEUTRAL' && 'bg-gray-100 text-gray-700',
                  insights.nlp_analysis.sentiment.sentiment === 'MIXED' && 'bg-yellow-100 text-yellow-700',
                )}>
                  {insights.nlp_analysis.sentiment.sentiment}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
