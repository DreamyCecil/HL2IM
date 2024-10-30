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

#include "CollisionCommon.h"
#include "WorldRayCasting.h"

#include <Engine/Terrain/Terrain.h>
#include <Engine/Terrain/TerrainRayCasting.h>

#define EPSILON (0.1f)

class CActiveSector {
public:
  CBrushSector *as_pbsc;
  void Clear(void) {};
};

static CStaticStackArray<CActiveSector> _aas;
CListHead _lhTestedTerrains; // list of tested terrains

// calculate origin position from ray placement
static inline FLOAT3D CalculateRayOrigin(const CPlacement3D &plRay)
{
  // origin is the position from the placement
  return plRay.pl_PositionVector;
}

// [Cecil] Added distance multiplier passed by the constructor
// calculate target position from ray placement
static inline FLOAT3D CalculateRayTarget(const CPlacement3D &plRay, FLOAT fDistance)
{
  // calculate direction of the ray
  FLOAT3D vDirection;
  AnglesToDirectionVector(plRay.pl_OrientationAngle, vDirection);
  // make target be from the origin in that direction
  return plRay.pl_PositionVector + vDirection * fDistance;
}

/*
 * Internal construction helper.
 */
void CCecilCastRay::Init(CEntity *penOrigin, const FLOAT3D &vOrigin, const FLOAT3D &vTarget)
{
  ClearSectorList();
  cr_penOrigin = penOrigin;
  cr_vOrigin = vOrigin;
  cr_vTarget = vTarget;
  cr_bAllowOverHit = FALSE;
  cr_pbpoIgnore = NULL;
  cr_cenIgnore.Clear(); // [Cecil]

  cr_bHitPortals = FALSE;
  cr_bHitTranslucentPortals = TRUE;
  cr_ttHitModels = TT_SIMPLE;
  cr_bHitFields = FALSE;
  cr_bPhysical = FALSE;
  cr_bHitBrushes = TRUE;
  cr_bHitTerrainInvisibleTris = FALSE;
  cr_fTestR = 0;

  cr_bFindBone = TRUE;
  cr_iBoneHit	 = -1;

  cl_plRay.pl_PositionVector = vOrigin;
  DirectionVectorToAngles((vTarget-vOrigin).Normalize(), cl_plRay.pl_OrientationAngle);
}

/*
 * Constructor.
 */
CCecilCastRay::CCecilCastRay(CEntity *penOrigin, const CPlacement3D &plOrigin)
{
  Init(penOrigin, CalculateRayOrigin(plOrigin), CalculateRayTarget(plOrigin, 1.0f));
  // mark last found hit point in infinity
  cr_fHitDistance = UpperLimit(0.0f);
}
CCecilCastRay::CCecilCastRay(CEntity *penOrigin, const CPlacement3D &plOrigin, FLOAT fMaxTestDistance)
{
  Init(penOrigin, CalculateRayOrigin(plOrigin), CalculateRayTarget(plOrigin, fMaxTestDistance));
  // mark last found hit point just as far away as we wan't to test
  cr_fHitDistance = fMaxTestDistance;
}
CCecilCastRay::CCecilCastRay(CEntity *penOrigin, const FLOAT3D &vOrigin, const FLOAT3D &vTarget)
{
  Init(penOrigin, vOrigin, vTarget);
  // mark last found hit point just a bit behind the target
  cr_fHitDistance = (cr_vTarget-cr_vOrigin).Length() + EPSILON;
}

CCecilCastRay::~CCecilCastRay(void)
{
  ClearSectorList();
}

void CCecilCastRay::ClearSectorList(void)
{
  // for each active sector
  for(INDEX ias=0; ias<_aas.Count(); ias++) {
    // mark it as inactive
    _aas[ias].as_pbsc->bsc_ulFlags&=~BSCF_RAYTESTED;
  }
  _aas.PopAll();
}

// [Cecil] Common method for calculating where a ray hits the sphere
BOOL RayHitsSphere(const FLOAT3D &vStart, const FLOAT3D &vEnd,
  const FLOAT3D &vSphereCenter, const FLOAT fSphereRadius, SRayReturnArgs &args)
{
  const FLOAT3D vSphereCenterToStart = vStart - vSphereCenter;
  const FLOAT3D vStartToEnd = vEnd - vStart;

  // Calculate discriminant for intersection parameters
  const FLOAT fP = (vStartToEnd % vSphereCenterToStart) / (vStartToEnd % vStartToEnd);
  const FLOAT fQ = ((vSphereCenterToStart % vSphereCenterToStart) - (fSphereRadius * fSphereRadius)) / (vStartToEnd % vStartToEnd);
  const FLOAT fD = fP * fP - fQ;

  // No collision will occur if it's less than zero
  if (fD < 0.0f) return FALSE;

  // Calculate intersection parameters
  const FLOAT fSqrtD = sqrt(fD);
  const FLOAT fLambda1 = -fP + fSqrtD;
  const FLOAT fLambda2 = -fP - fSqrtD;

  // Use lower one
  args.fMinLambda = Min(fLambda1, fLambda2);
  args.fHitDistance = args.fMinLambda * vStartToEnd.Length();

  args.vHitPoint = vStartToEnd * args.fMinLambda + vStart;
  FLOAT3D vCollisionNormal = args.vHitPoint - vSphereCenter;
  args.plHitPlane = FLOATplane3D(vCollisionNormal, args.vHitPoint);

  return TRUE;
};

// [Cecil] Common method for calculating where a ray hits the cylinder
BOOL RayHitsCylinder(const FLOAT3D &vStart, const FLOAT3D &vEnd,
  const FLOAT3D &vCylinderBottomCenter, const FLOAT3D &vCylinderTopCenter, const FLOAT fCylinderRadius, SRayReturnArgs &args)
{
  const FLOAT3D vCylinderBottomToStart = vStart - vCylinderBottomCenter;
  const FLOAT3D vStartToEnd = vEnd - vStart;

  const FLOAT3D vCylinderBottomToTop = vCylinderTopCenter - vCylinderBottomCenter;
  const FLOAT fCylinderBottomToTopLength = vCylinderBottomToTop.Length();
  const FLOAT3D vCylinderDirection = vCylinderBottomToTop / fCylinderBottomToTopLength;

  const FLOAT3D vB = vStartToEnd - vCylinderDirection * (vCylinderDirection % vStartToEnd);
  const FLOAT3D vC = vCylinderBottomToStart - vCylinderDirection * (vCylinderDirection % vCylinderBottomToStart);

  const FLOAT fP = (vB % vC) / (vB % vB);
  const FLOAT fQ = (vC % vC - fCylinderRadius * fCylinderRadius) / (vB % vB);

  const FLOAT fD = fP * fP - fQ;

  // No collision will occur if it's less than zero
  if (fD < 0.0f) return FALSE;

  // Clculate intersection parameters
  const FLOAT fSqrtD = sqrt(fD);
  const FLOAT fLambda1 = -fP + fSqrtD;
  const FLOAT fLambda2 = -fP - fSqrtD;

  // Use lower one
  args.fMinLambda = Min(fLambda1, fLambda2);
  args.fHitDistance = args.fMinLambda * vStartToEnd.Length();

  // Calculate the collision point
  args.vHitPoint = vStartToEnd * args.fMinLambda + vStart;

  // Find distance of the collision point from the cylinder bottom
  FLOATplane3D plCylinderBottom(vCylinderBottomToTop, vCylinderBottomCenter);
  FLOAT fCollisionDistance = plCylinderBottom.PointDistance(args.vHitPoint);

  // Make sure the point is between bottom and top of cylinder
  if (fCollisionDistance < 0.0f || fCollisionDistance >= fCylinderBottomToTopLength) {
    return FALSE;
  }

  FLOAT3D vCollisionNormal = plCylinderBottom.ProjectPoint(args.vHitPoint) - vCylinderBottomCenter;
  args.plHitPlane = FLOATplane3D(vCollisionNormal, args.vHitPoint);

  return TRUE;
};

// [Cecil] Common method for calculating where a ray hits the disc
BOOL RayHitsDisc(const FLOAT3D &vStart, const FLOAT3D &vEnd,
  const FLOAT3D &vDiscCenter, const FLOAT3D &vDiscNormal, const FLOAT fDiscRadius, SRayReturnArgs &args)
{
  // Disc plane
  args.plHitPlane = FLOATplane3D(vDiscNormal, vDiscCenter);

  // Get distances of ray points from the disc plane
  const FLOAT fDistance0 = args.plHitPlane.PointDistance(vStart);
  const FLOAT fDistance1 = args.plHitPlane.PointDistance(vEnd);

  // Make sure the ray hits the plane
  if (fDistance0 < 0.0f || fDistance0 < fDistance1) return FALSE;

  // Calculate fraction of line before intersection
  args.fMinLambda = fDistance0 / ((fDistance0 - fDistance1) + 0.0000001f/*correction*/);

  // Calculate intersection coordinate and distance
  args.vHitPoint = vStart + (vEnd - vStart) * args.fMinLambda;
  args.fHitDistance = (args.vHitPoint - vStart).Length();

  // Make sure the intersection is inside the radius
  FLOAT fDistFromCenter = (args.vHitPoint - vDiscCenter).Length();
  return (fDistFromCenter <= fDiscRadius);
};

// [Cecil] Common method for calculating where a ray hits the triangle
BOOL RayHitsTriangle(const FLOAT3D &vStart, const FLOAT3D &vEnd,
  const FLOAT3D &v0, const FLOAT3D &v1, const FLOAT3D &v2, SRayReturnArgs &args)
{
  // Polygon plane
  args.plHitPlane = FLOATplane3D(v0, v1, v2);

  // Get distances of ray points from the polygon plane
  FLOAT fDistance0 = args.plHitPlane.PointDistance(vStart);
  FLOAT fDistance1 = args.plHitPlane.PointDistance(vEnd);

  // Make sure the ray hits the plane
  if (fDistance0 < 0.0f || fDistance0 < fDistance1) return FALSE;

  // Calculate fraction of line before intersection
  args.fMinLambda = fDistance0 / ((fDistance0 - fDistance1) + 0.0000001f/*correction*/);

  // Calculate intersection coordinate and distance
  args.vHitPoint = vStart + (vEnd - vStart) * args.fMinLambda;
  args.fHitDistance = (args.vHitPoint - vStart).Length();

  // Find major axes of the polygon plane
  INDEX iMajorAxis1, iMajorAxis2;
  GetMajorAxesForPlane(args.plHitPlane, iMajorAxis1, iMajorAxis2);

  // Intersect the triangle
  CIntersector isIntersector(args.vHitPoint(iMajorAxis1), args.vHitPoint(iMajorAxis2));
  isIntersector.AddEdge(v0(iMajorAxis1), v0(iMajorAxis2), v1(iMajorAxis1), v1(iMajorAxis2));
  isIntersector.AddEdge(v1(iMajorAxis1), v1(iMajorAxis2), v2(iMajorAxis1), v2(iMajorAxis2));
  isIntersector.AddEdge(v2(iMajorAxis1), v2(iMajorAxis2), v0(iMajorAxis1), v0(iMajorAxis2));

  return isIntersector.IsIntersecting();
};

void CCecilCastRay::TestModelSimple(CEntity *penModel, CModelObject &mo)
{
  // get model's bounding box for current frame
  FLOATaabbox3D boxModel;
  mo.GetCurrentFrameBBox(boxModel);
  boxModel.StretchByVector(mo.mo_Stretch);
  // get center and radius of the bounding sphere in absolute space
  FLOAT fSphereRadius = boxModel.Size().Length()/2.0f;
  FLOAT3D vSphereCenter = boxModel.Center();
  vSphereCenter*=penModel->en_mRotation;
  vSphereCenter+=penModel->en_plPlacement.pl_PositionVector;

  // if the ray doesn't hit the sphere
  SRayReturnArgs args;
  if (!RayHitsSphere(cr_vOrigin, cr_vTarget,
    vSphereCenter, fSphereRadius+cr_fTestR, args) ) {
    // ignore
    return;
  }

  FLOAT fSphereHitDistance = args.fHitDistance;

  // if the ray hits the sphere closer than closest found hit point yet
  if (fSphereHitDistance<cr_fHitDistance && fSphereHitDistance>0.0f) {
    // set the current entity as new hit target
    cr_fHitDistance=fSphereHitDistance;
    cr_penHit = penModel;
    cr_pbscBrushSector = NULL;
    cr_cpoPolygon.Reset(); // [Cecil]
  }
}

void CCecilCastRay::TestModelCollisionBox(CEntity *penModel)
{
  // if no collision box
  CCollisionInfo *pci = penModel->en_pciCollisionInfo;
  if (pci==NULL) {
    // don't test
    return;
  }

  // get model's collision bounding box
  FLOATaabbox3D &boxModel = pci->ci_boxCurrent;
  FLOAT fSphereRadius = boxModel.Size().Length()/2.0f;
  FLOAT3D vSphereCenter = boxModel.Center();

  // if the ray doesn't hit the sphere
  SRayReturnArgs args;
  if (!RayHitsSphere(cr_vOrigin, cr_vTarget,
    vSphereCenter, fSphereRadius+cr_fTestR, args) ) {
    // ignore
    return;
  }

  FLOAT fSphereHitDistance = args.fHitDistance;

  // get entity collision spheres
  CStaticArray<CMovingSphere> &ams = pci->ci_absSpheres;
  // get entity position
  const FLOAT3D &vPosition = penModel->en_plPlacement.pl_PositionVector;
  const FLOATmatrix3D &mRotation = penModel->en_mRotation;

  // for each sphere
  FOREACHINSTATICARRAY(ams, CMovingSphere, itms) {
    // project its center to absolute space
    FLOAT3D vCenter = itms->ms_vCenter*mRotation + vPosition;
    // if the ray hits the sphere closer than closest found hit point yet
    SRayReturnArgs args;

    if (RayHitsSphere(cr_vOrigin, cr_vTarget,
      vCenter, itms->ms_fR+cr_fTestR, args) &&
      args.fHitDistance < cr_fHitDistance && args.fHitDistance > -cr_fTestR) {
      // set the current entity as new hit target
      cr_fHitDistance = args.fHitDistance;
      cr_penHit = penModel;
      cr_pbscBrushSector = NULL;
      cr_cpoPolygon.Reset(); // [Cecil]
    }
  }
}

// [Cecil] Test custom collision shapes instead of collision spheres
void CCecilCastRay::TestModelCustomShape(CEntity *penModel) {
  // [Cecil] Doesn't have a custom shape, do regular collision testing
  if (!(penModel->GetPhysicsFlags() & EPF_CUSTOMCOLLISION)) {
    TestModelCollisionBox(penModel);
    return;
  }

  // No collision box
  CCollisionInfo *pci = penModel->en_pciCollisionInfo;
  if (pci == NULL) return;

  FLOATaabbox3D boxSize;
  ECollisionShape eShape = COLSH_BOX;

  // Try to retrieve custom collision shape
  if (!GetCustomCollisionShape(penModel, boxSize, eShape)) {
    // Retrieve bounding box size for regular models
    eShape = COLSH_BOX;

    const CEntity::RenderType eRender = penModel->en_RenderType;

    if (eRender == CEntity::RT_MODEL || eRender == CEntity::RT_EDITORMODEL) {
      CModelObject *pmo = penModel->GetModelObject();

      //pmo->GetData()->GetAllFramesBBox(boxSize);
      pmo->GetCurrentFrameBBox(boxSize);
      boxSize.StretchByVector(pmo->mo_Stretch);

    } else if (eRender == CEntity::RT_SKAMODEL || eRender == CEntity::RT_SKAEDITORMODEL) {
      CModelInstance *pmi = penModel->GetModelInstance();

      //pmi->GetAllFramesBBox(boxSize);
      pmi->GetCurrentColisionBox(boxSize);
      boxSize.StretchByVector(pmi->mi_vStretch);

    } else {
      ASSERTALWAYS("Unknown model type");
    }
  }

  FLOAT3D vColCenter0, vColCenter1;

  // Temporary hit data
  SRayReturnArgs argsHit;
  BOOL bHit = FALSE;

  // Resulting hit data
  SRayReturnArgs argsCurrent;
  argsCurrent.fHitDistance = cr_fHitDistance;

  // Resulting polygon vertices
  FLOAT3D vPolygon0(0, 0, 0);
  FLOAT3D vPolygon1(0, 0, 0);
  FLOAT3D vPolygon2(0, 0, 0);

  // Remember new hit point
  #define REMEMBER_HIT_POINT \
    if (argsHit.fHitDistance > 0.0f && argsHit.fHitDistance < argsCurrent.fHitDistance) { \
      argsCurrent = argsHit; \
      bHit = TRUE; \
    }

  // [Cecil] TODO: Add cr_fTestR value to the radius but also add it to the resulting hit distance
  const FLOAT3D &vEntity = penModel->GetPlacement().pl_PositionVector;
  // [Cecil] TODO: Multiply mEntity by another matrix to apply rotation offset for custom collision (e.g. tilted box)
  const FLOATmatrix3D &mEntity = penModel->GetRotationMatrix();

  switch (eShape) {
    case COLSH_SPHERE: {
      // Sphere collision radius
      const FLOAT fRadius = boxSize.Size()(1) * 0.5f;

      // Sphere center position
      vColCenter0 = boxSize.Center();

      // Absolute position
      vColCenter0 = vEntity + vColCenter0 * mEntity;

      if (RayHitsSphere(cr_vOrigin, cr_vTarget, vColCenter0, fRadius, argsHit)) {
        REMEMBER_HIT_POINT;
      }
    } break;

    case COLSH_CYLINDER: {
      // Cylinder collision radius
      const FLOAT fRadius = boxSize.Size()(2) * 0.5f;

      // Cylinder bottom position
      vColCenter0 = boxSize.Center();
      vColCenter0(3) = boxSize.Min()(3);

      // Cylinder top position
      vColCenter1 = boxSize.Center();
      vColCenter1(3) = boxSize.Max()(3);

      // Absolute position
      vColCenter0 = vEntity + vColCenter0 * mEntity;
      vColCenter1 = vEntity + vColCenter1 * mEntity;

      // Cylinder normals
      const FLOAT3D vNormal0 = (vColCenter0 - vColCenter1).SafeNormalize();
      const FLOAT3D vNormal1 = (vColCenter1 - vColCenter0).SafeNormalize();

      // Cylinder bottom
      if (RayHitsDisc(cr_vOrigin, cr_vTarget, vColCenter0, vNormal0, fRadius, argsHit)) {
        REMEMBER_HIT_POINT;
      }

      // Cylinder top
      if (RayHitsDisc(cr_vOrigin, cr_vTarget, vColCenter1, vNormal1, fRadius, argsHit)) {
        REMEMBER_HIT_POINT;
      }

      // Cylinder middle
      if (RayHitsCylinder(cr_vOrigin, cr_vTarget, vColCenter0, vColCenter1, fRadius, argsHit)) {
        REMEMBER_HIT_POINT;
      }
    } break;

    case COLSH_CAPSULE: {
      // Capsule collision radius
      const FLOAT fRadius = boxSize.Size()(2) * 0.5f;

      // Capsule bottom position
      vColCenter0 = boxSize.Center();
      vColCenter0(3) += boxSize.Min()(3) + fRadius;

      // Capsule top position
      vColCenter1 = boxSize.Center();
      vColCenter1(3) += boxSize.Max()(3) - fRadius;

      // Absolute position
      vColCenter0 = vEntity + vColCenter0 * mEntity;
      vColCenter1 = vEntity + vColCenter1 * mEntity;

      // Capsule bottom
      if (RayHitsSphere(cr_vOrigin, cr_vTarget, vColCenter0, fRadius, argsHit)) {
        REMEMBER_HIT_POINT;
      }

      // Capsule top
      if (RayHitsSphere(cr_vOrigin, cr_vTarget, vColCenter1, fRadius, argsHit)) {
        REMEMBER_HIT_POINT;
      }

      // Capsule middle
      if (RayHitsCylinder(cr_vOrigin, cr_vTarget, vColCenter0, vColCenter1, fRadius, argsHit)) {
        REMEMBER_HIT_POINT;
      }
    } break;

    // Collide with a box by default
    default: {
      // Shoot ray through 12 triangles of a bounding box around the model
      CollisionTris_t aTris;
      GetTrisFromBox(boxSize, aTris);

      for (INDEX iTri = 0; iTri < 12; iTri++) {
        const CollisionTrianglePositions_t &tri = aTris[iTri];
        FLOAT3D v0 = vEntity + tri[0] * mEntity;
        FLOAT3D v1 = vEntity + tri[1] * mEntity;
        FLOAT3D v2 = vEntity + tri[2] * mEntity;

        if (RayHitsTriangle(cr_vOrigin, cr_vTarget, v0, v1, v2, argsHit)) {
          if (argsHit.fHitDistance > 0.0f && argsHit.fHitDistance < argsCurrent.fHitDistance) {
            argsCurrent = argsHit;
            bHit = TRUE;

            vPolygon0 = v0;
            vPolygon1 = v1;
            vPolygon2 = v2;
          }
        }
      }
    } break;
  }

  // Set current entity as the new hit target, if current distance has been shortened
  if (argsCurrent.fHitDistance < cr_fHitDistance) {
    cr_fHitDistance = argsCurrent.fHitDistance;
    cr_penHit = penModel;
    cr_pbscBrushSector = NULL;

    cr_cpoPolygon.SetFakePolygon(vPolygon0, vPolygon1, vPolygon2);
    cr_cpoPolygon.HitPolygon(argsCurrent.vHitPoint, argsCurrent.plHitPlane, GetValidSurfaceForEntity(cr_penHit), FALSE);
  }
};

void CCecilCastRay::TestModelFull(CEntity *penModel, CModelObject &mo)
{
  // NOTE: this contains an ugly hack to simulate good trivial rejection
  // for models that have attachments that extend far off the base entity.
  // it is used only in wed, so it should not be a big problem.

  // get model's bounding box for all frames and expand it a lot
  FLOATaabbox3D boxModel;
  mo.GetAllFramesBBox(boxModel);
  boxModel.StretchByVector(mo.mo_Stretch*5.0f);
  // get center and radius of the bounding sphere in absolute space
  FLOAT fSphereRadius = boxModel.Size().Length()/2.0f;
  FLOAT3D vSphereCenter = boxModel.Center();
  vSphereCenter*=penModel->en_mRotation;
  vSphereCenter+=penModel->en_plPlacement.pl_PositionVector;

  // if the ray doesn't hit the sphere
  SRayReturnArgs args;
  if (!RayHitsSphere(cr_vOrigin, cr_vTarget,
    vSphereCenter, fSphereRadius+cr_fTestR, args) ) {
    // ignore
    return;
  }

  FLOAT fSphereHitDistance = args.fHitDistance;

  FLOAT fHitDistance;
  // if the ray hits the model closer than closest found hit point yet
  if (mo.PolygonHit(cl_plRay, penModel->en_plPlacement, 0/*iCurrentMip*/,
    fHitDistance)!=NULL
    && fHitDistance<cr_fHitDistance) {
    // set the current entity as new hit target
    cr_fHitDistance=fHitDistance;
    cr_penHit = penModel;
    cr_pbscBrushSector = NULL;
    cr_cpoPolygon.Reset(); // [Cecil]
  }
}

/*
 * Test against a model entity.
 */
void CCecilCastRay::TestModel(CEntity *penModel)
{
  // if origin is predictor, and the model is predicted
  if (cr_penOrigin!=NULL && cr_penOrigin->IsPredictor() && penModel->IsPredicted()) {
    // don't test it
    return;
  }

  // if hidden model
  if( penModel->en_ulFlags&ENF_HIDDEN)
  {
    // don't test
    return;
  }

  // get its model
  CModelObject *pmoModel;
  if (penModel->en_RenderType!=CEntity::RT_BRUSH
   && penModel->en_RenderType != CEntity::RT_FIELDBRUSH) {
    pmoModel=penModel->en_pmoModelObject;
  } else {
    // empty brushes are also tested as models
    pmoModel=_wrpWorldRenderPrefs.GetEmptyBrushModel();
  }
  // if there is no valid model
  if (pmoModel==NULL) {
    // don't test it
    return;
  }
  CModelObject &mo = *pmoModel;

  // if simple testing, or no testing (used when testing empty brushes)
  if (cr_ttHitModels==TT_SIMPLE || cr_ttHitModels==TT_NONE) {
    TestModelSimple(penModel, mo);
  // if collision box testing
  } else if (cr_ttHitModels==TT_COLLISIONBOX) {
    TestModelCollisionBox(penModel);
  // if full testing
  } else if (cr_ttHitModels==TT_FULL || cr_ttHitModels==TT_FULLSEETHROUGH) {
    TestModelFull(penModel, mo);

  // [Cecil] Custom collision testing
  } else if (cr_ttHitModels == TT_CUSTOM) {
    TestModelCustomShape(penModel);

  // must be no other testing
  } else {
    ASSERT(FALSE);
  }
}

/*
 * Test against a ska model
 */ 
void CCecilCastRay::TestSkaModel(CEntity *penModel)
{
  // if origin is predictor, and the model is predicted
  if (cr_penOrigin!=NULL && cr_penOrigin->IsPredictor() && penModel->IsPredicted()) {
    // don't test it
    return;
  }

  // if hidden model
  if( penModel->en_ulFlags&ENF_HIDDEN)
  {
    // don't test
    return;
  }

  CModelInstance &mi = *penModel->GetModelInstance();
  // if simple testing, or no testing (used when testing empty brushes)
  if (cr_ttHitModels==TT_SIMPLE || cr_ttHitModels==TT_NONE) {
    TestSkaModelSimple(penModel, mi);
  // if collision box testing
  } else if (cr_ttHitModels==TT_COLLISIONBOX) {
    TestModelCollisionBox(penModel);
  // if full testing
  } else if (cr_ttHitModels==TT_FULL || cr_ttHitModels==TT_FULLSEETHROUGH) {
    TestSkaModelFull(penModel, mi);

  // [Cecil] Custom collision testing
  } else if (cr_ttHitModels == TT_CUSTOM) {
    TestModelCustomShape(penModel);

  // must be no other testing
  } else {
    ASSERT(FALSE);
  }
}

void CCecilCastRay::TestSkaModelSimple(CEntity *penModel, CModelInstance &mi)
{
  FLOATaabbox3D boxModel;
  mi.GetCurrentColisionBox(boxModel);
  boxModel.StretchByVector(mi.mi_vStretch);
  // get center and radius of the bounding sphere in absolute space
  FLOAT fSphereRadius = boxModel.Size().Length()/2.0f;
  FLOAT3D vSphereCenter = boxModel.Center();
  vSphereCenter*=penModel->en_mRotation;
  vSphereCenter+=penModel->en_plPlacement.pl_PositionVector;

  // if the ray doesn't hit the sphere
  SRayReturnArgs args;
  if (!RayHitsSphere(cr_vOrigin, cr_vTarget,
    vSphereCenter, fSphereRadius+cr_fTestR, args) ) {
    // ignore
    return;
  }

  FLOAT fSphereHitDistance = args.fHitDistance;

  // if the ray hits the sphere closer than closest found hit point yet
  if (fSphereHitDistance<cr_fHitDistance && fSphereHitDistance>0.0f) {
    // set the current entity as new hit target
    cr_fHitDistance=fSphereHitDistance;
    cr_penHit = penModel;
    cr_pbscBrushSector = NULL;
    cr_cpoPolygon.Reset(); // [Cecil]
  }
}

void CCecilCastRay::TestSkaModelFull(CEntity *penModel, CModelInstance &mi)
{
  FLOATaabbox3D boxModel;
  mi.GetAllFramesBBox(boxModel);
  boxModel.StretchByVector(mi.mi_vStretch);
  // get center and radius of the bounding sphere in absolute space
  FLOAT fSphereRadius = boxModel.Size().Length()/2.0f;
  FLOAT3D vSphereCenter = boxModel.Center();
  vSphereCenter*=penModel->en_mRotation;
  vSphereCenter+=penModel->en_plPlacement.pl_PositionVector;

  // if the ray doesn't hit the sphere
  SRayReturnArgs args;
  if (!RayHitsSphere(cr_vOrigin, cr_vTarget,
    vSphereCenter, fSphereRadius+cr_fTestR, args) ) {
    // ignore
    return;
  }

  FLOAT fSphereHitDistance = args.fHitDistance;

  // if the ray hits the sphere closer than closest found hit point yet
  if (fSphereHitDistance<cr_fHitDistance && fSphereHitDistance>0.0f) {
    FLOAT fTriangleHitDistance;
    // set the current entity as new hit target
//    cr_fHitDistance=fSphereHitDistance;
//    cr_penHit = penModel;
//    cr_pbscBrushSector = NULL;
//    cr_cpoPolygon.Reset(); // [Cecil]

    INDEX iBoneID = -1;
    if (cr_bFindBone) {
      fTriangleHitDistance = RM_TestRayCastHit(mi,penModel->en_mRotation,penModel->en_plPlacement.pl_PositionVector,cr_vOrigin,cr_vTarget,cr_fHitDistance,&iBoneID);
    } else {
      fTriangleHitDistance = RM_TestRayCastHit(mi,penModel->en_mRotation,penModel->en_plPlacement.pl_PositionVector,cr_vOrigin,cr_vTarget,cr_fHitDistance,NULL);
    }

    if (fTriangleHitDistance<cr_fHitDistance && fTriangleHitDistance>0.0f) {
      // set the current entity as new hit target
      cr_fHitDistance=fTriangleHitDistance;
      cr_penHit = penModel;
      cr_pbscBrushSector = NULL;
      cr_cpoPolygon.Reset(); // [Cecil]

      if (cr_bFindBone) {
        cr_iBoneHit = iBoneID;
      }
    }

  }
  return;
}

void CCecilCastRay::TestTerrain(CEntity *penTerrain)
{
  // if hidden model
  if( penTerrain->en_ulFlags&ENF_HIDDEN) {
    // don't test
    return;
  }

  // [Cecil] FIXME: Not implemented yet!
  /*CTerrain *ptrTerrain = penTerrain->GetTerrain();
  FLOAT fHitDistance = TestRayCastHit(ptrTerrain,penTerrain->en_mRotation, penTerrain->en_plPlacement.pl_PositionVector,
                                      cr_vOrigin,cr_vTarget,cr_fHitDistance,cr_bHitTerrainInvisibleTris);

  if (fHitDistance<cr_fHitDistance && fHitDistance>0.0f) {
    // set the current entity as new hit target
    cr_fHitDistance=fHitDistance;
    cr_penHit = penTerrain;
    cr_pbscBrushSector = NULL;
    cr_cpoPolygon.Reset(); // [Cecil]
  }*/
}

/*
 * Test against a brush sector.
 */
void CCecilCastRay::TestBrushSector(CBrushSector *pbscSector)
{
  // if entity is hidden
  if(pbscSector->bsc_pbmBrushMip->bm_pbrBrush->br_penEntity->en_ulFlags&ENF_HIDDEN)
  {
    // don't cast ray
    return;
  }
  // for each polygon in the sector
  FOREACHINSTATICARRAY(pbscSector->bsc_abpoPolygons, CBrushPolygon, itpoPolygon) {
    CBrushPolygon &bpoPolygon = itpoPolygon.Current();

    if (&bpoPolygon==cr_pbpoIgnore) {
      continue;
    }

    ULONG ulFlags = bpoPolygon.bpo_ulFlags;
    // if not testing recursively
    if (cr_penOrigin==NULL) {
      // if the polygon is portal
      if (ulFlags&BPOF_PORTAL) {
        // if it is translucent or selected
        if (ulFlags&(BPOF_TRANSLUCENT|BPOF_TRANSPARENT|BPOF_SELECTED)) {
          // if translucent portals should be passed through
          if (!cr_bHitTranslucentPortals) {
            // skip this polygon
            continue;
          }
        // if it is not translucent
        } else {
           // if portals should be passed through
          if (!cr_bHitPortals) {
            // skip this polygon
            continue;
          }
        }
      }
      // [Cecil] TODO: Check if switching this symbol causes desyncs between clients, because this is serious
      // if polygon is detail, and detail polygons are off
      static CSymbolPtr pbRenderDetail("wld_bRenderDetailPolygons");
      if ((ulFlags&BPOF_DETAILPOLYGON) && !pbRenderDetail.GetIndex()) {
        // skip this polygon
        continue;
      }
    }
    // get distances of ray points from the polygon plane
    FLOAT fDistance0 = bpoPolygon.bpo_pbplPlane->bpl_plAbsolute.PointDistance(cr_vOrigin);
    FLOAT fDistance1 = bpoPolygon.bpo_pbplPlane->bpl_plAbsolute.PointDistance(cr_vTarget);

    // if the ray hits the polygon plane
    if (fDistance0>=0 && fDistance0>=fDistance1) {
      // calculate fraction of line before intersection
      FLOAT fFraction = fDistance0/((fDistance0-fDistance1) + 0.0000001f/*correction*/);
      // calculate intersection coordinate
      FLOAT3D vHitPoint = cr_vOrigin+(cr_vTarget-cr_vOrigin)*fFraction;
      // calculate intersection distance
      FLOAT fHitDistance = (vHitPoint-cr_vOrigin).Length();
      // if the hit point can not be new closest candidate
      if (fHitDistance>cr_fHitDistance) {
        // skip this polygon
        continue;
      }

      // find major axes of the polygon plane
      INDEX iMajorAxis1, iMajorAxis2;
      GetMajorAxesForPlane(itpoPolygon->bpo_pbplPlane->bpl_plAbsolute, iMajorAxis1, iMajorAxis2);

      // create an intersector
      CIntersector isIntersector(vHitPoint(iMajorAxis1), vHitPoint(iMajorAxis2));
      // for all edges in the polygon
      FOREACHINSTATICARRAY(bpoPolygon.bpo_abpePolygonEdges, CBrushPolygonEdge,
        itbpePolygonEdge) {
        // get edge vertices (edge direction is irrelevant here!)
        const FLOAT3D &vVertex0 = itbpePolygonEdge->bpe_pbedEdge->bed_pbvxVertex0->bvx_vAbsolute;
        const FLOAT3D &vVertex1 = itbpePolygonEdge->bpe_pbedEdge->bed_pbvxVertex1->bvx_vAbsolute;
        // pass the edge to the intersector
        isIntersector.AddEdge(
          vVertex0(iMajorAxis1), vVertex0(iMajorAxis2),
          vVertex1(iMajorAxis1), vVertex1(iMajorAxis2));
      }
      // if the polygon is intersected by the ray
      if (isIntersector.IsIntersecting()) {
        // if it is portal and testing recusively
        if ((ulFlags&cr_ulPassablePolygons) && (cr_penOrigin!=NULL)) {
          // for each sector on the other side
          {FOREACHDSTOFSRC(bpoPolygon.bpo_rsOtherSideSectors, CBrushSector, bsc_rdOtherSidePortals, pbsc)
            // add the sector
            AddSector(pbsc);
          ENDFOR}

          if( cr_bHitPortals && ulFlags&(BPOF_TRANSLUCENT|BPOF_TRANSPARENT) && !cr_bPhysical)
          {
            // remember hit coordinates
            cr_fHitDistance=fHitDistance;
            cr_penHit = pbscSector->bsc_pbmBrushMip->bm_pbrBrush->br_penEntity;
            cr_pbscBrushSector = pbscSector;

            // [Cecil]
            cr_cpoPolygon.SetBrushPolygon(&bpoPolygon);
            cr_cpoPolygon.HitPolygon(vHitPoint);
          }
        // if the ray just plainly hit it
        } else {
          // remember hit coordinates
          cr_fHitDistance=fHitDistance;
          cr_penHit = pbscSector->bsc_pbmBrushMip->bm_pbrBrush->br_penEntity;
          cr_pbscBrushSector = pbscSector;

          // [Cecil]
          cr_cpoPolygon.SetBrushPolygon(&bpoPolygon);
          cr_cpoPolygon.HitPolygon(vHitPoint);
        }
      }
    }
  }
}

/* Add a sector if needed. */
inline void CCecilCastRay::AddSector(CBrushSector *pbsc)
{
  // if not already active and in first mip of its brush
  if ( pbsc->bsc_pbmBrushMip->IsFirstMip()
    &&!(pbsc->bsc_ulFlags&BSCF_RAYTESTED)) {
    // add it to active sectors
    _aas.Push().as_pbsc = pbsc;
    pbsc->bsc_ulFlags|=BSCF_RAYTESTED;
  }
}
/* Add all sectors of a brush. */
void CCecilCastRay::AddAllSectorsOfBrush(CBrush3D *pbr)
{
  // get relevant mip as if in manual mip brushing mode
  CBrushMip *pbmMip = pbr->GetBrushMipByDistance(
    _wrpWorldRenderPrefs.GetManualMipBrushingFactor());

  // if it has no brush mip for that mip factor
  if (pbmMip==NULL) {
    // skip it
    return;
  }
  // for each sector in the brush mip
  FOREACHINDYNAMICARRAY(pbmMip->bm_abscSectors, CBrushSector, itbsc) {
    // add the sector
    AddSector(itbsc);
  }
}

/* Add all sectors around given entity. */
void CCecilCastRay::AddSectorsAroundEntity(CEntity *pen)
{
  // for each zoning sector that this entity is in
  {FOREACHSRCOFDST(pen->en_rdSectors, CBrushSector, bsc_rsEntities, pbsc)
    // if part of zoning brush
    if (pbsc->bsc_pbmBrushMip->bm_pbrBrush->br_penEntity->GetRenderType()!=CEntity::RT_BRUSH) {
      // skip it
      continue;
    }
    // add the sector
    AddSector(pbsc);
  ENDFOR}
}

/* Test entire world against ray. */
void CCecilCastRay::TestWholeWorld(CWorld *pwoWorld)
{
  // for each entity in the world
  {FOREACHINDYNAMICCONTAINER(pwoWorld->wo_cenEntities, CEntity, itenInWorld) {
    // if it is the origin of the ray
    if (itenInWorld==cr_penOrigin /*|| itenInWorld==cr_penIgnore*/) {
      // skip it
      continue;
    }

    // [Cecil] One of the ignored entities
    if (cr_cenIgnore.IsMember(itenInWorld)) continue;

    // if it is a brush and testing against brushes is disabled
    if( (itenInWorld->en_RenderType == CEntity::RT_BRUSH ||
         itenInWorld->en_RenderType == CEntity::RT_FIELDBRUSH) && 
         !cr_bHitBrushes) {
      // skip it
      continue;
    }

    // if it is a model and testing against models is enabled
    if(((itenInWorld->en_RenderType == CEntity::RT_MODEL
      ||(itenInWorld->en_RenderType == CEntity::RT_EDITORMODEL
         && _wrpWorldRenderPrefs.IsEditorModelsOn()))
      && cr_ttHitModels != TT_NONE)
    //  and if cast type is TT_FULL_SEETROUGH then model is not
    //  ENF_SEETROUGH
      && !((cr_ttHitModels == TT_FULLSEETHROUGH || cr_ttHitModels == TT_COLLISIONBOX || cr_ttHitModels == TT_CUSTOM) &&
           (itenInWorld->en_ulFlags&ENF_SEETHROUGH))) {
      // test it against the model entity
      TestModel(itenInWorld);
    // if it is a ska model
    } else if(((itenInWorld->en_RenderType == CEntity::RT_SKAMODEL
      ||(itenInWorld->en_RenderType == CEntity::RT_SKAEDITORMODEL
         && _wrpWorldRenderPrefs.IsEditorModelsOn()))
      && cr_ttHitModels != TT_NONE)
    //  and if cast type is TT_FULL_SEETROUGH then model is not
    //  ENF_SEETROUGH
      && !((cr_ttHitModels == TT_FULLSEETHROUGH || cr_ttHitModels == TT_COLLISIONBOX || cr_ttHitModels == TT_CUSTOM) &&
           (itenInWorld->en_ulFlags&ENF_SEETHROUGH))) {
      TestSkaModel(itenInWorld);
    } else if (itenInWorld->en_RenderType == CEntity::RT_TERRAIN) {
      TestTerrain(itenInWorld);
    // if it is a brush
    } else if (itenInWorld->en_RenderType == CEntity::RT_BRUSH ||
      (itenInWorld->en_RenderType == CEntity::RT_FIELDBRUSH
      &&_wrpWorldRenderPrefs.IsFieldBrushesOn() && cr_bHitFields)) {
      // get its brush
      CBrush3D &brBrush = *itenInWorld->en_pbrBrush;

      // get relevant mip as if in manual mip brushing mode
      CBrushMip *pbmMip = brBrush.GetBrushMipByDistance(
        _wrpWorldRenderPrefs.GetManualMipBrushingFactor());

      // if it has no brush mip for that mip factor
      if (pbmMip==NULL) {
        // skip it
        continue;
      }

      // if it has zero sectors
      if (pbmMip->bm_abscSectors.Count()==0){
        // test it against the model entity
        TestModel(itenInWorld);

      // if it has some sectors
      } else {
        // for each sector in the brush mip
        FOREACHINDYNAMICARRAY(pbmMip->bm_abscSectors, CBrushSector, itbsc) {
          // if the sector is not hidden
          if (!(itbsc->bsc_ulFlags & BSCF_HIDDEN)) {
            // test the ray against the sector
            TestBrushSector(itbsc);
          }
        }
      }
    }
  }}
}

/* Test active sectors recusively. */
void CCecilCastRay::TestThroughSectors(void)
{
  // for each active sector (sectors are added during iteration!)
  for(INDEX ias=0; ias<_aas.Count(); ias++) {
    CBrushSector *pbsc = _aas[ias].as_pbsc;
    // test the ray against the sector
    TestBrushSector(pbsc);
    // for each entity in the sector
    {FOREACHDSTOFSRC(pbsc->bsc_rsEntities, CEntity, en_rdSectors, pen)
      // if it is the origin of the ray
      if (pen==cr_penOrigin /*|| pen==cr_penIgnore*/) {
        // skip it
        continue;
      }

      // [Cecil] One of the ignored entities
      if (cr_cenIgnore.IsMember(pen)) continue;

      // if it is a model and testing against models is enabled
      if(((pen->en_RenderType == CEntity::RT_MODEL
        ||(pen->en_RenderType == CEntity::RT_EDITORMODEL
           && _wrpWorldRenderPrefs.IsEditorModelsOn()))
        && cr_ttHitModels != TT_NONE)
      //  and if cast type is TT_FULL_SEETROUGH then model is not
      //  ENF_SEETROUGH
        && !((cr_ttHitModels == TT_FULLSEETHROUGH || cr_ttHitModels == TT_COLLISIONBOX || cr_ttHitModels == TT_CUSTOM) &&
             (pen->en_ulFlags&ENF_SEETHROUGH))) {
        // test it against the model entity
        TestModel(pen);
      // if is is a ska model
      } else if(((pen->en_RenderType == CEntity::RT_SKAMODEL
        ||(pen->en_RenderType == CEntity::RT_SKAEDITORMODEL
           && _wrpWorldRenderPrefs.IsEditorModelsOn()))
        && cr_ttHitModels != TT_NONE)
      //  and if cast type is TT_FULL_SEETROUGH then model is not
      //  ENF_SEETROUGH
        && !((cr_ttHitModels == TT_FULLSEETHROUGH || cr_ttHitModels == TT_COLLISIONBOX || cr_ttHitModels == TT_CUSTOM) &&
             (pen->en_ulFlags&ENF_SEETHROUGH))) {
        // test it against the ska model entity
        TestSkaModel(pen);
      // if it is a terrain
      } else if( pen->en_RenderType == CEntity::RT_TERRAIN) {
        CTerrain *ptrTerrain = pen->GetTerrain();
        ASSERT(ptrTerrain!=NULL);
        // if terrain hasn't allready been tested
        if(!ptrTerrain->tr_lnInActiveTerrains.IsLinked()) {
          // test it now and add it to list of tested terrains
          TestTerrain(pen);
          _lhTestedTerrains.AddTail(ptrTerrain->tr_lnInActiveTerrains);
        }
      // if it is a non-hidden brush
      } else if ( (pen->en_RenderType == CEntity::RT_BRUSH) &&
                  !(pen->en_ulFlags&ENF_HIDDEN) ) {
        // get its brush
        CBrush3D &brBrush = *pen->en_pbrBrush;
        // add all sectors in the brush
        AddAllSectorsOfBrush(&brBrush);
      }
    ENDFOR}
  }

  // for all tested terrains
  {FORDELETELIST(CTerrain, tr_lnInActiveTerrains, _lhTestedTerrains, ittr) {
    // remove it from list
    ittr->tr_lnInActiveTerrains.Remove();
  }}
  ASSERT(_lhTestedTerrains.IsEmpty());
}

/*
 * Do the ray casting.
 */
void CCecilCastRay::Cast(CWorld *pwoWorld)
{
  // initially no polygon is found
  cr_cpoPolygon.Reset(); // [Cecil]
  cr_pbscBrushSector = NULL;
  cr_penHit = NULL;
  if (cr_bPhysical) {
    cr_ulPassablePolygons = BPOF_PASSABLE|BPOF_SHOOTTHRU;
  } else {
    cr_ulPassablePolygons = BPOF_PORTAL|BPOF_OCCLUDER;
  }

  // if origin entity is given
  if (cr_penOrigin!=NULL) {
    // if not continuing
    if (_aas.Count()==0) {
      // add all sectors around it
      AddSectorsAroundEntity(cr_penOrigin);
    }
    // test all sectors recursively
    TestThroughSectors();
  // if there is no origin entity
  } else {
    // test entire world against ray
    TestWholeWorld(pwoWorld);
  }

  // calculate the hit point from the hit distance
  cr_vHit = cr_vOrigin + (cr_vTarget-cr_vOrigin).Normalize()*cr_fHitDistance;
}


/*
 * Continue cast.
 */
void CCecilCastRay::ContinueCast(CWorld *pwoWorld)
{
  cr_pbpoIgnore = cr_cpoPolygon.pbpoHit; // [Cecil]

  // [Cecil] Also for RT_EDITORMODEL, RT_SKAMODEL and RT_SKAEDITORMODEL
  switch (cr_penHit->en_RenderType) {
    case CEntity::RT_MODEL: case CEntity::RT_EDITORMODEL:
    case CEntity::RT_SKAMODEL: case CEntity::RT_SKAEDITORMODEL:
      cr_cenIgnore.Add(cr_penHit);
      break;
  }

  cr_vOrigin = cr_vHit;
  cl_plRay.pl_PositionVector = cr_vOrigin;
  cr_fHitDistance = (cr_vTarget-cr_vOrigin).Length() + EPSILON;
  Cast(pwoWorld);
}
