'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  GearsetsStore, 
  GearsetRow, 
  CrafterAttributes,
  getGearsetsStore,
  ALL_CRAFT_JOBS,
  JOB_NAMES,
  DEFAULT_ATTRIBUTES,
} from '@/lib/gearsets';
import type { CraftJob } from '@/types';

/**
 * React Hook: 使用配裝 Store
 */
export function useGearsets() {
  const [gearsets, setGearsets] = useState<GearsetRow[]>([]);
  const [store] = useState(() => getGearsetsStore());

  useEffect(() => {
    // 初始化
    setGearsets(store.getAll());

    // 訂閱變更
    const unsubscribe = store.subscribe(() => {
      setGearsets(store.getAll());
    });

    return unsubscribe;
  }, [store]);

  const addGearset = useCallback((name?: string, jobs?: CraftJob[]) => {
    return store.addGearset(name, jobs);
  }, [store]);

  const updateGearset = useCallback((id: number, updates: Partial<Omit<GearsetRow, 'id'>>) => {
    store.updateGearset(id, updates);
  }, [store]);

  const updateAttributes = useCallback((id: number, attrs: Partial<CrafterAttributes>) => {
    store.updateAttributes(id, attrs);
  }, [store]);

  const deleteGearset = useCallback((id: number) => {
    return store.deleteGearset(id);
  }, [store]);

  const getForJob = useCallback((job: CraftJob) => {
    return store.getForJob(job);
  }, [store]);

  const getDisplayName = useCallback((gearset: GearsetRow) => {
    return store.getDisplayName(gearset);
  }, [store]);

  const toCrafterStats = useCallback((job: CraftJob, gearsetId?: number) => {
    return store.toCrafterStats(job, gearsetId);
  }, [store]);

  return {
    gearsets,
    defaultGearset: gearsets[0] || { id: 0, value: DEFAULT_ATTRIBUTES, compatibleJobs: ALL_CRAFT_JOBS },
    addGearset,
    updateGearset,
    updateAttributes,
    deleteGearset,
    getForJob,
    getDisplayName,
    toCrafterStats,
    exportJson: () => store.toJson(),
    importJson: (json: string) => store.fromJson(json),
  };
}

export { ALL_CRAFT_JOBS, JOB_NAMES, DEFAULT_ATTRIBUTES };
export type { GearsetRow, CrafterAttributes };
