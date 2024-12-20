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

#ifndef CECIL_INCL_WORLDRAYCASTING_H
#define CECIL_INCL_WORLDRAYCASTING_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

#include "CollisionCommon.h"

/*
 * Class that describes casting of a ray.
 */
class CCecilCastRay {
public:
  // diferent types of testing
  enum TestType {
    TT_NONE,            // do not test at all
    TT_SIMPLE,          // do approximate testing
    TT_COLLISIONBOX,    // do testing by collision box
    TT_FULL,            // do full testing
    TT_FULLSEETHROUGH,  // do full testing without entities marked as see through
    TT_CUSTOM,          // [Cecil] Test custom collision shapes
  };
public:
  BOOL cr_bAllowOverHit;                // set if the ray can hit behind its target
  ULONG cr_ulPassablePolygons;          // flags mask for pass-through testing
  CBrushPolygon *cr_pbpoIgnore;         // polygon that is origin of the continuted ray (is never hit by the ray)
  CEntities cr_cenIgnore;               // [Cecil] Entities to ignore in the ray's path

  /* Internal construction helper. */
  void Init(CEntity *penOrigin, const FLOAT3D &vOrigin, const FLOAT3D &vTarget);
  void ClearSectorList(void);

  /* Add a sector if needed. */
  inline void AddSector(CBrushSector *pbsc);
  /* Add all sectors of a brush. */
  void AddAllSectorsOfBrush(CBrush3D *pbr);
  /* Add all sectors around given entity. */
  void AddSectorsAroundEntity(CEntity *pen);

  /* Test against a model entity. */
  void TestModelSimple(CEntity *penModel, CModelObject &mo);
  void TestModelCollisionBox(CEntity *penModel);

  // [Cecil] Test custom collision shapes instead of collision spheres
  void TestModelCustomShape(CEntity *penModel);

  void TestModelFull(CEntity *penModel, CModelObject &mo);
  void TestSkaModelSimple(CEntity *penModel, CModelInstance &mi);
  void TestSkaModelFull(CEntity *penModel, CModelInstance &mi);
  void TestModel(CEntity *penModel);
  void TestSkaModel(CEntity *penModel);

  /* Test against a terrain */
  void TestTerrain(CEntity *penTerrain);

  /* Test against a brush sector. */
  void TestBrushSector(CBrushSector *pbscSector);

  /* Test entire world against ray. */
  void TestWholeWorld(CWorld *pwoWorld);
  /* Test active sectors recusively. */
  void TestThroughSectors(void);

public:
// these are filled by the constructor:
  CPlacement3D cl_plRay;      // placement of the ray in absolute space
  CEntity *cr_penOrigin;      // entity that is origin of the ray (is never hit by the ray)
  FLOAT3D cr_vOrigin;         // coordinates of ray origin
  FLOAT3D cr_vTarget;         // coordinates of ray target
  FLOAT3D cr_vOriginRelative; // coordinates of ray origin relative to current entity
  FLOAT3D cr_vTargetRelative; // coordinates of ray target relative to current entity

// these can be altered afterwards for special options
  BOOL cr_bHitPortals;             // don't pass through portals (off by default)
  BOOL cr_bHitTranslucentPortals;  // don't pass through translucent portals (on by default)
  enum TestType cr_ttHitModels;    // type of testing against models (simple by default)
  BOOL cr_bHitFields;              // don't pass thrugh field brushes (off by default)
  BOOL cr_bHitBrushes;             // don't pass thrugh brushes (on by default)
  BOOL cr_bHitTerrainInvisibleTris;// don't pass thrugh invisible terrain triangles (off by default)
  BOOL cr_bPhysical;               // pass only where physical objects can pass
  FLOAT cr_fTestR;                 // additional radius of ray (default 0)

// these are filled by casting algorithm:
  CEntity *cr_penHit;         // entity hit by ray, NULL if ray was cast in void
  FLOAT3D cr_vHit;            // coordinate where the ray hit the entity
  FLOAT cr_fHitDistance;      // how far the hit was from the origin

  BOOL  cr_bFindBone;         // should the bone ID be checked while testing with SKA
  INDEX cr_iBoneHit;          // id of the bone hit by the ray (SKA)

  SCollisionPolygon cr_cpoPolygon;  // [Cecil] For mimicking brush polygons, if not colliding with real ones
  CBrushSector *cr_pbscBrushSector; // sector that was hit (if brush entity hit)

  /* Constructor. */
  CCecilCastRay(CEntity *penOrigin, const CPlacement3D &plOrigin); // target is very far away
  CCecilCastRay(CEntity *penOrigin, const CPlacement3D &plOrigin, FLOAT fMaxTestDistance);
  CCecilCastRay(CEntity *penOrigin, const FLOAT3D &vOrigin, const FLOAT3D &vTarget);
  ~CCecilCastRay(void);

  /* Do the ray casting. */
  void Cast(CWorld *pwoWorld);
  /* Continue cast. */
  void ContinueCast(CWorld *pwoWorld);
};

// [Cecil] Return arguments for ray checking methods
struct SRayReturnArgs {
  FLOAT fMinLambda;
  FLOAT fHitDistance;
  FLOAT3D vHitPoint;
  FLOATplane3D plHitPlane;
};

// [Cecil] Common method for calculating where a ray hits the sphere
BOOL RayHitsSphere(const FLOAT3D &vStart, const FLOAT3D &vEnd,
  const FLOAT3D &vSphereCenter, const FLOAT fSphereRadius, SRayReturnArgs &args);

// [Cecil] Common method for calculating where a ray hits the cylinder
BOOL RayHitsCylinder(const FLOAT3D &vStart, const FLOAT3D &vEnd,
  const FLOAT3D &vCylinderBottomCenter, const FLOAT3D &vCylinderTopCenter, const FLOAT fCylinderRadius, SRayReturnArgs &args);

// [Cecil] Common method for calculating where a ray hits the disc
BOOL RayHitsDisc(const FLOAT3D &vStart, const FLOAT3D &vEnd,
  const FLOAT3D &vDiscCenter, const FLOAT3D &vDiscNormal, const FLOAT fDiscRadius, SRayReturnArgs &args);

// [Cecil] Common method for calculating where a ray hits the triangle
BOOL RayHitsTriangle(const FLOAT3D &vStart, const FLOAT3D &vEnd,
  const FLOAT3D &v0, const FLOAT3D &v1, const FLOAT3D &v2, SRayReturnArgs &args);

#endif  /* include-once check. */
