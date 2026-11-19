import type { FamilyMember } from '../../components/leluhurqu/LeluhurQuView';
import type {
  DuplicateNameGroup,
  QuizBankStats,
  QuizCoreDifficulty,
  QuizDifficulty,
  QuizQuestion,
  QuizStage,
} from './quizTypes';

export type HiddenAnswerMask = 'none' | 'city' | 'birthYear' | 'parent' | 'callName' | 'generation';

function normalizeText(raw?: string): string {
  return (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function extractMemberCity(m: FamilyMember): string {
  const direct = (m.city || '').trim();
  if (direct) return direct;
  if (m.notes) {
    const match = m.notes.match(/(?:kota|domisili|asal|tinggal)\s*[:\-]\s*([^,;\n]+)/i);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function createSeededRandom(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface DuplicateNameIndex {
  nameCounts: Map<string, number>;
  callNameCounts: Map<string, number>;
  groups: DuplicateNameGroup[];
}

export function buildDuplicateNameIndex(
  members: FamilyMember[],
  memberMap: Map<string, FamilyMember>
): DuplicateNameIndex {
  const buckets = new Map<string, FamilyMember[]>();
  const callNameCounts = new Map<string, number>();

  for (const m of members) {
    const norm = normalizeText(m.name);
    if (norm) {
      if (!buckets.has(norm)) buckets.set(norm, []);
      buckets.get(norm)!.push(m);
    }
    const callNorm = normalizeText(m.callName);
    if (callNorm) {
      callNameCounts.set(callNorm, (callNameCounts.get(callNorm) || 0) + 1);
    }
  }

  const nameCounts = new Map<string, number>();
  const groups: DuplicateNameGroup[] = [];

  buckets.forEach((list, norm) => {
    nameCounts.set(norm, list.length);
    if (list.length > 1) {
      groups.push({
        normalizedName: norm,
        displayName: list[0].name,
        count: list.length,
        resolvedLabels: list.map((item) =>
          formatDisambiguatedMemberLabel(item, memberMap, nameCounts, 'none', true)
        ),
      });
    }
  });

  return { nameCounts, callNameCounts, groups };
}

/**
 * Solusi Nama yang Sama:
 * Jika ada lebih dari 1 anggota dengan nama identik, tambahkan pembeda nasab/generasi/atribut
 * sambil MENYEMBUNYIKAN field yang sedang ditanyakan (`mask`) agar jawaban tidak bocor.
 */
export function formatDisambiguatedMemberLabel(
  member: FamilyMember,
  memberMap: Map<string, FamilyMember>,
  nameCounts: Map<string, number>,
  mask: HiddenAnswerMask = 'none',
  forceDetail = false
): string {
  const norm = normalizeText(member.name);
  const isDuplicate = (nameCounts.get(norm) || 0) > 1;
  if (!isDuplicate && !forceDetail) {
    return member.name;
  }

  const clues: string[] = [];
  if (mask !== 'parent' && member.parentId) {
    const parent = memberMap.get(member.parentId);
    if (parent) {
      const prefix = member.gender === 'P' ? 'Binti' : 'Bin';
      clues.push(`${prefix} ${parent.name}`);
    }
  }
  if (mask !== 'generation') {
    clues.push(`G${(member.generationLevel ?? 0) + 1}`);
  }
  const city = extractMemberCity(member);
  if (mask !== 'city' && city) {
    clues.push(city);
  }
  if (mask !== 'birthYear' && member.birthYear) {
    clues.push(`L.${member.birthYear}`);
  }
  if (clues.length === 0 && member.orderIndex) {
    clues.push(`Anak ke-${member.orderIndex}`);
  }
  if (clues.length === 0) {
    clues.push(`ID ${member.id.slice(-3)}`);
  }

  return `${member.name} (${clues.slice(0, 3).join(' • ')})`;
}

interface BuildOptionResult {
  options: string[];
  correctIndex: number;
}

function buildUniqueOptions(
  correctLabel: string,
  distractorCandidates: string[],
  rng: () => number
): BuildOptionResult | null {
  const seenNorm = new Set<string>();
  const cleanCorrect = correctLabel.trim();
  if (!cleanCorrect) return null;
  seenNorm.add(normalizeText(cleanCorrect));

  const pickedDistractors: string[] = [];
  for (const cand of shuffleWithRng(distractorCandidates, rng)) {
    const trimmed = (cand || '').trim();
    const norm = normalizeText(trimmed);
    if (!trimmed || seenNorm.has(norm)) continue;
    seenNorm.add(norm);
    pickedDistractors.push(trimmed);
    if (pickedDistractors.length === 3) break;
  }

  if (pickedDistractors.length < 3) return null;

  const combined = shuffleWithRng([cleanCorrect, ...pickedDistractors], rng);
  const correctIndex = combined.findIndex((o) => o === cleanCorrect);
  return { options: combined, correctIndex };
}

function stageLabelOf(stage: QuizStage): string {
  if (stage === 1) return 'Stage 1 · Nama & Nasab';
  if (stage === 2) return 'Stage 2 · Kombinasi Kota';
  return 'Stage 3 · Tahun Kelahiran';
}

export function generateQuizQuestionBank(
  members: FamilyMember[],
  seed = 'default-seed'
): { questions: QuizQuestion[]; stats: QuizBankStats } {
  const rng = createSeededRandom(seed);
  const cleanMembers = members.filter((m) => (m.name || '').trim().length > 0);
  const memberMap = new Map<string, FamilyMember>();
  const childrenMap = new Map<string, FamilyMember[]>();

  cleanMembers.forEach((m) => memberMap.set(m.id, m));
  cleanMembers.forEach((m) => {
    if (m.parentId && memberMap.has(m.parentId)) {
      if (!childrenMap.has(m.parentId)) childrenMap.set(m.parentId, []);
      childrenMap.get(m.parentId)!.push(m);
    }
  });
  childrenMap.forEach((list) =>
    list.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
  );

  const dupIndex = buildDuplicateNameIndex(cleanMembers, memberMap);
  const hasDup = (m: FamilyMember) => (dupIndex.nameCounts.get(normalizeText(m.name)) || 0) > 1;
  const labelFor = (m: FamilyMember, mask: HiddenAnswerMask) =>
    formatDisambiguatedMemberLabel(m, memberMap, dupIndex.nameCounts, mask, false);

  const questions: QuizQuestion[] = [];
  const allCities = Array.from(
    new Set(cleanMembers.map((m) => extractMemberCity(m)).filter(Boolean))
  );
  const allBirthYears = Array.from(
    new Set(cleanMembers.map((m) => (m.birthYear || '').trim()).filter(Boolean))
  );
  const allCallNames = Array.from(
    new Set(cleanMembers.map((m) => (m.callName || '').trim()).filter(Boolean))
  );
  const allSpouseNames = Array.from(
    new Set(
      cleanMembers.flatMap((m) => (m.spouses || []).map((s) => s.name.trim())).filter(Boolean)
    )
  );

  // =========================================================================
  // STAGE 1: NAMA & NASAB (Orang tua, pasangan, panggilan, anak ke-N, generasi)
  // =========================================================================
  for (const m of cleanMembers) {
    const gen = (m.generationLevel ?? 0) + 1;

    // 1A. Siapa orang tua kandung dari X?
    if (m.parentId && memberMap.has(m.parentId)) {
      const parent = memberMap.get(m.parentId)!;
      const correctStr = labelFor(parent, 'none');
      const distractors = cleanMembers
        .filter((other) => other.id !== parent.id && other.id !== m.id)
        .map((other) => labelFor(other, 'none'));
      const built = buildUniqueOptions(correctStr, distractors, rng);
      if (built) {
        questions.push({
          id: `s1_parent_${m.id}`,
          stage: 1,
          stageLabel: stageLabelOf(1),
          difficulty: gen <= 3 ? 'ringan' : 'medium',
          prompt: `Siapakah orang tua kandung dari ${labelFor(m, 'parent')}?`,
          contextHint: hasDup(m) ? 'Disambiguasi nama sama aktif' : undefined,
          options: built.options,
          correctIndex: built.correctIndex,
          explanation: `${m.name} (Generasi ${gen}) merupakan putra/putri dari ${correctStr}.`,
          subjectMemberId: m.id,
          hasDuplicateNameDisambiguation: hasDup(m) || hasDup(parent),
        });
      }
    }

    // 1B. Siapa pasangan hidup dari X?
    if (m.spouses && m.spouses.length > 0) {
      const primarySpouse = m.spouses[0];
      const spName = primarySpouse.name.trim();
      if (spName) {
        const otherNames = [
          ...allSpouseNames.filter((s) => normalizeText(s) !== normalizeText(spName)),
          ...cleanMembers
            .filter((o) => o.id !== m.id && normalizeText(o.name) !== normalizeText(spName))
            .map((o) => o.name),
        ];
        const built = buildUniqueOptions(spName, otherNames, rng);
        if (built) {
          questions.push({
            id: `s1_spouse_${m.id}`,
            stage: 1,
            stageLabel: stageLabelOf(1),
            difficulty: gen <= 3 ? 'ringan' : 'medium',
            prompt: `Siapakah pasangan dari ${labelFor(m, 'none')}?`,
            options: built.options,
            correctIndex: built.correctIndex,
            explanation: `Pasangan tercatat dari ${m.name} adalah ${spName}.`,
            subjectMemberId: m.id,
            hasDuplicateNameDisambiguation: hasDup(m),
          });
        }
      }
    }

    // 1C. Nama panggilan / sebutan akrab
    if (m.callName && m.callName.trim() && normalizeText(m.callName) !== normalizeText(m.name)) {
      const callClean = m.callName.trim();
      const callUnique = (dupIndex.callNameCounts.get(normalizeText(callClean)) || 0) <= 1;
      const distractors = allCallNames.filter(
        (c) => normalizeText(c) !== normalizeText(callClean)
      );
      const built = buildUniqueOptions(callClean, distractors, rng);
      if (built && callUnique) {
        questions.push({
          id: `s1_call_${m.id}`,
          stage: 1,
          stageLabel: stageLabelOf(1),
          difficulty: 'ringan',
          prompt: `Apa nama panggilan / sapaan akrab dari ${labelFor(m, 'callName')}?`,
          options: built.options,
          correctIndex: built.correctIndex,
          explanation: `${m.name} biasa disapa ${callClean} di keluarga.`,
          subjectMemberId: m.id,
          hasDuplicateNameDisambiguation: hasDup(m),
        });
      }
    }

    // 1D. Anak sulung / anak ke-N dari orang tua
    const kids = childrenMap.get(m.id) || [];
    if (kids.length >= 2) {
      const firstKid = kids[0];
      const otherPeople = cleanMembers
        .filter((o) => o.id !== firstKid.id && o.id !== m.id)
        .map((o) => labelFor(o, 'parent'));
      const built = buildUniqueOptions(labelFor(firstKid, 'parent'), otherPeople, rng);
      if (built) {
        questions.push({
          id: `s1_firstchild_${m.id}`,
          stage: 1,
          stageLabel: stageLabelOf(1),
          difficulty: gen <= 2 ? 'ringan' : 'medium',
          prompt: `Siapakah anak pertama (sulung) dari ${labelFor(m, 'none')}?`,
          options: built.options,
          correctIndex: built.correctIndex,
          explanation: `Anak ke-1 dari ${m.name} adalah ${firstKid.name}.`,
          subjectMemberId: firstKid.id,
          hasDuplicateNameDisambiguation: hasDup(m) || hasDup(firstKid),
        });
      }
    }

    // 1E. Generasi ke-berapa X dalam silsilah trah?
    const maxGen = Math.max(4, ...cleanMembers.map((x) => (x.generationLevel ?? 0) + 1));
    const genPool: string[] = [];
    for (let g = 1; g <= maxGen; g++) {
      if (g !== gen) genPool.push(`Generasi ${g} (G${g})`);
    }
    const genBuilt = buildUniqueOptions(`Generasi ${gen} (G${gen})`, genPool, rng);
    if (genBuilt) {
      questions.push({
        id: `s1_gen_${m.id}`,
        stage: 1,
        stageLabel: stageLabelOf(1),
        difficulty: 'ringan',
        prompt: `Termasuk generasi ke berapakah ${labelFor(m, 'generation')} dalam silsilah ini?`,
        options: genBuilt.options,
        correctIndex: genBuilt.correctIndex,
        explanation: `${m.name} berada pada Generasi ${gen} (G${gen}).`,
        subjectMemberId: m.id,
        hasDuplicateNameDisambiguation: hasDup(m),
      });
    }

    // 1F. Kakek / Nenek (Medium)
    if (m.parentId) {
      const parent = memberMap.get(m.parentId);
      if (parent?.parentId && memberMap.has(parent.parentId)) {
        const grandParent = memberMap.get(parent.parentId)!;
        const distractors = cleanMembers
          .filter((o) => o.id !== grandParent.id && o.id !== m.id && o.id !== parent.id)
          .map((o) => labelFor(o, 'none'));
        const built = buildUniqueOptions(labelFor(grandParent, 'none'), distractors, rng);
        if (built) {
          questions.push({
            id: `s1_grand_${m.id}`,
            stage: 1,
            stageLabel: stageLabelOf(1),
            difficulty: 'medium',
            prompt: `Siapakah kakek/nenek garis lurus dari ${labelFor(m, 'none')}?`,
            options: built.options,
            correctIndex: built.correctIndex,
            explanation: `Garis atas ${m.name} adalah ${parent.name}, lalu orang tuanya ${grandParent.name}.`,
            subjectMemberId: m.id,
            hasDuplicateNameDisambiguation: hasDup(m) || hasDup(grandParent),
          });
        }
      }
    }
  }

  // =========================================================================
  // STAGE 2: KOMBINASI KOTA (Kota domisili, kombinasi kota + nama/generasi)
  // =========================================================================
  const fallbackKotaList = ['Bandung', 'Jakarta', 'Surabaya', 'Yogyakarta', 'Sukabumi', 'Semarang', 'Bogor', 'Malang'];

  for (const m of cleanMembers) {
    const city = extractMemberCity(m);
    const gen = (m.generationLevel ?? 0) + 1;
    if (city) {
      const otherCities = [
        ...allCities.filter((c) => normalizeText(c) !== normalizeText(city)),
        ...fallbackKotaList.filter((c) => normalizeText(c) !== normalizeText(city)),
      ];
      const builtCity = buildUniqueOptions(city, otherCities, rng);
      if (builtCity) {
        questions.push({
          id: `s2_cityof_${m.id}`,
          stage: 2,
          stageLabel: stageLabelOf(2),
          difficulty: gen <= 3 ? 'ringan' : 'medium',
          prompt: `Di kota manakah ${labelFor(m, 'city')} berasal atau berdomisili?`,
          options: builtCity.options,
          correctIndex: builtCity.correctIndex,
          explanation: `${m.name} tercatat berasal/berdomisili di ${city}.`,
          subjectMemberId: m.id,
          hasDuplicateNameDisambiguation: hasDup(m),
        });
      }

      // 2B. Siapa anggota yang berdomisili di kota tersebut?
      const otherMembersOutsideCity = cleanMembers
        .filter((o) => o.id !== m.id && normalizeText(extractMemberCity(o)) !== normalizeText(city))
        .map((o) => labelFor(o, 'city'));
      const builtWho = buildUniqueOptions(labelFor(m, 'city'), otherMembersOutsideCity, rng);
      if (builtWho) {
        questions.push({
          id: `s2_whocity_${m.id}`,
          stage: 2,
          stageLabel: stageLabelOf(2),
          difficulty: 'medium',
          prompt: `Siapakah anggota keluarga Generasi ${gen} yang tercatat di kota ${city}?`,
          options: builtWho.options,
          correctIndex: builtWho.correctIndex,
          explanation: `${labelFor(m, 'city')} tercatat berdomisili di ${city}.`,
          subjectMemberId: m.id,
          hasDuplicateNameDisambiguation: hasDup(m),
        });
      }

      // 2C. Kombinasi Kota + Orang Tua (Sulit)
      if (m.parentId && memberMap.has(m.parentId)) {
        const parent = memberMap.get(m.parentId)!;
        const pCity = extractMemberCity(parent);
        const comboCorrect = `${labelFor(m, 'city')} (${city})`;
        const comboDistractors = cleanMembers
          .filter((o) => o.id !== m.id && o.parentId !== m.parentId)
          .map((o) => {
            const oc = extractMemberCity(o) || fallbackKotaList[Math.floor(rng() * fallbackKotaList.length)];
            return `${labelFor(o, 'city')} (${oc})`;
          });
        const builtCombo = buildUniqueOptions(comboCorrect, comboDistractors, rng);
        if (builtCombo) {
          questions.push({
            id: `s2_combopar_${m.id}`,
            stage: 2,
            stageLabel: stageLabelOf(2),
            difficulty: 'sulit',
            prompt: `Manakah kombinasi anak dari ${parent.name}${pCity ? ` (${pCity})` : ''} beserta kota domisilinya yang tepat?`,
            options: builtCombo.options,
            correctIndex: builtCombo.correctIndex,
            explanation: `Anak dari ${parent.name} adalah ${m.name} dengan kota domisili ${city}.`,
            subjectMemberId: m.id,
            hasDuplicateNameDisambiguation: hasDup(m),
          });
        }
      }
    } else if (m.parentId && memberMap.has(m.parentId) && m.spouses && m.spouses.length > 0) {
      // Kombinasi relasi cabang & pasangan untuk anggota tanpa kota terisi
      const parent = memberMap.get(m.parentId)!;
      const comboCorrect = `${parent.name} ➔ ${m.name} & ${m.spouses[0].name}`;
      const comboDistractors = cleanMembers
        .filter((o) => o.id !== m.id && o.parentId && memberMap.has(o.parentId))
        .map((o) => {
          const op = memberMap.get(o.parentId!)!;
          const osp = o.spouses?.[0]?.name || 'Lajang';
          return `${op.name} ➔ ${o.name} & ${osp}`;
        });
      const builtRel = buildUniqueOptions(comboCorrect, comboDistractors, rng);
      if (builtRel) {
        questions.push({
          id: `s2_branch_${m.id}`,
          stage: 2,
          stageLabel: stageLabelOf(2),
          difficulty: 'medium',
          prompt: `Manakah kombinasi garis orang tua, anggota, dan pasangan yang benar untuk cabang G${gen}?`,
          options: builtRel.options,
          correctIndex: builtRel.correctIndex,
          explanation: `Jalur yang benar adalah ${comboCorrect}.`,
          subjectMemberId: m.id,
          hasDuplicateNameDisambiguation: hasDup(m),
        });
      }
    }
  }

  // =========================================================================
  // STAGE 3: TAHUN KELAHIRAN (Tahun tepat, siapa lahir tahun X, perbandingan usia)
  // =========================================================================
  for (const m of cleanMembers) {
    const by = (m.birthYear || '').trim();
    const gen = (m.generationLevel ?? 0) + 1;
    const byNum = parseInt(by, 10);

    if (by && !Number.isNaN(byNum)) {
      const syntheticYears = [
        String(byNum - 4),
        String(byNum - 2),
        String(byNum + 3),
        String(byNum + 5),
        String(byNum + 7),
      ];
      const yearCandidates = [
        ...allBirthYears.filter((y) => y !== by),
        ...syntheticYears.filter((y) => y !== by),
      ];
      const builtYear = buildUniqueOptions(by, yearCandidates, rng);
      if (builtYear) {
        questions.push({
          id: `s3_yearof_${m.id}`,
          stage: 3,
          stageLabel: stageLabelOf(3),
          difficulty: gen <= 2 ? 'medium' : 'sulit',
          prompt: `Pada tahun berapakah ${labelFor(m, 'birthYear')} dilahirkan?`,
          options: builtYear.options,
          correctIndex: builtYear.correctIndex,
          explanation: `${m.name} tercatat lahir pada tahun ${by}.`,
          subjectMemberId: m.id,
          hasDuplicateNameDisambiguation: hasDup(m),
        });
      }

      // 3B. Siapa yang lahir pada tahun tersebut?
      const otherByYear = cleanMembers
        .filter((o) => o.id !== m.id && (o.birthYear || '').trim() !== by)
        .map((o) => labelFor(o, 'birthYear'));
      const builtWhoYear = buildUniqueOptions(labelFor(m, 'birthYear'), otherByYear, rng);
      if (builtWhoYear) {
        questions.push({
          id: `s3_whoyear_${m.id}`,
          stage: 3,
          stageLabel: stageLabelOf(3),
          difficulty: 'sulit',
          prompt: `Siapakah anggota silsilah yang tercatat lahir pada tahun ${by}?`,
          options: builtWhoYear.options,
          correctIndex: builtWhoYear.correctIndex,
          explanation: `Anggota yang lahir tahun ${by} adalah ${labelFor(m, 'birthYear')}.`,
          subjectMemberId: m.id,
          hasDuplicateNameDisambiguation: hasDup(m),
        });
      }

      // 3C. Kombinasi 3 faktor (Kota + Tahun Lahir + Orang Tua) -> Sulit
      const city = extractMemberCity(m);
      if (city && m.parentId && memberMap.has(m.parentId)) {
        const parent = memberMap.get(m.parentId)!;
        const distractors = cleanMembers
          .filter(
            (o) =>
              o.id !== m.id &&
              !(
                o.parentId === m.parentId &&
                (o.birthYear || '').trim() === by &&
                normalizeText(extractMemberCity(o)) === normalizeText(city)
              )
          )
          .map((o) => labelFor(o, 'birthYear'));
        const built3 = buildUniqueOptions(labelFor(m, 'birthYear'), distractors, rng);
        if (built3) {
          questions.push({
            id: `s3_triple_${m.id}`,
            stage: 3,
            stageLabel: stageLabelOf(3),
            difficulty: 'sulit',
            prompt: `Siapakah keturunan ${parent.name} yang lahir tahun ${by} dan berdomisili di ${city}?`,
            options: built3.options,
            correctIndex: built3.correctIndex,
            explanation: `Jawaban tepat: ${m.name} (anak ${parent.name}, lahir ${by}, kota ${city}).`,
            subjectMemberId: m.id,
            hasDuplicateNameDisambiguation: hasDup(m),
          });
        }
      }
    }
  }

  // 3D. Perbandingan saudara tertua berdasarkan tahun lahir
  childrenMap.forEach((kids, parentId) => {
    const kidsWithYear = kids
      .map((k) => ({ k, yr: parseInt((k.birthYear || '').trim(), 10) }))
      .filter((x) => !Number.isNaN(x.yr));
    if (kidsWithYear.length >= 2) {
      kidsWithYear.sort((a, b) => a.yr - b.yr);
      const oldest = kidsWithYear[0];
      const youngest = kidsWithYear[kidsWithYear.length - 1];
      const parent = memberMap.get(parentId);
      if (parent && oldest.yr < youngest.yr) {
        const distractorPool = [
          ...kidsWithYear.slice(1).map((x) => labelFor(x.k, 'birthYear')),
          ...cleanMembers
            .filter((o) => o.id !== oldest.k.id && o.parentId !== parentId)
            .map((o) => labelFor(o, 'birthYear')),
        ];
        const builtOldest = buildUniqueOptions(
          labelFor(oldest.k, 'birthYear'),
          distractorPool,
          rng
        );
        if (builtOldest) {
          questions.push({
            id: `s3_oldest_${parentId}`,
            stage: 3,
            stageLabel: stageLabelOf(3),
            difficulty: 'sulit',
            prompt: `Di antara keturunan ${parent.name}, siapakah yang tahun kelahirannya paling awal?`,
            options: builtOldest.options,
            correctIndex: builtOldest.correctIndex,
            explanation: `${oldest.k.name} lahir paling awal (${oldest.yr}) dibanding saudara lainnya.`,
            subjectMemberId: oldest.k.id,
            hasDuplicateNameDisambiguation: hasDup(oldest.k) || hasDup(parent),
          });
        }
      }
    }
  });

  // Hitung statistik bank soal
  const byStage: Record<QuizStage, number> = { 1: 0, 2: 0, 3: 0 };
  const byDifficulty: Record<QuizCoreDifficulty, number> = {
    ringan: 0,
    medium: 0,
    sulit: 0,
  };
  for (const q of questions) {
    byStage[q.stage] += 1;
    byDifficulty[q.difficulty] += 1;
  }

  return {
    questions,
    stats: {
      totalMembers: cleanMembers.length,
      potentialTotal: questions.length,
      byStage,
      byDifficulty,
      duplicateNames: dupIndex.groups,
      membersWithCityCount: cleanMembers.filter((m) => Boolean(extractMemberCity(m))).length,
      membersWithBirthYearCount: cleanMembers.filter((m) => Boolean((m.birthYear || '').trim())).length,
    },
  };
}

/**
 * Mengambil 10 soal acak untuk sesi kuis:
 * - Mode 'campuran': tepat 4 Ringan + 3 Medium + 3 Sulit (jika kurang di satu tier pada trah mini, isi dari tier tersedia).
 * - Mode spesifik ('ringan' / 'medium' / 'sulit'): acak sesuai tingkat yang dipilih (fallback ke tier terdekat jika bank < 10).
 */
export function composeQuizSessionQuestions(
  members: FamilyMember[],
  difficulty: QuizDifficulty,
  seed: string,
  targetCount = 10
): { questions: QuizQuestion[]; stats: QuizBankStats } {
  const { questions: bank, stats } = generateQuizQuestionBank(members, seed);
  const rng = createSeededRandom(`${seed}::deck::${difficulty}`);

  const ringanPool = shuffleWithRng(
    bank.filter((q) => q.difficulty === 'ringan'),
    rng
  );
  const mediumPool = shuffleWithRng(
    bank.filter((q) => q.difficulty === 'medium'),
    rng
  );
  const sulitPool = shuffleWithRng(
    bank.filter((q) => q.difficulty === 'sulit'),
    rng
  );

  const picked: QuizQuestion[] = [];
  const usedIds = new Set<string>();
  const takeFrom = (pool: QuizQuestion[], limit: number) => {
    for (const q of pool) {
      if (picked.length >= targetCount || limit <= 0) break;
      if (usedIds.has(q.id)) continue;
      usedIds.add(q.id);
      picked.push(q);
      limit -= 1;
    }
  };

  if (difficulty === 'campuran') {
    const rQuota = targetCount === 10 ? 4 : Math.ceil(targetCount * 0.4);
    const mQuota = targetCount === 10 ? 3 : Math.floor(targetCount * 0.3);
    const sQuota = Math.max(1, targetCount - rQuota - mQuota);
    takeFrom(ringanPool, rQuota);
    takeFrom(mediumPool, mQuota);
    takeFrom(sulitPool, sQuota);
  } else if (difficulty === 'ringan') {
    takeFrom(ringanPool, targetCount);
  } else if (difficulty === 'medium') {
    takeFrom(mediumPool, targetCount);
  } else {
    takeFrom(sulitPool, targetCount);
  }

  // Jika jumlah anggota masih sedikit sehingga tier target < 10 soal, lengkapi dengan soal tersisa tanpa duplikat
  if (picked.length < targetCount) {
    const remaining = shuffleWithRng(
      bank.filter((q) => !usedIds.has(q.id)),
      rng
    );
    takeFrom(remaining, targetCount - picked.length);
  }

  return {
    questions: shuffleWithRng(picked, rng),
    stats,
  };
}
