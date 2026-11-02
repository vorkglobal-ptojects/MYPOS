// Canonical Branch IDs matching public.branches table
export const CANONICAL_BRANCHES = [
  { id: 'HQ',   name: 'Head Office' },
  { id: 'DHW',  name: 'Main Branch' },
  { id: 'KHT',  name: 'Kahathuduwa' },
  { id: 'KTW',  name: 'Kottawa' },
  { id: 'KOT',  name: 'Kotikawatta' },
  { id: 'PND',  name: 'Panadura' },
  { id: 'BRL',  name: 'Borella' },
  { id: 'DMT',  name: 'Dematagoda' },
  { id: 'HMG',  name: 'Homagama' },
  { id: 'KDW',  name: 'Kadawatha' },
  { id: 'KIR',  name: 'Kiribathgoda' },
  { id: 'W2',   name: 'Wattala 2' },
  { id: 'W3',   name: 'Wattala 3' },
  { id: 'W4',   name: 'Wattala 4' },
  { id: 'TEST', name: 'Test Branch' },
] as const;

const BRANCH_ALIAS_MAP: Record<string, string> = {
  'TEST': 'TEST', 'TESTBRANCH': 'TEST', 'TEST BRANCH': 'TEST',
  'KAH': 'KHT', 'KHT': 'KHT', 'KAHATHUDUWA': 'KHT', 'KAHATHOTUWA': 'KHT',
  'PAN': 'PND', 'PND': 'PND', 'PANADURA': 'PND',
  'DEM': 'DMT', 'DMT': 'DMT', 'DEMATAGODA': 'DMT',
  'BOR': 'BRL', 'BRL': 'BRL', 'BORELLA': 'BRL',
  'KAD': 'KDW', 'KDW': 'KDW', 'KADAWATHA': 'KDW',
  'KTW': 'KTW', 'KOTTAWA': 'KTW',
  'KOT': 'KOT', 'KOTIKAWATTA': 'KOT',
  'HOM': 'HMG', 'HMG': 'HMG', 'HOMAGAMA': 'HMG',
  'KIR': 'KIR', 'KIR1': 'KIR', 'KIR2': 'KIR', 'KIRIBATHGODA': 'KIR',
  'WAT2': 'W2', 'W2': 'W2',
  'WAT3': 'W3', 'W3': 'W3',
  'WAT4': 'W4', 'W4': 'W4',
  'DHW': 'DHW', 'DEHIWALA': 'DHW', 'MAIN': 'DHW', 'MAIN BRANCH': 'DHW',
  'HQ': 'HQ', 'HEAD OFFICE': 'HQ',
};

export function normalizeBranchId(branchId: string | null | undefined): string {
  if (!branchId) return 'HQ';
  const clean = branchId.trim().toUpperCase();
  return BRANCH_ALIAS_MAP[clean] || clean;
}

export function isNationalId(id: string | null | undefined): boolean {
  if (!id) return false;
  const clean = id.trim();
  return /^[0-9]{9}[vVxX]$/.test(clean) || /^[0-9]{12}$/.test(clean);
}

export function stripBranchPrefix(billNo: string | null | undefined): string {
  if (!billNo) return '';
  return billNo.replace(/^(w3|w2|w4|kdw|kht|pnd|dmt|ktw|hq|kir|hmg|brl|kot|dhw|test)[-/_:\s]+/i, '').trim();
}

