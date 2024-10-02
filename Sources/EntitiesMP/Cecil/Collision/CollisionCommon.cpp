/* Copyright (c) 2024 Dreamy Cecil
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

#include "CollisionCommon.h"

// Get a list of triangles from a bounding box (12 tris = 2 per 6 cube sides)
void GetTrisFromBox(FLOATaabbox3D box, CollisionTris_t &aTris) {
  const FLOAT3D &v0 = box.Min();
  const FLOAT3D &v1 = box.Max();

  // Cube vertices
  const FLOAT3D aVtx[8] = {
    // East side
    FLOAT3D(v1(1), v0(2), v1(3)), FLOAT3D(v1(1), v0(2), v0(3)), // Lower South/North
    FLOAT3D(v1(1), v1(2), v0(3)), FLOAT3D(v1(1), v1(2), v1(3)), // Upper North/South
    // West side
    FLOAT3D(v0(1), v0(2), v1(3)), FLOAT3D(v0(1), v0(2), v0(3)), // Lower South/North
    FLOAT3D(v0(1), v1(2), v0(3)), FLOAT3D(v0(1), v1(2), v1(3)), // Upper North/South
  };

  // Triangles constructed out of cube vertices in a counter-clockwise order
  const CollisionTrianglePositions_t aCubeTris[12] = {
    // Facing South
    CollisionTrianglePositions_t(aVtx[4], aVtx[0], aVtx[3]), // Lower
    CollisionTrianglePositions_t(aVtx[4], aVtx[3], aVtx[7]), // Upper
    // Facing East
    CollisionTrianglePositions_t(aVtx[0], aVtx[1], aVtx[2]), // Lower
    CollisionTrianglePositions_t(aVtx[0], aVtx[2], aVtx[3]), // Upper
    // Facing North
    CollisionTrianglePositions_t(aVtx[1], aVtx[5], aVtx[6]), // Lower
    CollisionTrianglePositions_t(aVtx[1], aVtx[6], aVtx[2]), // Upper
    // Facing West
    CollisionTrianglePositions_t(aVtx[5], aVtx[4], aVtx[7]), // Lower
    CollisionTrianglePositions_t(aVtx[5], aVtx[7], aVtx[6]), // Upper
    // Facing Upwards
    CollisionTrianglePositions_t(aVtx[7], aVtx[3], aVtx[2]), // South-East
    CollisionTrianglePositions_t(aVtx[7], aVtx[2], aVtx[6]), // North-West
    // Facing Downwards
    CollisionTrianglePositions_t(aVtx[0], aVtx[5], aVtx[1]), // North-East
    CollisionTrianglePositions_t(aVtx[0], aVtx[4], aVtx[5]), // South-West
  };

  // Copy triangles into the array
  CollisionTrianglePositions_t *pTriArray = aTris.Push(12);

  for (INDEX iTri = 0; iTri < 12; iTri++) {
    pTriArray[iTri][0] = aCubeTris[iTri][0];
    pTriArray[iTri][1] = aCubeTris[iTri][1];
    pTriArray[iTri][2] = aCubeTris[iTri][2];
  }
};
