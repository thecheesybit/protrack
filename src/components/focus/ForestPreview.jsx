import { useState, useMemo } from 'react'
import { ForestTerrain } from './ForestTerrain'
import { DayGrove } from './CalendarForest'
import { ForestWorldMap } from './ForestWorldMap'
import { deriveMonthEcosystem, SUCCESSION_TIERS } from '@/lib/ecosystem'
import { INDIAN_SEASONS } from '@/lib/indianClimate'
import { Sprout, Flame, Clock, TreePine, Flower2, Droplets, Mountain, Sparkles, Globe, Heart, CloudRain } from 'lucide-react'

// Deterministic mock session factory
function makeMockSessions(count, dayNum = 1) {
  const sessions = []
  const types = ['tree', 'tree', 'shrub', 'flower', 'tree']
  const durations = [25, 30, 15, 8, 50]
  const labels = ['Deep Math Focus', 'Architecture Study', 'Reading Sprint', 'System Design', 'Code Review']

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length]
    const dur = durations[i % durations.length]
    const d = new Date(2026, 8, dayNum, 9 + (i % 8), (i * 17) % 60)
    sessions.push({
      id: `mock-sess-${dayNum}-${i}`,
      durationMin: dur,
      plantType: type,
      completed: true,
      label: `${labels[i % labels.length]} #${i + 1}`,
      startedAt: d,
      createdAt: d,
    })
  }
  return sessions
}

export function ForestPreview() {
  const [activeTab, setActiveTab] = useState('gallery')
  const [vitalityVal, setVitalityVal] = useState(0.85)
  const [selectedSeasonId, setSelectedSeasonId] = useState('vasant')

  const sess1 = useMemo(() => makeMockSessions(1), [])
  const sess3 = useMemo(() => makeMockSessions(3), [])
  const sess25 = useMemo(() => makeMockSessions(25), [])
  const sess60 = useMemo(() => makeMockSessions(60), [])
  const sess93 = useMemo(() => makeMockSessions(93), [])
  const sess130 = useMemo(() => makeMockSessions(130), [])
  const sess500 = useMemo(() => makeMockSessions(500), [])
  const sess2500 = useMemo(() => makeMockSessions(2500), [])
  const sess10000 = useMemo(() => makeMockSessions(10000), [])

  // Multi-month mock sessions for World Continent
  const worldSessions = useMemo(() => {
    const all = []
    const now = new Date()
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
      const count = m === 5 ? 2 : m === 4 ? 8 : m === 3 ? 18 : m === 2 ? 35 : m === 1 ? 55 : 22
      const types = ['tree', 'shrub', 'flower']
      for (let i = 0; i < count; i++) {
        const sessDate = new Date(d.getFullYear(), d.getMonth(), 1 + (i % 26), 10 + (i % 8), 0)
        all.push({
          id: `world-sess-${m}-${i}`,
          completed: true,
          durationMin: 25 + (i % 4) * 15,
          plantType: types[i % types.length],
          label: `Focus #${i + 1}`,
          startedAt: sessDate,
          createdAt: sessDate,
        })
      }
    }
    return all
  }, [])

  return (
    <div className="min-h-screen bg-[#07080c] text-slate-100 p-6 font-sans">
      <header className="mb-8 max-w-7xl mx-auto flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 font-display flex items-center gap-2">
            <Sprout className="h-6 w-6" />
            <span>PRO TRACK — Living Forest Ecosystem Test Harness</span>
          </h1>
          <p className="text-xs text-white/50 mt-1">
            Validating month-hex succession tiers, hydrology, geomorphology, vitality drought & recovery, climate, and Honeycomb Continent.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['gallery', 'tiers', 'vitality', 'climate', 'worldmap', 'sanctuary', 'stress', 'calendar'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-emerald-500 text-slate-950 shadow-glow-sm'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {tab === 'worldmap' ? 'World Continent' : tab}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {activeTab === 'gallery' && (
          <div className="flex flex-col gap-6">
            {/* Stats row preview matching FocusWidget (Screenshot 1, Note 1) */}
            <div className="max-w-md rounded-2xl border border-emerald-500/25 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white/80">FocusWidget Stats Row Redesign</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">User Note (1)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/5 py-2.5 px-2">
                  <Flame className="h-4 w-4 text-amber-400" />
                  <span className="font-display text-xl font-bold text-white">1d</span>
                  <span className="text-[10px] text-white/40">Streak</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/5 py-2.5 px-2">
                  <Clock className="h-4 w-4 text-sky-400" />
                  <span className="font-display text-xl font-bold text-white">15h</span>
                  <span className="text-[10px] text-white/40">Total</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/5 py-2.5 px-2">
                  <TreePine className="h-4 w-4 text-emerald-400" />
                  <span className="font-display text-xl font-bold text-white">40</span>
                  <div className="flex items-center gap-1 text-[9px]">
                    <span className="flex items-center text-emerald-300 font-medium"><TreePine className="h-2.5 w-2.5 mr-0.5" />34</span>
                    <span className="text-white/20">·</span>
                    <span className="flex items-center text-teal-300 font-medium"><Sprout className="h-2.5 w-2.5 mr-0.5" />2</span>
                    <span className="text-white/20">·</span>
                    <span className="flex items-center text-rose-300 font-medium"><Flower2 className="h-2.5 w-2.5 mr-0.5" />4</span>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-white/40">Forest</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 0: Empty Plot */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 flex flex-col">
              <h3 className="text-xs font-bold text-white/80 mb-2">0 Plants — Freshly Tilled Soil Bed</h3>
              <ForestTerrain
                items={[]}
                minHeightClass="min-h-[280px] h-[280px]"
                emptyState={
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Sprout className="h-8 w-8 text-emerald-400" />
                    <p className="text-xs font-bold text-white/90">Freshly Tilled Soil Bed</p>
                    <p className="text-[10px] text-white/50">Your forest floor is waiting for its first plant.</p>
                  </div>
                }
              />
            </div>

            {/* Card 1: Single Plant */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 flex flex-col">
              <h3 className="text-xs font-bold text-white/80 mb-2">1 Plant — Cozy Centered Plot</h3>
              <ForestTerrain
                items={sess1.map((s, i) => ({
                  key: s.id,
                  type: s.plantType,
                  species: 'all',
                  seed: i,
                  session: s,
                  tooltip: { title: s.label, detail: '25m Tree' },
                }))}
                minHeightClass="min-h-[280px] h-[280px]"
              />
            </div>

            {/* Card 2: 3 Plants */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 flex flex-col">
              <h3 className="text-xs font-bold text-white/80 mb-2">3 Plants — Small Grove (Tree, Shrub, Flower)</h3>
              <ForestTerrain
                items={sess3.map((s, i) => ({
                  key: s.id,
                  type: s.plantType,
                  species: 'all',
                  seed: i,
                  session: s,
                  tooltip: { title: s.label, detail: `${s.durationMin}m ${s.plantType}` },
                }))}
                minHeightClass="min-h-[280px] h-[280px]"
              />
            </div>

            {/* Card 3: 25 Plants (Reference 1) */}
            <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/50 p-4 flex flex-col ring-1 ring-emerald-500/20">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-emerald-400">25 Plants — Reference 1 (5x5 Grid)</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">Ref Screenshot</span>
              </div>
              <ForestTerrain
                items={sess25.map((s, i) => ({
                  key: s.id,
                  type: s.plantType,
                  species: 'all',
                  seed: i * 7,
                  session: s,
                  tooltip: { title: s.label, detail: `${s.durationMin}m ${s.plantType}` },
                }))}
                minHeightClass="min-h-[280px] h-[280px]"
              />
            </div>

            {/* Card 4: 60 Plants */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 flex flex-col">
              <h3 className="text-xs font-bold text-white/80 mb-2">60 Plants — Thriving Woodland</h3>
              <ForestTerrain
                items={sess60.map((s, i) => ({
                  key: s.id,
                  type: s.plantType,
                  species: 'all',
                  seed: i * 13,
                  session: s,
                  tooltip: { title: s.label, detail: `${s.durationMin}m ${s.plantType}` },
                }))}
                minHeightClass="min-h-[280px] h-[280px]"
              />
            </div>

            {/* Card 5: 93 Plants (Reference 2) & 130 Plants (Overflow) */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-white/80">93 Plants — Month View (Reference 2)</h3>
                <span className="text-[10px] text-white/40">10x10 Grid</span>
              </div>
              <ForestTerrain
                items={sess93.map((s, i) => ({
                  key: s.id,
                  type: s.plantType,
                  species: 'all',
                  seed: i * 5,
                  session: s,
                  tooltip: { title: s.label, detail: `${s.durationMin}m ${s.plantType}` },
                }))}
                minHeightClass="min-h-[280px] h-[280px]"
              />
            </div>

            {/* Card 6: 130 Plants (Overflow Badge) */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-white/80">130 Plants — Beyond Capacity Overflow</h3>
                <span className="text-[10px] text-emerald-400 font-bold">+10 Overflow Badge</span>
              </div>
              <ForestTerrain
                items={sess130.map((s, i) => ({
                  key: s.id,
                  type: s.plantType,
                  species: 'all',
                  seed: i * 11,
                  session: s,
                  tooltip: { title: s.label, detail: `${s.durationMin}m ${s.plantType}` },
                }))}
                maxCells={120}
                minHeightClass="min-h-[280px] h-[280px]"
              />
            </div>
          </div>
        </div>
        )}

        {/* ════════════════ SUCCESSION TIERS 0 - 5 ════════════════ */}
        {activeTab === 'tiers' && (
          <div className="flex flex-col gap-6">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <span>Ecological Succession Lifecycles (Tiers 0 – 5)</span>
              </h2>
              <p className="text-xs text-white/60 mt-1">
                Visualizing how a month-hex evolves from Day 1 bare substrate through pioneering flora, ponds, winding streams, meandering rivers, up to the climax waterfall and rainbow.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0, 1, 2, 3, 4, 5].map((lvl) => {
                const tierMeta = SUCCESSION_TIERS[lvl]
                const count = lvl === 0 ? 0 : lvl === 1 ? 3 : lvl === 2 ? 12 : lvl === 3 ? 30 : lvl === 4 ? 70 : 130
                const mockSess = makeMockSessions(count)
                const tierMinutes = [0, 150, 420, 1050, 2100, 3600][lvl]
                const tierActiveDays = [0, 3, 13, 18, 22, 26][lvl]
                const eco = deriveMonthEcosystem({
                  totalMin: tierMinutes,
                  activeDays: tierActiveDays,
                  daysElapsed: 28,
                  daysSinceLast: 0,
                  currentStreak: Math.max(lvl * 2, lvl === 5 ? 5 : 0),
                  month: 2, // Vasant
                  year: 2026,
                  isSealed: false,
                })

                return (
                  <div key={lvl} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            backgroundColor: `${tierMeta.badgeColor}25`,
                            color: tierMeta.badgeColor,
                          }}
                        >
                          Tier {lvl} · {tierMeta.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/40">{count} plants</span>
                    </div>

                    <p className="text-[11px] text-white/60 mb-2 italic">"{tierMeta.description}"</p>

                    <ForestTerrain
                      items={mockSess.map((s, i) => ({
                        key: s.id,
                        type: s.plantType,
                        species: 'all',
                        seed: i * 7,
                        session: s,
                        tooltip: { title: s.label, detail: `${s.durationMin}m ${s.plantType}` },
                      }))}
                      ecosystem={eco}
                      isHex={true}
                      minHeightClass="min-h-[290px] h-[290px]"
                    />

                    <div className="mt-3 flex items-center justify-between text-[10px] text-white/50 border-t border-white/5 pt-2">
                      <span className="flex items-center gap-1 capitalize">
                        <Droplets className="h-3 w-3 text-sky-400" />
                        {eco.hydrology.name}
                      </span>
                      <span className="flex items-center gap-1 capitalize">
                        <Mountain className="h-3 w-3 text-amber-400" />
                        {eco.geomorphology.name}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ════════════════ VITALITY DROUGHT & RECOVERY ════════════════ */}
        {activeTab === 'vitality' && (
          <div className="flex flex-col gap-6">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-400" />
                <span>Cosmetic Vitality Layer & Recovery Slider</span>
              </h2>
              <p className="text-xs text-white/60 mt-1">
                Zero data destruction: focusSessions are never deleted for inactivity. Vitality (0.15..1.0) shifts the color grading from parched savannah to vibrant emerald, recovering instantly upon completing a session today.
              </p>
            </div>

            {/* Interactive Control Panel */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 max-w-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/80">Current Vitality:</span>
                <span className="text-sm font-bold text-emerald-400">
                  {Math.round(vitalityVal * 100)}% ({vitalityVal >= 0.7 ? 'Thriving' : vitalityVal >= 0.4 ? 'Temperate' : 'Parched'})
                </span>
              </div>

              <input
                type="range"
                min="0.15"
                max="1.0"
                step="0.05"
                value={vitalityVal}
                onChange={(e) => setVitalityVal(Number(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVitalityVal(0.20)}
                  className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/15 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition-all cursor-pointer"
                >
                  Simulate 7-Day Drought (0.20)
                </button>
                <button
                  type="button"
                  onClick={() => setVitalityVal(0.95)}
                  className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/20 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition-all cursor-pointer"
                >
                  Complete Focus Today! (0.95)
                </button>
              </div>
            </div>

            {/* Realtime Diorama */}
            <div className="max-w-2xl rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl">
              <ForestTerrain
                items={sess60.map((s, i) => ({
                  key: s.id,
                  type: s.plantType,
                  species: 'all',
                  seed: i * 5,
                  session: s,
                  tooltip: { title: s.label, detail: `${s.durationMin}m ${s.plantType}` },
                }))}
                ecosystem={{
                  vitality: vitalityVal,
                  tier: SUCCESSION_TIERS[3],
                  hydrology: { type: 'stream', name: 'Winding Brook' },
                  geomorphology: { type: 'rolling_hills', name: 'Rolling Hills' },
                  climate: { season: INDIAN_SEASONS[1] },
                }}
                isHex={true}
                minHeightClass="min-h-[420px]"
              />
            </div>
          </div>
        )}

        {/* ════════════════ SEASONS & WEATHER PARTICLES ════════════════ */}
        {activeTab === 'climate' && (
          <div className="flex flex-col gap-6">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                <CloudRain className="h-5 w-5" />
                <span>Indian Climate Seasons & Atmospheric Weather Particles</span>
              </h2>
              <p className="text-xs text-white/60 mt-1">
                Integrated with <code className="text-emerald-300">indianClimate.js</code>. Varsha brings monsoon rain, Vasant floats flower petals, Shishir drifts winter snow, Grishma stirs summer heat dust, and Sharad scatters autumn leaves.
              </p>
            </div>

            {/* Season Selector */}
            <div className="flex flex-wrap gap-2">
              {INDIAN_SEASONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSeasonId(s.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedSeasonId === s.id
                      ? 'bg-emerald-500 text-slate-950 shadow-glow-sm'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <span>{s.sanskritName}</span>
                  <span className="text-[10px] font-normal opacity-80">({s.name})</span>
                </button>
              ))}
            </div>

            {/* Interactive Hex with Season Weather */}
            <div className="max-w-2xl rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl">
              <ForestTerrain
                items={sess60.map((s, i) => ({
                  key: s.id,
                  type: s.plantType,
                  species: 'all',
                  seed: i * 4,
                  session: s,
                  tooltip: { title: s.label, detail: `${s.durationMin}m ${s.plantType}` },
                }))}
                ecosystem={{
                  vitality: 0.9,
                  tier: SUCCESSION_TIERS[4],
                  hydrology: { type: 'river', name: 'Meandering River' },
                  geomorphology: { type: 'rocky_peaks', name: 'Rocky Ridge' },
                  climate: { season: INDIAN_SEASONS.find((s) => s.id === selectedSeasonId) || INDIAN_SEASONS[1] },
                }}
                isHex={true}
                minHeightClass="min-h-[440px]"
              />
            </div>
          </div>
        )}

        {/* ════════════════ HONEYCOMB CONTINENT WORLD MAP ════════════════ */}
        {activeTab === 'worldmap' && (
          <div className="flex flex-col gap-4">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                <Globe className="h-5 w-5" />
                <span>Multi-Month Honeycomb Continent</span>
              </h2>
              <p className="text-xs text-white/60 mt-1">
                Each month is an interlocking hexagonal tile in an outward spiral. Past months are sealed with their final merit tier; the active month is alive and pulsating. Drag to explore, scroll to zoom, click any hex to inspect.
              </p>
            </div>

            <div className="w-full h-[620px] rounded-3xl border border-emerald-500/25 bg-slate-950/90 shadow-2xl overflow-hidden">
              <ForestWorldMap
                sessions={worldSessions}
                currentStreak={5}
                className="h-full w-full"
                onInspectMonth={(hex) => {
                  console.log(`Inspecting ${hex.key}: Tier ${hex.ecosystem?.tier?.level ?? hex.ecosystem?.tier?.tier} (${hex.totalHours} hrs focused)`)
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'sanctuary' && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center max-w-2xl">
              <h2 className="text-xl font-bold text-emerald-400">Forest Sanctuary — Enlarged Canvas & De-crowded Header</h2>
              <p className="text-xs text-white/60 mt-1">
                Max-w-7xl container with streamlined 2-row header, eliminated clutter, and enlarged 64vh diorama box for an immersive living ecosystem.
              </p>
            </div>

            {/* Refined, Streamlined Header (De-crowded & Airy) */}
            <div className="w-full max-w-7xl flex flex-col items-center gap-1.5 text-center mt-2">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-white drop-shadow-md">
                  Look how much you've grown: <span className="text-emerald-400 capitalize">34 Trees, 2 Shrubs and 4 Flowers</span>
                </h2>

                <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-0.5 backdrop-blur-md">
                  <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-emerald-500/25 text-emerald-300 font-bold shadow-sm">
                    <TreePine className="h-3.5 w-3.5" />
                    <span>Living Diorama</span>
                  </span>
                  <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-white/60">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Honeycomb World</span>
                  </span>
                </div>
              </div>

              <p className="text-xs font-medium text-emerald-200/75 max-w-lg leading-relaxed italic">
                "Your future self will thank you for the focus you cultivate today."
              </p>
            </div>

            {/* Enlarged Canvas */}
            <div className="w-full max-w-7xl rounded-3xl border border-emerald-500/25 bg-slate-950/80 shadow-2xl overflow-hidden">
              <ForestTerrain
                items={sess60.map((s, i) => ({
                  key: s.id,
                  type: s.plantType,
                  species: 'all',
                  seed: i * 3,
                  session: s,
                  tooltip: { title: s.label, detail: `${s.durationMin}m ${s.plantType}` },
                }))}
                minHeightClass="h-[64vh] min-h-[500px] max-h-[740px] w-full"
                className="h-full w-full rounded-3xl"
                isSanctuary={true}
              />
            </div>

            {/* Stat strip */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <span className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75 backdrop-blur-md">
                <Clock className="h-3.5 w-3.5 text-sky-400" />
                <span>15h 4m focused total</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75 backdrop-blur-md">
                <Sprout className="h-3.5 w-3.5 text-emerald-400" />
                <span>40 total sessions</span>
              </span>
            </div>
          </div>
        )}

        {activeTab === 'stress' && (
          <div className="flex flex-col gap-6">
            <div className="max-w-xl">
              <h2 className="text-xl font-bold text-emerald-400">Massive Grove Stress Test (500 to 10,000 Trees)</h2>
              <p className="text-xs text-white/60 mt-1">
                Validating dynamic plot area expansion, frustum culling, and 60 FPS performance via hardware-accelerated Canvas with LOD.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                <h3 className="text-xs font-bold text-white/80 mb-2">500 Trees — Expanded Clearing</h3>
                <ForestTerrain
                  items={sess500.map((s, i) => ({ key: s.id, type: s.plantType, seed: i, session: s }))}
                  maxCells={10000}
                  minHeightClass="min-h-[340px] h-[340px]"
                />
              </div>
              <div className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                <h3 className="text-xs font-bold text-white/80 mb-2">2,500 Trees — Dense Woodland</h3>
                <ForestTerrain
                  items={sess2500.map((s, i) => ({ key: s.id, type: s.plantType, seed: i, session: s }))}
                  maxCells={10000}
                  minHeightClass="min-h-[340px] h-[340px]"
                />
              </div>
              <div className="flex flex-col rounded-2xl border border-emerald-500/40 bg-slate-900/50 p-4 ring-1 ring-emerald-500/30">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-emerald-400">10,000 Trees — Massive Ecosystem</h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">10k Stress Test</span>
                </div>
                <ForestTerrain
                  items={sess10000.map((s, i) => ({ key: s.id, type: s.plantType, seed: i, session: s }))}
                  maxCells={10000}
                  minHeightClass="min-h-[340px] h-[340px]"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-xl font-bold text-emerald-400">Calendar Forest Views (Week vs Day)</h2>
              <p className="text-xs text-white/60 mt-1">
                Comparing the compact hoverable tufts in Week view against the expansive Hero Rhombus diorama in Day view.
              </p>
            </div>

            {/* Single-Day View Hero Grove (TodayAgenda) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white/90">Single-Day View Hero Grove (TodayAgenda)</h3>
                  <p className="text-xs text-white/50">
                    Expansive 2.5D isometric diorama filling the bottom of the Day view with full rotation, zoom, roaming wildlife, and executive status.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  User Note # "needs to be more bigger"
                </span>
              </div>
              <DayGrove
                sessions={makeMockSessions(5, 16)}
                dateStr="2026-09-16"
                variant="hero"
                isToday={true}
              />
            </div>

            {/* Week 7-Day Columns */}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-white/90">Week Timetable 7-Day Columns (TimetableGrid)</h3>
              <p className="text-xs text-white/50">
                Hover over any column's baseline grove to see it scale up 1.65x with the Executive Status Briefing card.
              </p>
              <div className="grid grid-cols-7 gap-2 border border-white/10 rounded-2xl p-4 bg-slate-950/60">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                  const daySessions = makeMockSessions(
                    idx === 0 ? 0 : idx === 1 ? 1 : idx === 2 ? 3 : idx === 3 ? 5 : idx === 4 ? 2 : idx === 5 ? 7 : 4,
                    idx + 1,
                  )
                  return (
                    <div key={day} className="flex flex-col border border-white/10 rounded-xl p-2 min-h-[220px] relative bg-slate-900/40">
                      <span className="text-[10px] font-bold text-white/60">{day} ({daySessions.length})</span>
                      <div className="flex-1 flex flex-col justify-end">
                        <DayGrove
                          sessions={daySessions}
                          dateStr={`2026-09-0${idx + 1}`}
                          dayIndex={idx}
                          className="relative inset-auto w-full"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
