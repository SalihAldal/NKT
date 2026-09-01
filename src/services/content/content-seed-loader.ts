import type { GameContent } from '@/domain/models/content';
import { CONTENT_DATASET_VERSION } from '@/domain/constants/content-version';
import { generateFullDataset } from './content-dataset-generator';

let cachedDataset: GameContent[] | null = null;
let cachedVersion: string | null = null;

/** Idempotent production dataset — generated once per version */
export const getProductionDataset = (): GameContent[] => {
  if (cachedDataset && cachedVersion === CONTENT_DATASET_VERSION) {
    return cachedDataset;
  }
  cachedDataset = generateFullDataset();
  cachedVersion = CONTENT_DATASET_VERSION;
  return cachedDataset;
};

export const clearProductionCache = (): void => {
  cachedDataset = null;
  cachedVersion = null;
};

export const getProductionDatasetSize = (): number => getProductionDataset().length;
