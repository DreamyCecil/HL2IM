/* Copyright (c) 2002-2012 Croteam Ltd.
This program is free software; you can redistribute it and/or modify
it under the terms of version 2 of the GNU General Public License as published by
the Free Software Foundation


This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. */

#include "StdH.h"

#include <Engine/Templates/AllocationArray.h>
#include <Engine/Templates/AllocationArray.cpp>

// [Cecil] Compatibility
BOOL _bAllocationArrayParanoiaCheck = FALSE;

// allowed grid dimensions (meters)
#define GRID_MIN (-32000)
#define GRID_MAX (+32000)

#define GRID_CELLSIZE  2.0 // size of one grid cell (meters)
// number of hash table entries for grid cells
#define GRID_HASHTABLESIZE_LOG2  12 // must be even for bit-shuffling
#define GRID_HASHTABLESIZE (1<<GRID_HASHTABLESIZE_LOG2)

// find grid box from float coordinates
static inline void BoxToGrid(
  const FLOATaabbox3D &boxEntity, INDEX &iMinX, INDEX &iMaxX, INDEX &iMinZ, INDEX &iMaxZ)
{
  FLOAT fMinX = boxEntity.Min()(1);
  FLOAT fMinZ = boxEntity.Min()(3);
  FLOAT fMaxX = boxEntity.Max()(1);
  FLOAT fMaxZ = boxEntity.Max()(3);
  iMinX = INDEX(floor(fMinX/GRID_CELLSIZE));
  iMinZ = INDEX(floor(fMinZ/GRID_CELLSIZE));
  iMaxX = INDEX(ceil(fMaxX/GRID_CELLSIZE));
  iMaxZ = INDEX(ceil(fMaxZ/GRID_CELLSIZE));

  iMinX = Clamp(iMinX, (INDEX)GRID_MIN, (INDEX)GRID_MAX);
  iMinZ = Clamp(iMinZ, (INDEX)GRID_MIN, (INDEX)GRID_MAX);
  iMaxX = Clamp(iMaxX, (INDEX)GRID_MIN, (INDEX)GRID_MAX);
  iMaxZ = Clamp(iMaxZ, (INDEX)GRID_MIN, (INDEX)GRID_MAX);
}

// key calculations
static inline ULONG MakeCode(INDEX iX, INDEX iZ)
{
  return (iX<<16)|(iZ&0xffff);
}

static inline INDEX MakeKey(INDEX iX, INDEX iZ)
{
  //INDEX iKey = (iX+iZ)&(GRID_HASHTABLESIZE-1);  // x+z
  // use absolute x and z, swap upper and lower bits in z, xor x and z
  INDEX iZ2 = abs(iZ);
  INDEX iKey = (iZ2>>(GRID_HASHTABLESIZE_LOG2/2)) | (
    (iZ2&(GRID_HASHTABLESIZE/2-1))<<(GRID_HASHTABLESIZE_LOG2/2));
  iKey = iKey^abs(iX);
  iKey = iKey&(GRID_HASHTABLESIZE-1);
  return iKey;
}

static inline INDEX MakeKeyFromCode(ULONG ulCode)
{
  INDEX iX = SLONG(ulCode)>>16;
  INDEX iZ = SLONG(SWORD(ulCode&0xffff));
  return MakeKey(iX, iZ);
}

// collision grid classes
class CGridCell {
public:
  ULONG gc_ulCode;      // 32 bit uid of the cell (from its coordinates in grid)
  INDEX gc_iNextCell;   // next cell with this hash code
  INDEX gc_iFirstEntry; // first entry in this cell
};
class CGridEntry {
public:
  CEntity *ge_penEntity;    // entity pointed to
  INDEX ge_iNextEntry;      // next entry in same cell
};

class CCollisionGrid {
public:
  CStaticArray<INDEX> cg_aiFirstCells;     // first cell for each hash entry
  CAllocationArray<CGridCell> cg_agcCells;     // all cells
  CAllocationArray<CGridEntry> cg_ageEntries;  // all entries

  CCollisionGrid(void);
  ~CCollisionGrid(void);
  void Clear(void);
  // create a new grid cell in given hash table entry
  INDEX CreateCell(INDEX iKey, ULONG ulCode);
  // remove a cell
  void RemoveCell(INDEX igc);
  // get grid cell for its coordinates
  INDEX FindCell(INDEX iX, INDEX iZ, BOOL bCreate);
  // add entry to a given cell
  void AddEntry(INDEX igc, CEntity *pen);
  // remove entry from a given cell
  void RemoveEntry(INDEX igc, CEntity *pen);
};


// collision grid class implementation

CCollisionGrid::CCollisionGrid(void)
{
  Clear();
}

CCollisionGrid::~CCollisionGrid(void)
{
  Clear();
}

void CCollisionGrid::Clear(void)
{
  cg_aiFirstCells.Clear();
  cg_agcCells.Clear();
  cg_ageEntries.Clear();

  cg_aiFirstCells.New(GRID_HASHTABLESIZE);
  cg_agcCells.SetAllocationStep(1024);
  cg_ageEntries.SetAllocationStep(1024);

  // mark all cells as unused
  for(INDEX iKey=0; iKey<GRID_HASHTABLESIZE; iKey++) {
    cg_aiFirstCells[iKey] = -1;
  }
}

// create a new grid cell in given hash table entry
INDEX CCollisionGrid::CreateCell(INDEX iKey, ULONG ulCode)
{
  // find an empty cell
  INDEX igc = cg_agcCells.Allocate();
  CGridCell &gc = cg_agcCells[igc];

  // set up the cell
  gc.gc_ulCode = ulCode;
  gc.gc_iFirstEntry = -1;

  // link it by hash key
  gc.gc_iNextCell = cg_aiFirstCells[iKey];
  cg_aiFirstCells[iKey] = igc;

  return igc;
}

// remove a cell
void CCollisionGrid::RemoveCell(INDEX igc)
{
  // get key of the cell
  CGridCell &gc = cg_agcCells[igc];
  INDEX iKey = MakeKeyFromCode(gc.gc_ulCode);

  // find the cell's index pointer
  INDEX *pigc = &cg_aiFirstCells[iKey];
  ASSERT(*pigc>=0);
  while(*pigc>=0) {
    CGridCell &gc = cg_agcCells[*pigc];
    if (*pigc==igc) {
      *pigc = gc.gc_iNextCell;
      gc.gc_iNextCell = -2;
      gc.gc_iFirstEntry = -1;
      gc.gc_ulCode = 0x12345678;
      cg_agcCells.Free(igc);
      return;
    }
    pigc = &gc.gc_iNextCell;
  }
  ASSERT(FALSE);
}

// get grid cell for its coordinates
INDEX CCollisionGrid::FindCell(INDEX iX, INDEX iZ, BOOL bCreate)
{
  // make uid of the cell
  ASSERT(iX>=GRID_MIN && iX<=GRID_MAX);
  ASSERT(iZ>=GRID_MIN && iZ<=GRID_MAX);
  ULONG ulCode = MakeCode(iX, iZ);
  // get the hash key for the cell
  INDEX iKey = MakeKey(iX, iZ);  // x+z, use lower bits
  ASSERT(iKey==MakeKeyFromCode(ulCode));
  // find the cell in list of cells with that key
  INDEX igcFound = -1;
  for (INDEX igc=cg_aiFirstCells[iKey]; igc>=0; igc = cg_agcCells[igc].gc_iNextCell) {
    if (cg_agcCells[igc].gc_ulCode==ulCode) {
      igcFound = igc;
      break;
    }
  }

  // if the cell is found
  if (igcFound>=0) {
    // use existing one
    return igcFound;
  // if the cell is not found
  } else {
    // if new one may be created
    if (bCreate) {
      // create a new one
      return CreateCell(iKey, ulCode);
    // if new one may not be created
    } else {
      // return nothing
      return -1;
    }
  }
}

// [Cecil] TEMP: Collision grid particles
void Particles_PrepareCollisionGrid(void);
void Particles_EndCollisionGrid(void);
void Particles_GridCell(const FLOAT3D &vPos, FLOAT fGridSize, COLOR colBlend);

// [Cecil] TEMP: Render collision grid cells in a specific area
void Particles_CollisionGridCells(const FLOATaabbox3D &box) {
  // Don't render if not a server
  if (_pNetwork->IsNetworkEnabled() && !_pNetwork->IsServer()) return;

  CCollisionGrid &cg = *_pNetwork->ga_World.wo_pcgCollisionGrid;

  // Determine grid coordinates
  INDEX iMinX, iMaxX, iMinZ, iMaxZ;
  BoxToGrid(box, iMinX, iMaxX, iMinZ, iMaxZ);

  FLOAT3D vStart = box.Min();
  vStart(1) = floor(vStart(1) / GRID_CELLSIZE) * GRID_CELLSIZE;
  vStart(3) = floor(vStart(3) / GRID_CELLSIZE) * GRID_CELLSIZE;

  Particles_PrepareCollisionGrid();

  for (INDEX iX = iMinX; iX <= iMaxX; iX++)
  {
    for (INDEX iZ = iMinZ; iZ <= iMaxZ; iZ++)
    {
      INDEX iCell = cg.FindCell(iX, iZ, FALSE);
      if (iCell < 0) continue;

      // Count entities in the cell
      INDEX ctEntities = 0;

      for (INDEX iEntry = cg.cg_agcCells[iCell].gc_iFirstEntry; iEntry >= 0; iEntry = cg.cg_ageEntries[iEntry].ge_iNextEntry) {
        ctEntities++;
      }

      if (ctEntities == 0) continue;

      // Change hue depending on the amount of entities
      const COLOR col = HSVToColor(ClampUp((ctEntities - 1) * 15L, 255L), 255, 127);

      const FLOAT3D vCell = FLOAT3D(iX - iMinX, 0, iZ - iMinZ) * GRID_CELLSIZE; // Cell position relative to the area
      const FLOAT3D vOffset = FLOAT3D(-0.5f, 0, -0.5f) * GRID_CELLSIZE; // Center the cell

      const FLOAT3D vPos = vStart + vCell + vOffset;
      Particles_GridCell(vPos, GRID_CELLSIZE, col | 0xFF);
    }
  }

  Particles_EndCollisionGrid();
};
