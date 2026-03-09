import { useState } from 'react';
import { ArrowRight, Activity, Globe, Cpu, CheckCircle } from 'lucide-react';

export default function LandingPage({ onLaunch }) {
    const [isLaunching, setIsLaunching] = useState(false);

    const handleLaunch = () => {
        setIsLaunching(true);
        setTimeout(() => onLaunch(), 600);
    };

    return (
        <div style={{
            minHeight: '100vh',
            width: '100%',
            background: '#0B0B0C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Subtle grid pattern */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `
                    radial-gradient(circle at 50% 50%, rgba(79,195,247,0.03) 0%, transparent 70%),
                    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
                `,
                backgroundSize: '100% 100%, 60px 60px, 60px 60px',
                pointerEvents: 'none',
            }} />

            {/* Main card */}
            <div style={{
                maxWidth: '520px',
                width: '100%',
                padding: '56px 48px',
                background: 'rgba(28, 28, 31, 0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                backdropFilter: 'blur(20px)',
                textAlign: 'center',
                position: 'relative',
                zIndex: 1,
                opacity: isLaunching ? 0 : 1,
                transform: isLaunching ? 'scale(0.95)' : 'scale(1)',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: 'fadeIn 0.6s ease-out',
            }}>
                {/* Logo Icon */}
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '14px',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 28px',
                    overflow: 'hidden'
                }}>
                    <img src="/logo.png" alt="Supplytics Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>

                {/* Heading */}
                <h1 style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '32px',
                    fontWeight: 800,
                    color: '#F1F1F3',
                    letterSpacing: '-0.03em',
                    lineHeight: 1.2,
                    marginBottom: '12px',
                }}>
                    Supplytics
                </h1>

                <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#4FC3F7',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: '20px',
                }}>
                    Autonomous Supply Chain Resilience
                </p>

                <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '15px',
                    fontWeight: 400,
                    color: '#9E9EA8',
                    lineHeight: 1.7,
                    marginBottom: '36px',
                    maxWidth: '400px',
                    margin: '0 auto 36px',
                }}>
                    Bridging global volatility with proactive, hyper-personalized mitigation strategies for mid-market manufacturers.
                </p>

                {/* Launch Button */}
                <button
                    onClick={handleLaunch}
                    disabled={isLaunching}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '14px 36px',
                        background: '#4FC3F7',
                        color: '#0B0B0C',
                        border: 'none',
                        borderRadius: '10px',
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: isLaunching ? 'default' : 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 24px rgba(79, 195, 247, 0.25)',
                        animation: 'pulse-glow 2.5s ease-in-out infinite',
                    }}
                    onMouseEnter={(e) => {
                        if (!isLaunching) {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 8px 32px rgba(79, 195, 247, 0.35)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 24px rgba(79, 195, 247, 0.25)';
                    }}
                >
                    {isLaunching ? 'Initializing...' : 'Launch Agent'}
                    <ArrowRight size={18} />
                </button>

                {/* System status indicators */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '20px',
                    marginTop: '32px',
                    paddingTop: '24px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                }}>
                    {[
                        { icon: Globe, label: 'API Connected', color: '#81C784' },
                        { icon: Cpu, label: 'AI Engine', color: '#81C784' },
                        { icon: Activity, label: 'Live Feed', color: '#81C784' },
                    ].map(({ icon: Icon, label, color }) => (
                        <div
                            key={label}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                fontFamily: "'Inter', sans-serif",
                                fontWeight: 500,
                                color: '#6B6B76',
                            }}
                        >
                            <span style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                background: color,
                                boxShadow: `0 0 6px ${color}60`,
                            }} />
                            {label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Pulse glow animation */}
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 4px 24px rgba(79, 195, 247, 0.25); }
                    50% { box-shadow: 0 4px 32px rgba(79, 195, 247, 0.4); }
                }
            `}</style>
        </div>
    );
}
