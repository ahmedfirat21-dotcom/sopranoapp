// SopranoChat — Oda kategorisi görsel teması
// Keşfet ve Odalarım sayfasında TEK kaynaklı renk paleti.
// Her kategori için 3 aşamalı gradient + kartvizit ikonu.

export const CATEGORY_THEME: Record<string, { colors: [string, string, string]; icon: string; accent: string }> = {
  chat:  { colors: ['#1E4170', '#13365A', '#0D2642'], icon: 'chatbubbles',          accent: '#3B82F6' },
  music: { colors: ['#4A2575', '#381B5A', '#251040'], icon: 'musical-notes',        accent: '#8B5CF6' },
  game:  { colors: ['#5C1A30', '#461426', '#30101C'], icon: 'game-controller',      accent: '#EF4444' },
  tech:  { colors: ['#123B5C', '#0D2C48', '#081D32'], icon: 'code-slash',           accent: '#06B6D4' },
  book:  { colors: ['#4D3A14', '#3A2B0C', '#2A1E08'], icon: 'book',                 accent: '#D97706' },
  film:  { colors: ['#4C1452', '#39103E', '#280B2C'], icon: 'film',                 accent: '#EC4899' },
  other: { colors: ['#1E293B', '#151E2E', '#0F172A'], icon: 'ellipsis-horizontal',  accent: '#64748B' },
};

export const ROOM_THEME_GRADIENTS: Record<string, [string, string]> = {
  ocean:   ['#0E4D6F', '#083344'],
  sunset:  ['#7F1D1D', '#4C0519'],
  forest:  ['#14532D', '#052E16'],
  galaxy:  ['#312E81', '#1E1B4B'],
  aurora:  ['#134E4A', '#042F2E'],
  cherry:  ['#831843', '#500724'],
  cyber:   ['#1E3A8A', '#172554'],
  volcano: ['#7C2D12', '#431407'],
};

export function getCategoryTheme(category?: string) {
  return CATEGORY_THEME[category || 'other'] || CATEGORY_THEME.other;
}
