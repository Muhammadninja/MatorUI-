import { describe, expect, it } from 'vitest';
import { catalogApprovalErrors, approvedCatalogAssetForBody, VEHICLE_IMAGE_CATALOG } from './catalog';
import { chooseVehicleVisual } from './vehicle-visual';
import { resolveVehicleImage } from './resolver';

describe('owner-approved vehicle image catalog', () => {
  it('contains only the three retained approved assets with verified mappings', () => {
    expect(catalogApprovalErrors()).toEqual([]);
    expect(VEHICLE_IMAGE_CATALOG.assets.filter((asset) => asset.approvalStatus === 'approved').map((asset) => asset.id).sort())
      .toEqual(['cobalt-gen2', 'gentra', 'nexia-r3']);
    expect(approvedCatalogAssetForBody('cobalt-gen2')).toBeDefined();
    expect(approvedCatalogAssetForBody('gentra')).toBeDefined();
    expect(approvedCatalogAssetForBody('nexia-r3')).toBeDefined();
    expect(resolveVehicleImage({ brandId: 'chevrolet', modelId: 'gentra', year: 2020 }).kind).toBe('image');
    expect(resolveVehicleImage({ brandId: 'chevrolet', modelId: 'nexia-3', year: 2020 }).kind).toBe('image');
  });

  it('keeps Spark and every other unapproved source out of the approved manifest', () => {
    expect(approvedCatalogAssetForBody('spark-m300')).toBeUndefined();
    expect(approvedCatalogAssetForBody('nexia-n150')).toBeUndefined();
    const resolution = resolveVehicleImage({ brandId: 'chevrolet', modelId: 'spark', year: 2020 });
    expect(resolution.kind).toBe('placeholder');
  });

  it('keeps an owner-approved bundled asset available during sync but honors explicit rejection/review', () => {
    const bundled = resolveVehicleImage({ brandId: 'chevrolet', modelId: 'cobalt', year: 2020 });
    expect(bundled.kind).toBe('image');
    expect(chooseVehicleVisual(bundled, { status: 'unavailable', url: null, version: null, reason: 'request_failed' }).kind).toBe('image');
    expect(chooseVehicleVisual(bundled, { status: 'unavailable', url: null, version: null, reason: 'rejected' }).kind).toBe('placeholder');
  });

  it('resolves an approved catalog key to its matching bundled image', () => {
    const bundled = resolveVehicleImage({ brandId: 'chevrolet', modelId: 'cobalt', year: 2020 });
    const visual = chooseVehicleVisual(bundled, {
      status: 'approved', url: null, version: 1, catalogAssetKey: 'cobalt-gen2',
    });
    expect(visual.kind).toBe('image');
    expect(chooseVehicleVisual(bundled, {
      status: 'approved', url: null, version: 1, catalogAssetKey: 'gentra',
    })).toMatchObject({ kind: 'placeholder', status: 'unavailable' });
  });
});
