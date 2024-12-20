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

#include <EntitiesMP/Mod/PhysBase.h>

// Set brush polygon
void SCollisionPolygon::SetBrushPolygon(CBrushPolygon *pbpoSet) {
  if (pbpoSet == NULL) {
    Reset();
    return;
  }

  eType = POL_BRUSH;
  pbpoHit = pbpoSet;

  bHit = FALSE;
  plPolygon = pbpoSet->bpo_pbplPlane->bpl_plAbsolute;
  ubSurface = pbpoSet->bpo_bppProperties.bpp_ubSurfaceType;
  bStairs = pbpoSet->bpo_ulFlags & BPOF_STAIRS;
};

// Set fake polygon
void SCollisionPolygon::SetFakePolygon(const FLOAT3D &v0, const FLOAT3D &v1, const FLOAT3D &v2) {
  eType = POL_TRIANGLE;
  pbpoHit = NULL;
  avPolygon[0] = v0;
  avPolygon[1] = v1;
  avPolygon[2] = v2;

  bHit = FALSE;
};

// Set disc polygon
void SCollisionPolygon::SetDiscPolygon(const FLOAT3D &vCenter, FLOAT fRadius, const FLOAT3D &vNormal) {
  eType = POL_DISC;
  pbpoHit = NULL;
  avPolygon[0] = vCenter;
  avPolygon[1] = FLOAT3D(fRadius, fRadius, fRadius);
  avPolygon[2] = vNormal;

  bHit = FALSE;
};

// Set infinitely thin polygon
void SCollisionPolygon::SetEdgePolygon(const FLOAT3D &vStart, const FLOAT3D &vEnd) {
  eType = POL_EDGE;
  pbpoHit = NULL;
  avPolygon[0] = vStart;
  avPolygon[1] = vEnd;
  avPolygon[2] = FLOAT3D(0, 0, 0);

  bHit = FALSE;
};

// Hit polygon at some collision point
void SCollisionPolygon::HitPolygon(const FLOAT3D &vCollisionPoint) {
  // Can only be hit if it's set to some type
  bHit = (eType != POL_INVALID);

  vCollision = vCollisionPoint;
};

// Hit polygon at some collision point with extra setup
void SCollisionPolygon::HitPolygon(const FLOAT3D &vCollisionPoint, const FLOATplane3D &plSetPlane, UBYTE ubSetSurface, BOOL bSetStairs) {
  // Can only be hit if it's set to some type
  bHit = (eType != POL_INVALID);

  vCollision = vCollisionPoint;
  plPolygon = plSetPlane;
  ubSurface = ubSetSurface;
  bStairs = bSetStairs;
};

// Check if a point intersects the polygon
BOOL SCollisionPolygon::IsIntersecting(const FLOAT3D &vPoint) const {
  // No polygon
  if (eType == POL_INVALID) return FALSE;

  // Technically impossible to intersect with an infinitely thin object
  if (eType == POL_EDGE) return FALSE;

  if (eType == POL_DISC) {
    FLOAT3D vCenter = avPolygon[0];
    FLOAT fRadius = avPolygon[1](1);

    FLOAT fDistFromCenter = (vPoint - vCenter).Length();
    return (fDistFromCenter <= fRadius);
  }

  // Find major axes of the polygon plane
  INDEX iMajorAxis1, iMajorAxis2;
  GetMajorAxesForPlane(plPolygon, iMajorAxis1, iMajorAxis2);

  // Create an intersector
  CIntersector is(vPoint(iMajorAxis1), vPoint(iMajorAxis2));

  // Real polygon
  if (eType == POL_BRUSH) {
    FOREACHINSTATICARRAY(pbpoHit->bpo_abpePolygonEdges, CBrushPolygonEdge, itbpePolygonEdge) {
      // Get edge vertices (edge direction is irrelevant here)
      const FLOAT3D &v0 = itbpePolygonEdge->bpe_pbedEdge->bed_pbvxVertex0->bvx_vAbsolute;
      const FLOAT3D &v1 = itbpePolygonEdge->bpe_pbedEdge->bed_pbvxVertex1->bvx_vAbsolute;

      is.AddEdge(v0(iMajorAxis1), v0(iMajorAxis2), v1(iMajorAxis1), v1(iMajorAxis2));
    }

  // Fake polygon
  } else if (eType == POL_TRIANGLE) {
    is.AddEdge(avPolygon[0](iMajorAxis1), avPolygon[0](iMajorAxis2), avPolygon[1](iMajorAxis1), avPolygon[1](iMajorAxis2));
    is.AddEdge(avPolygon[1](iMajorAxis1), avPolygon[1](iMajorAxis2), avPolygon[2](iMajorAxis1), avPolygon[2](iMajorAxis2));
    is.AddEdge(avPolygon[2](iMajorAxis1), avPolygon[2](iMajorAxis2), avPolygon[0](iMajorAxis1), avPolygon[0](iMajorAxis2));
  }

  return is.IsIntersecting();
};

// Assignment operator
SCollisionPolygon &SCollisionPolygon::operator=(const SCollisionPolygon &cpoOther) {
  eType = cpoOther.eType;
  pbpoHit = cpoOther.pbpoHit;
  avPolygon[0] = cpoOther.avPolygon[0];
  avPolygon[1] = cpoOther.avPolygon[1];
  avPolygon[2] = cpoOther.avPolygon[2];

  bHit = cpoOther.bHit;
  vCollision = cpoOther.vCollision;
  plPolygon = cpoOther.plPolygon;
  ubSurface = cpoOther.ubSurface;
  bStairs = cpoOther.bStairs;

  return *this;
};

// Serialization
void SCollisionPolygon::Write_t(CEntity *pen, CTStream *ostr) {
  *ostr << (INDEX)eType;

  if (eType == POL_BRUSH) {
    INDEX iBPO = pen->GetWorldPolygonIndex(pbpoHit);
    *ostr << iBPO;

  } else if (eType != POL_INVALID) {
    ostr->Write_t(&avPolygon, sizeof(avPolygon));
  }

  UBYTE ubByte = bHit;
  *ostr << ubByte;

  if (bHit) {
    ostr->Write_t(&vCollision, sizeof(vCollision));
    ostr->Write_t(&plPolygon, sizeof(plPolygon));
    *ostr << ubSurface;

    ubByte = bStairs;
    *ostr << ubByte;
  }
};

void SCollisionPolygon::Read_t(CEntity *pen, CTStream *istr) {
  INDEX iReadType;
  *istr >> iReadType;
  eType = (EPolygonType)iReadType;

  if (eType == POL_BRUSH) {
    INDEX iBPO;
    *istr >> iBPO;
    pbpoHit = pen->GetWorldPolygonPointer(iBPO);

  } else if (eType != POL_INVALID) {
    istr->Read_t(&avPolygon, sizeof(avPolygon));
  }

  UBYTE ubByte;
  *istr >> ubByte;
  bHit = ubByte;

  if (bHit) {
    istr->Read_t(&vCollision, sizeof(vCollision));
    istr->Read_t(&plPolygon, sizeof(plPolygon));
    *istr >> ubSurface;

    *istr >> ubByte;
    bStairs = ubByte;
  }
};

// Retrieve custom collision dimensions and shape of some entity
BOOL GetCustomCollisionShape(CEntity *pen, FLOATaabbox3D &boxSize, ECollisionShape &eShape) {
  if (IsDerivedFromID(pen, CPhysBase_ClassID)) {
    CPhysBase &enPhys = (CPhysBase &)*pen;

    // Centered box
    FLOAT3D vSize;
    eShape = enPhys.GetPhysCollision(vSize);
    boxSize = FLOATaabbox3D(vSize * -0.5f, vSize * +0.5f);

    // Additional offset
    CPlacement3D plOffset;

    if (enPhys.GetPhysOffset(plOffset)) {
      boxSize += plOffset.pl_PositionVector;
    }

    return TRUE;
  }

  // No custom collision for this entity
  return FALSE;
};

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
