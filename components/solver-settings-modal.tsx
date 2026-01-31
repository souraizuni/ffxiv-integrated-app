import React from 'react';
import InitialQualityControl from './initial-quality-control';
import type { RaphaelSolverOptions } from '@/lib/simulator/solver';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solverOptions: RaphaelSolverOptions & any;
  setSolverOptions: (cb: (prev: any) => any) => void;
}

export default function SolverSettingsModal({ isOpen, onClose, solverOptions, setSolverOptions }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">求解器進階設定</h3>
          <button onClick={onClose} className="text-sm px-2 py-1">關閉</button>
        </div>
        <div className="space-y-4">
          <InitialQualityControl solverOptions={solverOptions} setSolverOptions={setSolverOptions} />
          {/* future advanced settings can go here */}
        </div>
      </div>
    </div>
  );
}
