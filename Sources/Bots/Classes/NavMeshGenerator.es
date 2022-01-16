/* Copyright (c) 2018-2021 Dreamy Cecil
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

// [Cecil] 2018-11-10: An entity for generating and saving NavMeshes for bots step-by-step
2000
%{
#include "StdH.h"

// [Cecil] TEMP: Last processed point in the NavMesh generation
extern INDEX _iLastPoint;

// [Cecil] TEMP: Set loop at only one point at a time if dealing with edges
#if NAVMESH_GEN_TYPE == NAVMESH_EDGES
  #define EDGES_LOOP m_ctLoop = 5
#else
  #define EDGES_LOOP (void)0
#endif
%}

class CNavMeshGenerator : CRationalEntity {
name      "NavMeshGenerator";
thumbnail "Thumbnails\\PlayerActionMarker.tbn";

properties:
  1 INDEX m_iPoint = 0, // current point for checking
  2 INDEX m_ctPoints = 0, // amount of points in the NavMesh
  3 INDEX m_ctLoop = 10, // amount of points to process per tick

components:

functions:
  // returns bytes of memory used by this object
  SLONG GetUsedMemory(void) {
    // initial
    SLONG slUsedMemory = sizeof(CNavMeshGenerator) - sizeof(CRationalEntity) + CRationalEntity::GetUsedMemory();
    // add some more
    return slUsedMemory;
  };

procedures:
  Main() {
    InitAsVoid();

    autowait(0.1f);

    m_iPoint = _iLastPoint; // [Cecil] TEMP
    m_ctPoints = _pNavmesh->bnm_cbppPoints.Count();
    EDGES_LOOP;

    CPrintF("-- New Generator:\n");

    if (m_iPoint >= m_ctPoints) {
      CPrintF("[NavMeshGenerator]: No more points to process\n");
    }

    if (m_ctPoints <= 0) {
      CPrintF("[NavMeshGenerator]: NavMesh doesn't have any points!\n");
    }

    // go through points
    while (m_iPoint < m_ctPoints) {
      _pNavmesh->ConnectPoints(m_iPoint);
      
      m_iPoint++;

      if ((m_iPoint % m_ctLoop) == 0) {
        autowait(0.05f);
      }
    }

    _iLastPoint = m_iPoint; // [Cecil] TEMP

    Destroy();
    return;
  }
};

