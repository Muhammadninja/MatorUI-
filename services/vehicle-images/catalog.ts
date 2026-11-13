import rawCatalog from '../vehicle-image-catalog.json';

export type CatalogApprovalStatus = 'approved' | 'pending' | 'rejected';

export type VehicleImageCatalogAsset = {
  id: string;
  manufacturer: string | null;
  makeId: string | null;
  modelMappings: Array<{
    modelId: string;
    generationId?: string;
    faceliftId?: string;
    yearFrom: number;
    yearTo: number;
    trimPrefixes?: string[];
  }>;
  generation: string | null;
  generationId: string | null;
  facelift: string | null;
  faceliftId: string | null;
  marketRegion: string | null;
  identityVerified: boolean;
  generationVerified: boolean;
  approvalStatus: CatalogApprovalStatus;
  assetKey: string | null;
  storageRef: string;
  assetUrl: string | null;
  sourceFiles: string[];
  provenance: string;
};

export const VEHICLE_IMAGE_CATALOG = rawCatalog as {
  version: number;
  assets: VehicleImageCatalogAsset[];
};

export function approvedCatalogAssetForBody(bodyKey: string): VehicleImageCatalogAsset | undefined {
  const matches = VEHICLE_IMAGE_CATALOG.assets.filter(
    (asset) => asset.id === bodyKey && asset.approvalStatus === 'approved' &&
      asset.identityVerified && asset.generationVerified && asset.marketRegion && asset.assetKey === bodyKey,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function catalogApprovalErrors(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const asset of VEHICLE_IMAGE_CATALOG.assets) {
    if (ids.has(asset.id)) errors.push(`duplicate catalog asset id: ${asset.id}`);
    ids.add(asset.id);
    if (asset.approvalStatus === 'approved' &&
      (!asset.identityVerified || !asset.generationVerified || !asset.marketRegion || !asset.assetKey || asset.modelMappings.length === 0)) {
      errors.push(`approved asset ${asset.id} lacks a verified canonical mapping`);
    }
    for (const mapping of asset.modelMappings) {
      if (!Number.isInteger(mapping.yearFrom) || !Number.isInteger(mapping.yearTo) || mapping.yearFrom > mapping.yearTo)
        errors.push(`asset ${asset.id} has an invalid compatible year range`);
    }
  }
  return errors;
}
