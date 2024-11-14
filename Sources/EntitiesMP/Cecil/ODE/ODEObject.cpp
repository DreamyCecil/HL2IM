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

#include <EntitiesMP/Mod/PhysBase.h>
#include <EntitiesMP/Player.h>

extern CPhysEngine *_pODE;

// Offset ODE matrix using a row and a column
#define PHYS_MATRIX(Matrix, Row, Column) Matrix[(Row) * 4 + (Column)]

static __forceinline void FloatMatrixToODE(const FLOATmatrix3D &mSetRot, dReal *aRot) {
  memset(aRot, 0, sizeof(dMatrix3));

  PHYS_MATRIX(aRot, 0, 0) = mSetRot(1, 1);
  PHYS_MATRIX(aRot, 0, 1) = mSetRot(1, 2);
  PHYS_MATRIX(aRot, 0, 2) = mSetRot(1, 3);
  PHYS_MATRIX(aRot, 1, 0) = mSetRot(2, 1);
  PHYS_MATRIX(aRot, 1, 1) = mSetRot(2, 2);
  PHYS_MATRIX(aRot, 1, 2) = mSetRot(2, 3);
  PHYS_MATRIX(aRot, 2, 0) = mSetRot(3, 1);
  PHYS_MATRIX(aRot, 2, 1) = mSetRot(3, 2);
  PHYS_MATRIX(aRot, 2, 2) = mSetRot(3, 3);
};

static __forceinline void ODEMatrixToFloat(const dReal *aRot, FLOATmatrix3D &mRot) {
  mRot(1, 1) = PHYS_MATRIX(aRot, 0, 0);
  mRot(1, 2) = PHYS_MATRIX(aRot, 0, 1);
  mRot(1, 3) = PHYS_MATRIX(aRot, 0, 2);
  mRot(2, 1) = PHYS_MATRIX(aRot, 1, 0);
  mRot(2, 2) = PHYS_MATRIX(aRot, 1, 1);
  mRot(2, 3) = PHYS_MATRIX(aRot, 1, 2);
  mRot(3, 1) = PHYS_MATRIX(aRot, 2, 0);
  mRot(3, 2) = PHYS_MATRIX(aRot, 2, 1);
  mRot(3, 3) = PHYS_MATRIX(aRot, 2, 2);
};

// Clear the trimesh
void odeTrimesh::Clear(void) {
  // Trimesh build data
  aVertices.Clear();
  aIndices.Clear();

  // Trimesh itself
  if (trimesh != NULL) {
    dGeomTriMeshDataDestroy(trimesh);
    trimesh = NULL;
  }

  boxVolume = odeBox();
};

// Build the trimesh
void odeTrimesh::Build(void) {
  trimesh = dGeomTriMeshDataCreate();

  dGeomTriMeshDataBuildSimple(trimesh,
    (dReal *)aVertices.sa_Array, aVertices.Count(),
    (UINT *)aIndices.sa_Array, aIndices.Count());

  /*
  // These must stay in memory for the trimesh because the values aren't copied
  odeVtx *aVtx = new odeVtx[4];
  int *aIndices = new int[6];

  // Square polygon vertices
  aVtx[0] = FLOAT3D( 32, 0,  32);
  aVtx[1] = FLOAT3D(-32, 0,  32);
  aVtx[2] = FLOAT3D( 32, 0, -32);
  aVtx[3] = FLOAT3D(-32, 0, -32);
  
  // Two triangles one after another with shared vertices of the square polygon
  aIndices[0] = 0; aIndices[1] = 1; aIndices[2] = 2;
  aIndices[3] = 1; aIndices[4] = 2; aIndices[5] = 3;

  dTriMeshDataID trimesh = dGeomTriMeshDataCreate();
  dGeomTriMeshDataBuildSimple(trimesh, (dReal *)aVtx, 4, aIndices, 6);

  dGeomID geomTrimesh = dCreateTriMesh(_pODE->space, trimesh, NULL, NULL, NULL);
  */
};

// Add vertices of some brush
BOOL odeTrimesh::FromBrush(CBrush3D *pbr, INDEX *piVertexOffset, BOOL bAbsolute, BOOL bOffsetOutwards) {
  // Use internal counter
  INDEX iInternalVertexOffset = 0;
  if (piVertexOffset == NULL) piVertexOffset = &iInternalVertexOffset;

  BOOL bResult = FALSE;

  // Go through each sector of the most detailed mip
  FOREACHINDYNAMICARRAY(pbr->GetFirstMip()->bm_abscSectors, CBrushSector, itSec) {
    // Go through each sector polygon
    FOREACHINSTATICARRAY(itSec->bsc_abpoPolygons, CBrushPolygon, itPol) {
      CBrushPolygon *pbpo = itPol;

      // Skip passable polygons
      if (pbpo->bpo_ulFlags & BPOF_PASSABLE) continue;

      const INDEX ctVtx = pbpo->bpo_apbvxTriangleVertices.Count();

      // Copy vertex positions
      FOREACHINSTATICARRAY(pbpo->bpo_apbvxTriangleVertices, CBrushVertex *, itPolVtx) {
        // Add vertex in absolute coordinates
        if (bAbsolute) {
          FLOAT3D vVtx = itPolVtx.Current()->bvx_vAbsolute;

          if (bOffsetOutwards) {
            FLOAT3D vNormal = (FLOAT3D &)pbpo->bpo_pbplPlane->bpl_plAbsolute;
            vVtx += vNormal.SafeNormalize() * 0.01f;
          }

          AddVertex(odeVector(vVtx(1), vVtx(2), vVtx(3)));

        // Add vertex in relative coordinates
        } else {
          FLOAT3D vVtx = itPolVtx.Current()->bvx_vRelative;

          if (bOffsetOutwards) {
            FLOAT3D vNormal = (FLOAT3D &)pbpo->bpo_pbplPlane->bpl_plRelative;
            vVtx += vNormal.SafeNormalize() * 0.01f;
          }

          AddVertex(odeVector(vVtx(1), vVtx(2), vVtx(3)));
        }

        bResult = TRUE;
      }

      // Copy vertex indices
      FOREACHINSTATICARRAY(pbpo->bpo_aiTriangleElements, INDEX, itPolIndex) {
        AddIndex((*itPolIndex) + *piVertexOffset);
      }

      // Offset vertex indices by the amount of vertices
      *piVertexOffset += ctVtx;
    }
  }

  return bResult;
};

// Delete the object
void odeObject::Delete(void) {
  Clear(TRUE);
  mesh.Clear();

  nPhysOwner.SetOwner(NULL);
};

// Clear object geometry
void odeObject::Clear(BOOL bRemoveNode) {
  if (lnInObjects.IsLinked()) {
    lnInObjects.Remove();
  }

  if (bRemoveNode) nPhysOwner.Remove();

  // Destroy body
  if (body != NULL) dBodyDestroy(body);
  if (geom != NULL) dGeomDestroy(geom);
  if (joint != NULL) dJointDestroy(joint);

  body = NULL;
  geom = NULL;
  joint = NULL;
};

// Called on object movement
void odeObject::MovedCallback(dBodyID body)
{
  odeObject &obj = *(odeObject *)dBodyGetData(body);
  CEntity *pen = obj.GetOwner();

  if (pen == NULL) return;

  if (IsDerivedFromID(pen, CPhysBase_ClassID)) {
    ((CPhysBase *)pen)->OnPhysicsMovement();
  }
};

// Called on object contact
void odeObject::ContactCallback(const FLOAT3D &vHit, const FLOAT3D &vDir, FLOAT fSpeed) {
  CEntity *pen = GetOwner();
  if (pen == NULL) return;

  if (IsDerivedFromID(pen, CPhysBase_ClassID)) {
    ((CPhysBase *)pen)->OnPhysicsContact(vHit, vDir, fSpeed);
  }
};

// Setup a new geom
void odeObject::SetupGeom(void) {
  dGeomSetData(geom, this);
};

// Begin setting up physics shape
void odeObject::BeginShape(const CPlacement3D &plSetCenter, FLOAT fSetMass, ULONG ulSetFlags) {
  plCenter = plSetCenter;
  ulSetupFlags = ulSetFlags;
  fSetupMass = fSetMass;

  // Clear old geometry and body
  Clear(FALSE);
};

// Finish setting up physics shape
void odeObject::EndShape(void) {
  _pODE->lhObjects.AddTail(lnInObjects);

  if (ulSetupFlags & OBJF_BODY) {
    // Create physical body
    body = dBodyCreate(_pODE->world);
    dGeomSetBody(geom, body);

    if (fSetupMass > 0.0f) {
      dBodySetMass(body, &mass);
    }

    dBodySetData(body, this);
    dBodySetMovedCallback(body, &odeObject::MovedCallback);
  }

  // Set placement
  FLOATmatrix3D mRot;
  MakeRotationMatrix(mRot, plCenter.pl_OrientationAngle);
  SetMatrix(mRot);

  SetPosition(plCenter.pl_PositionVector);
};

// Make a sphere
BOOL odeObject::SetSphere(FLOAT fRadius) {
  ASSERT(fRadius > 0);

  // Interpret radius as diameter
  fRadius *= 0.5f;

  // Resize the sphere
  if (geom != NULL && dGeomGetClass(geom) == dSphereClass) {
    dGeomSphereSetRadius(geom, fRadius);
    return FALSE;
  }

  // Geometry for collisions
  geom = dCreateSphere(_pODE->space, fRadius);
  SetupGeom();

  // Physical body
  if ((ulSetupFlags & OBJF_BODY) && fSetupMass > 0.0f) {
    // Calculate density ('p = m/V' where 'V = (4/3) * pi * r^3')
    static const FLOAT fVolumeMul = (4.0f / 3.0f) * PI;
    const dReal fDensity = fSetupMass / (fVolumeMul * (fRadius * fRadius * fRadius));

    // Set mass
    dMassSetSphere(&mass, fDensity, fRadius);
  }

  return TRUE;
};

// Make a box
BOOL odeObject::SetBox(const odeVector &vSize) {
  ASSERT(vSize(1) > 0 && vSize(2) > 0 && vSize(3) > 0);

  // Resize the box
  if (geom != NULL && dGeomGetClass(geom) == dBoxClass) {
    dGeomBoxSetLengths(geom, vSize(1), vSize(2), vSize(3));
    return FALSE;
  }

  // Geometry for collisions
  geom = dCreateBox(_pODE->space, vSize(1), vSize(2), vSize(3));
  SetupGeom();

  // Physical body
  if ((ulSetupFlags & OBJF_BODY) && fSetupMass > 0.0f) {
    // Calculate density ('p = m/V' where 'V = w*h*l')
    const dReal fDensity = fSetupMass / (vSize(1) * vSize(2) * vSize(3));

    // Set mass
    dMassSetBox(&mass, fDensity, vSize(1), vSize(2), vSize(3));
  }

  return TRUE;
};

// Make a capsule
BOOL odeObject::SetCapsule(FLOAT fRadius, FLOAT fLength) {
  ASSERT(fRadius > 0 && fLength >= 0);

  // If length is small enough, both caps of the capsule essentially form a sphere
  if (fLength <= 0.0f) {
    return SetSphere(fRadius);
  }

  // Interpret radius as diameter
  fRadius *= 0.5f;

  // Resize the capsule
  if (geom != NULL && dGeomGetClass(geom) == dCapsuleClass) {
    dGeomCapsuleSetParams(geom, fRadius, fLength);
    return FALSE;
  }

  // Geometry for collisions
  geom = dCreateCapsule(_pODE->space, fRadius, fLength);
  SetupGeom();

  // Physical body
  if ((ulSetupFlags & OBJF_BODY) && fSetupMass > 0.0f) {
    // [Cecil] TEMP: Volume of a cylinder, not a capsule
    // Calculate density ('p = m/V' where 'V = pi * h * r^2')
    const dReal fDensity = fSetupMass / (PI * fLength * fRadius * fRadius);

    // Set mass
    dMassSetCapsule(&mass, fDensity, 3, fRadius, fLength);
  }

  return TRUE;
};

// Make a cylinder
BOOL odeObject::SetCylinder(FLOAT fRadius, FLOAT fLength) {
  ASSERT(fRadius > 0 && fLength > 0);

  // Interpret radius as diameter
  fRadius *= 0.5f;

  // Resize the cylinder
  if (geom != NULL && dGeomGetClass(geom) == dCylinderClass) {
    dGeomCylinderSetParams(geom, fRadius, fLength);
    return FALSE;
  }

  // Geometry for collisions
  geom = dCreateCylinder(_pODE->space, fRadius, fLength);
  SetupGeom();

  // Physical body
  if ((ulSetupFlags & OBJF_BODY) && fSetupMass > 0.0f) {
    // Calculate density ('p = m/V' where 'V = pi * h * r^2')
    const dReal fDensity = fSetupMass / (PI * fLength * fRadius * fRadius);

    // Set mass
    dMassSetCylinder(&mass, fDensity, 3, fRadius, fLength);
  }

  return TRUE;
};

// Make a trimesh
BOOL odeObject::SetTrimesh(void) {
  // Geometry for collisions
  geom = dCreateTriMesh(_pODE->space, mesh.trimesh, NULL, NULL, NULL);
  SetupGeom();

  // Physical body
  if ((ulSetupFlags & OBJF_BODY) && fSetupMass > 0.0f) {
    // [Cecil] TEMP: Volume of a box surrounding the trimesh, not the actual trimesh
    // Calculate density ('p = m/V' where 'V = w*h*l')
    const odeVector vSize = mesh.boxVolume.Size();
    const dReal fDensity = fSetupMass / (vSize(1) * vSize(2) * vSize(3));

    // Set mass
    dMassSetTrimesh(&mass, fDensity, geom);
  }

  return TRUE;
};

// Create a joint between two objects
void odeObject::Connect(odeObject &objOther) {
  // [Cecil] TEMP: Testing specific joint types
  //joint = dJointCreateFixed(_pODE->world, 0);
  joint = dJointCreateHinge(_pODE->world, 0);

  dJointAttach(joint, body, objOther.body);
  //dJointSetFixed(joint);

  const FLOAT3D &v = objOther.plCenter.pl_PositionVector;
  //dJointSetUniversalAnchor(joint, v(1), v(2), v(3));
  dJointSetHingeAnchor(joint, v(1), v(2), v(3));
  dJointSetHingeAxis(joint, 0, 0, 1);
};

// Set position of an object
void odeObject::SetPosition(const FLOAT3D &vSetPos) {
  if (geom == NULL) return;

  // Affects body as well, if dynamic
  dGeomSetPosition(geom, vSetPos(1), vSetPos(2), vSetPos(3));
};

// Get position of an object
FLOAT3D odeObject::GetPosition(void) const {
  if (geom == NULL) return FLOAT3D(0, 0, 0);

  // Returns body position, if dynamic
  const dReal *aPos = dGeomGetPosition(geom);
  return FLOAT3D(aPos[0], aPos[1], aPos[2]);
};

// Set rotation matrix of an object
void odeObject::SetMatrix(const FLOATmatrix3D &mSetRot) {
  if (geom == NULL) return;

  dMatrix3 aRot;
  FloatMatrixToODE(mSetRot, aRot);
  dGeomSetRotation(geom, aRot);
};

// Get rotation matrix of an object
FLOATmatrix3D odeObject::GetMatrix(void) const {
  if (geom == NULL) return FLOATmatrix3D(0.0f);

  const dReal *aRot = dGeomGetRotation(geom);

  FLOATmatrix3D mRot;
  ODEMatrixToFloat(aRot, mRot);

  return mRot;
};

// Add force in an absolute direction from a certain absolute point
void odeObject::AddForce(const FLOAT3D &vDir, FLOAT fForce, const FLOAT3D &vFromPos) {
  if (!IsCreated()) return;

  Unfreeze();

  FLOAT3D vForce = vDir * fForce * ODE_GetSimIterations();
  dBodyAddForceAtPos(body, vForce(1), vForce(2), vForce(3), vFromPos(1), vFromPos(2), vFromPos(3));
};

// Add force in an absolute direction from the center of the object
void odeObject::AddForce(const FLOAT3D &vDir, FLOAT fForce) {
  if (!IsCreated()) return;

  Unfreeze();

  FLOAT3D vForce = vDir * fForce * ODE_GetSimIterations();
  dBodyAddForce(body, vForce(1), vForce(2), vForce(3));
};

// Add torque in absolute coordinates from the center of the object
void odeObject::AddTorque(const ANGLE3D &aRotation) {
  if (!IsCreated()) return;

  Unfreeze();

  dBodyAddTorque(body, DegToRad(aRotation(2)), DegToRad(aRotation(1)), DegToRad(aRotation(3)));
};

// Add torque in relative coordinates from the center of the object
void odeObject::AddTorqueRel(const ANGLE3D &aRotation) {
  if (!IsCreated()) return;

  Unfreeze();

  dBodyAddRelTorque(body, DegToRad(aRotation(2)), DegToRad(aRotation(1)), DegToRad(aRotation(3)));
};

// Manually update gravitational force using custom gravity direction with acceleration speed
// If center point deviates from [0, 0, 0], it applies force at that point relative to the center of the object
void odeObject::UpdateGravity(BOOL bManual, const FLOAT3D &vManualGravityAcc, const FLOAT3D &vCenter) {
  if (!IsCreated()) return;

  // Reenable ODE gravity
  if (!bManual) {
    if (!dBodyGetGravityMode(body)) dBodySetGravityMode(body, 1);
    return;
  }

  // Disable ODE gravity
  if (dBodyGetGravityMode(body)) dBodySetGravityMode(body, 0);

  // Get current world gravity
  dVector3 vWorldGravity;
  dWorldGetGravity(_pODE->world, vWorldGravity);

  const dReal fWorldGravityLen = sqrt(
      vWorldGravity[0] * vWorldGravity[0]
    + vWorldGravity[1] * vWorldGravity[1]
    + vWorldGravity[2] * vWorldGravity[2]
  );

  // Add manual gravity force
  const dReal fGravityForceMul = fWorldGravityLen * mass.mass * ODE_GetSimIterations();
  const odeVector vGravity = odeVector(vManualGravityAcc(1), vManualGravityAcc(2), vManualGravityAcc(3)) * fGravityForceMul;

  // [Cecil] TODO: Perhaps it would be more wise to fork ODE and implement gravity vectors per body like it's already
  // done with a number of other variables that take their values from the world by default. Should be extremely easy.
  if (vCenter != FLOAT3D(0, 0, 0)) {
    dBodyAddForceAtRelPos(body, vGravity(1), vGravity(2), vGravity(3), vCenter(1), vCenter(2), vCenter(3));
  } else {
    dBodyAddForce(body, vGravity(1), vGravity(2), vGravity(3));
  }
};

// Get direction vector of the current gravity
FLOAT3D odeObject::GetGravity(void) const {
  if (!IsCreated()) return FLOAT3D(0, 0, 0);

  // World gravity
  if (dBodyGetGravityMode(body)) {
    dVector3 vWorldGravity;
    dWorldGetGravity(_pODE->world, vWorldGravity);

    const dReal fWorldGravityLen = sqrt(
        vWorldGravity[0] * vWorldGravity[0]
      + vWorldGravity[1] * vWorldGravity[1]
      + vWorldGravity[2] * vWorldGravity[2]
    );

    if (fWorldGravityLen <= 0.001) {
      return FLOAT3D(0, 0, 0);
    }

    return FLOAT3D(vWorldGravity[0], vWorldGravity[1], vWorldGravity[2]) / fWorldGravityLen;
  }

  // Entity gravity
  CMovableEntity *pen = (CMovableEntity *)nPhysOwner.GetOwner();
  ASSERT(pen != NULL);

  return pen->en_vGravityDir;
};

// Absolute movement speed
void odeObject::SetCurrentTranslation(const FLOAT3D &vSpeed) {
  if (!IsCreated()) return;

  Unfreeze();

  dBodySetLinearVel(body, vSpeed(1), vSpeed(2), vSpeed(3));
};

FLOAT3D odeObject::GetCurrentTranslation(void) const {
  if (!IsCreated()) return FLOAT3D(0, 0, 0);

  const dReal *vSpeed = dBodyGetLinearVel(body);
  return FLOAT3D(vSpeed[0], vSpeed[1], vSpeed[2]);
};

// Absolute rotation speed
void odeObject::SetCurrentRotation(const ANGLE3D &aRotation) {
  if (!IsCreated()) return;

  Unfreeze();

  // Instead of HPB angles it's using axes to rotate around:
  // X - pitch; Y - heading; Z - banking
  dBodySetAngularVel(body, DegToRad(aRotation(2)), DegToRad(aRotation(1)), DegToRad(aRotation(3)));
};

ANGLE3D odeObject::GetCurrentRotation(void) const {
  if (!IsCreated()) return ANGLE3D(0, 0, 0);

  // Heading - Y; pitch - X; banking - Z
  const dReal *vRotation = dBodyGetAngularVel(body);
  return ANGLE3D(RadToDeg(vRotation[1]), RadToDeg(vRotation[0]), RadToDeg(vRotation[2]));
};

// Toggle whether the body is affected by physics engine's gravity
void odeObject::SetGravity(BOOL bState) {
  if (!IsCreated()) return;

  dBodySetGravityMode(body, bState);
};

// Limit maximum rotation speed (from 0 to dInfinity)
void odeObject::SetMaxRotationSpeed(FLOAT fMaxSpeed) {
  if (!IsCreated()) return;

  dBodySetMaxAngularSpeed(body, fMaxSpeed);
};

// Stop moving
void odeObject::ResetSpeed(void) {
  if (!IsCreated()) return;

  dBodySetLinearVel(body, 0, 0, 0);
  dBodySetAngularVel(body, 0, 0, 0);
};

// Toggle auto-disabling optimization
void odeObject::SetAutoDisable(BOOL bState) {
  if (!IsCreated()) return;

  dBodySetAutoDisableFlag(body, bState);
};

// Check if the body is using auto-disabling optimizations
BOOL odeObject::IsAutoDisabled(void) const {
  // Geoms without bodies don't move
  if (!IsCreated()) {
    ASSERTALWAYS("Checking whether a body is auto-disabled without an actual body!");
    return FALSE;
  }

  return dBodyGetAutoDisableFlag(body);
};

// Toggle between kinematic and dynamic bodies
void odeObject::SetKinematic(BOOL bState) {
  if (!IsCreated()) return;

  if (bState) {
    dBodySetKinematic(body);
  } else {
    dBodySetDynamic(body);
  }
};

// Check if the body is kinematic
BOOL odeObject::IsKinematic(void) const {
  // Geoms without bodies don't move, so they can be considered kinematic
  if (!IsCreated()) {
    ASSERTALWAYS("Checking whether a body is kinematic without an actual body!");
    return TRUE;
  }

  return dBodyIsKinematic(body);
};

// Disable object physics
void odeObject::Freeze(BOOL bForce) {
  if (!IsCreated() || (IsFrozen() && !bForce)) return;

  dBodyDisable(body);
};

// Reenable object physics
void odeObject::Unfreeze(BOOL bForce) {
  if (!IsCreated() || (!IsFrozen() && !bForce)) return;

  dBodyEnable(body);
};

// Check if object physics are disabled
BOOL odeObject::IsFrozen(void) const {
  if (!IsCreated()) return TRUE;

  return !dBodyIsEnabled(body);
};
