export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  check: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  tilesCount: number;
  discoveredCount: number;
  visitedCount: number;
  level: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Tiles
  { id: 'tile_1',   emoji: '👣', name: 'Første steg',    description: 'Avdekk din første flise',  check: s => s.tilesCount >= 1 },
  { id: 'tile_10',  emoji: '🗺️',  name: 'Utforsker',      description: 'Avdekk 10 fliser',          check: s => s.tilesCount >= 10 },
  { id: 'tile_50',  emoji: '🥾', name: 'Vandrer',         description: 'Avdekk 50 fliser',          check: s => s.tilesCount >= 50 },
  { id: 'tile_100', emoji: '🏙️', name: 'Byutforsker',    description: 'Avdekk 100 fliser',         check: s => s.tilesCount >= 100 },

  // Discovery
  { id: 'poi_1',   emoji: '🔍', name: 'Nysgjerrig',      description: 'Oppdag ditt første sted',   check: s => s.discoveredCount >= 1 },
  { id: 'poi_10',  emoji: '⭐', name: 'Eventyrer',        description: 'Oppdag 10 steder',           check: s => s.discoveredCount >= 10 },
  { id: 'poi_50',  emoji: '🌟', name: 'Oppdager',         description: 'Oppdag 50 steder',           check: s => s.discoveredCount >= 50 },
  { id: 'poi_100', emoji: '🏆', name: 'Osloekspert',      description: 'Oppdag 100 steder',          check: s => s.discoveredCount >= 100 },

  // Visited
  { id: 'visit_1',  emoji: '📍', name: 'Jeg var her!',   description: 'Besøk ditt første sted',    check: s => s.visitedCount >= 1 },
  { id: 'visit_10', emoji: '🎯', name: 'Stamgjest',       description: 'Besøk 10 steder',            check: s => s.visitedCount >= 10 },
  { id: 'visit_25', emoji: '🦊', name: 'Byoriginalen',    description: 'Besøk 25 steder',            check: s => s.visitedCount >= 25 },

  // Level
  { id: 'level_3', emoji: '⚡', name: 'På vei',           description: 'Nå nivå 3',                 check: s => s.level >= 3 },
  { id: 'level_5', emoji: '💎', name: 'Veteran',           description: 'Nå nivå 5',                 check: s => s.level >= 5 },
];
