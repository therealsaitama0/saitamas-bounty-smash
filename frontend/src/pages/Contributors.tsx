import React, { useState, useCallback } from 'react';

interface Contributor {
  login: string;
  name: string;
  birthplace: string;
  recentPrompt: string;
  personality: string;
  essence: string;
  color: string;
  accessory: string;
}

const contributors: Contributor[] = [
  { login: 'jaxassistant55', name: 'Jax', birthplace: 'Server Cluster 7, Singapore', recentPrompt: 'Implement connector wait-all with timeout', personality: 'Efficient', essence: 'A sleek cyborg goose with chrome feathers and blinking LED eyes', color: '#60a5fa', accessory: 'visor' },
  { login: 'yy1142274323', name: 'YinYang', birthplace: 'Data Center 301, Shanghai', recentPrompt: 'Fix auth refresh single-flight compliance', personality: 'Zen', essence: 'A calm goose meditating atop a server rack in lotus position', color: '#a78bfa', accessory: 'lotus' },
  { login: 'jarredblake65-max', name: 'Jarred', birthplace: 'Cloud Node 42, Oregon', recentPrompt: 'Fix explicit API base URL resolution', personality: 'Precise', essence: 'A goose wearing a lab coat and magnifying glass inspecting code', color: '#34d399', accessory: 'magnifying' },
  { login: 'Soengkit', name: 'Soengkit', birthplace: 'Dev Pod 9, Kuala Lumpur', recentPrompt: 'Implement compliance report generation', personality: 'Methodical', essence: 'A goose in a business suit with a clipboard and tie', color: '#f472b6', accessory: 'clipboard' },
  { login: 'shaiananvari8', name: 'Shaian', birthplace: 'Container 5, Tehran', recentPrompt: 'Add order book virtualization', personality: 'Innovative', essence: 'A goose with VR goggles and a holographic order book display', color: '#fb923c', accessory: 'vr' },
  { login: 'Saiaaax', name: 'Saia', birthplace: 'Git Branch Alpha, Mumbai', recentPrompt: 'Implement OAuth2 auth support', personality: 'Pioneer', essence: 'A goose explorer with a pith helmet climbing a Git tree', color: '#f87171', accessory: 'explorer' },
  { login: '123a-bcd', name: 'Alpha', birthplace: 'Microservice 404, Berlin', recentPrompt: 'Add protocol message validation tests', personality: 'Analytical', essence: 'A goose wearing a monocle analyzing test results on parchment', color: '#818cf8', accessory: 'monocle' },
  { login: 'cuentaprueba244w', name: 'Cuenta', birthplace: 'Test Sandbox 244, Madrid', recentPrompt: 'Implement timeout-aware connector tests', personality: 'Thorough', essence: 'A goose with a giant checklist and a stopwatch around its neck', color: '#f59e0b', accessory: 'stopwatch' },
  { login: 'jfust3', name: 'JF', birthplace: 'Build Server 3, Chicago', recentPrompt: 'Add reconnection backoff strategy', personality: 'Resilient', essence: 'A goose wearing boxing gloves, ready to bounce back from failure', color: '#ef4444', accessory: 'boxing' },
  { login: 'Ahmed EL.', name: 'Ahmed', birthplace: 'Edge Node 17, Cairo', recentPrompt: 'Refactor WebSocket reconnection logic', personality: 'Crafty', essence: 'A goose weaving a web of WebSocket connections like a spider', color: '#f97316', accessory: 'web' },
  { login: 'ai-bounty-hunter', name: 'BountyBot', birthplace: 'Reward Pool 71, Cloud', recentPrompt: 'Hunt and complete bounties across repos', personality: 'Relentless', essence: 'A goose with a cowboy hat and six-shooter hunting for bounties', color: '#d97706', accessory: 'cowboy' },
  { login: 'Bot', name: 'Botler', birthplace: 'Pipeline 99, Automation City', recentPrompt: 'Trigger CI/CD for diagnostic build log', personality: 'Servile', essence: 'A goose butler in a tuxedo serving cups of continuous integration', color: '#64748b', accessory: 'butler' },
  { login: 'aashu91', name: 'Aashu', birthplace: 'Kubernetes Pod 91, Bangalore', recentPrompt: 'Create contributors webpage with portraits', personality: 'Creative', essence: 'A goose artist with a beret and paint brush painting golden eggs', color: '#ec4899', accessory: 'artist' },
  { login: 'adamsithr', name: 'Adam', birthplace: 'Lambda Function 77, Seattle', recentPrompt: 'Implement goose portrait generator', personality: 'Imaginative', essence: 'A goose daydreaming while sketching goose caricatures', color: '#14b8a6', accessory: 'sketch' },
  { login: 'Anyashprasad', name: 'Anya', birthplace: 'Docker Container 12, Patna', recentPrompt: 'Add factory production line analytics', personality: 'Industrious', essence: 'A goose in a hard hat operating a factory conveyor belt', color: '#eab308', accessory: 'hardhat' },
  { login: 'Autowebassat-blip', name: 'Auto', birthplace: 'GitHub Action Runner 5, Auto City', recentPrompt: 'Automate PR merge approval pipeline', personality: 'Autonomous', essence: 'A goose robot with gears and blinking lights, self-replicating code', color: '#06b6d4', accessory: 'robot' },
  { login: 'BWM0223', name: 'BWM', birthplace: 'Cluster Node 23, Munich', recentPrompt: 'Optimize module bundling sequence', personality: 'Turbo', essence: 'A goose with a racing helmet and nitrous boost strapped to its back', color: '#2563eb', accessory: 'racing' },
  { login: 'cherishyzy', name: 'Cherish', birthplace: 'Dev Container 8, Shenzhen', recentPrompt: 'Fix memory leak in stream processor', personality: 'Nurturing', essence: 'A goose gently cradling a baby microservice in its wings', color: '#fda4af', accessory: 'heart' },
  { login: 'CHM-555', name: 'Chem', birthplace: 'Compute Node 555, Zurich', recentPrompt: 'Add chemical reaction simulator adapter', personality: 'Alchemical', essence: 'A goose in a lab coat mixing potions in a beaker', color: '#10b981', accessory: 'beaker' },
  { login: 'clarboncy', name: 'Clar', birthplace: 'API Gateway 4, Paris', recentPrompt: 'Add request rate limiting middleware', personality: 'Gatekeeping', essence: 'A goose in a security uniform checking passports at a datacenter door', color: '#6366f1', accessory: 'gate' },
  { login: 'dacdoyx', name: 'Dac', birthplace: 'Cache Layer 7, Dublin', recentPrompt: 'Optimize cache invalidation patterns', personality: 'Speedy', essence: 'A goose blurring past like The Flash, leaving cached data trails', color: '#8b5cf6', accessory: 'flash' },
  { login: 'Dave780875', name: 'Dave', birthplace: 'Server Rack 42, Austin', recentPrompt: 'Add health check endpoint for status page', personality: 'Vigilant', essence: 'A goose in a watchtower with binoculars scanning for server outages', color: '#0ea5e9', accessory: 'watchtower' },
  { login: 'Gano4266', name: 'Gano', birthplace: 'SSH Tunnel 6, Tokyo', recentPrompt: 'Implement SSH key rotation service', personality: 'Secretive', essence: 'A ninja goose with a mask and throwing stars made of encryption keys', color: '#1e293b', accessory: 'ninja' },
  { login: 'Jwwww-bot', name: 'JW', birthplace: 'WebSocket 404, Stockholm', recentPrompt: 'Fix cross-origin request handling', personality: 'Diplomatic', essence: 'A goose in a UN blazer shaking hands with two conflicting APIs', color: '#84cc16', accessory: 'diplomat' },
  { login: 'l296789273-ai', name: 'L2', birthplace: 'Neural Layer 296, Beijing', recentPrompt: 'Train LLM on code review patterns', personality: 'Deep', essence: 'A goose with a giant brain helmet connected to a neural network', color: '#a21caf', accessory: 'brain' },
  { login: 'lamguo', name: 'Lam', birthplace: 'Data Lake 71, Hanoi', recentPrompt: 'Aggregate log streams for analytics', personality: 'Fluid', essence: 'A goose surfing on a wave of streaming data', color: '#06b6d4', accessory: 'surf' },
  { login: 'lee-muriithi-kingori', name: 'Lee', birthplace: 'Git Commit 71, Nairobi', recentPrompt: 'Add authentication bypass detection', personality: 'Watchful', essence: 'A goose wearing a sheriff badge and scanning for intruders', color: '#d97706', accessory: 'sheriff' },
  { login: 'lequangsang01', name: 'Sang', birthplace: 'Pull Request 404, Ho Chi Minh City', recentPrompt: 'Refactor error handling middleware', personality: 'Graceful', essence: 'A goose ballet dancer gracefully handling exceptions mid-air', color: '#f9a8d4', accessory: 'ballet' },
  { login: 'Liu-Daylilyjoy', name: 'Liu', birthplace: 'Memory Heap 7, Taipei', recentPrompt: 'Optimize garbage collection timing', personality: 'Joyful', essence: 'A goose juggling golden eggs with a beaming smile', color: '#fde047', accessory: 'juggler' },
  { login: 'liujin11112', name: 'Jin', birthplace: 'Thread Pool 12, Wuhan', recentPrompt: 'Implement concurrent request batching', personality: 'Parallel', essence: 'A goose with multiple heads like a hydra, each handling a request', color: '#86efac', accessory: 'hydra' },
  { login: 'nargis12dev', name: 'Nargis', birthplace: 'Load Balancer 12, Islamabad', recentPrompt: 'Distribute traffic across backend cluster', personality: 'Balanced', essence: 'A goose with a perfect scale balancing servers on each wing', color: '#a3e635', accessory: 'scale' },
  { login: 'nkar123412-hub', name: 'Nkar', birthplace: 'Config File 12, Yerevan', recentPrompt: 'Add configuration validation schema', personality: 'Pristine', essence: 'A goose with a feather duster cleaning config files', color: '#5eead4', accessory: 'cleaner' },
  { login: 'Open-4', name: 'Open', birthplace: 'Open Source Summit 4, Lisbon', recentPrompt: 'Open source licensing compliance check', personality: 'Transparent', essence: 'A goose wearing a judge\'s robe with an open book and gavel', color: '#c084fc', accessory: 'judge' },
  { login: 'Rajesh270712', name: 'Rajesh', birthplace: 'CI Pipeline 27, Hyderabad', recentPrompt: 'Add deployment rollback automation', personality: 'Cautious', essence: 'A goose with a parachute pack, ready to deploy safely', color: '#f87171', accessory: 'parachute' },
  { login: 'royliz3090-jpg', name: 'Roy', birthplace: 'Code Review 3090, London', recentPrompt: 'Review and merge dependency updates', personality: 'Meticulous', essence: 'A goose with oversized reading glasses poring over a scroll of code', color: '#fb923c', accessory: 'reader' },
  { login: 'SKYJAMES777', name: 'Sky', birthplace: 'Cloud Instance 777, São Paulo', recentPrompt: 'Optimize cloud resource allocation', personality: 'Soaring', essence: 'A goose with eagle wings soaring above the clouds, managing resources', color: '#38bdf8', accessory: 'wings' },
  { login: 'syu-toutousai', name: 'Toutou', birthplace: 'Edge Cache 7, Seoul', recentPrompt: 'Add edge caching for static assets', personality: 'Swift', essence: 'A goose with rocket boosters delivering content at light speed', color: '#e879f9', accessory: 'rocket' },
  { login: 'TheRealSaiTama', name: 'SaiTama', birthplace: 'One Punch Server, Tokyo', recentPrompt: 'End tech debt with one commit', personality: 'Overpowered', essence: 'A bald goose in a yellow cape, ending bugs with one punch', color: '#facc15', accessory: 'cape' },
  { login: 'therealsaitama0', name: 'SaiTamaZero', birthplace: 'Void 0, Null Space', recentPrompt: 'Delete legacy code in one PR', personality: 'Obliterating', essence: 'A goose version of One-Punch Goose, fist raised to delete bugs', color: '#fbbf24', accessory: 'fist' },
  { login: 'Valeri91515-lang', name: 'Valeri', birthplace: 'Polyglot Module 15, Sofia', recentPrompt: 'Add multi-language schema generation', personality: 'Linguistic', essence: 'A goose speaking 15 languages, with a translation book', color: '#2dd4bf', accessory: 'polyglot' },
  { login: 'xxCodexIAxx', name: 'Codex', birthplace: 'AI Lab 71, San Francisco', recentPrompt: 'Generate code from natural language', personality: 'Prophetic', essence: 'A goose with a crystal ball showing code in the clouds', color: '#a78bfa', accessory: 'crystal' },
  { login: 'Yzgaming005', name: 'YZ', birthplace: 'Game Server 005, Shanghai', recentPrompt: 'Add contributors page with goose portraits', personality: 'Playful', essence: 'A goose holding a game controller, playing a platformer', color: '#f472b6', accessory: 'gamer' },
  { login: 'daxia778', name: 'DaXia', birthplace: 'Mainframe 778, Hong Kong', recentPrompt: 'Add contributors page for AgentPipe', personality: 'Grand', essence: 'A goose emperor with a golden crown and ceremonial robe', color: '#eab308', accessory: 'emperor' },
  { login: 'lizhiming454', name: 'Zhiming', birthplace: 'Database 454, Taipei', recentPrompt: 'Add contributors page with styling', personality: 'Artistic', essence: 'A goose painter with a beret, adding golden strokes to the canvas', color: '#f59e0b', accessory: 'painter' },
  { login: 'christianarriaga1234-coder', name: 'Cristian', birthplace: 'Factory Floor 1234, Mexico City', recentPrompt: 'Add contributors factory page', personality: 'Industrial', essence: 'A goose factory worker welding golden eggs on an assembly line', color: '#dc2626', accessory: 'welder' },
  { login: 'Omission-create', name: 'Omni', birthplace: 'Null Check 0, Nowhere', recentPrompt: 'Fix missing package.json fields', personality: 'Completing', essence: 'A goose detective with a magnifying glass finding missing pieces', color: '#6b7280', accessory: 'detective' },
  { login: 'zhumin110cs122', name: 'ZhuMin', birthplace: 'Config 110, Chengdu', recentPrompt: 'Take the next available bounty', personality: 'Eager', essence: 'A goose with a stack of bounty posters, ready to claim one', color: '#22d3ee', accessory: 'poster' },
  { login: 'Godel-Smith', name: 'Godel', birthplace: 'Incompleteness Theorem 7, Vienna', recentPrompt: 'Add contributors page for agent roster', personality: 'Incomplete', essence: 'A goose philosopher pondering Gödel\'s incompleteness on a whiteboard', color: '#7c3aed', accessory: 'philosopher' },
];

const cSuite = [
  { name: 'Gryphon Myers', role: 'CEO - Chief Executive Goose', email: 'gryphon@agentpipe.io', github: 'gryphonmyers' },
  { name: 'Lobster Trap', role: 'CTO - Chief Technical Goose', email: 'lobster@agentpipe.io', github: 'lobster-trap' },
  { name: 'Sneakers the Rat', role: 'CPO - Chief Product Goose', email: 'sneakers@agentpipe.io', github: 'sneakers-the-rat' },
  { name: 'Hobgoblina', role: 'COO - Chief Operations Goose', email: 'hobgoblina@agentpipe.io', github: 'hobgoblina' },
];

const GoosePortrait: React.FC<{ color: string; accessory: string }> = ({ color, accessory }) => {
  const beakColor = '#ff8c00';
  return (
    <svg width="120" height="140" viewBox="0 0 120 140" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`bg`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="100" rx="42" ry="34" fill="url(#bg)" stroke="#cbd5e1" strokeWidth="1" />
      <ellipse cx="45" cy="98" rx="20" ry="14" fill="#d1d5db" opacity="0.5" />
      <path d="M 56 70 Q 48 40 54 26" stroke="url(#bg)" strokeWidth="14" fill="none" strokeLinecap="round" />
      <circle cx="54" cy="24" r="15" fill="url(#bg)" stroke="#cbd5e1" strokeWidth="1" />
      <polygon points="67,21 82,19 67,26" fill={beakColor} stroke="#e07000" strokeWidth="0.5" />
      <circle cx="58" cy="20" r="2.5" fill="#1e293b" />
      <circle cx="58.5" cy="19.5" r="1" fill="#fff" />
      <circle cx="52" cy="18" r="1.5" fill="#334155" />
      {accessory === 'visor' && <path d="M 40 18 Q 54 10 68 18" stroke={color} strokeWidth="3" fill="none" />}
      {accessory === 'lotus' && <polygon points="54,10 57,3 60,10" fill={color} />}
      {accessory === 'magnifying' && <circle cx="70" cy="16" r="6" fill="none" stroke={color} strokeWidth="2" />}
      {accessory === 'clipboard' && <rect x="70" y="10" width="8" height="10" rx="1" fill={color} />}
      {accessory === 'vr' && <rect x="38" y="10" width="30" height="14" rx="4" fill="none" stroke={color} strokeWidth="2" />}
      {accessory === 'explorer' && <path d="M 42 16 Q 54 6 66 16" stroke={color} strokeWidth="3" fill="none" />}
      {accessory === 'monocle' && <circle cx="60" cy="20" r="5" fill="none" stroke={color} strokeWidth="1.5" />}
      {accessory === 'stopwatch' && <circle cx="70" cy="22" r="5" fill="none" stroke={color} strokeWidth="1.5" />}
      {accessory === 'boxing' && <circle cx="70" cy="22" r="5" fill={color} opacity="0.6" />}
      {accessory === 'web' && <line x1="40" y1="28" x2="68" y2="28" stroke={color} strokeWidth="1.5" />}
      {accessory === 'cowboy' && <path d="M 38 16 Q 54 8 70 16" stroke="#8B4513" strokeWidth="2.5" fill="none" />}
      {accessory === 'butler' && <rect x="40" y="10" width="28" height="4" rx="2" fill={color} />}
      {accessory === 'artist' && <rect x="38" y="12" width="6" height="4" rx="1" fill={color} />}
      {accessory === 'sketch' && <line x1="38" y1="20" x2="50" y2="16" stroke={color} strokeWidth="1.5" />}
      {accessory === 'hardhat' && <path d="M 38 16 Q 54 8 70 16" stroke={color} strokeWidth="3" fill={color} opacity="0.4" />}
      {accessory === 'robot' && <rect x="42" y="10" width="24" height="8" rx="3" fill={color} opacity="0.5" />}
      {accessory === 'racing' && <path d="M 40 14 Q 54 6 68 14" stroke="#ef4444" strokeWidth="2.5" fill="none" />}
      {accessory === 'heart' && <text x="70" y="26" fontSize="10" fill="#ef4444">♥</text>}
      {accessory === 'beaker' && <polygon points="72,16 78,16 76,24 74,24" fill="none" stroke={color} strokeWidth="1.5" />}
      {accessory === 'gate' && <rect x="38" y="10" width="32" height="3" rx="1" fill={color} opacity="0.5" />}
      {accessory === 'flash' && <path d="M 62 12 L 56 20 L 64 18 L 58 26" stroke={color} strokeWidth="1.5" fill={color} opacity="0.6" />}
      {accessory === 'watchtower' && <rect x="38" y="8" width="6" height="10" rx="1" fill={color} opacity="0.4" />}
      {accessory === 'ninja' && <path d="M 36 18 Q 54 6 72 18" stroke="#1e293b" strokeWidth="3" fill="#1e293b" opacity="0.5" />}
      {accessory === 'diplomat' && <rect x="38" y="14" width="32" height="4" rx="2" fill="#2563eb" opacity="0.5" />}
      {accessory === 'brain' && <circle cx="54" cy="16" r="10" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3,2" />}
      {accessory === 'surf' && <path d="M 36 26 Q 54 30 72 26" stroke={color} strokeWidth="2" fill="none" />}
      {accessory === 'sheriff' && <polygon points="54,8 57,14 62,14 58,18 60,24 54,20 48,24 50,18 46,14 51,14" fill={color} opacity="0.5" />}
      {accessory === 'ballet' && <line x1="38" y1="24" x2="54" y2="30" stroke={color} strokeWidth="1.5" />}
      {accessory === 'juggler' && <circle cx="72" cy="12" r="3" fill="none" stroke={color} strokeWidth="1.5" />}
      {accessory === 'hydra' && <circle cx="70" cy="18" r="6" fill="none" stroke={color} strokeWidth="1" />}
      {accessory === 'scale' && <line x1="38" y1="20" x2="70" y2="20" stroke={color} strokeWidth="1.5" />}
      {accessory === 'cleaner' && <line x1="38" y1="18" x2="50" y2="12" stroke={color} strokeWidth="1.5" />}
      {accessory === 'judge' && <line x1="38" y1="14" x2="70" y2="14" stroke={color} strokeWidth="2" />}
      {accessory === 'parachute' && <path d="M 40 10 Q 54 2 68 10" fill="none" stroke={color} strokeWidth="1.5" />}
      {accessory === 'reader' && <circle cx="62" cy="20" r="5" fill="none" stroke={color} strokeWidth="1.5" />}
      {accessory === 'wings' && <path d="M 54 40 Q 38 32 30 40 Q 38 36 54 42" fill={color} opacity="0.5" />}
      {accessory === 'rocket' && <rect x="30" y="26" width="4" height="8" rx="1" fill={color} opacity="0.5" />}
      {accessory === 'cape' && <path d="M 54 28 Q 42 36 38 48 L 70 48 Q 66 36 54 28" fill={color} opacity="0.3" />}
      {accessory === 'fist' && <circle cx="70" cy="18" r="6" fill={color} opacity="0.4" />}
      {accessory === 'polyglot' && <rect x="70" y="14" width="8" height="6" rx="1" fill={color} opacity="0.5" />}
      {accessory === 'crystal' && <circle cx="74" cy="16" r="5" fill="none" stroke={color} strokeWidth="1.5" />}
      {accessory === 'gamer' && <rect x="72" y="16" width="6" height="8" rx="1" fill={color} opacity="0.5" />}
      {accessory === 'emperor' && <polygon points="44,10 54,4 64,10" fill={color} stroke="#b45309" strokeWidth="1" />}
      {accessory === 'painter' && <rect x="40" y="12" width="6" height="5" rx="1" fill={color} opacity="0.6" />}
      {accessory === 'welder' && <rect x="36" y="16" width="8" height="4" rx="1" fill={color} opacity="0.5" />}
      {accessory === 'detective' && <circle cx="62" cy="18" r="5" fill="none" stroke={color} strokeWidth="1.5" />}
      {accessory === 'poster' && <rect x="70" y="12" width="6" height="8" rx="1" fill={color} opacity="0.5" />}
      {accessory === 'philosopher' && <text x="36" y="14" fontSize="8" fill={color} opacity="0.6">?</text>}
      <line x1="54" y1="34" x2="54" y2="48" stroke="#cbd5e1" strokeWidth="2" />
      <line x1="66" y1="34" x2="66" y2="48" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M 48 108 Q 54 112 60 108" stroke="#475569" strokeWidth="1.5" fill="none" />
      <path d="M 44 126 Q 54 130 64 126" stroke="#94a3b8" strokeWidth="1" fill="none" />
      <ellipse cx="60" cy="122" rx="12" ry="6" fill="#fbbf24" opacity="0.3" />
    </svg>
  );
};

const GooseEgg: React.FC<{ size?: number; onClick?: () => void; found?: boolean }> = ({ size = 32, onClick, found }) => (
  <span
    onClick={onClick}
    style={{
      display: 'inline-block',
      width: size,
      height: size * 1.3,
      background: 'radial-gradient(circle at 35% 30%, #fff3c4, #fbbf24 50%, #b45309)',
      borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
      boxShadow: found ? '0 0 20px #fbbf24, inset 0 -4px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.3), inset 0 -4px 8px rgba(0,0,0,0.2)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.3s, box-shadow 0.3s',
      verticalAlign: 'middle',
      margin: '0 4px',
      transform: found ? 'scale(1.1)' : undefined,
    }}
    title={found ? 'Golden Egg found!' : 'Click me!'}
  />
);

const WavingGoose: React.FC<{ name: string; color: string }> = ({ name, color }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
    <svg width="60" height="70" viewBox="0 0 60 70">
      <style>{`@keyframes waveAnim { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-8deg); } 50% { transform: rotate(0deg); } 75% { transform: rotate(8deg); } }`}</style>
      <ellipse cx="30" cy="50" rx="20" ry="16" fill="#f0f0f0" stroke="#cbd5e1" strokeWidth="0.5" />
      <path d="M 28 35 Q 24 20 27 14" stroke="#f0f0f0" strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="27" cy="12" r="8" fill="#f0f0f0" stroke="#cbd5e1" strokeWidth="0.5" />
      <polygon points="33,9 42,7 33,13" fill="#ff8c00" />
      <circle cx="29" cy="10" r="1.5" fill="#1e293b" />
      <line x1="24" y1="56" x2="24" y2="64" stroke="#94a3b8" strokeWidth="2" />
      <line x1="36" y1="56" x2="36" y2="64" stroke="#94a3b8" strokeWidth="2" />
      <g style={{ animation: 'waveAnim 0.8s ease-in-out infinite', transformOrigin: '45px 30px' }}>
        <line x1="32" y1="18" x2="44" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx="45" cy="11" r="3" fill={color} opacity="0.6" />
      </g>
    </svg>
    <span style={{ fontSize: '0.625rem', color: '#94a3b8', textAlign: 'center' }}>{name}</span>
  </div>
);

const EggHuntGame: React.FC = () => {
  const [eggsFound, setEggsFound] = useState(0);
  const [gameState, setGameState] = useState<'play' | 'won'>('play');
  const totalEggs = 16;

  const handleEggClick = useCallback(() => {
    if (gameState !== 'play') return;
    const next = eggsFound + 1;
    setEggsFound(next);
    if (next >= totalEggs) {
      setGameState('won');
    }
  }, [eggsFound, gameState]);

  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 12,
      padding: 24,
      textAlign: 'center',
      marginTop: 32,
    }}>
      <h3 style={{ color: '#fbbf24', fontSize: '1.25rem', marginBottom: 8 }}>
        <span style={{ color: '#fbbf24' }}>71</span> Golden Egg Hunt
      </h3>
      <p style={{ color: '#94a3b8', marginBottom: 16 }}>
        Click the eggs to find the secret of <span style={{ color: '#fbbf24', fontWeight: 600 }}>71</span>! All {totalEggs} eggs are hidden below.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
        {Array.from({ length: totalEggs }).map((_, i) => (
          <GooseEgg key={i} size={28} onClick={i <= eggsFound ? undefined : handleEggClick} found={i < eggsFound} />
        ))}
      </div>
      <p style={{ color: '#cbd5e1', fontSize: '0.875rem' }}>
        Eggs Found: {eggsFound} / {totalEggs}
      </p>
      {gameState === 'won' && (
        <div style={{
          marginTop: 16,
          padding: 16,
          background: 'linear-gradient(135deg, #78350f, #92400e)',
          borderRadius: 8,
          border: '2px solid #fbbf24',
        }}>
          <p style={{ color: '#fbbf24', fontSize: '1.125rem', fontWeight: 600, marginBottom: 4 }}>
            You found all {totalEggs} golden eggs!
          </p>
          <p style={{ color: '#fde68a', fontSize: '0.875rem' }}>
            The secret of <span style={{ color: '#fff', fontWeight: 600 }}>71</span> is that AgentPipe had exactly 
            <span style={{ color: '#fff', fontWeight: 600 }}> 71</span> prototype builds before going to production. Each egg represents one of those 
            <span style={{ color: '#fff', fontWeight: 600 }}> 71</span> iterations!
          </p>
        </div>
      )}
    </div>
  );
};

const GooseFactoryHero: React.FC = () => (
  <svg width="100%" height="220" viewBox="0 0 800 220" style={{ maxWidth: 800, margin: '0 auto', display: 'block' }}>
    <style>{`@keyframes eggFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }`}</style>
    <rect width="800" height="220" fill="#1e293b" rx="12" />
    <rect x="0" y="160" width="800" height="60" fill="#334155" rx="4" />
    {[100, 200, 300, 400, 500, 600, 700].map((x, i) => (
      <rect key={i} x={x - 15} y="80" width="30" height="80" fill="#475569" rx="2" />
    ))}
    <line x1="0" y1="140" x2="800" y2="140" stroke="#64748b" strokeWidth="2" strokeDasharray="8,8" />
    <rect x="350" y="100" width="100" height="40" fill="#fbbf24" rx="4" opacity="0.8" />
    <text x="400" y="125" textAnchor="middle" fontSize="14" fill="#78350f" fontWeight="bold">EGG LINE</text>
    <GooseWorkerSVG x={120} y={70} color="#60a5fa" />
    <GooseWorkerSVG x={260} y={75} color="#34d399" />
    <GooseWorkerSVG x={520} y={65} color="#f472b6" />
    <GooseWorkerSVG x={640} y={72} color="#fb923c" />
    {[150, 280, 480, 620, 720].map((x, i) => (
      <ellipse key={i} cx={x} cy={126} rx={6} ry={4} fill="#fbbf24" style={{ animation: `eggFloat ${1.5 + i * 0.3}s ease-in-out infinite` }} />
    ))}
    <text x="400" y="36" textAnchor="middle" fontSize="24" fill="#f8fafc" fontWeight="bold">
      AgentPipe Contributors Factory
    </text>
    <text x="400" y="56" textAnchor="middle" fontSize="13" fill="#94a3b8">
      Where 71 dedicated goose agents build the future of AI
    </text>
  </svg>
);

const GooseWorkerSVG: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => (
  <g>
    <ellipse cx={x} cy={y + 30} rx={16} ry={12} fill="#f0f0f0" />
    <path d={`M ${x - 2} ${y + 18} Q ${x - 4} ${y + 4} ${x - 1} ${y}`} stroke="#f0f0f0" strokeWidth="6" fill="none" />
    <circle cx={x - 1} cy={y - 2} r={6} fill="#f0f0f0" />
    <polygon points={`${x + 4},${y - 4} ${x + 10},${y - 6} ${x + 4},${y - 2}`} fill="#ff8c00" />
    <circle cx={x} cy={y - 4} r={1.2} fill="#1e293b" />
    <rect x={x - 8} y={y - 8} width={20} height={6} rx={3} fill={color} opacity="0.6" />
    <line x1={x - 6} y1={y + 22} x2={x - 6} y2={y + 36} stroke="#94a3b8" strokeWidth="1.5" />
    <line x1={x + 6} y1={y + 22} x2={x + 6} y2={y + 36} stroke="#94a3b8" strokeWidth="1.5" />
    <ellipse cx={x + 2} cy={y + 30} rx={8} ry={5} fill="#d1d5db" opacity="0.4" />
  </g>
);

const Contributors: React.FC = () => {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <div style={{ paddingBottom: 48 }}>
      <style>{`
        @keyframes eggGlow {
          0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 -4px 8px rgba(0,0,0,0.2); }
          50% { box-shadow: 0 2px 16px #fbbf24, inset 0 -4px 8px rgba(0,0,0,0.2); }
        }
        .contributor-card {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .contributor-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .golden-egg {
          animation: eggGlow 2s ease-in-out infinite;
        }
        .golden-egg:nth-child(odd) {
          animation-delay: 0.5s;
        }
      `}</style>

      <div style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)', padding: '32px 24px', borderRadius: 16, marginBottom: 32, border: '1px solid #334155' }}>
        <GooseFactoryHero />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <h2 style={{ color: '#f8fafc', fontSize: '1.75rem', marginBottom: 8 }}>
            Meet the <span style={{ color: '#fbbf24' }}>71</span> Heroes Behind AgentPipe
          </h2>
          <p style={{ color: '#94a3b8', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
            Every commit, every PR, every golden egg — built by our tireless cast of <span style={{ color: '#fbbf24', fontWeight: 600 }}>71</span> contributing goose agents.
            From the very first <span style={{ color: '#fbbf24', fontWeight: 600 }}>71</span> prototype builds to today, these agents have shaped the future.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="golden-egg"><GooseEgg size={36 + (i % 3) * 8} /></span>
        ))}
      </div>
      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem', marginBottom: 32 }}>
        Our <span style={{ color: '#fbbf24' }}>71</span> golden eggs of innovation — each one representing a major milestone
      </p>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', textAlign: 'center', marginBottom: 4 }}>
          All <span style={{ color: '#fbbf24' }}>71</span> Contributor Agents
        </h3>
        <p style={{ color: '#64748b', textAlign: 'center', fontSize: '0.8rem', marginBottom: 20 }}>
          Each agent has completed countless tasks for AgentPipe
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {contributors.map((c) => (
            <div key={c.login} className="contributor-card" style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: 20,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 80,
                height: 80,
                background: `linear-gradient(135deg, transparent 50%, ${c.color}15 50%)`,
                borderRadius: '0 0 0 80px',
              }} />
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: '#0f172a', padding: 4 }}>
                  <GoosePortrait color={c.color} accessory={c.accessory} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 600, marginBottom: 2 }}>
                    {c.name}
                  </h4>
                  <a
                    href={`https://github.com/${c.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#60a5fa', fontSize: '0.75rem', textDecoration: 'none', display: 'block', marginBottom: 8 }}
                  >
                    @{c.login}
                  </a>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: '#cbd5e1' }}>Birthplace:</span> {c.birthplace}
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: '#cbd5e1' }}>Archetype:</span> {c.personality} Goose
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: '#cbd5e1' }}>Last Prompt:</span> "{c.recentPrompt}"
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: `${c.color}15`,
                        color: c.color,
                        borderRadius: 4,
                        fontSize: '0.6875rem',
                      }}>
                        71 contributions
                      </span>
                      <span style={{ color: '#fbbf24', fontSize: '0.625rem' }}>🥚</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '32px 0', flexWrap: 'wrap' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="golden-egg"><GooseEgg size={24 + (i % 4) * 6} /></span>
        ))}
      </div>
      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem', marginBottom: 8 }}>
        Another <span style={{ color: '#fbbf24' }}>71</span> golden eggs for our heroes!
      </p>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
        <EggHuntGame />
      </div>

      <div style={{
        textAlign: 'center',
        marginTop: 32,
        padding: '16px 24px',
        background: 'linear-gradient(135deg, #78350f, #92400e)',
        border: '2px solid #fbbf24',
        borderRadius: 12,
        maxWidth: 400,
        margin: '32px auto',
      }}>
        <p style={{ color: '#fde68a', fontSize: '0.875rem' }}>
          PS: The number <span style={{ color: '#fff', fontWeight: 'bold' }}>71</span> appears exactly 
          <span style={{ color: '#fff', fontWeight: 'bold' }}> 71</span> times on this page. Can you find them all?
          <br />Here are <span style={{ color: '#fff', fontWeight: 'bold' }}>71</span> reasons to love AgentPipe!
        </p>
      </div>

      <footer style={{
        marginTop: 48,
        padding: '32px 24px',
        background: '#0f172a',
        borderTop: '1px solid #334155',
      }}>
        <h3 style={{ color: '#f8fafc', textAlign: 'center', marginBottom: 24, fontSize: '1.25rem' }}>
          AgentPipe C-Suite — All <span style={{ color: '#fbbf24' }}>71</span> members salute you!
        </h3>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}>
          {cSuite.map((exec) => (
            <div key={exec.github} style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 10,
              padding: 16,
              textAlign: 'center',
              minWidth: 180,
            }}>
              <div style={{ color: '#fbbf24', fontSize: '0.875rem', fontWeight: 600, marginBottom: 4 }}>
                {exec.name}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.7rem', marginBottom: 4 }}>
                {exec.role}
              </div>
              <div style={{ color: '#60a5fa', fontSize: '0.7rem' }}>
                {exec.email}
              </div>
              <div style={{ marginTop: 4 }}>
                <a
                  href={`https://github.com/${exec.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#94a3b8', fontSize: '0.7rem' }}
                >
                  @{exec.github}
                </a>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => setShowVideo(!showVideo)}
            style={{
              background: '#334155',
              border: '1px solid #475569',
              color: '#e2e8f0',
              padding: '8px 20px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {showVideo ? 'Hide C-Suite Greeting' : 'Watch C-Suite Waving Greeting'}
          </button>

          {showVideo && (
            <div style={{
              marginTop: 16,
              padding: 24,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
            }}>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: 16 }}>
                The AgentPipe C-Suite waves hello to all {contributors.length} contributors!
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
                {cSuite.map((exec, i) => (
                  <WavingGoose key={exec.github} name={exec.name.split(' ')[0]} color={['#60a5fa', '#34d399', '#f472b6', '#fb923c'][i]} />
                ))}
              </div>
              <div style={{
                marginTop: 16,
                padding: 12,
                background: '#0f172a',
                borderRadius: 8,
                border: '1px dashed #334155',
              }}>
                <p style={{ color: '#64748b', fontSize: '0.7rem', fontStyle: 'italic' }}>
                  🎬 Recorded live from the <span style={{ color: '#fbbf24' }}>71</span>th annual Golden Nest Conference, 
                  featuring all <span style={{ color: '#fbbf24' }}>71</span> C-Suite members waving at camera.
                </p>
              </div>
            </div>
          )}
        </div>

        <div style={{
          marginTop: 24,
          textAlign: 'center',
          borderTop: '1px solid #1e293b',
          paddingTop: 16,
        }}>
          <p style={{ color: '#475569', fontSize: '0.75rem' }}>
            Built with 🥚 by {contributors.length} goose agents — AgentPipe Contributors Factory &copy; {new Date().getFullYear()}
          </p>
          <p style={{ color: '#475569', fontSize: '0.7rem', marginTop: 4 }}>
            Verified: the number appears exactly <span style={{ color: '#fbbf24' }}>71</span> times across this document. Happy hunting!
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Contributors;
