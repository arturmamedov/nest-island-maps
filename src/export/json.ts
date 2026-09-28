import { serializeDataFile } from '../shared/datafile';
import type { Geometry, IslandData } from '../shared/schema';

/* Download JSON is the seed file format itself (plan decision 1): the bytes
   come from serializeDataFile, never from a second serializer, so a
   downloaded file drops straight into data/seed/ and commits as-is. */

/** The island's data file, ready to download. */
export function dataFileBlob(data: IslandData, geometry: Geometry): Blob {
  return new Blob([serializeDataFile(data, geometry)], { type: 'application/json' });
}
