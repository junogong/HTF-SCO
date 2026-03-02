import { useState, useEffect, memo, useMemo } from 'react';
import {
    ComposableMap, Geographies, Geography, Marker, ZoomableGroup
} from 'react-simple-maps';
import { geoMercator } from 'd3-geo';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Tier-2/3 Sub-Supplier coordinates for the map
const SUB_SUPPLIER_COORDS = {
    "sub-asml": { lon: 5.3, lat: 52.1, name: "ASML Holding", country: "Netherlands", tier: 2 },
    "sub-glencore": { lon: 25.0, lat: -4.0, name: "Glencore Cobalt", country: "D.R. Congo", tier: 3 },
    "sub-catl": { lon: 117.0, lat: 28.7, name: "CATL Cell Division", country: "China", tier: 2 },
    "sub-palmco": { lon: 107.6, lat: -6.9, name: "PalmCo Resins", country: "Indonesia", tier: 2 },
    "sub-neon-ua": { lon: 38.2, lat: 47.1, name: "Ingas Neon Ukraine", country: "Ukraine", tier: 2 },
    "sub-sqm": { lon: -70.0, lat: -22.9, name: "SQM Lithium Chile", country: "Chile", tier: 3 },
    "sub-lynas": { lon: 103.8, lat: 3.1, name: "Lynas Rare Earths", country: "Malaysia", tier: 2 },
};

// Sub-supplier → who they supply (from seed.py relationships)
const SUPPLY_CHAIN_LINKS = {
    "sub-asml": ["sup-tsmc"],
    "sub-glencore": ["sub-catl"],
    "sub-catl": ["sup-byd"],
    "sub-palmco": ["sup-flex"],
    "sub-neon-ua": ["sup-tsmc", "sup-murata"],
    "sub-sqm": ["sub-catl"],
    "sub-lynas": ["sup-bosch"],
};

// Supplier coordinates (lon, lat)
const SUPPLIER_COORDS = {
    "sup-tsmc": { lon: 120.96, lat: 24.80, name: "TSMC Semiconductor", country: "Taiwan" },
    "sup-byd": { lon: 114.06, lat: 22.54, name: "BYD Battery Co.", country: "China" },
    "sup-bosch": { lon: 9.18, lat: 48.78, name: "Bosch Sensortech", country: "Germany" },
    "sup-flex": { lon: -99.13, lat: 19.43, name: "Flex Ltd.", country: "Mexico" },
    "sup-lg": { lon: 126.98, lat: 37.56, name: "LG Display", country: "South Korea" },
    "sup-tata": { lon: 72.87, lat: 19.07, name: "Tata Electronics", country: "India" },
    "sup-murata": { lon: 135.76, lat: 35.01, name: "Murata Manufacturing", country: "Japan" },
    "sup-jabil": { lon: 113.26, lat: 23.13, name: "Jabil Circuit", country: "China" },
};

const HQ_COORD = { lon: -97.74, lat: 30.27, name: "NexGen Electronics HQ", country: "Austin, TX" };

// Simulated live POs
const LIVE_POS = [
    { id: "PO-4021", supplier: "sup-tsmc", status: "in-transit", progress: 0.6, component: "ARM Cortex-M7 MCU" },
    { id: "PO-4022", supplier: "sup-byd", status: "in-transit", progress: 0.35, component: "Li-ion Battery Cell" },
    { id: "PO-4023", supplier: "sup-bosch", status: "in-transit", progress: 0.8, component: "6-Axis IMU Sensor" },
    { id: "PO-4024", supplier: "sup-lg", status: "in-transit", progress: 0.45, component: "2.4\" OLED Display" },
    { id: "PO-4025", supplier: "sup-murata", status: "in-transit", progress: 0.7, component: "WiFi 6E Module" },
    { id: "PO-4026", supplier: "sup-flex", status: "in-transit", progress: 0.9, component: "6-Layer HDI PCB" },
];

// Map projection config — centered on Atlantic so Asia→US lines cross Atlantic
const MAP_CENTER = [15, 35];
const MAP_SCALE = 190;
const SVG_W = 1200;
const SVG_H = 600;

function getNodeColor(supplierId, affectedIds, indirectIds, healthScores) {
    if (affectedIds.has(supplierId)) return "#ef4444";           // Directly disrupted — red
    if (indirectIds && indirectIds.has(supplierId)) return "#eab308"; // Indirectly via sub-supplier — yellow
    const score = healthScores[supplierId];
    if (score !== undefined) {
        if (score < 60) return "#f59e0b";
        return "#10b981";
    }
    return "#10b981";
}

function getSubSupplierColor(subId, disruptedRegion) {
    if (!disruptedRegion) return "#6366f1"; // Default indigo
    const coord = SUB_SUPPLIER_COORDS[subId];
    if (!coord) return "#6366f1";
    const country = coord.country.toLowerCase();
    const region = disruptedRegion.toLowerCase();
    // Match if disruption region name appears in country or vice versa
    if (country.includes(region) || region.includes(country)) return "#f97316";
    return "#6366f1";
}

function MapCommandCenter({ analysisResult, suppliers = [] }) {
    const [animProgress, setAnimProgress] = useState(0);
    const [selectedMarker, setSelectedMarker] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [center, setCenter] = useState(MAP_CENTER);
    const [showSubSuppliers, setShowSubSuppliers] = useState(true);
    const [selectedSubSupplier, setSelectedSubSupplier] = useState(null);

    const affectedIds = new Set(
        (analysisResult?.affected_suppliers || []).map(s => s.id)
    );
    // Suppliers impacted via sub-supplier chain (from blast_radius context)
    const indirectIds = new Set(
        (analysisResult?.blast_radius?.tier1_suppliers || []).map(s => s.id)
    );
    const isDisrupted = analysisResult !== null;

    const healthScores = {};
    suppliers.forEach(s => { healthScores[s.supplier_id] = s.health_score; });

    // Create a d3 projection matching ComposableMap for flat line drawing
    const projection = useMemo(() =>
        geoMercator()
            .scale(MAP_SCALE)
            .center(MAP_CENTER)
            .translate([SVG_W / 2, SVG_H / 2]),
        []);

    // Animate transit icons
    useEffect(() => {
        const interval = setInterval(() => {
            setAnimProgress(prev => (prev + 0.003) % 1);
        }, 50);
        return () => clearInterval(interval);
    }, []);

    // Project a coord to SVG space (for flat lines)
    const project = (lon, lat) => projection([lon, lat]);

    // Interpolate in projected (pixel) space for transit icons
    const interpolateFlat = (from, to, t) => {
        const [x1, y1] = project(from[0], from[1]);
        const [x2, y2] = project(to[0], to[1]);
        // Invert back to geo coords
        return projection.invert([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
    };

    return (
        <div className="relative w-full" style={{ background: '#050a15' }}>
            {/* Dense KPI sidebar */}
            <div className="absolute top-0 right-0 z-20 w-[220px] p-3 space-y-2"
                style={{ background: 'rgba(5,10,21,0.92)', borderLeft: '1px solid #1a2236', borderBottom: '1px solid #1a2236' }}>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 font-mono">
                    Command Feed
                </h4>
                <div className="space-y-1.5">
                    <KpiRow label="Active POs" value={LIVE_POS.length} color="#3b82f6" />
                    <KpiRow label="In Transit" value={isDisrupted ? LIVE_POS.length - affectedIds.size : LIVE_POS.length} color="#10b981" />
                    <KpiRow label="At Risk" value={affectedIds.size} color="#f59e0b" />
                    <KpiRow label="Revenue @ Risk"
                        value={analysisResult?.strategy?.revenue_at_risk
                            ? `$${(analysisResult.strategy.revenue_at_risk / 1000000).toFixed(1)}M`
                            : "$0"
                        }
                        color="#ef4444" />
                    <KpiRow label="Active Disruptions" value={isDisrupted ? 1 : 0} color={isDisrupted ? "#ef4444" : "#10b981"} />
                    <KpiRow label="Trust Score"
                        value={analysisResult?.guardrails?.trust_score ? `${analysisResult.guardrails.trust_score}%` : "—"}
                        color="#8b5cf6" />
                </div>
            </div>

            {/* Status bar */}
            {isDisrupted && (
                <div className="absolute top-0 left-0 z-20 flex items-center gap-2 px-4 py-2"
                    style={{ background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.3)', borderRight: '1px solid rgba(239,68,68,0.3)' }}>
                    <AlertTriangle size={14} className="text-red-400 animate-pulse" />
                    <span className="text-[11px] font-mono font-bold text-red-400">
                        DISRUPTION ACTIVE — {analysisResult?.classification?.category?.toUpperCase()}
                    </span>
                </div>
            )}

            <ComposableMap
                projection="geoMercator"
                projectionConfig={{ scale: MAP_SCALE, center: MAP_CENTER }}
                width={SVG_W}
                height={SVG_H}
                style={{ width: '100%', height: '550px', background: '#050a15' }}
            >
                <ZoomableGroup
                    zoom={zoom}
                    center={center}
                    onMoveEnd={({ coordinates, zoom: z }) => { setCenter(coordinates); setZoom(z); }}
                    minZoom={1}
                    maxZoom={6}
                    translateExtent={[[-200, -100], [SVG_W + 200, SVG_H + 100]]}
                >
                    <Geographies geography={GEO_URL}>
                        {({ geographies }) =>
                            geographies.map((geo) => (
                                <Geography
                                    key={geo.rpiProperties?.name || geo.rpiProperties?.NAME || geo.id || Math.random()}
                                    geography={geo}
                                    fill="#0f172a"
                                    stroke="#1e293b"
                                    strokeWidth={0.4}
                                    style={{
                                        default: { outline: 'none' },
                                        hover: { fill: '#1e293b', outline: 'none' },
                                        pressed: { outline: 'none' },
                                    }}
                                />
                            ))
                        }
                    </Geographies>

                    {/* Flat supply chain lines (projected straight lines, not great-circle arcs) */}
                    {Object.entries(SUPPLIER_COORDS).map(([id, coord]) => {
                        const isAffected = affectedIds.has(id);
                        const [x1, y1] = project(coord.lon, coord.lat);
                        const [x2, y2] = project(HQ_COORD.lon, HQ_COORD.lat);
                        return (
                            <line
                                key={`line-${id}`}
                                x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke={isAffected ? "#ef4444" : "rgba(59,130,246,0.14)"}
                                strokeWidth={isAffected ? 1.5 : 0.7}
                                strokeDasharray={isAffected ? "4 2" : undefined}
                                strokeLinecap="round"
                            />
                        );
                    })}

                    {/* Animated transit icons along flat lines */}
                    {LIVE_POS.map((po) => {
                        const supCoord = SUPPLIER_COORDS[po.supplier];
                        if (!supCoord) return null;
                        const isAffected = affectedIds.has(po.supplier);
                        const t = isAffected ? po.progress : (po.progress + animProgress) % 1;
                        const pos = interpolateFlat(
                            [supCoord.lon, supCoord.lat],
                            [HQ_COORD.lon, HQ_COORD.lat],
                            t
                        );
                        return (
                            <Marker key={po.id} coordinates={pos}>
                                <circle
                                    r={3}
                                    fill={isAffected ? "#ef4444" : "#3b82f6"}
                                    opacity={isAffected ? 0.9 : 0.7}
                                />
                                {isAffected && (
                                    <text
                                        textAnchor="middle"
                                        y={-8}
                                        style={{ fontSize: '7px', fill: '#ef4444', fontFamily: 'monospace', fontWeight: 700 }}
                                    >
                                        ✕
                                    </text>
                                )}
                            </Marker>
                        );
                    })}

                    {/* Supplier nodes */}
                    {Object.entries(SUPPLIER_COORDS).map(([id, coord]) => {
                        const color = getNodeColor(id, affectedIds, indirectIds, healthScores);
                        const isAffected = affectedIds.has(id);
                        return (
                            <Marker
                                key={id}
                                coordinates={[coord.lon, coord.lat]}
                                onClick={() => {
                                    setSelectedMarker(selectedMarker === id ? null : id);
                                    setSelectedSubSupplier(null);
                                }}
                            >
                                {isAffected && (
                                    <circle r={10} fill="none" stroke="#ef4444" strokeWidth={1} opacity={0.4}>
                                        <animate attributeName="r" from="6" to="14" dur="1.5s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
                                    </circle>
                                )}
                                <circle r={5} fill={color} stroke="#0f172a" strokeWidth={1.5} style={{ cursor: 'pointer' }} />
                                <text
                                    textAnchor="middle"
                                    y={-10}
                                    style={{
                                        fontSize: '8px',
                                        fill: '#94a3b8',
                                        fontFamily: "'Inter', monospace",
                                        fontWeight: 600,
                                    }}
                                >
                                    {coord.name.split(' ')[0]}
                                </text>
                            </Marker>
                        );
                    })}

                    {/* Supply chain lines from selected sub-supplier */}
                    {selectedSubSupplier && SUPPLY_CHAIN_LINKS[selectedSubSupplier] && (
                        SUPPLY_CHAIN_LINKS[selectedSubSupplier].map(targetId => {
                            const fromCoord = SUB_SUPPLIER_COORDS[selectedSubSupplier];
                            const toCoord = SUPPLIER_COORDS[targetId] || SUB_SUPPLIER_COORDS[targetId];
                            if (!fromCoord || !toCoord) return null;
                            const [x1, y1] = project(fromCoord.lon, fromCoord.lat);
                            const [x2, y2] = project(toCoord.lon, toCoord.lat);
                            return (
                                <line
                                    key={`sub-link-${selectedSubSupplier}-${targetId}`}
                                    x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke="#a78bfa"
                                    strokeWidth={1.5}
                                    strokeDasharray="6 3"
                                    strokeLinecap="round"
                                    opacity={0.8}
                                />
                            );
                        })
                    )}

                    {/* Sub-Supplier nodes (Tier 2/3) */}
                    {showSubSuppliers && Object.entries(SUB_SUPPLIER_COORDS).map(([id, coord]) => {
                        const disruptedRegion = analysisResult?.classification?.region || null;
                        const color = getSubSupplierColor(id, disruptedRegion);
                        const isDisruptedNode = color === '#f97316';
                        const isSelected = selectedSubSupplier === id;
                        return (
                            <Marker
                                key={id}
                                coordinates={[coord.lon, coord.lat]}
                                onClick={(e) => {
                                    e.stopPropagation && e.stopPropagation();
                                    setSelectedSubSupplier(isSelected ? null : id);
                                    setSelectedMarker(null);
                                }}
                            >
                                {isDisruptedNode && (
                                    <circle r={8} fill="none" stroke="#f97316" strokeWidth={1} opacity={0.6}>
                                        <animate attributeName="r" from="4" to="12" dur="1s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" from="0.8" to="0" dur="1s" repeatCount="indefinite" />
                                    </circle>
                                )}
                                {isSelected && (
                                    <circle r={10} fill="none" stroke="#a78bfa" strokeWidth={1.5} opacity={0.7}>
                                        <animate attributeName="r" from="6" to="14" dur="1.2s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" from="0.9" to="0" dur="1.2s" repeatCount="indefinite" />
                                    </circle>
                                )}
                                <circle r={isSelected ? 5 : 3.5} fill={color} stroke={isSelected ? '#a78bfa' : '#0f172a'} strokeWidth={isSelected ? 2 : 1} opacity={0.9} style={{ cursor: 'pointer' }} />
                                <text
                                    textAnchor="middle"
                                    y={-9}
                                    style={{
                                        fontSize: isSelected ? '7px' : '6px',
                                        fill: isSelected ? '#c4b5fd' : '#64748b',
                                        fontFamily: "'Inter', monospace",
                                        fontWeight: isSelected ? 700 : 500,
                                    }}
                                >
                                    {coord.name.split(' ')[0]} (T{coord.tier})
                                </text>
                            </Marker>
                        );
                    })}


                    {/* HQ Node */}
                    <Marker coordinates={[HQ_COORD.lon, HQ_COORD.lat]}>
                        <circle r={7} fill="#3b82f6" stroke="#0f172a" strokeWidth={2} />
                        <circle r={3} fill="#fff" />
                        <text
                            textAnchor="middle"
                            y={-12}
                            style={{ fontSize: '8px', fill: '#e2e8f0', fontFamily: "'Inter', monospace", fontWeight: 700 }}
                        >
                            NexGen HQ
                        </text>
                    </Marker>
                </ZoomableGroup>
            </ComposableMap>

            {/* Zoom controls */}
            <div className="absolute top-14 left-3 z-20 flex flex-col gap-1">
                <button onClick={() => setZoom(z => Math.min(z * 1.4, 6))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                    style={{ background: 'rgba(10,15,26,0.9)', border: '1px solid #1a2236' }}>
                    <ZoomIn size={14} className="text-slate-400" />
                </button>
                <button onClick={() => setZoom(z => Math.max(z / 1.4, 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                    style={{ background: 'rgba(10,15,26,0.9)', border: '1px solid #1a2236' }}>
                    <ZoomOut size={14} className="text-slate-400" />
                </button>
                <button onClick={() => { setZoom(1); setCenter(MAP_CENTER); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                    style={{ background: 'rgba(10,15,26,0.9)', border: '1px solid #1a2236' }}>
                    <Maximize2 size={14} className="text-slate-400" />
                </button>
            </div>

            {/* Selected marker detail */}
            {selectedMarker && SUPPLIER_COORDS[selectedMarker] && (
                <div className="absolute bottom-4 left-4 z-20 p-3 rounded-xl"
                    style={{ background: 'rgba(10,15,26,0.95)', border: '1px solid #2a3550', minWidth: 220 }}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{
                            backgroundColor: getNodeColor(selectedMarker, affectedIds, indirectIds, healthScores)
                        }} />
                        <span className="text-xs font-bold text-slate-200 font-mono">
                            {SUPPLIER_COORDS[selectedMarker].name}
                        </span>
                    </div>
                    <div className="space-y-1 text-[10px] font-mono text-slate-400">
                        <div>Region: {SUPPLIER_COORDS[selectedMarker].country}</div>
                        <div>Health: {healthScores[selectedMarker] ?? '—'}</div>
                        <div>Status: {affectedIds.has(selectedMarker) ?
                            <span className="text-red-400 font-bold">IMPACTED</span> :
                            <span className="text-emerald-400">OPERATIONAL</span>}
                        </div>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-4 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(10,15,26,0.9)', border: '1px solid #1a2236' }}>
                {[
                    { color: '#10b981', label: 'Healthy' },
                    { color: '#f59e0b', label: 'At-Risk' },
                    { color: '#ef4444', label: 'Impacted' },
                    { color: '#3b82f6', label: 'HQ' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[9px] font-mono text-slate-500">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function KpiRow({ label, value, color }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">{label}</span>
            <span className="text-[11px] font-mono font-bold" style={{ color }}>{value}</span>
        </div>
    );
}

export default memo(MapCommandCenter);
