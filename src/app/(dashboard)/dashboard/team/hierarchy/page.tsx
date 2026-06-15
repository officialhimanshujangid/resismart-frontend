'use client';

import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import Tree, { RawNodeDatum, RenderCustomNodeElementFn } from 'react-d3-tree';
import {
  Paper,
  CircularProgress,
  Typography,
  IconButton,
  Avatar,
  Chip,
  Tooltip
} from '@mui/material';
import {
  ShieldCheck,
  Briefcase,
  GitFork,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Users,
  Layers
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface UserBrief {
  _id: string;
  name: string;
  email: string;
  profileImage?: string;
}

interface Designation {
  _id: string;
  name: string;
}

interface SystemEmployee {
  _id: string;
  employeeCode: string;
  phone?: string;
  isActive: boolean;
  userId: UserBrief;
  designationId: Designation;
  reportingManagerId?: UserBrief;
}

export default function TeamHierarchyPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<RawNodeDatum | null>(null);
  const [zoom, setZoom] = useState(0.9);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        setLoading(true);
        const [empRes, mgrRes] = await Promise.all([
          api.get('/system-employees?isPagination=false&includeInactive=false'),
          api.get('/system-employees/reporting-managers'),
        ]);

        const employees: SystemEmployee[] = empRes.data.employees || [];
        const managers: UserBrief[] = mgrRes.data.managers || [];

        // 1. Identify Owner: The user in managers who is NOT an employee
        const employeeUserIds = new Set(employees.map(e => e.userId._id));
        const ownerUser = managers.find(m => !employeeUserIds.has(m._id));

        if (!ownerUser) {
          showToast('Could not identify system owner in reporting managers', 'error');
          setLoading(false);
          return;
        }

        // 2. Build adjacency list of managers -> direct reports
        const managerToReportsMap: Record<string, SystemEmployee[]> = {};
        
        employees.forEach(emp => {
          const managerId = emp.reportingManagerId?._id || ownerUser._id;
          if (!managerToReportsMap[managerId]) {
            managerToReportsMap[managerId] = [];
          }
          managerToReportsMap[managerId].push(emp);
        });

        // 3. Build tree recursively starting from ownerUser (mapping to D3 format)
        const buildTree = (user: UserBrief, role: 'owner' | 'employee', employeeDetails?: SystemEmployee): RawNodeDatum => {
          const directReports = managerToReportsMap[user._id] || [];
          const childrenNodes = directReports.map(emp => buildTree(emp.userId, 'employee', emp));

          return {
            name: user.name,
            attributes: {
              id: user._id,
              email: user.email,
              role,
              designation: employeeDetails?.designationId?.name || '',
              employeeCode: employeeDetails?.employeeCode || '',
              profileImage: user.profileImage || '',
            },
            children: childrenNodes,
          };
        };

        const hierarchyRoot = buildTree(ownerUser, 'owner');
        setTreeData(hierarchyRoot);
      } catch (err) {
        showToast('Failed to build organizational hierarchy', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchHierarchy();
  }, [showToast]);

  // Center the root node horizontally or vertically depending on orientation
  useEffect(() => {
    if (mounted && containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (orientation === 'vertical') {
        setTranslate({ x: width / 2, y: 70 });
      } else {
        setTranslate({ x: 150, y: height / 2 || 250 });
      }
    }
  }, [mounted, loading, orientation]);

  const handleZoomIn = () => setZoom(z => Math.min(1.4, z + 0.1));
  const handleZoomOut = () => setZoom(z => Math.max(0.4, z - 0.1));
  
  const handleZoomReset = () => {
    setZoom(0.9);
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (orientation === 'vertical') {
        setTranslate({ x: width / 2, y: 70 });
      } else {
        setTranslate({ x: 150, y: height / 2 || 250 });
      }
    }
  };

  // Custom node element renderer embedding HTML in SVG space
  const renderCardNode: RenderCustomNodeElementFn = ({ nodeDatum, toggleNode }) => {
    const attrs = nodeDatum.attributes || {};
    const hasChildren = nodeDatum.children && nodeDatum.children.length > 0;
    const isOwner = attrs.role === 'owner';
    const isManager = hasChildren;
    const isCollapsed = nodeDatum.__rd3t.collapsed;
    const directReportsCount = nodeDatum.children?.length || 0;
    
    const cardWidth = 280;
    const cardHeight = 130;
    
    // Center card relative to the D3 node coordinates
    const xOffset = -cardWidth / 2;
    const yOffset = -cardHeight / 2;

    return (
      <g>
        <foreignObject
          width={cardWidth}
          height={cardHeight}
          x={xOffset}
          y={yOffset}
          className="overflow-visible"
        >
          <div 
            className={`relative p-4 rounded-2xl border bg-white/95 backdrop-blur-md shadow-md transition-all duration-300 select-none flex flex-col justify-between border-l-[6px] hover:shadow-xl hover:-translate-y-1.5 ${
              isOwner 
                ? 'border-l-blue-600 border-slate-200/80 shadow-blue-500/5 hover:border-blue-500' 
                : isManager 
                  ? 'border-l-violet-500 border-slate-200/80 shadow-violet-500/5 hover:border-violet-400' 
                  : 'border-l-emerald-500 border-slate-200/80 shadow-emerald-500/5 hover:border-emerald-400'
            }`}
            style={{ height: '100%', boxSizing: 'border-box' }}
          >
            {/* Top Row: Avatar and User Details */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar
                  src={attrs.profileImage as string}
                  sx={{
                    bgcolor: isOwner ? '#2563eb' : isManager ? '#8b5cf6' : '#10b981',
                    width: 44,
                    height: 44,
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
                    border: '2px solid white'
                  }}
                  className={`transition-all duration-300 ${
                    isOwner ? 'ring-4 ring-blue-500/20' : isManager ? 'ring-4 ring-violet-500/20' : 'ring-4 ring-emerald-500/20'
                  }`}
                >
                  {nodeDatum.name.charAt(0).toUpperCase()}
                </Avatar>
                {/* Active status indicator dot */}
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                  isOwner ? 'bg-blue-500' : isManager ? 'bg-violet-500' : 'bg-emerald-500'
                }`} />
              </div>
              
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-slate-800 text-sm truncate tracking-tight leading-snug">
                  {nodeDatum.name}
                </h4>
                <p className="text-[10.5px] text-slate-500 truncate font-semibold">
                  {attrs.email}
                </p>
                {attrs.employeeCode && (
                  <span className="inline-block font-mono text-[8.5px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-md mt-1">
                    {attrs.employeeCode}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Row: Designation Badge & Expand/Collapse Toggle */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2">
              {isOwner ? (
                <Chip
                  label="Owner / CEO"
                  size="small"
                  icon={<ShieldCheck className="w-3 h-3" />}
                  sx={{
                    fontSize: '8.5px',
                    height: '20px',
                    fontWeight: 900,
                    backgroundColor: '#eff6ff',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    '.MuiChip-icon': { color: '#2563eb' }
                  }}
                />
              ) : (
                attrs.designation && (
                  <Chip
                    label={attrs.designation as string}
                    size="small"
                    icon={<Briefcase className="w-2.5 h-2.5" />}
                    sx={{
                      fontSize: '8.5px',
                      height: '20px',
                      fontWeight: 800,
                      backgroundColor: '#f8fafc',
                      color: '#475569',
                      border: '1px solid #e2e8f0',
                      maxWidth: '125px',
                      '.MuiChip-icon': { color: '#64748b' },
                      '.MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '4px' }
                    }}
                  />
                )
              )}
              
              {hasChildren && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNode();
                  }}
                  className={`flex items-center gap-1.5 text-[8.5px] font-black uppercase px-2.5 py-1 rounded-full cursor-pointer transition-all duration-300 shadow-sm ${
                    isCollapsed 
                      ? 'text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-blue-500/20 hover:scale-105' 
                      : 'text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-2.5 h-2.5" />
                  <span>
                    {isCollapsed ? `Show Team (${directReportsCount})` : 'Hide Team'}
                  </span>
                  {isCollapsed ? (
                    <ChevronDown className="w-2.5 h-2.5" />
                  ) : (
                    <ChevronUp className="w-2.5 h-2.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </foreignObject>
      </g>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <style>{`
        .rd3t-link {
          stroke: #cbd5e1;
          stroke-width: 2px;
          fill: none;
          stroke-dasharray: 6, 4;
          animation: linkFlow 25s linear infinite;
          transition: all 0.3s ease;
        }
        @keyframes linkFlow {
          to {
            stroke-dashoffset: -500;
          }
        }
        .rd3t-link:hover {
          stroke: #2563eb;
          stroke-width: 3px;
          filter: drop-shadow(0 0 4px rgba(37, 99, 235, 0.4));
        }
        .rd3t-node {
          transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <GitFork className="w-6 h-6 text-[#0a5bd7]" /> Team Hierarchy
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Interactive organizational chart tree of system employees</p>
        </div>
        
        {/* Zoom & Canvas Controls */}
        {!loading && treeData && (
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm self-start sm:self-auto z-20">
            <Tooltip title={orientation === 'vertical' ? "Switch to Horizontal Layout" : "Switch to Vertical Layout"}>
              <IconButton 
                onClick={() => setOrientation(o => o === 'vertical' ? 'horizontal' : 'vertical')}
                size="small" 
                className="text-slate-500 hover:bg-slate-50 rounded-lg"
              >
                <Layers className="w-4 h-4" />
              </IconButton>
            </Tooltip>
            <div className="h-4 w-[1px] bg-slate-200 mx-1" />
            <Tooltip title="Zoom Out">
              <IconButton onClick={handleZoomOut} size="small" className="text-slate-500 hover:bg-slate-50 rounded-lg">
                <ZoomOut className="w-4 h-4" />
              </IconButton>
            </Tooltip>
            <span className="text-xs font-black text-slate-500 w-12 text-center select-none">
              {Math.round(zoom * 100)}%
            </span>
            <Tooltip title="Zoom In">
              <IconButton onClick={handleZoomIn} size="small" className="text-slate-500 hover:bg-slate-50 rounded-lg">
                <ZoomIn className="w-4 h-4" />
              </IconButton>
            </Tooltip>
            <div className="h-4 w-[1px] bg-slate-200 mx-1" />
            <Tooltip title="Recenter Board">
              <IconButton onClick={handleZoomReset} size="small" className="text-slate-500 hover:bg-slate-50 rounded-lg">
                <Maximize2 className="w-4 h-4" />
              </IconButton>
            </Tooltip>
          </div>
        )}
      </div>

      {loading || !mounted ? (
        <div className="flex items-center justify-center py-20 bg-white border border-slate-200/60 rounded-2xl min-h-[500px]">
          <CircularProgress size={32} thickness={4} />
        </div>
      ) : treeData ? (
        <div className="relative">
          {/* Canvas Tips Overlay */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none select-none">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-white/95 px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Scroll to Zoom &bull; Drag to Pan &bull; Click to toggle nodes
            </span>
          </div>

          <Paper
            ref={containerRef}
            elevation={0}
            className="border border-slate-200/60 rounded-2xl overflow-hidden relative shadow-inner bg-slate-50/20"
            style={{
              height: '580px',
              backgroundImage: 'radial-gradient(circle, #e2e8f0 1.5px, transparent 1.5px)',
              backgroundSize: '24px 24px',
            }}
          >
            <Tree
              data={treeData}
              orientation={orientation}
              pathFunc="step"
              zoom={zoom}
              translate={translate}
              renderCustomNodeElement={renderCardNode}
              nodeSize={orientation === 'vertical' ? { x: 320, y: 200 } : { x: 340, y: 160 }}
              separation={{ siblings: 1.2, nonSiblings: 1.5 }}
              transitionDuration={600}
              enableLegacyTransitions={true}
              pathClassFunc={() => 'rd3t-link'}
            />
          </Paper>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-20 text-center text-slate-400 font-semibold text-sm min-h-[500px] flex items-center justify-center">
          No hierarchy data available.
        </div>
      )}
    </div>
  );
}
